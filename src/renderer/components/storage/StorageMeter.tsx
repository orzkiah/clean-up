import React from 'react';
import { formatBytes, formatPercentage } from '../../utils/formatters';

interface StorageMeterProps {
  totalBytes: number;
  usedBytes: number;
  freeBytes: number;
  usedPercentage: number;
}

export const StorageMeter: React.FC<StorageMeterProps> = ({
  totalBytes,
  usedBytes,
  freeBytes,
  usedPercentage,
}) => {
  // Determine subtle status accent based on percentage
  const getBarColor = (pct: number) => {
    if (pct >= 90) return 'bg-amber-500';
    if (pct >= 80) return 'bg-amber-400/80';
    return 'bg-blue-500';
  };

  return (
    <div className="w-full space-y-3">
      {/* Progress Bar Container */}
      <div className="h-3 w-full bg-slate-800/80 rounded-full overflow-hidden p-0.5 border border-slate-700/50">
        <div
          className={`h-full rounded-full transition-all duration-500 ease-out ${getBarColor(
            usedPercentage
          )}`}
          style={{ width: `${Math.min(100, Math.max(0, usedPercentage))}%` }}
        />
      </div>

      {/* Legend & Details */}
      <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-blue-500 inline-block" />
            <span className="text-slate-300 font-medium">{formatBytes(usedBytes)}</span>
            <span className="text-slate-500">used ({formatPercentage(usedPercentage)})</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-slate-700 inline-block" />
            <span className="text-slate-300 font-medium">{formatBytes(freeBytes)}</span>
            <span className="text-slate-500">free</span>
          </div>
        </div>

        <div className="text-slate-400 text-right">
          <span className="text-slate-500 mr-1.5">Capacity:</span>
          <span className="font-medium text-slate-200">{formatBytes(totalBytes)}</span>
        </div>
      </div>
    </div>
  );
};
