import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import { BaseScanner, ScannerContext } from './BaseScanner';
import { ScanCategoryId, ScanItem } from '../../../shared/types';

export class LargeFileScanner extends BaseScanner {
  public readonly categoryId: ScanCategoryId = 'large_files';
  public readonly title = 'Large Files';
  public readonly description = 'High-capacity files in personal folders that consume significant disk space.';

  public static readonly DEFAULT_THRESHOLD_BYTES = 500 * 1024 * 1024; // 500 MB

  public async scan(context: ScannerContext): Promise<ScanItem[]> {
    const userProfile = process.env.USERPROFILE || os.homedir();
    const threshold = context.options?.largeFileMinBytes ?? LargeFileScanner.DEFAULT_THRESHOLD_BYTES;

    // Scan user-owned locations only
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
          return stats.isFile() && stats.size >= threshold;
        }
      );

      results.push(...items);
    }

    // Sort descending by size
    return results.sort((a, b) => b.sizeBytes - a.sizeBytes);
  }

  protected override getReasonForInclusion(stats: fs.Stats): string {
    const sizeMb = (stats.size / (1024 * 1024)).toFixed(0);
    return `Large file (${sizeMb} MB) in user folder requiring review`;
  }
}
