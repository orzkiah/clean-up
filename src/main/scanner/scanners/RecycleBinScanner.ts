import { execFile } from 'child_process';
import { BaseScanner, ScannerContext } from './BaseScanner';
import { ScanCategoryId, ScanItem } from '../../../shared/types';

interface RecycleBinStats {
  count: number;
  totalBytes: number;
}

export class RecycleBinScanner extends BaseScanner {
  public readonly categoryId: ScanCategoryId = 'recycle_bin';
  public readonly title = 'Recycle Bin';
  public readonly description = 'Items deleted by the user awaiting permanent emptying.';

  public async scan(context: ScannerContext): Promise<ScanItem[]> {
    if (context.signal.aborted) return [];

    context.onProgress({ currentPath: 'Recycle Bin' });

    try {
      const stats = await this.queryRecycleBin(context.signal);
      if (!stats || stats.count === 0 || stats.totalBytes === 0) {
        return [];
      }

      context.onProgress({
        currentPath: 'Recycle Bin',
        filesScannedDelta: stats.count,
        bytesDiscoveredDelta: stats.totalBytes,
      });

      const item: ScanItem = {
        id: this.generateItemId('Windows::RecycleBin', stats.totalBytes),
        name: `Recycle Bin Contents (${stats.count} items)`,
        fullPath: 'shell:RecycleBinFolder',
        category: 'recycle_bin',
        sizeBytes: stats.totalBytes,
        createdAt: new Date().toISOString(),
        modifiedAt: new Date().toISOString(),
        accessedAt: new Date().toISOString(),
        extension: '',
        riskLevel: 'SAFE_TO_CLEAN',
        source: 'Recycle Bin',
        canClean: true,
        reason: `${stats.count} item(s) pending permanent removal in the Recycle Bin`,
      };

      return [item];
    } catch (err) {
      console.warn('Recycle Bin inspection failed non-fatally:', err);
      return [];
    }
  }

  private queryRecycleBin(signal: AbortSignal): Promise<RecycleBinStats | null> {
    return new Promise((resolve) => {
      if (signal.aborted) {
        resolve(null);
        return;
      }

      const script = `
$sh = New-Object -ComObject Shell.Application
$bin = $sh.Namespace(0xa)
$items = $bin.Items()
$count = $items.Count
$totalSize = 0
foreach ($i in $items) {
    $totalSize += $i.Size
}
[PSCustomObject]@{
    count = $count
    totalBytes = $totalSize
} | ConvertTo-Json -Compress
`;

      const child = execFile(
        'powershell.exe',
        ['-NoProfile', '-NonInteractive', '-Command', script],
        { timeout: 7000, windowsHide: true },
        (error, stdout) => {
          if (error || !stdout.trim()) {
            resolve(null);
            return;
          }

          try {
            const data = JSON.parse(stdout.trim());
            resolve({
              count: Number(data.count) || 0,
              totalBytes: Number(data.totalBytes) || 0,
            });
          } catch {
            resolve(null);
          }
        }
      );

      signal.addEventListener('abort', () => {
        try {
          child.kill();
        } catch {
          // Ignore
        }
        resolve(null);
      });
    });
  }
}
