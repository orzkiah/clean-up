import {
  DuplicateScanResult,
  DuplicateScanProgress,
  DuplicateActionItem,
  DuplicateResolutionPlan,
  DuplicateResolutionResult,
  HashCacheStats,
} from '../../shared/types';

export class DuplicateService {
  public async startScan(): Promise<string> {
    if (!window.cleanUpApi) {
      throw new Error('Desktop IPC bridge unavailable');
    }
    const res = await window.cleanUpApi.startDuplicateScan();
    if (!res.success || !res.data) {
      throw new Error(res.error || 'Failed to start duplicate scan');
    }
    return res.data.scanId;
  }

  public async cancelScan(): Promise<boolean> {
    if (!window.cleanUpApi) return false;
    const res = await window.cleanUpApi.cancelDuplicateScan();
    return res.success ? !!res.data?.cancelled : false;
  }

  public async getResults(): Promise<DuplicateScanResult | null> {
    if (!window.cleanUpApi) return null;
    const res = await window.cleanUpApi.getDuplicateResults();
    if (!res.success) {
      throw new Error(res.error || 'Failed to retrieve duplicate results');
    }
    return res.data || null;
  }

  public subscribeProgress(callback: (progress: DuplicateScanProgress) => void): () => void {
    if (!window.cleanUpApi) return () => {};
    return window.cleanUpApi.onDuplicateProgress(callback);
  }

  public async prepareResolution(actions: DuplicateActionItem[]): Promise<DuplicateResolutionPlan> {
    if (!window.cleanUpApi) {
      throw new Error('Desktop IPC bridge unavailable');
    }
    const res = await window.cleanUpApi.prepareDuplicateResolution(actions);
    if (!res.success || !res.data) {
      throw new Error(res.error || 'Failed to prepare duplicate resolution plan');
    }
    return res.data;
  }

  public async executeResolution(planId: string): Promise<DuplicateResolutionResult> {
    if (!window.cleanUpApi) {
      throw new Error('Desktop IPC bridge unavailable');
    }
    const res = await window.cleanUpApi.executeDuplicateResolution(planId);
    if (!res.success || !res.data) {
      throw new Error(res.error || 'Failed to execute duplicate resolution');
    }
    return res.data;
  }

  public async getCacheStats(): Promise<HashCacheStats | null> {
    if (!window.cleanUpApi) return null;
    const res = await window.cleanUpApi.getHashCacheStats();
    return res.success && res.data ? res.data : null;
  }

  public async clearCache(): Promise<boolean> {
    if (!window.cleanUpApi) return false;
    const res = await window.cleanUpApi.clearHashCache();
    return res.success ? !!res.data?.cleared : false;
  }
}

export const duplicateService = new DuplicateService();
