import React from 'react';
import { Trash2, AlertTriangle, ShieldCheck, X, Loader2 } from 'lucide-react';
import { DuplicateResolutionPlan } from '../../../shared/types';
import { formatBytes } from '../../utils/formatters';

interface DuplicateConfirmModalProps {
  plan: DuplicateResolutionPlan;
  isExecuting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const DuplicateConfirmModal: React.FC<DuplicateConfirmModalProps> = ({
  plan,
  isExecuting,
  onConfirm,
  onCancel,
}) => {
  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700/80 rounded-xl shadow-2xl max-w-xl w-full flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-rose-950/60 border border-rose-800/60 flex items-center justify-center text-rose-400 shrink-0">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-100">
                Move {formatBytes(plan.totalBytesToReclaim)} to Windows Recycle Bin
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Confirm removal of {plan.itemsToRemove.length} duplicate {plan.itemsToRemove.length === 1 ? 'file' : 'files'}
              </p>
            </div>
          </div>
          <button
            onClick={onCancel}
            disabled={isExecuting}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content & File List */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {/* Safety Notice */}
          <div className="p-3.5 rounded-lg bg-emerald-950/30 border border-emerald-800/40 flex items-start gap-2.5 text-xs text-emerald-300">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <strong>Original Copies Kept: </strong>
              At least one original copy of each duplicate group is preserved. Files will be moved to the{' '}
              <strong className="text-emerald-200">Windows Recycle Bin</strong>, allowing you to restore them at any time.
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
              Items to be moved ({plan.itemsToRemove.length}):
            </div>
            <div className="max-h-56 overflow-y-auto border border-slate-800 rounded-lg bg-slate-950/60 divide-y divide-slate-800/60">
              {plan.itemsToRemove.map((item) => (
                <div key={item.itemId} className="p-2.5 flex items-center justify-between gap-3 text-xs">
                  <div className="min-w-0">
                    <div className="font-medium text-slate-200 truncate">{item.name}</div>
                    <div className="text-[11px] text-slate-500 font-mono truncate" title={item.fullPath}>
                      {item.fullPath}
                    </div>
                  </div>
                  <span className="font-mono text-slate-400 shrink-0">
                    {formatBytes(item.sizeBytes)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="p-3 rounded-lg bg-slate-800/40 border border-slate-700/60 text-xs text-slate-400 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <span>
              Files will not be unlinked permanently. They can be inspected or restored from the Windows Recycle Bin.
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 flex items-center justify-end gap-3 bg-slate-900/50">
          <button
            type="button"
            onClick={onCancel}
            disabled={isExecuting}
            className="px-4 py-2 rounded-lg text-xs font-medium border border-slate-700 hover:bg-slate-800 text-slate-300 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isExecuting}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white transition-all shadow-sm shadow-rose-900/40 disabled:opacity-50"
          >
            {isExecuting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Moving to Recycle Bin...</span>
              </>
            ) : (
              <>
                <Trash2 className="w-3.5 h-3.5" />
                <span>Move to Windows Recycle Bin</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
