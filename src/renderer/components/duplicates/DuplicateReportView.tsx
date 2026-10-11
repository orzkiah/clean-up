import React from 'react';
import { CheckCircle2, AlertCircle, ArrowLeft, Trash2, FolderCheck } from 'lucide-react';
import { DuplicateResolutionResult } from '../../../shared/types';
import { formatBytes } from '../../utils/formatters';

interface DuplicateReportViewProps {
  result: DuplicateResolutionResult;
  onDone: () => void;
}

export const DuplicateReportView: React.FC<DuplicateReportViewProps> = ({ result, onDone }) => {
  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/60 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-semibold text-slate-100 tracking-tight">Resolution Summary</h1>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-900/60 font-mono">
              Recycle Bin Verified
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Selected duplicate files have been safely relocated to the Windows Recycle Bin.
          </p>
        </div>

        <button
          onClick={onDone}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white transition-all shadow-sm shadow-blue-900/40 self-start sm:self-auto"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Duplicates</span>
        </button>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-slate-900/40 rounded-xl p-5 border border-slate-800">
          <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
            <FolderCheck className="w-4 h-4 text-emerald-400" />
            <span>Reclaimed Space</span>
          </div>
          <div className="text-2xl font-bold tracking-tight text-slate-100 font-mono">
            {formatBytes(result.bytesReclaimed)}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Free space recovered</p>
        </div>

        <div className="bg-slate-900/40 rounded-xl p-5 border border-slate-800">
          <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
            <Trash2 className="w-4 h-4 text-emerald-400" />
            <span>Moved to Recycle Bin</span>
          </div>
          <div className="text-2xl font-bold tracking-tight text-slate-100 font-mono">
            {result.movedCount.toLocaleString()}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Restorable from Recycle Bin</p>
        </div>

        <div className="bg-slate-900/40 rounded-xl p-5 border border-slate-800">
          <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
            <AlertCircle className="w-4 h-4 text-amber-400" />
            <span>Skipped</span>
          </div>
          <div className="text-2xl font-bold tracking-tight text-slate-100 font-mono">
            {result.skippedCount.toLocaleString()}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Preserved unchanged</p>
        </div>

        <div className="bg-slate-900/40 rounded-xl p-5 border border-slate-800">
          <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
            <AlertCircle className="w-4 h-4 text-rose-400" />
            <span>Failed</span>
          </div>
          <div className="text-2xl font-bold tracking-tight text-slate-100 font-mono">
            {result.failedCount.toLocaleString()}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Encountered errors</p>
        </div>
      </div>

      {/* Items Breakdown Table */}
      <div className="bg-slate-900/40 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="px-5 py-3.5 bg-slate-900/80 border-b border-slate-800/80 flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300">
            Processed Files ({result.items.length})
          </h3>
          <span className="text-[11px] text-slate-500 font-mono">
            ID: {result.resolutionId.substring(0, 16)}...
          </span>
        </div>

        <div className="divide-y divide-slate-800/50 max-h-96 overflow-y-auto">
          {result.items.map((item) => (
            <div key={item.itemId} className="p-3.5 flex items-center justify-between gap-4 text-xs">
              <div className="min-w-0">
                <div className="font-medium text-slate-200 truncate">{item.name}</div>
                <div className="text-[11px] text-slate-500 font-mono truncate" title={item.fullPath}>
                  {item.fullPath}
                </div>
              </div>

              <div className="flex items-center gap-4 shrink-0">
                <span className="font-mono text-slate-400">{formatBytes(item.sizeBytes)}</span>
                {item.status === 'moved_to_trash' && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-950/60 text-emerald-400 border border-emerald-900/60">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Recycled</span>
                  </span>
                )}
                {item.status === 'skipped' && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-amber-950/60 text-amber-400 border border-amber-900/60">
                    <AlertCircle className="w-3 h-3" />
                    <span>Skipped</span>
                  </span>
                )}
                {item.status === 'failed' && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-rose-950/60 text-rose-400 border border-rose-900/60" title={item.reason}>
                    <AlertCircle className="w-3 h-3" />
                    <span>Failed</span>
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
