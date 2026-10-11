import * as path from 'path';
import * as fs from 'fs';
import { BaseScanner, ScannerContext } from './BaseScanner';
import { ScanCategoryId, ScanItem } from '../../../shared/types';

export class WindowsTempScanner extends BaseScanner {
  public readonly categoryId: ScanCategoryId = 'windows_temp';
  public readonly title = 'Windows System Temp';
  public readonly description = 'Operating system temporary installation caches and log dumps.';

  public async scan(context: ScannerContext): Promise<ScanItem[]> {
    const winDir = process.env.WINDIR || process.env.SystemRoot || 'C:\\Windows';
    const winTemp = path.join(winDir, 'Temp');

    return this.crawlDirectory(
      winTemp,
      context,
      (_filePath, stats) => stats.isFile()
    );
  }

  protected override getReasonForInclusion(stats: fs.Stats): string {
    const ageDays = Math.floor((Date.now() - stats.mtimeMs) / (1000 * 60 * 60 * 24));
    return `System temporary file (modified ${ageDays} days ago)`;
  }
}
