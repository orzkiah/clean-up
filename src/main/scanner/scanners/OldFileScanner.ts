import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import { BaseScanner, ScannerContext } from './BaseScanner';
import { ScanCategoryId, ScanItem } from '../../../shared/types';

export class OldFileScanner extends BaseScanner {
  public readonly categoryId: ScanCategoryId = 'old_files';
  public readonly title = 'Old Files';
  public readonly description = 'Personal files untouched for 6+ months that may no longer be needed.';

  public static readonly DEFAULT_AGE_DAYS = 180;

  public async scan(context: ScannerContext): Promise<ScanItem[]> {
    const userProfile = process.env.USERPROFILE || os.homedir();
    const minDays = context.options?.oldFileMinDays ?? OldFileScanner.DEFAULT_AGE_DAYS;
    const cutoffTimestamp = Date.now() - minDays * 24 * 60 * 60 * 1000;

    const userFolders = [
      path.join(userProfile, 'Desktop'),
      path.join(userProfile, 'Downloads'),
      path.join(userProfile, 'Documents'),
      path.join(userProfile, 'Videos'),
      path.join(userProfile, 'Pictures'),
      path.join(userProfile, 'Music'),
    ];

    const results: ScanItem[] = [];

    for (const folder of userFolders) {
      if (context.signal.aborted) break;

      const items = await this.crawlDirectory(
        folder,
        context,
        (_filePath, stats) => {
          if (!stats.isFile()) return false;

          // Prefer atime (LastAccessTime) if non-zero; otherwise fallback to mtime (LastWriteTime)
          const atimeValid = stats.atimeMs > 0 && stats.atimeMs <= Date.now();
          const targetTime = atimeValid ? stats.atimeMs : stats.mtimeMs;

          return targetTime < cutoffTimestamp;
        }
      );

      results.push(...items);
    }

    // Sort oldest first
    return results.sort((a, b) => new Date(a.accessedAt).getTime() - new Date(b.accessedAt).getTime());
  }

  protected override getReasonForInclusion(stats: fs.Stats): string {
    const atimeValid = stats.atimeMs > 0 && stats.atimeMs <= Date.now();
    const chosenTime = atimeValid ? stats.atimeMs : stats.mtimeMs;
    const ageDays = Math.floor((Date.now() - chosenTime) / (1000 * 60 * 60 * 24));
    const timestampSource = atimeValid ? 'LastAccessTime' : 'LastWriteTime (fallback)';

    return `Untouched for ${ageDays} days (source: ${timestampSource})`;
  }
}
