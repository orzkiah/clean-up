import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';
import {
  DuplicateScanResult,
  DuplicateGroup,
  DuplicateFileItem,
  DuplicateScanProgress,
} from '../../shared/types';
import { FingerprintService, defaultFingerprintService, CandidateFile } from './FingerprintService';
import { SafetyPolicy, defaultSafetyPolicy } from '../scanner/safety/SafetyPolicy';
import { normalizePath } from '../scanner/safety/ProtectedPaths';
import { HashCacheDatabase, defaultHashCache } from './cache/HashCacheDatabase';

export type DuplicateProgressEmitter = (progress: DuplicateScanProgress) => void;

export class DuplicateScanner {
  private fingerprintService: FingerprintService;
  private safetyPolicy: SafetyPolicy;
  private hashCache: HashCacheDatabase;

  constructor(
    fingerprintService?: FingerprintService,
    safetyPolicy?: SafetyPolicy,
    hashCache?: HashCacheDatabase
  ) {
    this.fingerprintService = fingerprintService || defaultFingerprintService;
    this.safetyPolicy = safetyPolicy || defaultSafetyPolicy;
    this.hashCache = hashCache || defaultHashCache;
  }

  /**
   * Resolves the safe library roots for duplicate scanning.
   * Strictly user library folders (Desktop, Downloads, Documents, Videos, Pictures, Music).
   */
  public getScanRoots(): string[] {
    const home = os.homedir();
    const candidateFolders = ['Desktop', 'Downloads', 'Documents', 'Videos', 'Pictures', 'Music'];
    const roots: string[] = [];

    for (const folder of candidateFolders) {
      const p = path.join(home, folder);
      try {
        if (fs.existsSync(p)) {
          const stats = fs.statSync(p);
          if (stats.isDirectory()) {
            roots.push(normalizePath(p));
          }
        }
      } catch {
        // Skip inaccessible folder
      }
    }

    return roots;
  }

  /**
   * Executes the 3-stage duplicate file detection pipeline.
   */
  public async executeScan(
    signal: AbortSignal,
    emitProgress: DuplicateProgressEmitter,
    customRoots?: string[]
  ): Promise<DuplicateScanResult> {
    const scanStartTime = Date.now();
    const scanId = crypto.randomUUID();
    const roots = customRoots && customRoots.length > 0 ? customRoots : this.getScanRoots();

    let filesExamined = 0;
    let lastProgressEmit = 0;
    let cacheHits = 0;
    let rehashedCount = 0;

    const notifyProgress = (
      status: DuplicateScanProgress['status'],
      candidatesCount = 0,
      hashedCount = 0,
      currentFile = ''
    ) => {
      const now = Date.now();
      if (status !== 'scanning' || now - lastProgressEmit > 200 || filesExamined % 200 === 0) {
        lastProgressEmit = now;
        emitProgress({
          status,
          filesExamined,
          candidatesCount,
          hashedCount,
          currentFile: path.basename(currentFile) || currentFile,
        });
      }
    };

    notifyProgress('scanning', 0, 0, 'Discovering user files...');

    // 1. Traverse scan roots and collect files
    const allFiles: CandidateFile[] = [];

    for (const root of roots) {
      if (signal.aborted) break;

      await this.crawlDirectory(root, signal, (file) => {
        filesExamined++;
        allFiles.push(file);
        notifyProgress('scanning', 0, 0, file.name);
      });
    }

    if (signal.aborted) {
      notifyProgress('cancelled', 0, 0, 'Scan cancelled');
      throw new Error('Duplicate scan cancelled by user');
    }

    // 2. STAGE 1: Group files by exact byte size
    const sizeCandidateGroups = this.fingerprintService.groupBySize(allFiles);
    let totalCandidates = 0;
    for (const group of sizeCandidateGroups.values()) {
      totalCandidates += group.length;
    }

    notifyProgress('fingerprinting', totalCandidates, 0, 'Sampling file fingerprints...');

    // 3. STAGE 2: Quick Fingerprinting for identical size candidates
    // Group candidates by quick fingerprint
    const fingerprintGroups = new Map<string, CandidateFile[]>();

    for (const [_size, group] of sizeCandidateGroups.entries()) {
      if (signal.aborted) break;

      for (const file of group) {
        if (signal.aborted) break;

        notifyProgress('fingerprinting', totalCandidates, 0, file.name);
        const fp = await this.fingerprintService.computeQuickFingerprint(file.fullPath, file.sizeBytes);

        if (!fp) continue; // Skip unreadable/locked file

        // Unique key: size + fingerprint
        const key = `${file.sizeBytes}_${fp}`;
        const existing = fingerprintGroups.get(key);
        if (existing) {
          existing.push(file);
        } else {
          fingerprintGroups.set(key, [file]);
        }
      }
    }

    if (signal.aborted) {
      notifyProgress('cancelled', totalCandidates, 0, 'Scan cancelled');
      throw new Error('Duplicate scan cancelled by user');
    }

    // Eliminate unique quick fingerprints
    const finalHashCandidates: CandidateFile[][] = [];
    let filesNeedingFullHash = 0;
    for (const group of fingerprintGroups.values()) {
      if (group.length > 1) {
        finalHashCandidates.push(group);
        filesNeedingFullHash += group.length;
      }
    }

    notifyProgress('hashing', totalCandidates, 0, 'Streaming cryptographic hashes...');

    // 4. STAGE 3: Full SHA-256 streaming hash
    let hashedCount = 0;
    const exactDuplicateMap = new Map<string, CandidateFile[]>();

    // Process candidate groups with bounded concurrency (4 files concurrently)
    const HASH_CONCURRENCY = 4;

    for (const group of finalHashCandidates) {
      if (signal.aborted) break;

      for (let i = 0; i < group.length; i += HASH_CONCURRENCY) {
        if (signal.aborted) break;

        const batch = group.slice(i, i + HASH_CONCURRENCY);
        const hashes = await Promise.all(
          batch.map(async (file) => {
            try {
              notifyProgress('hashing', totalCandidates, hashedCount, file.name);
              const mtimeMs = file.mtimeMs || new Date(file.modifiedAt).getTime();

              let hash = this.hashCache.getValidHash(file.fullPath, file.sizeBytes, mtimeMs);
              if (hash) {
                cacheHits++;
              } else {
                hash = await this.fingerprintService.computeFullHashStream(file.fullPath, signal);
                this.hashCache.setHash(file.fullPath, file.sizeBytes, mtimeMs, hash);
                rehashedCount++;
              }

              hashedCount++;
              return { file, hash };
            } catch {
              return null; // Skip file if read failed
            }
          })
        );

        for (const item of hashes) {
          if (!item) continue;
          const { file, hash } = item;
          // Combine size and full hash
          const key = `${file.sizeBytes}_${hash}`;
          const existing = exactDuplicateMap.get(key);
          if (existing) {
            existing.push(file);
          } else {
            exactDuplicateMap.set(key, [file]);
          }
        }
      }
    }

    if (signal.aborted) {
      notifyProgress('cancelled', totalCandidates, hashedCount, 'Scan cancelled');
      throw new Error('Duplicate scan cancelled by user');
    }

    // 5. Construct final DuplicateGroup results
    const groups: DuplicateGroup[] = [];
    let totalDuplicateFiles = 0;
    let totalReclaimableBytes = 0;

    for (const [key, files] of exactDuplicateMap.entries()) {
      if (files.length > 1) {
        const sizeBytes = files[0].sizeBytes;
        const hash = key.split('_')[1] || '';
        const potentiallyReclaimableBytes = sizeBytes * (files.length - 1);

        const fileItems: DuplicateFileItem[] = files.map((f) => ({
          itemId: f.itemId,
          name: f.name,
          fullPath: f.fullPath,
          sizeBytes: f.sizeBytes,
          createdAt: f.createdAt,
          modifiedAt: f.modifiedAt,
          mtimeMs: f.mtimeMs,
        }));

        groups.push({
          groupId: 'grp_' + crypto.randomBytes(6).toString('hex'),
          hash,
          sizeBytes,
          files: fileItems,
          duplicateCount: fileItems.length,
          potentiallyReclaimableBytes,
          riskLevel: 'REVIEW_REQUIRED',
        });

        totalDuplicateFiles += fileItems.length;
        totalReclaimableBytes += potentiallyReclaimableBytes;
      }
    }

    // Sort groups by potentially reclaimable bytes descending
    groups.sort((a, b) => b.potentiallyReclaimableBytes - a.potentiallyReclaimableBytes);

    notifyProgress('completed', totalCandidates, hashedCount, 'Complete');

    return {
      scanId,
      completedAt: new Date().toISOString(),
      totalFilesExamined: filesExamined,
      candidatesCount: totalCandidates,
      hashedCount,
      groupsCount: groups.length,
      duplicateFilesCount: totalDuplicateFiles,
      totalReclaimableBytes,
      groups,
      cacheHits,
      rehashedCount,
      scanDurationMs: Date.now() - scanStartTime,
    };
  }

