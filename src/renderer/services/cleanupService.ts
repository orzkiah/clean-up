import { CleanupPlan, CleanupResult, CleanupProgress } from '../../shared/types';

export class CleanupService {
  public async preparePlan(itemIds: string[]): Promise<CleanupPlan> {
    if (!window.cleanUpApi) {
      throw new Error('Desktop API unavailable');
    }
    const res = await window.cleanUpApi.prepareCleanupPlan(itemIds);
    if (!res.success || !res.data) {
      throw new Error(res.error || 'Failed to prepare cleanup plan');
    }
    return res.data;
  }

  public async executeCleanup(planId: string): Promise<CleanupResult> {
    if (!window.cleanUpApi) {
      throw new Error('Desktop API unavailable');
    }
    const res = await window.cleanUpApi.executeCleanup(planId);
    if (!res.success || !res.data) {
      throw new Error(res.error || 'Failed to execute cleanup');
    }
    return res.data;
  }

  public async cancelCleanup(): Promise<boolean> {
    if (!window.cleanUpApi) return false;
    const res = await window.cleanUpApi.cancelCleanup();
    return !!res.data?.cancelled;
  }

  public subscribeProgress(callback: (progress: CleanupProgress) => void): () => void {
    if (!window.cleanUpApi) return () => {};
    return window.cleanUpApi.onCleanupProgress(callback);
  }
}

export const cleanupService = new CleanupService();
