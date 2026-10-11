import { BaseScanner } from './scanners/BaseScanner';
import { UserTempScanner } from './scanners/UserTempScanner';
import { WindowsTempScanner } from './scanners/WindowsTempScanner';
import { BrowserCacheScanner } from './scanners/BrowserCacheScanner';
import { RecycleBinScanner } from './scanners/RecycleBinScanner';
import { LargeFileScanner } from './scanners/LargeFileScanner';
import { OldFileScanner } from './scanners/OldFileScanner';
import { SafetyPolicy } from './safety/SafetyPolicy';

export class ScannerRegistry {
  private scanners: BaseScanner[] = [];

  constructor(safetyPolicy?: SafetyPolicy) {
    this.scanners = [
      new UserTempScanner(safetyPolicy),
      new WindowsTempScanner(safetyPolicy),
      new BrowserCacheScanner(safetyPolicy),
      new RecycleBinScanner(safetyPolicy),
      new LargeFileScanner(safetyPolicy),
      new OldFileScanner(safetyPolicy),
    ];
  }

  public getAllScanners(): BaseScanner[] {
    return [...this.scanners];
  }
}
