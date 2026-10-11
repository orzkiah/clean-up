import React from 'react';
import { HardDrive, Check } from 'lucide-react';
import { DiskInfo } from '../../models/storage';
import { formatBytes } from '../../utils/formatters';

interface DriveSelectorProps {
  drives: DiskInfo[];
  selectedDriveId: string;
  onSelectDrive: (driveId: string) => void;
}

export const DriveSelector: React.FC<DriveSelectorProps> = ({
  drives,
  selectedDriveId,
  onSelectDrive,
}) => {
  if (drives.length <= 1) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-slate-400 font-medium mr-1">Drive:</span>
      {drives.map((drive) => {
        const isSelected = drive.id === selectedDriveId;

        return (
          <button
            key={drive.id}
            onClick={() => onSelectDrive(drive.id)}
            disabled={!drive.isAvailable}
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-xs transition-all border ${
              isSelected
                ? 'bg-slate-800 text-slate-100 border-slate-600 shadow-sm font-medium'
                : drive.isAvailable
                ? 'bg-slate-900/60 text-slate-400 border-slate-800 hover:text-slate-200 hover:border-slate-700'
                : 'bg-slate-900/30 text-slate-600 border-slate-800/40 cursor-not-allowed opacity-60'
            }`}
          >
            <HardDrive className={`w-3.5 h-3.5 ${isSelected ? 'text-blue-400' : 'text-slate-500'}`} />
            <span>
              {drive.id} {drive.label ? `(${drive.label})` : ''}
            </span>
            {drive.isSystemDrive && (
              <span className="text-[10px] uppercase font-mono px-1 py-0.2 rounded bg-blue-950/60 text-blue-400 border border-blue-900/50">
                System
              </span>
            )}
            {drive.isAvailable && (
              <span className="text-slate-500 font-normal">
                · {formatBytes(drive.freeBytes)} free
              </span>
            )}
            {isSelected && <Check className="w-3 h-3 text-blue-400 ml-1" />}
          </button>
        );
      })}
    </div>
  );
};
