import * as fs from 'fs';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export interface TrashResult {
  success: boolean;
  error?: string;
}

export class DuplicateTrashService {
  /**
   * Moves a file to the Windows Recycle Bin.
   *
   * STRICT SAFETY RULE:
   * Direct unlinking (e.g. fs.unlinkSync) is NEVER used for duplicate resolution.
   * Files MUST only be sent to the OS Recycle Bin so that the user can restore them if needed.
   */
  public static async moveToRecycleBin(filePath: string): Promise<TrashResult> {
    if (!fs.existsSync(filePath)) {
      return { success: false, error: 'File does not exist on disk' };
    }

    // Try Electron shell.trashItem if running within Electron
    try {
      // Dynamic require so non-Electron node environments (like unit test runner) don't crash
      const electron = require('electron');
      if (electron && electron.shell && typeof electron.shell.trashItem === 'function') {
        await electron.shell.trashItem(filePath);
        // Verify the original file no longer exists at its previous location
        if (!fs.existsSync(filePath)) {
          return { success: true };
        }
      }
    } catch {
      // If shell.trashItem fails or electron is not available (e.g., in unit tests), fallback to PowerShell Recycle Bin
    }

    // Fallback: Use PowerShell Microsoft.VisualBasic.FileIO to send to Windows Recycle Bin
    try {
      const psScript = `
        Add-Type -AssemblyName Microsoft.VisualBasic;
        [Microsoft.VisualBasic.FileIO.FileSystem]::DeleteFile(
          $env:TARGET_FILE_TO_RECYCLE,
          [Microsoft.VisualBasic.FileIO.UIOption]::OnlyErrorDialogs,
          [Microsoft.VisualBasic.FileIO.RecycleOption]::SendToRecycleBin
        );
      `;

      await execFileAsync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', psScript], {
        env: {
          ...process.env,
          TARGET_FILE_TO_RECYCLE: filePath,
        },
      });

      if (!fs.existsSync(filePath)) {
        return { success: true };
      } else {
        return { success: false, error: 'File still exists after Recycle Bin operation' };
      }
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || 'Failed to move file to Windows Recycle Bin',
      };
    }
  }
}
