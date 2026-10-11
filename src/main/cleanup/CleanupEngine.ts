import * as fs from 'fs';
import * as crypto from 'crypto';
import {
  ScanItem,
  CleanupResult,
  CleanupProgress,
  ItemCleanupResult,
} from '../../shared/types';
import { CleanupValidator, defaultCleanupValidator } from './CleanupValidator';
import { RecycleBinCleaner } from './RecycleBinCleaner';

export interface CleanupProgressEmitter {
  (progress: CleanupProgress): void;
}

export class CleanupEngine {
  private validator: CleanupValidator;

  constructor(validator?: CleanupValidator) {
    this.validator = validator || defaultCleanupValidator;
  }

  public async execute(
    planId: string,
    itemsToClean: ScanItem[],
    signal: AbortSignal,
    emitProgress: CleanupProgressEmitter
  ): Promise<CleanupResult> {
    const cleanupId = crypto.randomUUID();
    const startedAt = new Date().toISOString();

    let deletedItems = 0;
    let skippedItems = 0;
    let failedItems = 0;
    let bytesFreed = 0;
    let bytesSkipped = 0;
    let bytesFailed = 0;

    const categoriesFreed: Record<string, { count: number; bytes: number }> = {};
    const itemResults: ItemCleanupResult[] = [];

    const totalCount = itemsToClean.length;

    let lastProgressEmit = 0;
    const sendThrottledProgress = (currentIndex: number, currentItemName: string, force = false) => {
      const now = Date.now();
      if (force || now - lastProgressEmit > 80) {
        lastProgressEmit = now;
        emitProgress({
          status: signal.aborted ? 'cancelled' : 'cleaning',
          currentIndex,
          totalItems: totalCount,
          bytesFreed,
          skippedCount: skippedItems,
          currentItemName,
        });
      }
    };

    sendThrottledProgress(0, 'Initializing cleanup...', true);

    for (let i = 0; i < itemsToClean.length; i++) {
      if (signal.aborted) break;

      const item = itemsToClean[i];
      sendThrottledProgress(i + 1, item.name);

      // Handle Recycle Bin special case
      if (item.category === 'recycle_bin') {
        const binRes = await RecycleBinCleaner.emptyRecycleBin();
        if (binRes.success) {
          deletedItems++;
          bytesFreed += item.sizeBytes;
          itemResults.push({
            itemId: item.id,
            name: item.name,
            category: item.category,
            sizeBytes: item.sizeBytes,
            status: 'deleted',
            reason: 'Recycle Bin emptied successfully',
          });

          categoriesFreed['recycle_bin'] = categoriesFreed['recycle_bin'] || { count: 0, bytes: 0 };
          categoriesFreed['recycle_bin'].count += 1;
          categoriesFreed['recycle_bin'].bytes += item.sizeBytes;
        } else {
          failedItems++;
          bytesFailed += item.sizeBytes;
          itemResults.push({
            itemId: item.id,
            name: item.name,
            category: item.category,
            sizeBytes: item.sizeBytes,
            status: 'failed',
            reason: binRes.error || 'Failed to empty Recycle Bin',
          });
        }
        continue;
      }

      // File item: Pre-deletion safety validation
      const preValidation = this.validator.validateImmediatelyBeforeDeletion(
        item.fullPath,
        item.sizeBytes,
        item.category
      );

      if (!preValidation.canDelete) {
        skippedItems++;
        bytesSkipped += item.sizeBytes;
        itemResults.push({
          itemId: item.id,
          name: item.name,
          category: item.category,
          sizeBytes: item.sizeBytes,
          status: 'skipped',
          reason: preValidation.skipReason || 'Pre-deletion validation failed',
        });
        continue;
      }

      // Perform actual deletion with locked file error handling
      try {
        await fs.promises.unlink(item.fullPath);

        deletedItems++;
        bytesFreed += item.sizeBytes;
        itemResults.push({
          itemId: item.id,
          name: item.name,
          category: item.category,
          sizeBytes: item.sizeBytes,
          status: 'deleted',
          reason: 'Removed successfully',
        });

        categoriesFreed[item.category] = categoriesFreed[item.category] || { count: 0, bytes: 0 };
        categoriesFreed[item.category].count += 1;
        categoriesFreed[item.category].bytes += item.sizeBytes;
      } catch (err: any) {
        // Locked files (EBUSY, EPERM, EACCES) or already deleted files (ENOENT)
        const code = err?.code || '';
        if (code === 'EBUSY' || code === 'EPERM' || code === 'EACCES') {
          skippedItems++;
          bytesSkipped += item.sizeBytes;
          itemResults.push({
            itemId: item.id,
            name: item.name,
            category: item.category,
            sizeBytes: item.sizeBytes,
            status: 'skipped',
            reason: 'Skipped — currently in use',
          });
        } else if (code === 'ENOENT') {
          skippedItems++;
          bytesSkipped += item.sizeBytes;
          itemResults.push({
            itemId: item.id,
            name: item.name,
            category: item.category,
            sizeBytes: item.sizeBytes,
            status: 'skipped',
            reason: 'File already removed',
          });
        } else {
          failedItems++;
          bytesFailed += item.sizeBytes;
          itemResults.push({
            itemId: item.id,
            name: item.name,
            category: item.category,
            sizeBytes: item.sizeBytes,
            status: 'failed',
            reason: err?.message || 'Deletion error',
          });
        }
      }
    }

    const completedAt = new Date().toISOString();
    let finalStatus: CleanupResult['status'] = 'completed';
    if (signal.aborted) {
      finalStatus = 'cancelled';
    } else if (failedItems > 0 && deletedItems === 0) {
      finalStatus = 'failed';
    } else if (skippedItems > 0) {
      finalStatus = 'completed_with_skips';
    }

    sendThrottledProgress(totalCount, 'Cleanup complete', true);

    return {
      cleanupId,
      startedAt,
      completedAt,
      status: finalStatus,
      requestedItems: totalCount,
      deletedItems,
      skippedItems,
      failedItems,
      bytesFreed,
      bytesSkipped,
      bytesFailed,
      categoriesFreed,
      itemResults,
    };
  }
}

export const defaultCleanupEngine = new CleanupEngine();
