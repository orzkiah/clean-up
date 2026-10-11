export type DriveType = 'fixed' | 'removable' | 'network' | 'cdrom' | 'ramdisk' | 'unknown';

export interface DiskInfo {
  id: string; // e.g. "C:"
  label: string; // e.g. "Windows-SSD" or "Local Disk"
  mountPoint: string; // e.g. "C:\"
  fileSystem: string; // e.g. "NTFS", "FAT32", "exFAT"
  driveType: DriveType;
  isSystemDrive: boolean;
  totalBytes: number;
  freeBytes: number;
  usedBytes: number;
  usedPercentage: number;
  isAvailable: boolean;
  error?: string;
}

export interface StorageOverview {
  systemDrive: DiskInfo | null;
  drives: DiskInfo[];
  lastUpdated: string; // ISO 8601
}

export interface IpcResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// ==========================================
// PHASE 2 SCANNER MODELS & SAFETY TYPES
// ==========================================

export type RiskLevel = 'SAFE_TO_CLEAN' | 'REVIEW_REQUIRED' | 'PROTECTED';

export type ScanCategoryId =
  | 'user_temp'
  | 'windows_temp'
  | 'browser_cache'
  | 'recycle_bin'
  | 'large_files'
  | 'old_files';

export interface ScanItem {
  id: string;
  name: string;
  fullPath: string;
  category: ScanCategoryId;
  sizeBytes: number;
  createdAt: string; // ISO string
  modifiedAt: string; // ISO string
  accessedAt: string; // ISO string
  extension: string;
  riskLevel: RiskLevel;
  source: string;
  canClean: boolean;
  reason: string;
}

export interface CategorySummary {
  categoryId: ScanCategoryId;
  title: string;
  description: string;
  riskLevel: RiskLevel;
  itemCount: number;
  totalBytes: number;
  isRecoverable: boolean; // Only true for SAFE_TO_CLEAN categories
}

export type ScanStatus =
  | 'idle'
  | 'preparing'
  | 'scanning'
  | 'cancelling'
  | 'completed'
  | 'cancelled'
  | 'failed';

export interface ScanProgress {
  status: ScanStatus;
  currentScanner: string;
  currentPath: string;
  filesScanned: number;
  foldersScanned: number;
  bytesDiscovered: number;
  categoriesCompleted: number;
  totalCategories: number;
}

export interface ScanResult {
  scanId: string;
  startedAt: string;
  completedAt: string;
  status: ScanStatus;
  totalFilesScanned: number;
  totalFoldersScanned: number;
  totalBytesFound: number;
  recoverableBytes: number; // Sum of ONLY SAFE_TO_CLEAN categories
  categories: Record<ScanCategoryId, CategorySummary>;
  itemsByCategory: Record<ScanCategoryId, ScanItem[]>;
  warnings: string[];
}

export interface ScanFilterOptions {
  largeFileMinBytes?: number;
  oldFileMinDays?: number;
}

// ==========================================
// PHASE 3 CLEANUP & HISTORY MODELS
// ==========================================

export interface CleanupPlanItem {
  itemId: string;
  name: string;
  category: ScanCategoryId;
  sizeBytes: number;
  riskLevel: RiskLevel;
}

export interface CleanupPlanCategoryBreakdown {
  category: ScanCategoryId;
  title: string;
  count: number;
  totalBytes: number;
}

export interface CleanupPlan {
  planId: string;
  scanId: string;
  items: CleanupPlanItem[];
  totalBytes: number;
  categories: CleanupPlanCategoryBreakdown[];
  createdAt: string;
}

export type ItemCleanupStatus = 'deleted' | 'skipped' | 'failed';

export interface ItemCleanupResult {
  itemId: string;
  name: string;
  category: ScanCategoryId;
  sizeBytes: number;
  status: ItemCleanupStatus;
  reason: string;
}

export type CleanupStatus =
  | 'idle'
  | 'preparing'
  | 'cleaning'
  | 'completed'
  | 'completed_with_skips'
  | 'cancelled'
  | 'failed';

export interface CleanupProgress {
  status: CleanupStatus;
  currentIndex: number;
  totalItems: number;
  bytesFreed: number;
  skippedCount: number;
  currentItemName: string;
}

export interface CleanupResult {
  cleanupId: string;
  startedAt: string;
  completedAt: string;
  status: CleanupStatus;
  requestedItems: number;
  deletedItems: number;
  skippedItems: number;
  failedItems: number;
  bytesFreed: number;
  bytesSkipped: number;
  bytesFailed: number;
  categoriesFreed: Record<string, { count: number; bytes: number }>;
  itemResults: ItemCleanupResult[];
}

export interface HistoryRecord {
  id: string;
  timestamp: string; // ISO
  formattedDate: string;
  formattedTime: string;
  bytesFreed: number;
  itemsDeleted: number;
  itemsSkipped: number;
  categories: { name: string; bytes: number; count: number }[];
}

// ==========================================
// PHASE 4 DUPLICATE FINDER MODELS
// ==========================================

export interface DuplicateFileItem {
  itemId: string;
  name: string;
  fullPath: string;
  sizeBytes: number;
  createdAt: string;
  modifiedAt: string;
  mtimeMs?: number;
}

