import { contextBridge, ipcRenderer } from 'electron';
import {
  StorageApi,
  ScanFilterOptions,
  ScanProgress,
  CleanupProgress,
  CleanupPlan,
  CleanupResult,
  HistoryRecord,
} from '../shared/types';

const api: StorageApi = {
  getStorageOverview: () => ipcRenderer.invoke('storage:getOverview'),
  getDriveDetails: (driveId: string) => ipcRenderer.invoke('storage:getDriveDetails', driveId),
  refreshStorage: () => ipcRenderer.invoke('storage:getOverview'),
  getAppVersion: () => ipcRenderer.invoke('app:getVersion'),

  startStorageScan: (options?: ScanFilterOptions) => ipcRenderer.invoke('scanner:startScan', options),
  cancelStorageScan: () => ipcRenderer.invoke('scanner:cancelScan'),
  getScanResults: () => ipcRenderer.invoke('scanner:getResults'),
  openItemLocation: (itemId: string) => ipcRenderer.invoke('scanner:openLocation', itemId),

  onScanProgress: (callback: (progress: ScanProgress) => void) => {
    const listener = (_event: any, progress: ScanProgress) => callback(progress);
    ipcRenderer.on('scanner:progress', listener);
    return () => {
      ipcRenderer.removeListener('scanner:progress', listener);
    };
  },

  // Cleanup APIs
  prepareCleanupPlan: (itemIds: string[]) => ipcRenderer.invoke('cleanup:preparePlan', itemIds),
  executeCleanup: (planId: string) => ipcRenderer.invoke('cleanup:execute', planId),
  cancelCleanup: () => ipcRenderer.invoke('cleanup:cancel'),

  onCleanupProgress: (callback: (progress: CleanupProgress) => void) => {
    const listener = (_event: any, progress: CleanupProgress) => callback(progress);
    ipcRenderer.on('cleanup:progress', listener);
    return () => {
      ipcRenderer.removeListener('cleanup:progress', listener);
    };
  },

  // History APIs
  getCleanupHistory: () => ipcRenderer.invoke('history:get'),
  clearCleanupHistory: () => ipcRenderer.invoke('history:clear'),

  // Duplicate APIs
  startDuplicateScan: () => ipcRenderer.invoke('duplicates:startScan'),
  cancelDuplicateScan: () => ipcRenderer.invoke('duplicates:cancelScan'),
  getDuplicateResults: () => ipcRenderer.invoke('duplicates:getResults'),
  onDuplicateProgress: (callback: (progress: any) => void) => {
    const listener = (_event: any, progress: any) => callback(progress);
    ipcRenderer.on('duplicates:progress', listener);
    return () => {
      ipcRenderer.removeListener('duplicates:progress', listener);
    };
  },
  prepareDuplicateResolution: (actions: any[]) => ipcRenderer.invoke('duplicates:prepareResolution', actions),
  executeDuplicateResolution: (planId: string) => ipcRenderer.invoke('duplicates:executeResolution', planId),
  getHashCacheStats: () => ipcRenderer.invoke('duplicates:getCacheStats'),
  clearHashCache: () => ipcRenderer.invoke('duplicates:clearCache'),

  // Storage Analyzer APIs
  getStorageAnalysis: (forceRefresh?: boolean) => ipcRenderer.invoke('storage:getAnalysis', forceRefresh),
};

try {
  contextBridge.exposeInMainWorld('cleanUpApi', api);
} catch (error) {
  console.error('Failed to expose cleanUpApi in preload:', error);
}
