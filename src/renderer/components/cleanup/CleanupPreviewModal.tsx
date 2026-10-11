import React from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';
import { CleanupPlan } from '../../../shared/types';
import { formatBytes } from '../../utils/formatters';

interface CleanupPreviewModalProps {
  isOpen: boolean;
  plan: CleanupPlan | null;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading: boolean;
}

export const CleanupPreviewModal: React.FC<CleanupPreviewModalProps> = ({
  isOpen,
  plan,
  onConfirm,
  onCancel,
  isLoading,
}) => {
  if (!isOpen || !plan) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 rounded-xl shadow-2xl max-w-lg w-full overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-950/50 border border-amber-800/60 flex items-center justify-center text-amber-400">
              <Trash2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-100">Review Cleanup</h3>
              <p className="text-xs text-slate-400">Confirmation required before permanent deletion</p>
            </div>
          </div>
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="text-slate-400 hover:text-slate-200 p-1 rounded-md hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5">
          <div className="space-y-2">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-400">
              You selected for removal:
            </span>
            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {plan.categories.map((cat) => (
                <div
                  key={cat.category}
                  className="flex items-center justify-between p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 text-xs"
                >
                  <span className="font-medium text-slate-200">{cat.title}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-slate-400">
                      {cat.count.toLocaleString()} {cat.count === 1 ? 'item' : 'items'}
                    </span>
                    <span className="font-semibold text-slate-200 font-mono">
                      {formatBytes(cat.totalBytes)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Total Highlight */}
          <div className="pt-3 border-t border-slate-800 flex items-baseline justify-between">
            <span className="text-xs text-slate-400 font-medium">Total Space to Clean:</span>
            <span className="text-xl font-bold tracking-tight text-slate-100 font-mono">
              {formatBytes(plan.totalBytes)}
            </span>
          </div>

          {/* Warning Notice */}
          <div className="p-3 rounded-lg bg-amber-950/20 border border-amber-800/30 flex items-start gap-2.5 text-xs text-amber-300/90 leading-relaxed">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <span>
                These files will be permanently removed. Files actively locked or in use by Windows
                will be safely skipped automatically.
              </span>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-slate-950/60 border-t border-slate-800 flex items-center justify-end gap-3">
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="px-4 py-2 rounded-lg text-xs font-medium text-slate-300 hover:text-slate-100 hover:bg-slate-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className="px-5 py-2 rounded-lg text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white transition-colors shadow-sm disabled:opacity-50"
          >
            {isLoading ? 'Preparing...' : `Clean ${formatBytes(plan.totalBytes)}`}
          </button>
        </div>
      </div>
    </div>
  );
};
