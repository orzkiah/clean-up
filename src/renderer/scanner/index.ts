/**
 * Scanner Service Architecture (Phase 2 Preview)
 *
 * Product Principle: Do not create fake scan results or mock data.
 * The scanner engine will be implemented in Phase 2 with deep filesystem indexing,
 * path filters, permission guards, and checksum deduplication.
 */

export interface ScanOptions {
  targetDriveId: string;
  targetPaths?: string[];
  scanLargeFiles?: boolean;
  scanTemporaryFiles?: boolean;
  scanSystemCaches?: boolean;
  minFileSizeMB?: number;
}

export type ScanStatus = 'idle' | 'preparing' | 'indexing' | 'analyzing' | 'completed' | 'cancelled' | 'error';

export interface ScanProgress {
  status: ScanStatus;
  scannedFilesCount: number;
  scannedBytes: number;
  currentDirectory: string;
  elapsedMs: number;
}

export interface ScannerEngineContract {
  isAvailable(): boolean;
  startScan(options: ScanOptions): Promise<void>;
  cancelScan(): Promise<void>;
  getProgress(): ScanProgress;
}
