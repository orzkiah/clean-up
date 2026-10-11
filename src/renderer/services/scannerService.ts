import {
  ScanResult,
  ScanProgress,
  ScanFilterOptions,
} from '../../shared/types';

export class ScannerService {
  public async startScan(options?: ScanFilterOptions): Promise<string> {
    if (!window.cleanUpApi) {
      throw new Error('Desktop API unavailable');
    }
    const res = await window.cleanUpApi.startStorageScan(options);
    if (!res.success || !res.data) {
      throw new Error(res.error || 'Failed to start scan');
    }
    return res.data.scanId;
  }

  public async cancelScan(): Promise<boolean> {
    if (!window.cleanUpApi) return false;
    const res = await window.cleanUpApi.cancelStorageScan();
    return !!res.data?.cancelled;
  }

  public async getResults(): Promise<ScanResult | null> {
    if (!window.cleanUpApi) return null;
    const res = await window.cleanUpApi.getScanResults();
    return res.data || null;
  }

  public async openLocation(itemId: string): Promise<boolean> {
    if (!window.cleanUpApi) return false;
    const res = await window.cleanUpApi.openItemLocation(itemId);
    if (!res.success) {
      throw new Error(res.error || 'Failed to open location');
    }
    return !!res.data?.opened;
  }

  public subscribeProgress(callback: (progress: ScanProgress) => void): () => void {
    if (!window.cleanUpApi) return () => {};
    return window.cleanUpApi.onScanProgress(callback);
  }
}

export const scannerService = new ScannerService();
