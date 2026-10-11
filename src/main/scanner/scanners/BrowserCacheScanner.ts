import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import { BaseScanner, ScannerContext } from './BaseScanner';
import { ScanCategoryId, ScanItem } from '../../../shared/types';

export class BrowserCacheScanner extends BaseScanner {
  public readonly categoryId: ScanCategoryId = 'browser_cache';
  public readonly title = 'Browser Cache';
  public readonly description = 'Cached web images, media, and scripts from Google Chrome and Microsoft Edge.';

  private readonly allowedCacheSubdirs = [
    'Cache',
    'Code Cache',
    'GPUCache',
    path.join('Service Worker', 'CacheStorage'),
  ];

  public async scan(context: ScannerContext): Promise<ScanItem[]> {
    const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');

    const browserRoots = [
      { name: 'Google Chrome', root: path.join(localAppData, 'Google', 'Chrome', 'User Data') },
      { name: 'Microsoft Edge', root: path.join(localAppData, 'Microsoft', 'Edge', 'User Data') },
    ];

    const allItems: ScanItem[] = [];

    for (const browser of browserRoots) {
      if (context.signal.aborted) break;

      try {
        if (!fs.existsSync(browser.root)) continue;

        // Profiles can be "Default", "Profile 1", "Profile 2", etc.
        const entries = await fs.promises.readdir(browser.root, { withFileTypes: true });

        for (const entry of entries) {
          if (context.signal.aborted) break;

          if (entry.isDirectory() && (entry.name === 'Default' || entry.name.startsWith('Profile '))) {
            const profileDir = path.join(browser.root, entry.name);

            // ONLY scan strictly permitted cache subdirectories inside the profile
            for (const cacheSubdir of this.allowedCacheSubdirs) {
              if (context.signal.aborted) break;

              const cacheDirPath = path.join(profileDir, cacheSubdir);
              if (fs.existsSync(cacheDirPath)) {
                const items = await this.crawlDirectory(
                  cacheDirPath,
                  context,
                  (_filePath, stats) => stats.isFile()
                );
                allItems.push(...items);
              }
            }
          }
        }
      } catch {
        // Skip browser if inaccessible
        continue;
      }
    }

    return allItems;
  }

  protected override getReasonForInclusion(_stats: fs.Stats): string {
    return 'Web browser cache (re-downloadable when needed)';
  }
}
