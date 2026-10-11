import React, { useState, useMemo } from 'react';
import {
  ArrowLeft,
  ArrowUpDown,
  Search,
  ShieldCheck,
  AlertCircle,
  FolderOpen,
  Sparkles,
  Lock,
} from 'lucide-react';
import { ScanItem, CategorySummary } from '../../../shared/types';
import { formatBytes } from '../../utils/formatters';
import { useCleanup } from '../../core/CleanupContext';

interface CategoryItemsTableProps {
  summary: CategorySummary;
  items: ScanItem[];
  onBack: () => void;
  onOpenLocation: (itemId: string) => Promise<boolean>;
}

type SortField = 'size' | 'name' | 'date';
type SortOrder = 'asc' | 'desc';

export const CategoryItemsTable: React.FC<CategoryItemsTableProps> = ({
  summary,
  items,
  onBack,
  onOpenLocation,
}) => {
  const {
    selectedItemIds,
    toggleItem,
    selectItems,
    deselectItems,
    preparePlanForSelected,
  } = useCleanup();

  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('size');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [isPreparing, setIsPreparing] = useState(false);

  const isSafeCategory = summary.riskLevel === 'SAFE_TO_CLEAN';

  const categorySelectedItems = useMemo(() => {
    return items.filter((it) => selectedItemIds.has(it.id));
  }, [items, selectedItemIds]);

  const categorySelectedBytes = useMemo(() => {
    return categorySelectedItems.reduce((acc, it) => acc + it.sizeBytes, 0);
  }, [categorySelectedItems]);

  const isAllCategorySelected =
    isSafeCategory && items.length > 0 && categorySelectedItems.length === items.length;

  const handleToggleAllCategory = () => {
    if (!isSafeCategory) return;
    if (isAllCategorySelected) {
      deselectItems(items.map((it) => it.id));
    } else {
      selectItems(items.map((it) => it.id));
    }
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder(field === 'size' ? 'desc' : 'asc');
    }
  };

  const filteredAndSortedItems = useMemo(() => {
    let result = items;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (it) => it.name.toLowerCase().includes(q) || it.fullPath.toLowerCase().includes(q)
      );
    }

    return [...result].sort((a, b) => {
      let cmp = 0;
      if (sortField === 'size') {
        cmp = a.sizeBytes - b.sizeBytes;
      } else if (sortField === 'name') {
        cmp = a.name.localeCompare(b.name);
      } else if (sortField === 'date') {
        cmp = new Date(a.modifiedAt).getTime() - new Date(b.modifiedAt).getTime();
      }
      return sortOrder === 'desc' ? -cmp : cmp;
    });
  }, [items, searchQuery, sortField, sortOrder]);

  const handleOpen = async (itemId: string) => {
    setOpeningId(itemId);
    try {
      await onOpenLocation(itemId);
    } finally {
      setOpeningId(null);
    }
  };

  const handleReviewCleanup = async () => {
    if (categorySelectedItems.length === 0) return;
    setIsPreparing(true);
    try {
      await preparePlanForSelected();
    } finally {
      setIsPreparing(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header with Back button and summary info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-1.5 rounded-md bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
            title="Back to Categories"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-slate-100">{summary.title}</h2>
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                  isSafeCategory
                    ? 'bg-emerald-950/60 text-emerald-400 border-emerald-900/60'
                    : 'bg-amber-950/60 text-amber-400 border-amber-900/60'
                }`}
              >
                {isSafeCategory ? 'SAFE TO CLEAN' : 'REVIEW REQUIRED'}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {summary.itemCount.toLocaleString()} items totaling {formatBytes(summary.totalBytes)}
            </p>
          </div>
        </div>

        {/* Filter input */}
        <div className="relative min-w-[220px]">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter files..."
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-900/80 border border-slate-800 rounded-md text-slate-200 placeholder-slate-500 focus:outline-none focus:border-slate-600"
          />
        </div>
      </div>

      {/* Safety Notice Banner */}
      <div className="p-3 rounded-lg bg-slate-900/40 border border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
        <div className="flex items-center gap-2">
          {isSafeCategory ? (
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
          )}
          <span>{summary.description}</span>
        </div>
        <span className="text-[11px] font-mono">
          {isSafeCategory ? (
            <span className="text-emerald-400/90">Selective Removal Permitted</span>
          ) : (
            <span className="text-amber-400/90 flex items-center gap-1">
              <Lock className="w-3 h-3 inline" /> Protected (Manual Review Only)
            </span>
          )}
        </span>
      </div>

      {/* Items Table */}
      <div className="border border-slate-800 rounded-lg overflow-hidden bg-slate-900/30">
        <div className="overflow-x-auto max-h-[460px]">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/90 text-slate-400 border-b border-slate-800 sticky top-0 z-10 select-none">
              <tr>
                {/* Select column for SAFE_TO_CLEAN categories */}
                <th className="py-2.5 px-3 w-10 text-center">
                  {isSafeCategory ? (
                    <input
                      type="checkbox"
                      checked={isAllCategorySelected}
                      onChange={handleToggleAllCategory}
                      className="w-3.5 h-3.5 rounded border-slate-700 bg-slate-800 text-blue-600 focus:ring-blue-500/20 focus:ring-offset-0 cursor-pointer"
                      title={isAllCategorySelected ? 'Deselect All' : 'Select All'}
                    />
                  ) : (
                    <Lock className="w-3 h-3 text-slate-600 mx-auto" />
                  )}
                </th>
                <th
                  onClick={() => handleSort('name')}
                  className="py-2.5 px-4 font-medium cursor-pointer hover:text-slate-200"
                >
                  <div className="flex items-center gap-1.5">
                    <span>File Name / Path</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-500" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('size')}
                  className="py-2.5 px-4 font-medium cursor-pointer hover:text-slate-200 text-right w-28"
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span>Size</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-500" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('date')}
                  className="py-2.5 px-4 font-medium cursor-pointer hover:text-slate-200 w-36"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Modified</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-500" />
                  </div>
                </th>
                <th className="py-2.5 px-4 font-medium text-right w-28">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredAndSortedItems.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-500">
                    No files found matching the criteria.
                  </td>
                </tr>
              ) : (
                filteredAndSortedItems.map((item) => {
                  const isSelected = selectedItemIds.has(item.id);
                  return (
                    <tr
                      key={item.id}
                      className={`hover:bg-slate-800/30 transition-colors group ${
                        isSelected ? 'bg-blue-950/20' : ''
                      }`}
                    >
                      <td className="py-2 px-3 text-center">
                        {isSafeCategory ? (
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleItem(item.id)}
                            className="w-3.5 h-3.5 rounded border-slate-700 bg-slate-800 text-blue-600 focus:ring-blue-500/20 focus:ring-offset-0 cursor-pointer"
                          />
                        ) : (
                          <span className="text-[10px] text-slate-600">—</span>
                        )}
                      </td>
                      <td className="py-2 px-4 max-w-md">
                        <div className="font-medium text-slate-200 truncate">{item.name}</div>
                        <div
                          className="text-[10px] text-slate-500 font-mono truncate"
                          title={item.fullPath}
                        >
                          {item.fullPath}
                        </div>
                      </td>
                      <td className="py-2 px-4 text-right font-mono text-slate-300">
                        {formatBytes(item.sizeBytes)}
                      </td>
                      <td className="py-2 px-4 text-slate-400 text-[11px]">
                        {new Date(item.modifiedAt).toLocaleDateString([], {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </td>
                      <td className="py-2 px-4 text-right">
                        <button
                          onClick={() => handleOpen(item.id)}
                          disabled={openingId === item.id}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-slate-100 transition-colors border border-slate-700/60 disabled:opacity-50"
                          title="Reveal in Windows File Explorer"
                        >
                          <FolderOpen className="w-3 h-3 text-blue-400" />
                          <span>Open</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Floating Selection Action Bar for SAFE_TO_CLEAN categories */}
      {isSafeCategory && categorySelectedItems.length > 0 && (
        <div className="sticky bottom-2 z-20 p-3.5 rounded-xl bg-slate-900/95 border border-slate-700/90 shadow-2xl backdrop-blur-md flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-950/80 border border-emerald-800/80 flex items-center justify-center text-emerald-400">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-100">
                {categorySelectedItems.length.toLocaleString()} items selected
              </div>
              <div className="text-[11px] text-slate-400">
                Recoverable Space:{' '}
                <strong className="text-emerald-400 font-mono font-medium">
                  {formatBytes(categorySelectedBytes)}
                </strong>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => deselectItems(items.map((it) => it.id))}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 transition-colors"
            >
              Clear Selection
            </button>
            <button
              onClick={handleReviewCleanup}
              disabled={isPreparing}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-md shadow-emerald-900/30 disabled:opacity-50"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>
                {isPreparing ? 'Validating...' : `Review Cleanup (${formatBytes(categorySelectedBytes)})`}
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
