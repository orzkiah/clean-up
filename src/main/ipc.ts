import { ipcMain, app } from 'electron';
import { WindowsStorageService } from './services/windowsStorageService';
import { scanController } from './scanner/ScanController';
import {
  IpcResult,
  StorageOverview,
  DiskInfo,
  ScanResult,
  ScanFilterOptions,
} from '../shared/types';

export function registerIpcHandlers(): void {
  const storageService = new WindowsStorageService();

  // Storage Overview & Drive details
  ipcMain.handle('storage:getOverview', async (): Promise<IpcResult<StorageOverview>> => {
    try {
      const data = await storageService.getStorageOverview();
      return { success: true, data };
    } catch (err) {
      console.error('IPC error in storage:getOverview:', err);
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error reading storage drives',
      };
    }
  });

  ipcMain.handle('storage:getDriveDetails', async (_event, driveId: string): Promise<IpcResult<DiskInfo>> => {
    try {
      if (!driveId || typeof driveId !== 'string') {
        return { success: false, error: 'Invalid drive identifier' };
      }
      const data = await storageService.getDriveDetails(driveId);
      if (!data) {
        return { success: false, error: `Drive ${driveId} not found or unavailable` };
      }
      return { success: true, data };
    } catch (err) {
      console.error('IPC error in storage:getDriveDetails:', err);
      return {
        success: false,
        error: err instanceof Error ? err.message : `Failed to retrieve drive ${driveId}`,
      };
    }
  });

  ipcMain.handle('app:getVersion', async (): Promise<string> => {
    return app.getVersion();
  });

  // Scanner Endpoints
  ipcMain.handle(
    'scanner:startScan',
    async (event, options?: ScanFilterOptions): Promise<IpcResult<{ scanId: string }>> => {
      try {
        const result = await scanController.startScan(options, (progress) => {
          if (!event.sender.isDestroyed()) {
            event.sender.send('scanner:progress', progress);
          }
        });
        return { success: true, data: result };
      } catch (err: any) {
        console.error('IPC error in scanner:startScan:', err);
        return { success: false, error: err?.message || 'Failed to initialize scanner' };
      }
    }
  );

  ipcMain.handle('scanner:cancelScan', async (): Promise<IpcResult<{ cancelled: boolean }>> => {
    try {
      const result = scanController.cancelScan();
      return { success: true, data: result };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to cancel scanner' };
    }
  });

  ipcMain.handle('scanner:getResults', async (): Promise<IpcResult<ScanResult | null>> => {
    try {
      const result = scanController.getLatestResult();
      return { success: true, data: result };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to retrieve scan results' };
    }
  });

  ipcMain.handle('scanner:openLocation', async (_event, itemId: string): Promise<IpcResult<{ opened: boolean }>> => {
    try {
      const result = scanController.openItemLocation(itemId);
      return { success: true, data: result };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Could not open item location' };
    }
  });

  // Cleanup Endpoints
  ipcMain.handle(
    'cleanup:preparePlan',
    async (_event, itemIds: string[]): Promise<IpcResult<any>> => {
      try {
        const { cleanupController } = await import('./cleanup/CleanupController');
        const plan = cleanupController.preparePlan(itemIds);
        return { success: true, data: plan };
      } catch (err: any) {
        return { success: false, error: err?.message || 'Failed to prepare cleanup plan' };
      }
    }
  );

  ipcMain.handle(
    'cleanup:execute',
    async (event, planId: string): Promise<IpcResult<any>> => {
      try {
        const { cleanupController } = await import('./cleanup/CleanupController');
        const result = await cleanupController.executePlan(planId, (progress) => {
          if (!event.sender.isDestroyed()) {
            event.sender.send('cleanup:progress', progress);
          }
        });
        return { success: true, data: result };
      } catch (err: any) {
        return { success: false, error: err?.message || 'Cleanup execution failed' };
      }
    }
  );

  ipcMain.handle('cleanup:cancel', async (): Promise<IpcResult<{ cancelled: boolean }>> => {
    try {
      const { cleanupController } = await import('./cleanup/CleanupController');
      const res = cleanupController.cancelCleanup();
      return { success: true, data: res };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to cancel cleanup' };
    }
  });

  // History Endpoints
  ipcMain.handle('history:get', async (): Promise<IpcResult<any>> => {
    try {
      const { cleanupController } = await import('./cleanup/CleanupController');
      const history = cleanupController.getHistory();
      return { success: true, data: history };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to fetch history' };
    }
  });

  ipcMain.handle('history:clear', async (): Promise<IpcResult<{ cleared: boolean }>> => {
    try {
      const { cleanupController } = await import('./cleanup/CleanupController');
      const res = cleanupController.clearHistory();
      return { success: true, data: res };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to clear history' };
    }
  });

  // Duplicate Finder Endpoints
  ipcMain.handle('duplicates:startScan', async (event): Promise<IpcResult<{ scanId: string }>> => {
    try {
      const { duplicateController } = await import('./duplicates/DuplicateController');
      const res = await duplicateController.startScan((progress) => {
        if (!event.sender.isDestroyed()) {
          event.sender.send('duplicates:progress', progress);
        }
      });
      return { success: true, data: res };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to start duplicate scan' };
    }
  });

  ipcMain.handle('duplicates:cancelScan', async (): Promise<IpcResult<{ cancelled: boolean }>> => {
    try {
      const { duplicateController } = await import('./duplicates/DuplicateController');
      const res = duplicateController.cancelScan();
      return { success: true, data: res };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to cancel duplicate scan' };
    }
  });

  ipcMain.handle('duplicates:getResults', async (): Promise<IpcResult<any>> => {
    try {
      const { duplicateController } = await import('./duplicates/DuplicateController');
      const results = duplicateController.getLatestResult();
      return { success: true, data: results };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to get duplicate results' };
    }
  });

  ipcMain.handle(
    'duplicates:prepareResolution',
    async (_event, actions: any[]): Promise<IpcResult<any>> => {
      try {
        const { duplicateController } = await import('./duplicates/DuplicateController');
        const plan = await duplicateController.prepareResolution(actions);
        return { success: true, data: plan };
      } catch (err: any) {
        return { success: false, error: err?.message || 'Failed to prepare duplicate resolution plan' };
      }
    }
  );

  ipcMain.handle(
    'duplicates:executeResolution',
    async (_event, planId: string): Promise<IpcResult<any>> => {
      try {
        const { duplicateController } = await import('./duplicates/DuplicateController');
        const result = await duplicateController.executeResolution(planId);
        return { success: true, data: result };
      } catch (err: any) {
        return { success: false, error: err?.message || 'Failed to execute duplicate resolution' };
      }
    }
  );

  ipcMain.handle('duplicates:getCacheStats', async (): Promise<IpcResult<any>> => {
    try {
      const { duplicateController } = await import('./duplicates/DuplicateController');
      const stats = duplicateController.getHashCacheStats();
      return { success: true, data: stats };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to retrieve hash cache stats' };
    }
  });

  ipcMain.handle('duplicates:clearCache', async (): Promise<IpcResult<any>> => {
    try {
      const { duplicateController } = await import('./duplicates/DuplicateController');
      const res = duplicateController.clearHashCache();
      return { success: true, data: res };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to clear hash cache' };
    }
  });

  // Storage Analyzer Endpoints
  ipcMain.handle(
    'storage:getAnalysis',
    async (_event, forceRefresh?: boolean): Promise<IpcResult<any>> => {
      try {
        const { defaultStorageAnalyzer } = await import('./analyzer/StorageAnalyzer');
        const analysis = await defaultStorageAnalyzer.analyzeStorage(forceRefresh);
        return { success: true, data: analysis };
      } catch (err: any) {
        return { success: false, error: err?.message || 'Failed to analyze storage' };
      }
    }
  );
}
