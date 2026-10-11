import { shell } from 'electron';
import {
  DuplicateScanResult,
  DuplicateFileItem,
  DuplicateScanProgress,
  DuplicateActionItem,
  DuplicateResolutionPlan,
  DuplicateResolutionResult,
  HashCacheStats,
} from '../../shared/types';
import { DuplicateScanner, defaultDuplicateScanner, DuplicateProgressEmitter } from './DuplicateScanner';
import { DuplicateResolver, defaultDuplicateResolver } from './resolver/DuplicateResolver';
import { HashCacheDatabase, defaultHashCache } from './cache/HashCacheDatabase';

export class DuplicateController {
  private scanner: DuplicateScanner;
  private resolver: DuplicateResolver;
  private hashCache: HashCacheDatabase;
  private currentAbortController: AbortController | null = null;
  private latestResult: DuplicateScanResult | null = null;
  private itemMap = new Map<string, DuplicateFileItem>();
  private isScanning = false;

  constructor(
    scanner?: DuplicateScanner,
    resolver?: DuplicateResolver,
    hashCache?: HashCacheDatabase
  ) {
    this.scanner = scanner || defaultDuplicateScanner;
    this.resolver = resolver || defaultDuplicateResolver;
    this.hashCache = hashCache || defaultHashCache;
  }

  public async startScan(
    emitProgress: DuplicateProgressEmitter,
    customRoots?: string[]
  ): Promise<{ scanId: string }> {
    if (this.isScanning && this.currentAbortController) {
      this.currentAbortController.abort();
    }

    this.isScanning = true;
    this.currentAbortController = new AbortController();
    const signal = this.currentAbortController.signal;

    // Run asynchronously
    this.scanner
      .executeScan(signal, emitProgress, customRoots)
      .then((result) => {
        this.latestResult = result;
        this.itemMap.clear();

        // Index duplicate file items for secure location opening
        for (const group of result.groups) {
          for (const file of group.files) {
            this.itemMap.set(file.itemId, file);
          }
        }
      })
      .catch((err) => {
        console.error('Duplicate scan error:', err);
      })
      .finally(() => {
        this.isScanning = false;
        this.currentAbortController = null;
      });

    return { scanId: 'active-duplicate-scan' };
  }

  public cancelScan(): { cancelled: boolean } {
    if (this.currentAbortController && this.isScanning) {
      this.currentAbortController.abort();
      this.isScanning = false;
      return { cancelled: true };
    }
    return { cancelled: false };
  }

  public getLatestResult(): DuplicateScanResult | null {
    return this.latestResult;
  }

  public openItemLocation(itemId: string): { opened: boolean } {
    if (!itemId) {
      throw new Error('Invalid item ID');
    }

    const item = this.itemMap.get(itemId);
    if (!item) {
      throw new Error('Item ID not found in duplicate scan session');
    }

    shell.showItemInFolder(item.fullPath);
    return { opened: true };
  }

  /**
   * Prepares a duplicate resolution plan with full 15-point safety validation.
   */
  public async prepareResolution(actions: DuplicateActionItem[]): Promise<DuplicateResolutionPlan> {
    const allowedRoots = this.scanner.getScanRoots();
    return await this.resolver.preparePlan(this.latestResult, actions, allowedRoots);
  }

  /**
   * Executes the resolution plan, safely trashing files to the Windows Recycle Bin.
   */
  public async executeResolution(planId: string): Promise<DuplicateResolutionResult> {
    const result = await this.resolver.executePlan(planId);

    // Update in-memory latestResult to remove trashed items
    if (this.latestResult && result.movedCount > 0) {
      const movedItemIds = new Set(
        result.items.filter((i) => i.status === 'moved_to_trash').map((i) => i.itemId)
      );

      const updatedGroups = [];
      let totalDuplicateFiles = 0;
      let totalReclaimableBytes = 0;

      for (const group of this.latestResult.groups) {
        const remainingFiles = group.files.filter((f) => !movedItemIds.has(f.itemId));
        if (remainingFiles.length > 1) {
          const potentiallyReclaimableBytes = group.sizeBytes * (remainingFiles.length - 1);
          updatedGroups.push({
            ...group,
            files: remainingFiles,
            duplicateCount: remainingFiles.length,
            potentiallyReclaimableBytes,
          });
          totalDuplicateFiles += remainingFiles.length;
          totalReclaimableBytes += potentiallyReclaimableBytes;
        }
      }

      this.latestResult = {
        ...this.latestResult,
        groups: updatedGroups,
        groupsCount: updatedGroups.length,
        duplicateFilesCount: totalDuplicateFiles,
        totalReclaimableBytes,
      };

      // Refresh itemMap
      this.itemMap.clear();
      for (const group of updatedGroups) {
        for (const file of group.files) {
          this.itemMap.set(file.itemId, file);
        }
      }
    }

    return result;
  }

  public getHashCacheStats(): HashCacheStats {
    return this.hashCache.getStats();
  }

  public clearHashCache(): { cleared: boolean } {
    this.hashCache.clear();
    return { cleared: true };
  }
}

export const duplicateController = new DuplicateController();
