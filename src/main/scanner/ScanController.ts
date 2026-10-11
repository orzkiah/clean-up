import { shell } from 'electron';
import { ScanResult, ScanItem, ScanFilterOptions, ScanProgress } from '../../shared/types';
import { ScannerEngine, ProgressEmitter } from './ScannerEngine';

export class ScanController {
  private engine: ScannerEngine;
  private currentAbortController: AbortController | null = null;
  private latestResult: ScanResult | null = null;
  private activeItemMap: Map<string, ScanItem> = new Map();
  private isScanning = false;

  constructor(engine?: ScannerEngine) {
    this.engine = engine || new ScannerEngine();
  }

  public async startScan(
    options: ScanFilterOptions | undefined,
    emitProgress: ProgressEmitter
  ): Promise<{ scanId: string }> {
    if (this.isScanning && this.currentAbortController) {
      this.currentAbortController.abort();
    }

    this.isScanning = true;
    this.currentAbortController = new AbortController();
    const signal = this.currentAbortController.signal;

    // Run asynchronously
    this.engine
      .executeScan(options, signal, emitProgress)
      .then((result) => {
        this.latestResult = result;
        this.activeItemMap.clear();

        // Index items by ID for secure location opening
        for (const catItems of Object.values(result.itemsByCategory)) {
          for (const item of catItems) {
            this.activeItemMap.set(item.id, item);
          }
        }
      })
      .catch((err) => {
        console.error('Scan execution error:', err);
      })
      .finally(() => {
        this.isScanning = false;
        this.currentAbortController = null;
      });

    return { scanId: 'active-scan' };
  }

  public cancelScan(): { cancelled: boolean } {
    if (this.currentAbortController && this.isScanning) {
      this.currentAbortController.abort();
      this.isScanning = false;
      return { cancelled: true };
    }
    return { cancelled: false };
  }

  public getLatestResult(): ScanResult | null {
    return this.latestResult;
  }

  /**
   * Securely reveals an item in Windows File Explorer.
   * Path is resolved STRICTLY from the in-memory scan session items,
   * preventing arbitrary path injection from the renderer.
   */
  public openItemLocation(itemId: string): { opened: boolean } {
    if (!itemId || typeof itemId !== 'string') {
      throw new Error('Invalid item ID provided');
    }

    const item = this.activeItemMap.get(itemId);
    if (!item) {
      throw new Error('Item ID not found in current scan session');
    }

    if (item.fullPath === 'shell:RecycleBinFolder') {
      shell.openPath('shell:RecycleBinFolder');
      return { opened: true };
    }

    shell.showItemInFolder(item.fullPath);
    return { opened: true };
  }
}

export const scanController = new ScanController();
