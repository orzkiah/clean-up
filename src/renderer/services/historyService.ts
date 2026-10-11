import { HistoryRecord } from '../../shared/types';

export class HistoryFrontendService {
  public async getHistory(): Promise<HistoryRecord[]> {
    if (!window.cleanUpApi) return [];
    const res = await window.cleanUpApi.getCleanupHistory();
    return res.data || [];
  }

  public async clearHistory(): Promise<boolean> {
    if (!window.cleanUpApi) return false;
    const res = await window.cleanUpApi.clearCleanupHistory();
    return !!res.data?.cleared;
  }
}

export const historyFrontendService = new HistoryFrontendService();
