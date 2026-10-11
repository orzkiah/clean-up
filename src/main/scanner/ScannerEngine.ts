import * as crypto from 'crypto';
import {
  ScanResult,
  ScanProgress,
  ScanItem,
  ScanCategoryId,
  CategorySummary,
  ScanFilterOptions,
} from '../../shared/types';
import { ScannerRegistry } from './ScannerRegistry';
import { SafetyPolicy, defaultSafetyPolicy } from './safety/SafetyPolicy';

export interface ProgressEmitter {
  (progress: ScanProgress): void;
}

export class ScannerEngine {
  private registry: ScannerRegistry;
  private safetyPolicy: SafetyPolicy;

  constructor(registry?: ScannerRegistry, safetyPolicy?: SafetyPolicy) {
    this.safetyPolicy = safetyPolicy || defaultSafetyPolicy;
    this.registry = registry || new ScannerRegistry(this.safetyPolicy);
  }

  public async executeScan(
    options: ScanFilterOptions | undefined,
    signal: AbortSignal,
    emitProgress: ProgressEmitter
  ): Promise<ScanResult> {
    const scanId = crypto.randomUUID();
    const startedAt = new Date().toISOString();
    const scanners = this.registry.getAllScanners();

    let totalFilesScanned = 0;
    let totalFoldersScanned = 0;
    let totalBytesFound = 0;
    let categoriesCompleted = 0;
    const warnings: string[] = [];

    const itemsByCategory: Record<ScanCategoryId, ScanItem[]> = {
      user_temp: [],
      windows_temp: [],
      browser_cache: [],
      recycle_bin: [],
      large_files: [],
      old_files: [],
    };

    const categories: Record<ScanCategoryId, CategorySummary> = {
      user_temp: {
        categoryId: 'user_temp',
        title: 'User Temporary Files',
        description: 'App caches, temporary installers, and discarded scratch files.',
        riskLevel: 'SAFE_TO_CLEAN',
        itemCount: 0,
        totalBytes: 0,
        isRecoverable: true,
      },
      windows_temp: {
        categoryId: 'windows_temp',
        title: 'Windows System Temp',
        description: 'OS temporary installation caches and log dumps.',
        riskLevel: 'SAFE_TO_CLEAN',
        itemCount: 0,
        totalBytes: 0,
        isRecoverable: true,
      },
      browser_cache: {
        categoryId: 'browser_cache',
        title: 'Browser Cache',
        description: 'Cached web images, media, and scripts from Chrome and Edge.',
        riskLevel: 'SAFE_TO_CLEAN',
        itemCount: 0,
        totalBytes: 0,
        isRecoverable: true,
      },
      recycle_bin: {
        categoryId: 'recycle_bin',
        title: 'Recycle Bin',
        description: 'Deleted items awaiting permanent removal.',
        riskLevel: 'SAFE_TO_CLEAN',
        itemCount: 0,
        totalBytes: 0,
        isRecoverable: true,
      },
      large_files: {
        categoryId: 'large_files',
        title: 'Large Files',
        description: 'Files >= 500 MB located in user personal directories.',
        riskLevel: 'REVIEW_REQUIRED',
        itemCount: 0,
        totalBytes: 0,
        isRecoverable: false,
      },
      old_files: {
        categoryId: 'old_files',
        title: 'Old Files',
        description: 'Personal files untouched for 180+ days.',
        riskLevel: 'REVIEW_REQUIRED',
        itemCount: 0,
        totalBytes: 0,
        isRecoverable: false,
      },
    };

    // Progress throttling
    let lastProgressEmit = 0;
    let currentScannerTitle = 'Initializing';
    let currentPathDisplay = '';

    const sendThrottledProgress = (force = false) => {
      const now = Date.now();
      if (force || now - lastProgressEmit > 80) {
        lastProgressEmit = now;
        emitProgress({
          status: signal.aborted ? 'cancelling' : 'scanning',
          currentScanner: currentScannerTitle,
          currentPath: currentPathDisplay,
          filesScanned: totalFilesScanned,
          foldersScanned: totalFoldersScanned,
          bytesDiscovered: totalBytesFound,
          categoriesCompleted,
          totalCategories: scanners.length,
        });
      }
    };

    sendThrottledProgress(true);

    for (const scanner of scanners) {
      if (signal.aborted) break;

      currentScannerTitle = scanner.title;
      currentPathDisplay = scanner.description;
      sendThrottledProgress(true);

      try {
        const items = await scanner.scan({
          signal,
          options,
          safetyPolicy: this.safetyPolicy,
          onProgress: (update) => {
            currentPathDisplay = update.currentPath;
            if (update.filesScannedDelta) totalFilesScanned += update.filesScannedDelta;
            if (update.foldersScannedDelta) totalFoldersScanned += update.foldersScannedDelta;
            if (update.bytesDiscoveredDelta) totalBytesFound += update.bytesDiscoveredDelta;
            sendThrottledProgress();
          },
        });

        itemsByCategory[scanner.categoryId] = items;
        const catBytes = items.reduce((acc, it) => acc + it.sizeBytes, 0);

        categories[scanner.categoryId].itemCount = items.length;
        categories[scanner.categoryId].totalBytes = catBytes;
      } catch (err: any) {
        warnings.push(`Scanner [${scanner.title}] encountered an issue: ${err?.message || err}`);
      }

      categoriesCompleted++;
      sendThrottledProgress(true);
    }

    const completedAt = new Date().toISOString();
    const finalStatus = signal.aborted ? 'cancelled' : 'completed';

    // Calculate recoverable bytes: ONLY from SAFE_TO_CLEAN categories
    const recoverableBytes = Object.values(categories)
      .filter((cat) => cat.isRecoverable)
      .reduce((acc, cat) => acc + cat.totalBytes, 0);

    const result: ScanResult = {
      scanId,
      startedAt,
      completedAt,
      status: finalStatus,
      totalFilesScanned,
      totalFoldersScanned,
      totalBytesFound,
      recoverableBytes,
      categories,
      itemsByCategory,
      warnings,
    };

    emitProgress({
      status: finalStatus,
      currentScanner: finalStatus === 'cancelled' ? 'Scan Cancelled' : 'Scan Completed',
      currentPath: '',
      filesScanned: totalFilesScanned,
      foldersScanned: totalFoldersScanned,
      bytesDiscovered: totalBytesFound,
      categoriesCompleted,
      totalCategories: scanners.length,
    });

    return result;
  }
}
