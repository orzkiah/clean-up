import React from 'react';
import { Loader2, XCircle, Folder, FileText, HardDrive } from 'lucide-react';
import { ScanProgress } from '../../../shared/types';
import { formatBytes } from '../../utils/formatters';

interface ScanProgressViewProps {
  progress: ScanProgress | null;
  onCancel: () => void;
  isCancelling: boolean;
}

export const ScanProgressView: React.FC<ScanProgressViewProps> = ({
  progress,
  onCancel,
  isCancelling,
}) => {
  const categoriesDone = progress?.categoriesCompleted || 0;
  const totalCategories = progress?.totalCategories || 6;
  const percent = totalCategories > 0 ? (categoriesDone / totalCategories) * 100 : 0;

  return (
    <div className="bg-slate-900/50 rounded-xl p-7 border border-slate-800 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-950/60 border border-blue-800/50 flex items-center justify-center text-blue-400">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-100">Scanning your storage</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {progress?.currentScanner || 'Preparing filesystem inspection...'}
            </p>
          </div>
        </div>

        <button
          onClick={onCancel}
          disabled={isCancelling}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium border border-slate-700 bg-slate-900 text-slate-300 hover:text-rose-300 hover:border-rose-900/60 transition-colors disabled:opacity-50"
        >
          <XCircle className="w-3.5 h-3.5" />
          <span>{isCancelling ? 'Cancelling...' : 'Cancel Scan'}</span>
        </button>
      </div>

      {/* Category Progress Bar */}
      <div className="space-y-2">
        <div className="flex justify-between text-xs text-slate-400">
          <span>Categories: {categoriesDone} of {totalCategories}</span>
          <span>{percent.toFixed(0)}%</span>
        </div>
        <div className="h-2 w-full bg-slate-800/90 rounded-full overflow-hidden p-0.5 border border-slate-700/50">
          <div
            className="h-full bg-blue-500 rounded-full transition-all duration-300 ease-out"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>

      {/* Live Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-3.5 rounded-lg bg-slate-950/60 border border-slate-800/80">
          <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
            <FileText className="w-3.5 h-3.5 text-blue-400" />
            <span>Files Inspected</span>
          </div>
          <div className="text-lg font-semibold text-slate-100 font-mono">
            {progress ? progress.filesScanned.toLocaleString() : 0}
          </div>
        </div>

        <div className="p-3.5 rounded-lg bg-slate-950/60 border border-slate-800/80">
          <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
            <Folder className="w-3.5 h-3.5 text-slate-400" />
            <span>Folders Traversed</span>
          </div>
          <div className="text-lg font-semibold text-slate-100 font-mono">
            {progress ? progress.foldersScanned.toLocaleString() : 0}
          </div>
        </div>

        <div className="p-3.5 rounded-lg bg-slate-950/60 border border-slate-800/80">
          <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
            <HardDrive className="w-3.5 h-3.5 text-emerald-400" />
            <span>Discovered Space</span>
          </div>
          <div className="text-lg font-semibold text-slate-100">
            {formatBytes(progress?.bytesDiscovered || 0)}
          </div>
        </div>
      </div>

      {/* Current location label */}
      <div className="pt-2 border-t border-slate-800/60 text-xs text-slate-500 truncate font-mono">
        <span className="text-slate-400">Inspecting: </span>
        <span>{progress?.currentPath || 'Scanning root...'}</span>
      </div>
    </div>
  );
};
