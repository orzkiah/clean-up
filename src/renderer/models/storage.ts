import { DiskInfo, DriveType, StorageOverview } from '../../shared/types';

export type { DiskInfo, DriveType, StorageOverview };

export type NavigationPage =
  | 'dashboard'
  | 'scan'
  | 'large-files'
  | 'old-files'
  | 'duplicates'
  | 'history'
  | 'settings';

export interface StorageHealthState {
  status: 'optimal' | 'moderate' | 'critical';
  label: string;
  description: string;
}

export function computeStorageHealth(usedPercentage: number): StorageHealthState {
  if (usedPercentage >= 90) {
    return {
      status: 'critical',
      label: 'Low Disk Space',
      description: 'Over 90% of disk space is in use. Performance and system updates may be impacted.',
    };
  }
  if (usedPercentage >= 75) {
    return {
      status: 'moderate',
      label: 'Moderate Storage Usage',
      description: 'Storage is above 75% capacity. Consider reviewing large or unneeded files soon.',
    };
  }
  return {
    status: 'optimal',
    label: 'Normal Capacity',
    description: 'Sufficient storage space is available on this volume.',
  };
}