  /**
   * Recursively traverses a user folder with safety bounds (max depth 6, skipping symlinks).
   */
  private async crawlDirectory(
    dirPath: string,
    signal: AbortSignal,
    onFile: (file: CandidateFile) => void,
    depth = 0
  ): Promise<void> {
    if (depth > 6 || signal.aborted) return;

    if (this.safetyPolicy.isNetworkOrUncPath(dirPath)) return;
    if (this.safetyPolicy.isPathProtected(dirPath)) return;

    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dirPath, { withFileTypes: true });
    } catch {
      return; // Inaccessible directory
    }

    const subDirs: string[] = [];

    for (const entry of entries) {
      if (signal.aborted) return;

      // Do NOT follow junctions or symbolic links
      if (entry.isSymbolicLink()) continue;

      const fullPath = path.join(dirPath, entry.name);

      if (entry.isDirectory()) {
        const lowerName = entry.name.toLowerCase();
        // Skip common large source/vendor directories
        if (
          lowerName === 'node_modules' ||
          lowerName === '.git' ||
          lowerName === '__pycache__' ||
          lowerName === 'venv' ||
          lowerName === 'vendor' ||
          lowerName === 'appdata'
        ) {
          continue;
        }
        subDirs.push(fullPath);
      } else if (entry.isFile()) {
        try {
          const stats = fs.statSync(fullPath);
          // Skip 0-byte files
          if (stats.size > 0) {
            const fileId = crypto.createHash('sha256').update(fullPath).digest('hex').substring(0, 16);
            onFile({
              itemId: fileId,
              name: entry.name,
              fullPath,
              sizeBytes: stats.size,
              createdAt: stats.birthtime.toISOString(),
              modifiedAt: stats.mtime.toISOString(),
              mtimeMs: Math.floor(stats.mtimeMs),
            });
          }
        } catch {
          // File was deleted or is locked
        }
      }
    }

    for (const subDir of subDirs) {
      if (signal.aborted) return;
      await this.crawlDirectory(subDir, signal, onFile, depth + 1);
    }
  }
}

export const defaultDuplicateScanner = new DuplicateScanner();
