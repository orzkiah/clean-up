import * as fs from 'fs';
import * as crypto from 'crypto';
import {
  DuplicateScanResult,
  DuplicateActionItem,
  DuplicateResolutionPlan,
  DuplicateResolutionResult,
  DuplicateTrashResultItem,
} from '../../../shared/types';
import {
  DuplicateResolutionValidator,
  defaultDuplicateResolutionValidator,
} from './DuplicateResolutionValidator';
import { DuplicateTrashService } from './DuplicateTrashService';
import { HashCacheDatabase, defaultHashCache } from '../cache/HashCacheDatabase';

export class DuplicateResolver {
  private validator: DuplicateResolutionValidator;
  private hashCache: HashCacheDatabase;
  private activePlans = new Map<string, DuplicateResolutionPlan>();

  constructor(
    validator?: DuplicateResolutionValidator,
    hashCache?: HashCacheDatabase
  ) {
    this.validator = validator || defaultDuplicateResolutionValidator;
    this.hashCache = hashCache || defaultHashCache;
  }

  /**
   * Prepares a duplicate resolution plan after running full 15-point validation.
   */
  public async preparePlan(
    scanResult: DuplicateScanResult | null,
    actions: DuplicateActionItem[],
    allowedRoots: string[]
  ): Promise<DuplicateResolutionPlan> {
    const validation = await this.validator.validateActions(scanResult, actions, allowedRoots);

    if (!validation.valid) {
      throw new Error(`Duplicate validation failed:\n- ${validation.errors.join('\n- ')}`);
    }

    if (validation.itemsToTrash.length === 0) {
      throw new Error('No files marked for removal in the resolution plan.');
    }

    const plan: DuplicateResolutionPlan = {
      planId: 'plan_' + crypto.randomUUID(),
      scanId: scanResult!.scanId,
      itemsToRemove: validation.itemsToTrash,
      totalBytesToReclaim: validation.reclaimableBytes,
      createdAt: new Date().toISOString(),
    };

    this.activePlans.set(plan.planId, plan);
    return plan;
  }

  /**
   * Returns an active plan by ID.
   */
  public getPlan(planId: string): DuplicateResolutionPlan | undefined {
    return this.activePlans.get(planId);
  }

  /**
   * Executes an approved resolution plan.
   * STRICT SAFETY: Only moves files to the Windows Recycle Bin.
   */
  public async executePlan(
    planId: string,
    signal?: AbortSignal
  ): Promise<DuplicateResolutionResult> {
    const plan = this.activePlans.get(planId);
    if (!plan) {
      throw new Error(`Resolution plan '${planId}' not found or already executed.`);
    }

    const resolutionId = 'res_' + crypto.randomUUID();
    const startedAt = new Date().toISOString();
    const items: DuplicateTrashResultItem[] = [];
    let movedCount = 0;
    let skippedCount = 0;
    let failedCount = 0;
    let bytesReclaimed = 0;

    for (const file of plan.itemsToRemove) {
      if (signal?.aborted) {
        items.push({
          itemId: file.itemId,
          name: file.name,
          fullPath: file.fullPath,
          sizeBytes: file.sizeBytes,
          status: 'skipped',
          reason: 'Resolution cancelled by user',
        });
        skippedCount++;
        continue;
      }

      // Check if file still exists before attempting trash
      if (!fs.existsSync(file.fullPath)) {
        items.push({
          itemId: file.itemId,
          name: file.name,
          fullPath: file.fullPath,
          sizeBytes: file.sizeBytes,
          status: 'skipped',
          reason: 'File not found on disk at execution time',
        });
        skippedCount++;
        continue;
      }

      // Perform safe Recycle Bin move
      const trashResult = await DuplicateTrashService.moveToRecycleBin(file.fullPath);

      if (trashResult.success) {
        // Confirm removal from original path
        if (!fs.existsSync(file.fullPath)) {
          movedCount++;
          bytesReclaimed += file.sizeBytes;
          this.hashCache.deleteEntry(file.fullPath);
          items.push({
            itemId: file.itemId,
            name: file.name,
            fullPath: file.fullPath,
            sizeBytes: file.sizeBytes,
            status: 'moved_to_trash',
            reason: 'Moved to Windows Recycle Bin',
          });
        } else {
          failedCount++;
          items.push({
            itemId: file.itemId,
            name: file.name,
            fullPath: file.fullPath,
            sizeBytes: file.sizeBytes,
            status: 'failed',
            reason: 'File still detected at path after Recycle Bin move',
          });
        }
      } else {
        failedCount++;
        items.push({
          itemId: file.itemId,
          name: file.name,
          fullPath: file.fullPath,
          sizeBytes: file.sizeBytes,
          status: 'failed',
          reason: trashResult.error || 'Failed to move to Recycle Bin',
        });
      }
    }

    // Remove executed plan from memory
    this.activePlans.delete(planId);

    const completedAt = new Date().toISOString();

    return {
      resolutionId,
      startedAt,
      completedAt,
      totalProcessed: plan.itemsToRemove.length,
      movedCount,
      skippedCount,
      failedCount,
      bytesReclaimed,
      items,
    };
  }
}

export const defaultDuplicateResolver = new DuplicateResolver();
