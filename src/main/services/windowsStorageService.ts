import { execFile } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { DiskInfo, DriveType, StorageOverview } from '../../shared/types';

interface CimDriveOutput {
  DeviceID?: string;
  VolumeName?: string;
  FileSystem?: string;
  Size?: number | string;
  FreeSpace?: number | string;
  DriveType?: number;
}

export class WindowsStorageService {
  private getSystemDriveLetter(): string {
    const sysDrive = process.env.SystemDrive || (process.env.WINDIR ? path.parse(process.env.WINDIR).root : 'C:');
    return sysDrive.replace(/\\$/, '').toUpperCase();
  }

  private mapDriveType(typeNum?: number): DriveType {
    // Win32_LogicalDisk DriveType values:
    // 0: Unknown, 1: No Root Directory, 2: Removable, 3: Local Fixed, 4: Network, 5: Compact Disc, 6: RAM Disk
    switch (typeNum) {
      case 2:
        return 'removable';
      case 3:
        return 'fixed';
      case 4:
        return 'network';
      case 5:
        return 'cdrom';
      case 6:
        return 'ramdisk';
      default:
        return 'unknown';
    }
  }

  /**
   * Primary method: query Windows Management Instrumentation (WMI / CIM) via PowerShell
   */
  private async queryWindowsDrivesViaCim(): Promise<CimDriveOutput[]> {
    return new Promise((resolve, reject) => {
      const psCommand =
        'Get-CimInstance Win32_LogicalDisk | Select-Object DeviceID, VolumeName, FileSystem, Size, FreeSpace, DriveType | ConvertTo-Json -Compress';

      execFile(
        'powershell.exe',
        ['-NoProfile', '-NonInteractive', '-Command', psCommand],
        { timeout: 8000, windowsHide: true },
        (error, stdout, stderr) => {
          if (error) {
            reject(new Error(`PowerShell disk query failed: ${error.message}`));
            return;
          }

          const raw = stdout.trim();
          if (!raw) {
            resolve([]);
            return;
          }

          try {
            const parsed = JSON.parse(raw);
            const list: CimDriveOutput[] = Array.isArray(parsed) ? parsed : [parsed];
            resolve(list);
          } catch (parseErr) {
            reject(new Error(`Failed to parse CIM disk json: ${(parseErr as Error).message}`));
          }
        }
      );
    });
  }

  /**
   * Fallback method using Node.js statfsSync
   */
  private getDriveStatsViaNode(driveId: string): { total: number; free: number } | null {
    try {
      const mount = driveId.endsWith('\\') ? driveId : `${driveId}\\`;
      if (!fs.existsSync(mount)) {
        return null;
      }
      const stats = fs.statfsSync(mount);
      const total = Number(stats.blocks) * Number(stats.bsize);
      const free = Number(stats.bavail) * Number(stats.bsize);
      return { total, free };
    } catch {
      return null;
    }
  }

  /**
   * Reads all available Windows storage drives
   */
  public async getStorageOverview(): Promise<StorageOverview> {
    const systemDriveLetter = this.getSystemDriveLetter();
    const driveMap = new Map<string, DiskInfo>();

    try {
      const cimDrives = await this.queryWindowsDrivesViaCim();

      for (const item of cimDrives) {
        if (!item.DeviceID) continue;
        const id = item.DeviceID.toUpperCase();
        const isSystem = id === systemDriveLetter;
        const total = item.Size ? Number(item.Size) : 0;
        const free = item.FreeSpace ? Number(item.FreeSpace) : 0;
        const used = Math.max(0, total - free);
        const usedPercentage = total > 0 ? Number(((used / total) * 100).toFixed(1)) : 0;
        const driveType = this.mapDriveType(item.DriveType);

        const isAvailable = total > 0;
        let label = item.VolumeName?.trim() || '';
        if (!label) {
          if (isSystem) {
            label = 'Windows System';
          } else if (driveType === 'fixed') {
            label = 'Local Disk';
          } else if (driveType === 'removable') {
            label = 'Removable Drive';
          } else if (driveType === 'network') {
            label = 'Network Drive';
          } else {
            label = 'Drive';
          }
        }

        driveMap.set(id, {
          id,
          label,
          mountPoint: `${id}\\`,
          fileSystem: item.FileSystem || 'Unknown',
          driveType,
          isSystemDrive: isSystem,
          totalBytes: total,
          freeBytes: free,
          usedBytes: used,
          usedPercentage,
          isAvailable,
          error: isAvailable ? undefined : 'Drive media not present or inaccessible',
        });
      }
    } catch (cimError) {
      console.warn('CIM query failed, falling back to direct statfs inspection:', cimError);
    }

    // Ensure system drive is present at least
    if (!driveMap.has(systemDriveLetter)) {
      const nodeStats = this.getDriveStatsViaNode(systemDriveLetter);
      if (nodeStats) {
        const total = nodeStats.total;
        const free = nodeStats.free;
        const used = Math.max(0, total - free);
        const usedPercentage = total > 0 ? Number(((used / total) * 100).toFixed(1)) : 0;

        driveMap.set(systemDriveLetter, {
          id: systemDriveLetter,
          label: 'Windows System Drive',
          mountPoint: `${systemDriveLetter}\\`,
          fileSystem: 'NTFS',
          driveType: 'fixed',
          isSystemDrive: true,
          totalBytes: total,
          freeBytes: free,
          usedBytes: used,
          usedPercentage,
          isAvailable: true,
        });
      } else {
        // Record with error if inaccessible
        driveMap.set(systemDriveLetter, {
          id: systemDriveLetter,
          label: 'System Drive',
          mountPoint: `${systemDriveLetter}\\`,
          fileSystem: 'Unknown',
          driveType: 'fixed',
          isSystemDrive: true,
          totalBytes: 0,
          freeBytes: 0,
          usedBytes: 0,
          usedPercentage: 0,
          isAvailable: false,
          error: 'Access denied or drive information unavailable',
        });
      }
    }

    const drives = Array.from(driveMap.values()).sort((a, b) => {
      if (a.isSystemDrive) return -1;
      if (b.isSystemDrive) return 1;
      return a.id.localeCompare(b.id);
    });

    const systemDrive = drives.find((d) => d.isSystemDrive) || drives[0] || null;

    return {
      systemDrive,
      drives,
      lastUpdated: new Date().toISOString(),
    };
  }

  public async getDriveDetails(driveId: string): Promise<DiskInfo | null> {
    const overview = await this.getStorageOverview();
    const normalized = driveId.toUpperCase().replace(/\\$/, '');
    const drive = overview.drives.find((d) => d.id === normalized);
    return drive || null;
  }
}
