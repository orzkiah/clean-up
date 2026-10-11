import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { ScanItem, ScanCategoryId, RiskLevel, ScanFilterOptions } from '../../../shared/types';
import { SafetyPolicy, defaultSafetyPolicy } from '../safety/SafetyPolicy';
import { normalizePath } from '../safety/ProtectedPaths';

export interface ScannerProgressCallback {
  (update: {
    currentPath: string;
    filesScannedDelta?: number;
    foldersScannedDelta?: number;
    bytesDiscoveredDelta?: number;
  }): void;
}

export interface ScannerContext {
  signal: AbortSignal;
  onProgress: ScannerProgressCallback;
  options?: ScanFilterOptions;
  safetyPolicy?: SafetyPolicy;
}

export abstract class BaseScanner {
  public abstract readonly categoryId: ScanCategoryId;
  public abstract readonly title: string;
  public abstract readonly description: string;

  protected safetyPolicy: SafetyPolicy;

  private static readonly SKIP_DIR_NAMES = new Set([
    'node_modules',
    '.git',
    '.svn',
    '.hg',
    '$recycle.bin',
    'system volume information',
    '.vscode',
    '.idea',
    '__pycache__',
    'venv',
    '.venv',
    'env',
    'vendor',
    'target',
    'build',
    'dist',
    '.gradle',
    '.cargo',
    'addons',
  ]);

  constructor(safetyPolicy?: SafetyPolicy) {
    this.safetyPolicy = safetyPolicy || defaultSafetyPolicy;
  }

  public abstract scan(context: ScannerContext): Promise<ScanItem[]>;

  protected generateItemId(fullPath: string, sizeBytes: number): string {
    return crypto
      .createHash('sha256')
      .update(`${fullPath}::${sizeBytes}`)
      .digest('hex')
      .substring(0, 16);
  }

  protected async crawlDirectory(
    dirPath: string,
    context: ScannerContext,
    filterFile: (filePath: string, stats: fs.Stats) => Promise<boolean> | boolean,
    maxDepth = 4
  ): Promise<ScanItem[]> {
    const items: ScanItem[] = [];
    const visitedDirs = new Set<string>();

    const traverse = async (currentDir: string, currentDepth: number): Promise<void> => {
      if (context.signal.aborted) return;
      if (currentDepth > maxDepth) return;

      const normDir = normalizePath(currentDir);
      if (visitedDirs.has(normDir)) return;
      visitedDirs.add(normDir);

      if (this.safetyPolicy.isPathProtected(currentDir)) return;

      context.onProgress({ currentPath: currentDir, foldersScannedDelta: 1 });

      let entries: fs.Dirent[] = [];
      try {
        entries = await fs.promises.readdir(currentDir, { withFileTypes: true });
      } catch {
        return;
      }

      const fileEntries: fs.Dirent[] = [];
      const subDirs: string[] = [];

      for (const entry of entries) {
        if (context.signal.aborted) return;

        // Skip symlinks and junctions before following
        if (entry.isSymbolicLink()) continue;

        if (entry.isDirectory()) {
          const lowerName = entry.name.toLowerCase();
          if (!BaseScanner.SKIP_DIR_NAMES.has(lowerName)) {
            subDirs.push(path.join(currentDir, entry.name));
          }
        } else if (entry.isFile()) {
          fileEntries.push(entry);
        }
      }

      // Process files with bounded concurrency (batch of 32)
      const BATCH_SIZE = 32;
      for (let i = 0; i < fileEntries.length; i += BATCH_SIZE) {
        if (context.signal.aborted) return;

        const chunk = fileEntries.slice(i, i + BATCH_SIZE);
        context.onProgress({ currentPath: currentDir, filesScannedDelta: chunk.length });

        await Promise.all(
          chunk.map(async (entry) => {
            if (context.signal.aborted) return;

            const fullPath = path.join(currentDir, entry.name);
            try {
              const stats = await fs.promises.stat(fullPath);
              const shouldInclude = await filterFile(fullPath, stats);
              if (shouldInclude) {
                const riskLevel = this.safetyPolicy.classifyItem(this.categoryId, fullPath);
                if (riskLevel !== 'PROTECTED') {
                  const item: ScanItem = {
                    id: this.generateItemId(fullPath, stats.size),
                    name: entry.name,
                    fullPath,
                    category: this.categoryId,
                    sizeBytes: stats.size,
                    createdAt: stats.birthtime.toISOString(),
                    modifiedAt: stats.mtime.toISOString(),
                    accessedAt: stats.atime.toISOString(),
                    extension: path.extname(entry.name).toLowerCase(),
                    riskLevel,
                    source: this.title,
                    canClean: riskLevel === 'SAFE_TO_CLEAN',
                    reason: this.getReasonForInclusion(stats),
                  };

                  items.push(item);
                  context.onProgress({
                    currentPath: fullPath,
                    bytesDiscoveredDelta: stats.size,
                  });
                }
              }
            } catch {
              // Non-fatal permission/locked error
            }
          })
        );
      }

      // Traverse subdirectories
      for (const subDir of subDirs) {
        if (context.signal.aborted) return;
        await traverse(subDir, currentDepth + 1);
      }
    };

    try {
      if (fs.existsSync(dirPath)) {
        await traverse(dirPath, 0);
      }
    } catch {
      // Ignore root directory access failure
    }

    return items;
  }

  protected getReasonForInclusion(_stats: fs.Stats): string {
    return 'Eligible for cleanup';
  }
}
