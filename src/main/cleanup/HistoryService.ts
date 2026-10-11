import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { app } from 'electron';
import { HistoryRecord, CleanupResult } from '../../shared/types';

export class HistoryService {
  private historyFilePath: string;

  constructor(customPath?: string) {
    if (customPath) {
      if (fs.existsSync(customPath) && fs.statSync(customPath).isDirectory()) {
        this.historyFilePath = path.join(customPath, 'cleanup_history.json');
      } else {
        this.historyFilePath = customPath;
      }
    } else {
      const userData = app ? app.getPath('userData') : path.join(os.homedir(), '.cleanup');
      if (!fs.existsSync(userData)) {
        try {
          fs.mkdirSync(userData, { recursive: true });
        } catch {
          // Fallback to homedir
        }
      }
      this.historyFilePath = path.join(userData, 'cleanup_history.json');
    }
  }

  public getHistory(): HistoryRecord[] {
    try {
      if (!fs.existsSync(this.historyFilePath)) {
        return [];
      }
      const raw = fs.readFileSync(this.historyFilePath, 'utf-8');
      const data = JSON.parse(raw);
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  }

  /**
   * Records aggregate cleanup results.
   * Privacy Principle: NEVER persists individual full file paths to disk.
   */
  public recordCleanup(result: CleanupResult): HistoryRecord {
    const history = this.getHistory();
    const dateObj = new Date(result.completedAt || Date.now());

    const categoriesList = Object.entries(result.categoriesFreed).map(([name, val]) => ({
      name,
      bytes: val.bytes,
      count: val.count,
    }));

    const record: HistoryRecord = {
      id: result.cleanupId,
      timestamp: dateObj.toISOString(),
      formattedDate: dateObj.toLocaleDateString([], {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }),
      formattedTime: dateObj.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      }),
      bytesFreed: result.bytesFreed,
      itemsDeleted: result.deletedItems,
      itemsSkipped: result.skippedItems,
      categories: categoriesList,
    };

    // Keep most recent 50 entries
    const updated = [record, ...history].slice(0, 50);

    try {
      const dir = path.dirname(this.historyFilePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.historyFilePath, JSON.stringify(updated, null, 2), 'utf-8');
    } catch (err) {
      console.warn('Could not persist cleanup history:', err);
    }

    return record;
  }

  public clearHistory(): boolean {
    try {
      if (fs.existsSync(this.historyFilePath)) {
        fs.writeFileSync(this.historyFilePath, JSON.stringify([], null, 2), 'utf-8');
      }
      return true;
    } catch {
      return false;
    }
  }
}

export const defaultHistoryService = new HistoryService();
