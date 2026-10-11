import { DiskInfo, StorageOverview } from '../models/storage';

export interface StorageServiceState {
  overview: StorageOverview | null;
  isLoading: boolean;
  error: string | null;
}

export class StorageService {
  /**
   * Fetch current storage overview across all detected drives
   */
  public async getStorageOverview(): Promise<StorageOverview> {
    if (!window.cleanUpApi) {
      throw new Error(
        'Windows CleanUp Desktop API is not available. Please ensure the app is running in the desktop container.'
      );
    }

    const response = await window.cleanUpApi.getStorageOverview();
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to detect Windows storage drives');
    }

    return response.data;
  }

  /**
   * Refresh drive storage metrics directly from the Windows OS
   */
  public async refreshStorage(): Promise<StorageOverview> {
    if (!window.cleanUpApi) {
      throw new Error('Windows CleanUp Desktop API is not available.');
    }

    const response = await window.cleanUpApi.refreshStorage();
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to refresh storage information');
    }

    return response.data;
  }

  /**
   * Fetch details for a specific drive letter
   */
  public async getDriveDetails(driveId: string): Promise<DiskInfo> {
    if (!window.cleanUpApi) {
      throw new Error('Windows CleanUp Desktop API is not available.');
    }

    const response = await window.cleanUpApi.getDriveDetails(driveId);
    if (!response.success || !response.data) {
      throw new Error(response.error || `Could not inspect drive ${driveId}`);
    }

    return response.data;
  }
}

export const storageService = new StorageService();