export interface DuplicateGroup {
  groupId: string;
  hash: string;
  sizeBytes: number;
  files: DuplicateFileItem[];
  duplicateCount: number;
  potentiallyReclaimableBytes: number; // sizeBytes * (files.length - 1)
  riskLevel: 'REVIEW_REQUIRED';
}

export interface DuplicateScanProgress {
  status: 'idle' | 'scanning' | 'fingerprinting' | 'hashing' | 'completed' | 'cancelled' | 'failed';
  filesExamined: number;
  candidatesCount: number;
  hashedCount: number;
  cacheHits?: number;
  currentFile: string;
}

export interface DuplicateScanResult {
  scanId: string;
  completedAt: string;
  totalFilesExamined: number;
  candidatesCount: number;
  hashedCount: number;
  cacheHits: number;
  rehashedCount: number;
  scanDurationMs: number;
  groupsCount: number;
  duplicateFilesCount: number;
  totalReclaimableBytes: number;
  groups: DuplicateGroup[];
}

// ==========================================
// PHASE 5 DUPLICATE RESOLVER & CACHE MODELS
// ==========================================

export type DuplicateActionType = 'KEEP' | 'REMOVE';

export interface DuplicateActionItem {
  itemId: string;
  action: DuplicateActionType;
}

export interface DuplicateResolutionPlan {
  planId: string;
  scanId: string;
  itemsToRemove: DuplicateFileItem[];
  totalBytesToReclaim: number;
  createdAt: string;
}

export interface DuplicateTrashResultItem {
  itemId: string;
  name: string;
  fullPath: string;
  sizeBytes: number;
  status: 'moved_to_trash' | 'skipped' | 'failed';
  reason: string;
}

export interface DuplicateResolutionResult {
  resolutionId: string;
  startedAt: string;
  completedAt: string;
  totalProcessed: number;
  movedCount: number;
  skippedCount: number;
  failedCount: number;
  bytesReclaimed: number;
  items: DuplicateTrashResultItem[];
}

export interface HashCacheStats {
  entryCount: number;
  dbSizeBytes: number;
  cacheHitsTotal: number;
  cacheMissesTotal: number;
}

// ==========================================
// PHASE 4 STORAGE ANALYZER MODELS
// ==========================================

export interface StorageCategoryItem {
  id: string;
  title: string;
  bytes: number;
  percentageOfUsed: number;
  color?: string;
  description: string;
}

export interface LargestFolderItem {
  path: string;
  name: string;
  sizeBytes: number;
  category: string;
}

export interface StorageAnalysisResult {
  lastUpdated: string;
  systemDriveId: string;
  physicalTotalBytes: number;
  physicalUsedBytes: number;
  physicalFreeBytes: number;
  analyzedBytes: number;
  unclassifiedBytes: number;
  categories: StorageCategoryItem[];
  largestFolders: LargestFolderItem[];
}

// IPC Contracts
export interface StorageApi {
  getStorageOverview: () => Promise<IpcResult<StorageOverview>>;
  getDriveDetails: (driveId: string) => Promise<IpcResult<DiskInfo>>;
  refreshStorage: () => Promise<IpcResult<StorageOverview>>;
  getAppVersion: () => Promise<string>;

  // Scanner methods
  startStorageScan: (options?: ScanFilterOptions) => Promise<IpcResult<{ scanId: string }>>;
  cancelStorageScan: () => Promise<IpcResult<{ cancelled: boolean }>>;
  getScanResults: () => Promise<IpcResult<ScanResult | null>>;
  openItemLocation: (itemId: string) => Promise<IpcResult<{ opened: boolean }>>;
  onScanProgress: (callback: (progress: ScanProgress) => void) => () => void;

  // Cleanup methods
  prepareCleanupPlan: (itemIds: string[]) => Promise<IpcResult<CleanupPlan>>;
  executeCleanup: (planId: string) => Promise<IpcResult<CleanupResult>>;
  cancelCleanup: () => Promise<IpcResult<{ cancelled: boolean }>>;
  onCleanupProgress: (callback: (progress: CleanupProgress) => void) => () => void;

  // History methods
  getCleanupHistory: () => Promise<IpcResult<HistoryRecord[]>>;
  clearCleanupHistory: () => Promise<IpcResult<{ cleared: boolean }>>;

  // Duplicate methods
  startDuplicateScan: () => Promise<IpcResult<{ scanId: string }>>;
  cancelDuplicateScan: () => Promise<IpcResult<{ cancelled: boolean }>>;
  getDuplicateResults: () => Promise<IpcResult<DuplicateScanResult | null>>;
  onDuplicateProgress: (callback: (progress: DuplicateScanProgress) => void) => () => void;
  prepareDuplicateResolution: (actions: DuplicateActionItem[]) => Promise<IpcResult<DuplicateResolutionPlan>>;
  executeDuplicateResolution: (planId: string) => Promise<IpcResult<DuplicateResolutionResult>>;
  getHashCacheStats: () => Promise<IpcResult<HashCacheStats>>;
  clearHashCache: () => Promise<IpcResult<{ cleared: boolean }>>;

  // Storage Analyzer methods
  getStorageAnalysis: (forceRefresh?: boolean) => Promise<IpcResult<StorageAnalysisResult>>;
}

declare global {
  interface Window {
    cleanUpApi?: StorageApi;
  }
}
