import React, { useState } from 'react';
import {
  History,
  Trash2,
  HardDrive,
  CheckCircle2,
  ShieldCheck,
  Calendar,
} from 'lucide-react';
import { useCleanup } from '../core/CleanupContext';
import { EmptyState } from '../components/common/EmptyState';
import { formatBytes } from '../utils/formatters';

export const HistoryPage: React.FC = () => {
  const { history, clearHistory } = useCleanup();
  const [isClearing, setIsClearing] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const totalBytesFreed = history.reduce((acc, h) => acc + h.bytesFreed, 0);
  const totalItemsDeleted = history.reduce((acc, h) => acc + h.itemsDeleted, 0);

  const handleClear = async () => {
    setIsClearing(true);
    try {
      await clearHistory();
      setShowClearConfirm(false);
    } finally {
      setIsClearing(false);
    }
  };

  const formatCategories = (cats: { name: string; bytes: number; count: number }[]) => {
    return cats
      .map((c) => {
        switch (c.name) {
          case 'user_temp':
            return 'User Temp';
          case 'windows_temp':
            return 'Windows Temp';
          case 'browser_cache':
            return 'Browser Cache';
          case 'recycle_bin':
            return 'Recycle Bin';
          default:
            return c.name;
        }
      })
      .join(', ');
  };

  return (
    <div className="space-y-7">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/60 pb-5">
        <div>
          <h1 className="text-xl font-semibold text-slate-100 tracking-tight">Cleanup History</h1>
          <p className="text-xs text-slate-400 mt-1">
            Audit trail of confirmed cleanup operations and cumulative storage recovered.
          </p>
        </div>

        {history.length > 0 && (
          <div className="flex items-center gap-2">
            {showClearConfirm ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">Clear audit log?</span>
                <button
                  onClick={handleClear}
                  disabled={isClearing}
                  className="px-2.5 py-1 rounded text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white transition-colors disabled:opacity-50"
                >
                  Yes, Clear
                </button>
                <button
                  onClick={() => setShowClearConfirm(false)}
                  disabled={isClearing}
                  className="px-2.5 py-1 rounded text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowClearConfirm(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-800 bg-slate-900/60 text-slate-400 hover:text-rose-400 hover:border-rose-900/60 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear History</span>
              </button>
            )}
          </div>
        )}
      </div>

      {history.length === 0 ? (
        <EmptyState
          icon={<History className="w-6 h-6" />}
          title="No Cleanup History Yet"
          description="When you confirm and execute cleanup operations, audit summaries of recovered storage will appear here."
        />
      ) : (
        <>
          {/* Top Aggregate Summary Card */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-slate-900/40 rounded-xl p-5 border border-slate-800">
              <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
                <HardDrive className="w-4 h-4 text-emerald-400" />
                <span>Total Space Recovered</span>
              </div>
              <div className="text-2xl font-bold tracking-tight text-slate-100 font-mono">
                {formatBytes(totalBytesFreed)}
              </div>
            </div>

            <div className="bg-slate-900/40 rounded-xl p-5 border border-slate-800">
              <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
                <CheckCircle2 className="w-4 h-4 text-blue-400" />
                <span>Total Files Cleaned</span>
              </div>
              <div className="text-2xl font-bold tracking-tight text-slate-100 font-mono">
                {totalItemsDeleted.toLocaleString()}
              </div>
            </div>

            <div className="bg-slate-900/40 rounded-xl p-5 border border-slate-800">
              <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
                <Calendar className="w-4 h-4 text-indigo-400" />
                <span>Operations Run</span>
              </div>
              <div className="text-2xl font-bold tracking-tight text-slate-100 font-mono">
                {history.length}
              </div>
            </div>
          </div>

          {/* History Records Table */}
          <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-900/30">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900/80 text-slate-400 border-b border-slate-800 select-none">
                  <tr>
                    <th className="py-3 px-4 font-medium">Timestamp</th>
                    <th className="py-3 px-4 font-medium text-right">Space Freed</th>
                    <th className="py-3 px-4 font-medium text-right">Items Removed</th>
                    <th className="py-3 px-4 font-medium">Categories Cleaned</th>
                    <th className="py-3 px-4 font-medium text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {history.map((record) => (
                    <tr key={record.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-2.5 px-4 text-slate-300 font-mono text-[11px]">
                        {record.formattedDate} {record.formattedTime}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono font-semibold text-emerald-400">
                        {formatBytes(record.bytesFreed)}
                      </td>
                      <td className="py-2.5 px-4 text-right text-slate-300 font-mono">
                        {record.itemsDeleted.toLocaleString()}
                        {record.itemsSkipped > 0 && (
                          <span className="text-[10px] text-amber-400 ml-1.5">
                            ({record.itemsSkipped} skipped)
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 text-slate-400 text-[11px] max-w-xs truncate">
                        {formatCategories(record.categories)}
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-400 border border-emerald-900/60">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Logged</span>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Privacy Guarantee Note */}
          <div className="p-4 rounded-lg bg-slate-900/30 border border-slate-800/60 flex items-center justify-between text-xs text-slate-400">
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                Privacy Guarantee: CleanUp stores only aggregate operational statistics. Individual file
                names and directory paths are never persisted in history logs.
              </span>
            </div>
            <span className="text-[11px] text-slate-500 font-mono">Zero Metadata Leak</span>
          </div>
        </>
      )}
    </div>
  );
};
