import React from 'react';
import { Loader2, XCircle, Trash2, ShieldAlert } from 'lucide-react';
import { CleanupProgress } from '../../../shared/types';
import { formatBytes } from '../../utils/formatters';

interface CleanupProgressViewProps {
  progress: CleanupProgress | null;
  onCancel: () => void;
  isCancelling: boolean;
}

export const CleanupProgressView: React.FC<CleanupProgressViewProps> = ({
  progress,
  onCancel,
  isCancelling,
}) => {
  const currentIndex = progress?.currentIndex || 0;
  const totalItems = progress?.totalItems || 1;
  const percent = Math.min(100, Math.round((currentIndex / totalItems) * 100));

  return (
    <div className="bg-slate-900/50 rounded-xl p-7 border border-slate-800 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-rose-950/60 border border-rose-800/50 flex items-center justify-center text-rose-400">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-100">Cleaning storage</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Permanently removing selected temporary and cached files...
            </p>
          </div>
        </div>

        <button
          onClick={onCancel}
          disabled={isCancelling}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium border border-slate-700 bg-slate-900 text-slate-300 hover:text-rose-300 hover:border-rose-800 transition-colors disabled:opacity-50"
        >
          <XCircle className="w-3.5 h-3.5" />
          <span>{isCancelling ? 'Cancelling...' : 'Cancel Cleanup'}</span>
        </button>
      </div>

      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="flex justify-between text-xs text-slate-400">
          <span>
            Progress: {currentIndex.toLocaleString()} of {totalItems.toLocaleString()} items
          </span>
          <span>{percent}%</span>
        </div>
        <div className="h-2 w-full bg-slate-800/90 rounded-full overflow-hidden p-0.5 border border-slate-700/50">
          <div
            className="h-full bg-rose-500 rounded-full transition-all duration-300 ease-out"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>

      {/* Live Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="p-3.5 rounded-lg bg-slate-950/60 border border-slate-800/80">
          <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
            <Trash2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Space Freed</span>
          </div>
          <div className="text-xl font-bold text-slate-100 font-mono">
            {formatBytes(progress?.bytesFreed || 0)}
          </div>
        </div>

        <div className="p-3.5 rounded-lg bg-slate-950/60 border border-slate-800/80">
          <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
            <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
            <span>Skipped (In Use)</span>
          </div>
          <div className="text-xl font-bold text-slate-100 font-mono">
            {progress?.skippedCount || 0}
          </div>
        </div>
      </div>

      {/* Current File Being Removed */}
      <div className="pt-2 border-t border-slate-800/60 text-xs text-slate-500 truncate font-mono">
        <span className="text-slate-400">Processing: </span>
        <span>{progress?.currentItemName || 'Initializing...'}</span>
      </div>
    </div>
  );
};
