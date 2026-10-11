import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import { normalizePath } from '../../scanner/safety/ProtectedPaths';

export class ApprovedRoots {
  /**
   * Retrieve canonical, resolved paths of directories permitted for file cleanup.
   */
  public static getApprovedRoots(): string[] {
    const roots: string[] = [];

    // 1. User Temp
    const userTemp = process.env.TEMP || process.env.TMP || path.join(os.homedir(), 'AppData', 'Local', 'Temp');
    if (userTemp) roots.push(userTemp);

    // 2. Windows Temp
    const winDir = process.env.WINDIR || process.env.SystemRoot || 'C:\\Windows';
    roots.push(path.join(winDir, 'Temp'));

    // 3. Chrome Caches
    const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
    const chromeUser = path.join(localAppData, 'Google', 'Chrome', 'User Data');
    const edgeUser = path.join(localAppData, 'Microsoft', 'Edge', 'User Data');

    const cacheNames = ['Cache', 'Code Cache', 'GPUCache', path.join('Service Worker', 'CacheStorage')];

    for (const browserRoot of [chromeUser, edgeUser]) {
      try {
        if (fs.existsSync(browserRoot)) {
          const profiles = fs.readdirSync(browserRoot, { withFileTypes: true });
          for (const p of profiles) {
            if (p.isDirectory() && (p.name === 'Default' || p.name.startsWith('Profile '))) {
              for (const c of cacheNames) {
                const cPath = path.join(browserRoot, p.name, c);
                roots.push(cPath);
              }
            }
          }
        }
      } catch {
        // Skip inaccessible browser root
      }
    }

    return roots.map(normalizePath).filter((r) => r.length > 0);
  }

  /**
   * Strictly verifies if a candidate file path is inside one of the approved cleanup roots.
   * Path traversal or attempts to delete parent directories return false.
   */
  public static isInsideApprovedRoot(candidatePath: string): boolean {
    if (!candidatePath) return false;
    const normalizedCandidate = normalizePath(candidatePath);

    const approved = ApprovedRoots.getApprovedRoots();

    for (const root of approved) {
      // Must be strictly INSIDE the root directory (never the root itself!)
      if (normalizedCandidate.startsWith(root + '\\')) {
        return true;
      }
    }

    return false;
  }
}
