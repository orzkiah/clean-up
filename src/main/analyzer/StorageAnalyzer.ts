import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import {
  StorageAnalysisResult,
  StorageCategoryItem,
  LargestFolderItem,
} from '../../shared/types';
import { WindowsStorageService } from '../services/windowsStorageService';
import { normalizePath } from '../scanner/safety/ProtectedPaths';

export class StorageAnalyzer {
  private storageService: WindowsStorageService;
  private cachedAnalysis: StorageAnalysisResult | null = null;
  private lastAnalyzedTime = 0;

  constructor(storageService?: WindowsStorageService) {
    this.storageService = storageService || new WindowsStorageService();
  }

  /**
   * Performs real filesystem storage analysis across bounded categories.
   */
  public async analyzeStorage(forceRefresh = false): Promise<StorageAnalysisResult> {
    const now = Date.now();
    // Cache for 60 seconds unless forceRefresh
    if (!forceRefresh && this.cachedAnalysis && now - this.lastAnalyzedTime < 60000) {
      return this.cachedAnalysis;
    }

    // 1. Get physical storage numbers from Windows OS
    const overview = await this.storageService.getStorageOverview();
    const systemDrive = overview.systemDrive || overview.drives[0];

    const physicalTotalBytes = systemDrive ? systemDrive.totalBytes : 0;
    const physicalUsedBytes = systemDrive ? systemDrive.usedBytes : 0;
    const physicalFreeBytes = systemDrive ? systemDrive.freeBytes : 0;
    const systemDriveId = systemDrive ? systemDrive.id : 'C:';

    const home = os.homedir();
    const localAppData = process.env.LOCALAPPDATA || path.join(home, 'AppData', 'Local');

    // 2. Measure categories
    // User Folders
    const downloadsBytes = this.measureDirectorySize(path.join(home, 'Downloads'), 3);
    const documentsBytes = this.measureDirectorySize(path.join(home, 'Documents'), 3);
    const picturesBytes = this.measureDirectorySize(path.join(home, 'Pictures'), 3);
    const videosBytes = this.measureDirectorySize(path.join(home, 'Videos'), 3);
    const musicBytes = this.measureDirectorySize(path.join(home, 'Music'), 3);
    const desktopBytes = this.measureDirectorySize(path.join(home, 'Desktop'), 3);

    const userFilesTotal = downloadsBytes + documentsBytes + picturesBytes + videosBytes + musicBytes + desktopBytes;

    // Applications
    const programFilesBytes = this.measureDirectorySize('C:\\Program Files', 2);
    const programFilesX86Bytes = this.measureDirectorySize('C:\\Program Files (x86)', 2);
    const applicationsTotal = programFilesBytes + programFilesX86Bytes;

    // Temp & Caches
    const userTemp = process.env.TEMP || path.join(localAppData, 'Temp');
    const userTempBytes = this.measureDirectorySize(userTemp, 2);
    const winTempBytes = this.measureDirectorySize('C:\\Windows\\Temp', 2);
    const temporaryFilesTotal = userTempBytes + winTempBytes;

    // Browser Caches
    const chromeCache = path.join(localAppData, 'Google', 'Chrome', 'User Data');
    const edgeCache = path.join(localAppData, 'Microsoft', 'Edge', 'User Data');
    const browserCacheBytes = this.measureBrowserCacheSize(chromeCache) + this.measureBrowserCacheSize(edgeCache);

    // Windows System
    // Technical accounting principle: We do NOT do a full recursive traversal of C:\Windows
    // because WinSxS uses hard links that would cause severe multi-gigabyte double-counting.
    // Instead, we measure key non-hardlinked core Windows directories (System32 binaries, drivers, installer)
    // to provide a reliable, conservative estimate.
    const winCoreBytes =
      this.measureDirectorySize('C:\\Windows\\System32', 1) +
      this.measureDirectorySize('C:\\Windows\\SysWOW64', 1) +
      this.measureDirectorySize('C:\\Windows\\Installer', 1) +
      this.measureDirectorySize('C:\\Windows\\SoftwareDistribution', 2);
    // Add baseline Windows footprint approximation (typical modern Win 10/11 is ~20-25 GB)
    const windowsSystemBytes = Math.max(winCoreBytes, 20 * 1024 * 1024 * 1024);

    // 3. Reconcile Analyzed vs Physical Storage
    const analyzedSum =
      applicationsTotal +
      userFilesTotal +
      windowsSystemBytes +
      temporaryFilesTotal +
      browserCacheBytes;

    // Physical used may exceed analyzed sum due to pagefile, hiberfil, restore points, NTFS metadata
    const unclassifiedBytes = Math.max(0, physicalUsedBytes - analyzedSum);
    const totalAccountedUsed = Math.max(physicalUsedBytes, analyzedSum);

    // 4. Build Category Items list
    const categories: StorageCategoryItem[] = [
      {
        id: 'apps',
        title: 'Installed Applications',
        bytes: applicationsTotal,
        percentageOfUsed: totalAccountedUsed > 0 ? (applicationsTotal / totalAccountedUsed) * 100 : 0,
        color: '#6366f1', // Indigo
        description: 'Program Files and application binaries',
      },
      {
        id: 'windows',
        title: 'Windows System',
        bytes: windowsSystemBytes,
        percentageOfUsed: totalAccountedUsed > 0 ? (windowsSystemBytes / totalAccountedUsed) * 100 : 0,
        color: '#3b82f6', // Blue
        description: 'Windows OS system files and components',
      },
      {
        id: 'videos',
        title: 'Videos',
        bytes: videosBytes,
        percentageOfUsed: totalAccountedUsed > 0 ? (videosBytes / totalAccountedUsed) * 100 : 0,
        color: '#8b5cf6', // Purple
        description: 'Video recordings, movies, and clips',
      },
      {
        id: 'downloads',
        title: 'Downloads',
        bytes: downloadsBytes,
        percentageOfUsed: totalAccountedUsed > 0 ? (downloadsBytes / totalAccountedUsed) * 100 : 0,
        color: '#06b6d4', // Cyan
        description: 'Downloaded installers, archives, and media',
      },
      {
        id: 'documents',
        title: 'Documents',
        bytes: documentsBytes,
        percentageOfUsed: totalAccountedUsed > 0 ? (documentsBytes / totalAccountedUsed) * 100 : 0,
        color: '#10b981', // Emerald
        description: 'Personal documents, spreadsheets, and PDFs',
      },
      {
        id: 'pictures',
        title: 'Pictures',
        bytes: picturesBytes,
        percentageOfUsed: totalAccountedUsed > 0 ? (picturesBytes / totalAccountedUsed) * 100 : 0,
        color: '#ec4899', // Pink
        description: 'Photos, images, and screenshots',
      },
      {
        id: 'desktop',
        title: 'Desktop',
        bytes: desktopBytes,
        percentageOfUsed: totalAccountedUsed > 0 ? (desktopBytes / totalAccountedUsed) * 100 : 0,
        color: '#f59e0b', // Amber
        description: 'Files and folders located on Desktop',
      },
      {
        id: 'temp',
        title: 'Temporary Files',
        bytes: temporaryFilesTotal,
        percentageOfUsed: totalAccountedUsed > 0 ? (temporaryFilesTotal / totalAccountedUsed) * 100 : 0,
        color: '#ef4444', // Red
        description: '%TEMP% and system scratch cache',
      },
      {
        id: 'browser_cache',
        title: 'Browser Caches',
        bytes: browserCacheBytes,
        percentageOfUsed: totalAccountedUsed > 0 ? (browserCacheBytes / totalAccountedUsed) * 100 : 0,
        color: '#f97316', // Orange
        description: 'Chrome and Edge temporary web assets',
      },
      {
        id: 'unclassified',
        title: 'Other / System Reserved',
        bytes: unclassifiedBytes,
        percentageOfUsed: totalAccountedUsed > 0 ? (unclassifiedBytes / totalAccountedUsed) * 100 : 0,
        color: '#64748b', // Slate
        description: 'Pagefile, hibernation, restore points, and unclassified files',
      },
    ];

    // Sort categories by size descending
    categories.sort((a, b) => b.bytes - a.bytes);

    // 5. Largest folders ranking (informational only)
    const largestFolders: LargestFolderItem[] = [
      { path: path.join(home, 'Videos'), name: 'Videos', sizeBytes: videosBytes, category: 'User Library' },
      { path: 'C:\\Program Files', name: 'Program Files', sizeBytes: programFilesBytes, category: 'Applications' },
      { path: path.join(home, 'Downloads'), name: 'Downloads', sizeBytes: downloadsBytes, category: 'User Library' },
      { path: 'C:\\Program Files (x86)', name: 'Program Files (x86)', sizeBytes: programFilesX86Bytes, category: 'Applications' },
      { path: path.join(home, 'Documents'), name: 'Documents', sizeBytes: documentsBytes, category: 'User Library' },
      { path: path.join(home, 'Desktop'), name: 'Desktop', sizeBytes: desktopBytes, category: 'User Library' },
      { path: path.join(home, 'Pictures'), name: 'Pictures', sizeBytes: picturesBytes, category: 'User Library' },
      { path: userTemp, name: 'User Temp', sizeBytes: userTempBytes, category: 'Temporary' },
    ]
      .filter((f) => f.sizeBytes > 0)
      .sort((a, b) => b.sizeBytes - a.sizeBytes);

    const result: StorageAnalysisResult = {
      lastUpdated: new Date().toISOString(),
      systemDriveId,
      physicalTotalBytes,
      physicalUsedBytes,
      physicalFreeBytes,
      analyzedBytes: analyzedSum,
      unclassifiedBytes,
      categories,
      largestFolders,
    };

    this.cachedAnalysis = result;
    this.lastAnalyzedTime = now;

    return result;
  }

