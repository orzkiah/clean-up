import * as crypto from 'crypto';
import {
  CleanupPlan,
  CleanupResult,
  ScanItem,
  ScanCategoryId,
  HistoryRecord,
} from '../../shared/types';
import { scanController } from '../scanner/ScanController';
import { CleanupValidator, defaultCleanupValidator } from './CleanupValidator';
import { CleanupEngine, defaultCleanupEngine, CleanupProgressEmitter } from './CleanupEngine';
import { HistoryService, defaultHistoryService } from './HistoryService';

interface StoredPlan {
  plan: CleanupPlan;
  items: ScanItem[];
}

export class CleanupController {
  private validator: CleanupValidator;
  private engine: CleanupEngine;
  private historyService: HistoryService;
  private activePlans = new Map<string, StoredPlan>();
  private currentAbortController: AbortController | null = null;
  private isCleaning = false;

  constructor(
    validator?: CleanupValidator,
    engine?: CleanupEngine,
    historyService?: HistoryService
  ) {
    this.validator = validator || defaultCleanupValidator;
    this.engine = engine || defaultCleanupEngine;
    this.historyService = historyService || defaultHistoryService;
  }

  /**
   * Prepares and validates an atomic cleanup plan from a list of item IDs.
   * Resolves items STRICTLY from the active scan session; arbitrary paths are rejected.
   */
  public preparePlan(itemIds: string[]): CleanupPlan {
    const scanResult = scanController.getLatestResult();
    if (!scanResult) {
      throw new Error('No active scan session available. Please perform a scan first.');
    }

    if (!Array.isArray(itemIds) || itemIds.length === 0) {
      throw new Error('No items selected for cleanup.');
    }

    // Index all scan items
    const scanItemsMap = new Map<string, ScanItem>();
    for (const catItems of Object.values(scanResult.itemsByCategory)) {
      for (const item of catItems) {
        scanItemsMap.set(item.id, item);
      }
    }

    const validatedItems: ScanItem[] = [];
    const categoriesMap: Record<ScanCategoryId, { count: number; totalBytes: number; title: string }> = {
      user_temp: { count: 0, totalBytes: 0, title: 'User Temporary Files' },
      windows_temp: { count: 0, totalBytes: 0, title: 'Windows System Temp' },
      browser_cache: { count: 0, totalBytes: 0, title: 'Browser Cache' },
      recycle_bin: { count: 0, totalBytes: 0, title: 'Recycle Bin' },
      large_files: { count: 0, totalBytes: 0, title: 'Large Files' },
      old_files: { count: 0, totalBytes: 0, title: 'Old Files' },
    };

    let totalBytes = 0;

    for (const id of itemIds) {
      const scanItem = scanItemsMap.get(id);
      if (!scanItem) continue;

      const validation = this.validator.validateItemForPlan(scanItem);
      if (validation.valid) {
        validatedItems.push(scanItem);
        totalBytes += scanItem.sizeBytes;

        const catData = categoriesMap[scanItem.category];
        if (catData) {
          catData.count += 1;
          catData.totalBytes += scanItem.sizeBytes;
        }
      }
    }

    if (validatedItems.length === 0) {
      throw new Error('No selected items passed safety validation for cleanup.');
    }

    const planId = crypto.randomUUID();
    const planCategories = Object.entries(categoriesMap)
      .filter(([_, data]) => data.count > 0)
      .map(([catId, data]) => ({
        category: catId as ScanCategoryId,
        title: data.title,
        count: data.count,
        totalBytes: data.totalBytes,
      }));

    const plan: CleanupPlan = {
      planId,
      scanId: scanResult.scanId,
      items: validatedItems.map((it) => ({
        itemId: it.id,
        name: it.name,
        category: it.category,
        sizeBytes: it.sizeBytes,
        riskLevel: it.riskLevel,
      })),
      totalBytes,
      categories: planCategories,
      createdAt: new Date().toISOString(),
    };

    this.activePlans.set(planId, { plan, items: validatedItems });
    return plan;
  }

  /**
   * Executes a confirmed cleanup plan.
   */
  public async executePlan(
    planId: string,
    emitProgress: CleanupProgressEmitter
  ): Promise<CleanupResult> {
    const stored = this.activePlans.get(planId);
    if (!stored) {
      throw new Error('Cleanup plan expired or invalid. Please review and confirm again.');
    }

    if (this.isCleaning && this.currentAbortController) {
      this.currentAbortController.abort();
    }

    this.isCleaning = true;
    this.currentAbortController = new AbortController();
    const signal = this.currentAbortController.signal;

    try {
      const result = await this.engine.execute(planId, stored.items, signal, emitProgress);

      // Record in persistent history
      this.historyService.recordCleanup(result);

      // Remove executed plan
      this.activePlans.delete(planId);

      return result;
    } finally {
      this.isCleaning = false;
      this.currentAbortController = null;
    }
  }

  public cancelCleanup(): { cancelled: boolean } {
    if (this.currentAbortController && this.isCleaning) {
      this.currentAbortController.abort();
      this.isCleaning = false;
      return { cancelled: true };
    }
    return { cancelled: false };
  }

  public getHistory(): HistoryRecord[] {
    return this.historyService.getHistory();
  }

  public clearHistory(): { cleared: boolean } {
    return { cleared: this.historyService.clearHistory() };
  }
}

export const cleanupController = new CleanupController();
