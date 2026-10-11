import { execFile } from 'child_process';

export class RecycleBinCleaner {
  /**
   * Safely clears the Windows Recycle Bin without UI prompts when explicitly confirmed by the user.
   */
  public static async emptyRecycleBin(): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve) => {
      const script = 'Clear-RecycleBin -Force -Confirm:$false -ErrorAction SilentlyContinue';

      execFile(
        'powershell.exe',
        ['-NoProfile', '-NonInteractive', '-Command', script],
        { timeout: 15000, windowsHide: true },
        (error) => {
          if (error) {
            resolve({ success: false, error: error.message });
          } else {
            resolve({ success: true });
          }
        }
      );
    });
  }
}
