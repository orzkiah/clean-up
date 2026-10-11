import React, { useState } from 'react';
import {
  ShieldCheck,
  RefreshCw,
  FolderSearch,
  HardDrive,
  FileStack,
  Clock,
  Trash2,
  Globe,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { ScanResult, ScanCategoryId, CategorySummary } from '../../../shared/types';
import { formatBytes } from '../../utils/formatters';
import { useCleanup } from '../../core/CleanupContext';

interface ScanSummaryViewProps {
  results: ScanResult;
  onSelectCategory: (categoryId: ScanCategoryId) => void;
  onRescan: () => void;
}

export const ScanSummaryView: React.FC<ScanSummaryViewProps> = ({
  results,
  onSelectCategory,
  onRescan,
}) => {
  const { selectItems, preparePlanForSelected } = useCleanup();
  const [isValidatingSafe, setIsValidatingSafe] = useState(false);

  const handleReviewAllSafe = async () => {
    const safeCategories = ['user_temp', 'windows_temp', 'browser_cache', 'recycle_bin'] as const;
    const safeIds: string[] = [];
    for (const cat of safeCategories) {
      const list = results.itemsByCategory[cat] || [];
      for (const it of list) safeIds.push(it.id);
    }
    if (safeIds.length === 0) return;

    setIsValidatingSafe(true);
    try {
      selectItems(safeIds);
      await preparePlanForSelected();
    } finally {
      setIsValidatingSafe(false);
    }
  };
  const getCategoryIcon = (id: ScanCategoryId) => {
    switch (id) {
      case 'user_temp':
      case 'windows_temp':
        return <FolderSearch className="w-5 h-5 text-blue-400" />;
      case 'browser_cache':
        return <Globe className="w-5 h-5 text-indigo-400" />;
      case 'recycle_bin':
        return <Trash2 className="w-5 h-5 text-emerald-400" />;
      case 'large_files':
        return <FileStack className="w-5 h-5 text-amber-400" />;
      case 'old_files':
        return <Clock className="w-5 h-5 text-amber-400" />;
      default:
        return <HardDrive className="w-5 h-5 text-slate-400" />;
    }
  };

  const categoriesList = Object.values(results.categories);

  return (
    <div className="space-y-7">
      {/* Top Banner: Potentially Recoverable Storage */}
      <div className="bg-slate-900/40 rounded-xl p-6 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-400">
              Storage Scan Complete
            </span>
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 font-mono">
              Read-Only
            </span>
          </div>

          <div className="mt-2 flex items-baseline gap-3">
            <div className="text-3xl font-bold tracking-tight text-slate-100">
              {formatBytes(results.recoverableBytes)}
            </div>
            <span className="text-xs font-medium text-emerald-400">
              Potentially Recoverable
            </span>
          </div>

          <p className="text-xs text-slate-400 mt-1 max-w-lg leading-relaxed">
            Calculated strictly from safe temporary caches and recyclable space. Personal files,
            documents, and system files are protected and never counted as automatic cleanup space.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onRescan}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium bg-slate-900 border border-slate-700/80 text-slate-200 hover:text-slate-100 hover:bg-slate-800 transition-colors shadow-sm"
          >
            <RefreshCw className="w-3.5 h-3.5 text-blue-400" />
            <span>Scan Again</span>
          </button>

          {results.recoverableBytes > 0 && (
            <button
              onClick={handleReviewAllSafe}
              disabled={isValidatingSafe}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-sm shadow-emerald-900/40 disabled:opacity-50"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>
                {isValidatingSafe
                  ? 'Validating Safety...'
                  : `Review Safe Cleanup (${formatBytes(results.recoverableBytes)})`}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Category Breakdown Cards Grid */}
      <div className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Discovered Storage Breakdown
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {categoriesList.map((cat: CategorySummary) => {
            const isSafe = cat.riskLevel === 'SAFE_TO_CLEAN';

            return (
              <div
                key={cat.categoryId}
                onClick={() => onSelectCategory(cat.categoryId)}
                className="bg-slate-900/50 hover:bg-slate-800/50 cursor-pointer rounded-lg p-4 border border-slate-800/80 hover:border-slate-700 transition-all flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="w-8 h-8 rounded-md bg-slate-800 border border-slate-700/50 flex items-center justify-center">
                      {getCategoryIcon(cat.categoryId)}
                    </div>
                    <span
                      className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${
                        isSafe
                          ? 'bg-emerald-950/60 text-emerald-400 border-emerald-900/50'
                          : 'bg-amber-950/60 text-amber-400 border-amber-900/50'
                      }`}
                    >
                      {isSafe ? 'SAFE TO CLEAN' : 'REVIEW'}
                    </span>
                  </div>

                  <h4 className="text-xs font-semibold text-slate-200 group-hover:text-blue-400 transition-colors">
                    {cat.title}
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                    {cat.description}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-semibold text-slate-200">
                      {formatBytes(cat.totalBytes)}
                    </span>
                    <span className="text-[11px] text-slate-500 ml-1.5">
                      ({cat.itemCount.toLocaleString()} {cat.itemCount === 1 ? 'item' : 'items'})
                    </span>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-slate-300 transition-transform group-hover:translate-x-0.5" />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Safety Policy Guarantee Footer */}
      <div className="p-4 rounded-lg bg-slate-900/30 border border-slate-800/60 flex items-center justify-between text-xs text-slate-400">
        <div className="flex items-center gap-2.5">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>
            Non-destructive audit complete. Total scanned: {results.totalFilesScanned.toLocaleString()} files across {results.totalFoldersScanned.toLocaleString()} directories.
          </span>
        </div>
        <span className="text-[11px] text-slate-500 font-mono">Safety Policy Enforced</span>
      </div>
    </div>
  );
};
