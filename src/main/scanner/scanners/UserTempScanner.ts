import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import { BaseScanner, ScannerContext } from './BaseScanner';
import { ScanCategoryId, ScanItem } from '../../../shared/types';

export class UserTempScanner extends BaseScanner {
  public readonly categoryId: ScanCategoryId = 'user_temp';
  public readonly title = 'User Temporary Files';
  public readonly description = 'Application caches, temporary installers, and discarded scratch files.';

  public async scan(context: ScannerContext): Promise<ScanItem[]> {
    const tempDir = process.env.TEMP || process.env.TMP || path.join(os.homedir(), 'AppData', 'Local', 'Temp');

    return this.crawlDirectory(
      tempDir,
      context,
      (_filePath, stats) => {
        // Collect files in temp dir
        return stats.isFile();
      }
    );
  }

  protected override getReasonForInclusion(stats: fs.Stats): string {
    const ageDays = Math.floor((Date.now() - stats.mtimeMs) / (1000 * 60 * 60 * 24));
    return `User temporary file (modified ${ageDays} days ago)`;
  }
}