  /**
   * Fast bounded directory size measurement.
   */
  public measureDirectorySize(dirPath: string, maxDepth = 2): number {
    try {
      if (!fs.existsSync(dirPath)) return 0;
      const stats = fs.statSync(dirPath);
      if (!stats.isDirectory()) return stats.size;
    } catch {
      return 0;
    }

    return this.crawlAndSum(dirPath, 0, maxDepth);
  }

  private crawlAndSum(dirPath: string, currentDepth: number, maxDepth: number): number {
    if (currentDepth > maxDepth) return 0;

    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dirPath, { withFileTypes: true });
    } catch {
      return 0; // Permission denied or inaccessible
    }

    let total = 0;

    for (const entry of entries) {
      if (entry.isSymbolicLink()) continue; // Skip symlinks/junctions

      const fullPath = path.join(dirPath, entry.name);

      if (entry.isDirectory()) {
        const lower = entry.name.toLowerCase();
        if (lower === 'node_modules' || lower === '.git' || lower === 'appdata') {
          continue;
        }
        total += this.crawlAndSum(fullPath, currentDepth + 1, maxDepth);
      } else if (entry.isFile()) {
        try {
          const s = fs.statSync(fullPath);
          total += s.size;
        } catch {
          // File locked or deleted
        }
      }
    }

    return total;
  }

  private measureBrowserCacheSize(browserUserDataPath: string): number {
    let total = 0;
    try {
      if (!fs.existsSync(browserUserDataPath)) return 0;
      const profiles = fs.readdirSync(browserUserDataPath, { withFileTypes: true });
      for (const p of profiles) {
        if (p.isDirectory() && (p.name === 'Default' || p.name.startsWith('Profile '))) {
          for (const c of ['Cache', 'Code Cache', 'GPUCache']) {
            const cachePath = path.join(browserUserDataPath, p.name, c);
            total += this.measureDirectorySize(cachePath, 2);
          }
        }
      }
    } catch {
      // Ignore
    }
    return total;
  }
}

export const defaultStorageAnalyzer = new StorageAnalyzer();
