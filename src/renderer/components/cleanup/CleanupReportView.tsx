import React, { useState } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  FolderSearch,
  Globe,
  Trash2,
  HardDrive,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  LayoutDashboard,
} from 'lucide-react';
import { CleanupResult } from '../../../shared/types';
import { formatBytes } from '../../utils/formatters';

interface CleanupReportViewProps {
  result: CleanupResult;
  onDone: () => void;
  onScanAgain: () => void;
  onGoToDashboard: () => void;
}

export const CleanupReportView: React.FC<CleanupReportViewProps> = ({
  result,
  onScanAgain,
  onGoToDashboard,
}) => {
  const [showSkippedDetails, setShowSkippedDetails] = useState(false);

  const skippedList = result.itemResults.filter((it) => it.status === 'skipped');

  const getCategoryIcon = (catName: string) => {
    switch (catName) {
      case 'user_temp':
      case 'windows_temp':
        return <FolderSearch className="w-4 h-4 text-blue-400" />;
      case 'browser_cache':
        return <Globe className="w-4 h-4 text-indigo-400" />;
      case 'recycle_bin':
        return <Trash2 className="w-4 h-4 text-emerald-400" />;
      default:
        return <HardDrive className="w-4 h-4 text-slate-400" />;
    }
  };

  const getCategoryLabel = (catName: string) => {
    switch (catName) {
      case 'user_temp':
        return 'User Temporary Files';
      case 'windows_temp':
        return 'Windows System Temp';
      case 'browser_cache':
        return 'Browser Cache';
      case 'recycle_bin':
        return 'Recycle Bin';
      default:
        return catName;
    }
  };

  return (
    <div className="space-y-7">
      {/* Header Banner */}
      <div className="bg-slate-900/40 rounded-xl p-6 border border-slate-800 space-y-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-emerald-950/60 border border-emerald-800/60 flex items-center justify-center text-emerald-400">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-100">Cleanup Complete</h2>
            <p className="text-xs text-slate-400">
              Selected files have been removed from your disk.
            </p>
          </div>
        </div>

        <div className="mt-2 flex items-baseline gap-3">
          <div className="text-3xl font-bold tracking-tight text-slate-100 font-mono">
            {formatBytes(result.bytesFreed)}
          </div>
          <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">
            Freed on Disk
          </span>
        </div>

        <div className="flex items-center gap-4 text-xs text-slate-400 pt-2 border-t border-slate-800/60">
          <span>{result.deletedItems.toLocaleString()} items removed</span>
          <span>•</span>
          <span>{result.skippedItems.toLocaleString()} items skipped</span>
        </div>
      </div>

      {/* Category Breakdown */}
      <div className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Cleanup Summary by Category
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {Object.entries(result.categoriesFreed).map(([catName, data]) => (
            <div
              key={catName}
              className="p-4 rounded-lg bg-slate-900/50 border border-slate-800/80 flex flex-col justify-between"
            >
              <div className="flex items-center gap-2 text-xs font-medium text-slate-300 mb-2">
                {getCategoryIcon(catName)}
                <span>{getCategoryLabel(catName)}</span>
              </div>
              <div className="text-lg font-bold text-slate-100 font-mono">
                {formatBytes(data.bytes)}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                {data.count.toLocaleString()} {data.count === 1 ? 'item' : 'items'} cleaned
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Skipped Items Accordion if any */}
      {skippedList.length > 0 && (
        <div className="rounded-lg bg-slate-900/40 border border-slate-800/80 overflow-hidden text-xs">
          <button
            onClick={() => setShowSkippedDetails(!showSkippedDetails)}
            className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-800/30 transition-colors"
          >
            <div className="flex items-center gap-2 text-slate-300">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                <strong>{skippedList.length} files were in use</strong> and could not be removed.
              </span>
            </div>
            {showSkippedDetails ? (
              <ChevronUp className="w-4 h-4 text-slate-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-slate-400" />
            )}
          </button>

          {showSkippedDetails && (
            <div className="p-4 pt-0 border-t border-slate-800/60 max-h-48 overflow-y-auto space-y-1.5">
              {skippedList.map((item, idx) => (
                <div
                  key={`${item.itemId}-${idx}`}
                  className="flex items-center justify-between p-2 rounded bg-slate-950/60 text-[11px]"
                >
                  <span className="font-mono text-slate-300 truncate max-w-sm">{item.name}</span>
                  <span className="text-amber-400/80">{item.reason}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Action Footer */}
      <div className="flex items-center justify-between pt-4 border-t border-slate-800">
        <button
          onClick={onScanAgain}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium bg-slate-900 border border-slate-700/80 text-slate-300 hover:text-slate-100 hover:bg-slate-800 transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Scan Again</span>
        </button>

        <button
          onClick={onGoToDashboard}
          className="inline-flex items-center gap-2 px-5 py-2 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white transition-colors"
        >
          <LayoutDashboard className="w-3.5 h-3.5" />
          <span>Back to Dashboard</span>
        </button>
      </div>
    </div>
  );
};
