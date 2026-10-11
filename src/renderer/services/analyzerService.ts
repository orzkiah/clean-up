import { StorageAnalysisResult } from '../../shared/types';

export class AnalyzerService {
  public async getAnalysis(forceRefresh = false): Promise<StorageAnalysisResult> {
    if (!window.cleanUpApi) {
      throw new Error('Desktop IPC bridge unavailable');
    }
    const res = await window.cleanUpApi.getStorageAnalysis(forceRefresh);
    if (!res.success || !res.data) {
      throw new Error(res.error || 'Failed to analyze storage');
    }
    return res.data;
  }
}

export const analyzerService = new AnalyzerService();
