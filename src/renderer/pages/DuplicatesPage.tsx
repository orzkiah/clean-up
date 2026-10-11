import React, { useState } from 'react';
import {
  Copy,
  FolderOpen,
  Play,
  RotateCcw,
  ShieldCheck,
  FileCheck2,
  Trash2,
  Layers,
  Sparkles,
  XCircle,
  Loader2,
  Database,
  Clock,
} from 'lucide-react';
import { useDuplicates } from '../core/DuplicateContext';
import { useScanner } from '../core/ScannerContext';
import { formatBytes } from '../utils/formatters';
import { ErrorBanner } from '../components/common/ErrorBanner';
import { DuplicateConfirmModal } from '../components/duplicates/DuplicateConfirmModal';
import { DuplicateReportView } from '../components/duplicates/DuplicateReportView';

export const DuplicatesPage: React.FC = () => {
  const {
    status,
    progress,
    results,
    fileActions,
    reclaimableSelectedBytes,
    selectedRemoveCount,
    setItemAction,
    keepNewest,
    keepOldest,
    keepAll,
    startScan,
    cancelScan,
    prepareResolution,
    executeResolution,
    resolutionPlan,
    setResolutionPlan,
    resolutionResult,
    dismissReport,
    cacheStats,
    clearCache,
    error,
  } = useDuplicates();

  const { openItemLocation } = useScanner();
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [isPreparing, setIsPreparing] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);

  const handleOpen = async (itemId: string) => {
    setOpeningId(itemId);
    try {
      await openItemLocation(itemId);
    } catch {
      // In case item is only in duplicate map
    } finally {
      setOpeningId(null);
    }
  };

  const handleStartResolution = async () => {
    setIsPreparing(true);
    try {
      await prepareResolution();
    } catch {
      // Error handled in context
    } finally {
      setIsPreparing(false);
    }
  };

  const handleConfirmResolution = async () => {
    if (!resolutionPlan) return;
    setIsExecuting(true);
    try {
      await executeResolution(resolutionPlan.planId);
    } catch {
      // Error handled in context
    } finally {
      setIsExecuting(false);
    }
  };

  // If viewing post-cleanup report
  if (resolutionResult) {
    return <DuplicateReportView result={resolutionResult} onDone={dismissReport} />;
  }

  // 1. SCANNING STATE
  if (status === 'scanning' || status === 'fingerprinting' || status === 'hashing') {
    return (
      <div className="space-y-7">
        <div className="border-b border-slate-800/60 pb-5">
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-semibold text-slate-100 tracking-tight">Scanning duplicates</h1>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-950 text-blue-400 border border-blue-900/60 font-mono">
              {status === 'fingerprinting' ? 'Stage 2: Fingerprinting' : status === 'hashing' ? 'Stage 3: SHA-256 Hashing' : 'Stage 1: Discovering'}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Analyzing file size, sampling deterministic chunks, and checking persistent SQLite hash cache.
          </p>
        </div>

        {error && <ErrorBanner message={error} />}

        <div className="bg-slate-900/40 rounded-xl p-6 border border-slate-800 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-950/60 border border-blue-800/50 flex items-center justify-center text-blue-400">
                <Loader2 className="w-5 h-5 animate-spin" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-slate-100">Comparing file content</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Multi-stage filtering: Size binning → Sample fingerprint → SHA-256 with SQLite Cache
                </p>
              </div>
            </div>

            <button
              onClick={cancelScan}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium border border-slate-700 bg-slate-900 text-slate-300 hover:text-rose-300 hover:border-rose-800 transition-colors"
            >
              <XCircle className="w-3.5 h-3.5" />
              <span>Cancel Scan</span>
            </button>
          </div>

          {/* Activity Bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-slate-400">
              <span className="capitalize">{status}...</span>
              <span className="font-mono text-slate-500">Live Engine</span>
            </div>
            <div className="h-1.5 w-full bg-slate-800/80 rounded-full overflow-hidden relative">
              <div className="h-full bg-blue-500 rounded-full w-1/3 animate-pulse" />
            </div>
          </div>

          {/* Live Metrics Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3.5 rounded-lg bg-slate-950/60 border border-slate-800/80">
              <div className="text-[11px] text-slate-400 uppercase tracking-wider mb-1">
                Files Examined
              </div>
              <div className="text-xl font-bold text-slate-100 font-mono">
                {progress?.filesExamined.toLocaleString() || 0}
              </div>
            </div>

            <div className="p-3.5 rounded-lg bg-slate-950/60 border border-slate-800/80">
              <div className="text-[11px] text-slate-400 uppercase tracking-wider mb-1">
                Candidates
              </div>
              <div className="text-xl font-bold text-slate-100 font-mono">
                {progress?.candidatesCount.toLocaleString() || 0}
              </div>
            </div>

            <div className="p-3.5 rounded-lg bg-slate-950/60 border border-slate-800/80">
              <div className="text-[11px] text-slate-400 uppercase tracking-wider mb-1">
                Hashed / Verified
              </div>
              <div className="text-xl font-bold text-slate-100 font-mono">
                {progress?.hashedCount.toLocaleString() || 0}
              </div>
            </div>
          </div>

          {/* Current File */}
          <div className="pt-2 border-t border-slate-800/60 text-xs text-slate-500 truncate font-mono">
            <span className="text-slate-400">Current file: </span>
            <span>{progress?.currentFile || 'Initializing filesystem...'}</span>
          </div>
        </div>
      </div>
    );
  }

  // 2. RESULTS STATE
  if (results) {
    return (
      <div className="space-y-7 pb-24">
        {resolutionPlan && (
          <DuplicateConfirmModal
            plan={resolutionPlan}
            isExecuting={isExecuting}
            onConfirm={handleConfirmResolution}
            onCancel={() => setResolutionPlan(null)}
          />
        )}

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/60 pb-5">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-semibold text-slate-100 tracking-tight">Duplicate Files</h1>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700/60 font-mono">
                Exact SHA-256 Matches
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Discovered files containing identical binary data. Review locations and selectively move unnecessary copies to the Windows Recycle Bin.
            </p>
          </div>

          <button
            onClick={() => startScan()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium bg-slate-900 border border-slate-700/80 text-slate-300 hover:text-slate-100 hover:bg-slate-800 transition-colors shadow-sm self-start sm:self-auto"
          >
            <RotateCcw className="w-3.5 h-3.5 text-blue-400" />
            <span>Scan Again</span>
          </button>
        </div>

        {error && <ErrorBanner message={error} />}

        {/* Top Summary Banner */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="bg-slate-900/40 rounded-xl p-5 border border-slate-800">
            <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              <span>Potential Reclaimable</span>
            </div>
            <div className="text-2xl font-bold tracking-tight text-slate-100 font-mono">
              {formatBytes(results.totalReclaimableBytes)}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Keeping 1 copy per group
            </p>
          </div>

          <div className="bg-slate-900/40 rounded-xl p-5 border border-slate-800">
            <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
              <Layers className="w-4 h-4 text-blue-400" />
              <span>Duplicate Groups</span>
            </div>
            <div className="text-2xl font-bold tracking-tight text-slate-100 font-mono">
              {results.groupsCount.toLocaleString()}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Identical binary content
            </p>
          </div>

          <div className="bg-slate-900/40 rounded-xl p-5 border border-slate-800">
            <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
              <Copy className="w-4 h-4 text-indigo-400" />
              <span>Total Duplicate Files</span>
            </div>
            <div className="text-2xl font-bold tracking-tight text-slate-100 font-mono">
              {results.duplicateFilesCount.toLocaleString()}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Across {results.totalFilesExamined.toLocaleString()} examined
            </p>
          </div>

          <div className="bg-slate-900/40 rounded-xl p-5 border border-slate-800">
            <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
              <Database className="w-4 h-4 text-purple-400" />
              <span>Persistent Cache</span>
            </div>
            <div className="text-2xl font-bold tracking-tight text-slate-100 font-mono">
              {results.cacheHits ?? 0} hits
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Scan completed in {((results.scanDurationMs ?? 0) / 1000).toFixed(1)}s
            </p>
          </div>
        </div>

        {/* Duplicate Groups List */}
        {results.groups.length === 0 ? (
          <div className="p-12 text-center text-slate-500 border border-dashed border-slate-800 rounded-xl">
            <FileCheck2 className="w-8 h-8 mx-auto text-emerald-400/80 mb-2" />
            <h3 className="text-sm font-semibold text-slate-200">No Duplicate Files Remaining</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              All examined files in your user folders have unique content.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Duplicate Groups ({results.groups.length})
              </h3>
              <span className="text-xs text-slate-400">
                Default: <strong className="text-slate-200">Keep all files</strong> until you review
              </span>
            </div>

            {results.groups.map((group, groupIdx) => {
              // Find newest file in this group to provide suggested label
              const sortedByDate = [...group.files].sort(
                (a, b) => new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime()
              );
              const newestFile = sortedByDate[0];

              return (
                <div
                  key={group.groupId}
                  className="bg-slate-900/40 border border-slate-800 rounded-xl overflow-hidden shadow-sm"
                >
                  {/* Group Header */}
                  <div className="px-5 py-3.5 bg-slate-900/80 border-b border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-bold text-slate-200">Group #{groupIdx + 1}</span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-400 border border-emerald-900/50">
                        {formatBytes(group.potentiallyReclaimableBytes)} reclaimable
                      </span>
                      <span className="text-xs text-slate-400">
                        {group.duplicateCount} copies ({formatBytes(group.sizeBytes)} each)
                      </span>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      <span className="text-[11px] text-slate-500 mr-1 hidden md:inline">Quick select:</span>
                      <button
                        onClick={() => keepNewest(group.groupId)}
                        className="px-2.5 py-1 rounded text-[11px] font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-slate-100 transition-colors border border-slate-700/60"
                        title="Keep the newest modified copy and mark others for removal"
                      >
                        Keep Newest
                      </button>
                      <button
                        onClick={() => keepOldest(group.groupId)}
                        className="px-2.5 py-1 rounded text-[11px] font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-slate-100 transition-colors border border-slate-700/60"
                        title="Keep the oldest modified copy and mark others for removal"
                      >
                        Keep Oldest
                      </button>
                      <button
                        onClick={() => keepAll(group.groupId)}
                        className="px-2.5 py-1 rounded text-[11px] font-medium bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors border border-slate-700/60"
                        title="Reset all files in this group to Keep"
                      >
                        Keep All
                      </button>
                    </div>
                  </div>

                  {/* Files in this group */}
                  <div className="divide-y divide-slate-800/50">
                    {group.files.map((file) => {
                      const action = fileActions.get(file.itemId) || 'KEEP';
                      const isRemove = action === 'REMOVE';
                      const isSuggested = file.itemId === newestFile.itemId;

                      return (
                        <div
                          key={file.itemId}
                          className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-800/30 transition-colors ${
                            isRemove ? 'bg-rose-950/15' : ''
                          }`}
                        >
                          <div className="flex items-start gap-3 min-w-0">
                            {/* Segmented Action Controls */}
                            <div className="flex items-center rounded-lg bg-slate-950/80 p-0.5 border border-slate-800 shrink-0 mt-0.5">
                              <button
                                type="button"
                                onClick={() => setItemAction(file.itemId, 'KEEP')}
                                className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                                  !isRemove
                                    ? 'bg-blue-600 text-white shadow-sm'
                                    : 'text-slate-400 hover:text-slate-200'
                                }`}
                              >
                                Keep
                              </button>
                              <button
                                type="button"
                                onClick={() => setItemAction(file.itemId, 'REMOVE')}
                                className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                                  isRemove
                                    ? 'bg-rose-600 text-white shadow-sm'
                                    : 'text-slate-400 hover:text-slate-200'
                                }`}
                              >
                                Remove
                              </button>
                            </div>

                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-medium text-slate-200 truncate">{file.name}</span>
                                {isSuggested && (
                                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950/70 text-emerald-400 border border-emerald-800/50 font-medium">
                                    Suggested copy to keep (Newest)
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-slate-500 font-mono truncate mt-0.5" title={file.fullPath}>
                                {file.fullPath}
                              </div>
                              <div className="text-[10px] text-slate-400 mt-1 flex items-center gap-2">
                                <Clock className="w-3 h-3 text-slate-500" />
                                <span>
                                  Modified: {new Date(file.modifiedAt).toLocaleDateString([], {
                                    year: 'numeric',
                                    month: 'short',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 shrink-0 self-end sm:self-auto">
                            <span className="text-xs font-mono text-slate-300">
                              {formatBytes(file.sizeBytes)}
                            </span>
                            <button
                              onClick={() => handleOpen(file.itemId)}
                              disabled={openingId === file.itemId}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-slate-100 transition-colors border border-slate-700/60 disabled:opacity-50"
                              title="Reveal in Windows File Explorer"
                            >
                              <FolderOpen className="w-3 h-3 text-blue-400" />
                              <span>Open</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Sticky Resolution Action Bar */}
        {results.groups.length > 0 && (
          <div className="fixed bottom-0 left-64 right-0 bg-slate-900/95 border-t border-slate-800 backdrop-blur-md px-8 py-4 z-40 flex items-center justify-between shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-rose-950/60 border border-rose-800/60 flex items-center justify-center text-rose-400 shrink-0">
                <Trash2 className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-semibold text-slate-200">
                  {selectedRemoveCount > 0 ? (
                    <span>
                      {selectedRemoveCount} {selectedRemoveCount === 1 ? 'file' : 'files'} marked for removal ({formatBytes(reclaimableSelectedBytes)})
                    </span>
                  ) : (
                    <span className="text-slate-400">
                      No files marked for removal. Review groups above to select duplicate copies.
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-slate-500">
                  Files are moved to Windows Recycle Bin. At least one original copy is always preserved.
                </div>
              </div>
            </div>

            <button
              onClick={handleStartResolution}
              disabled={selectedRemoveCount === 0 || isPreparing}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white transition-all shadow-sm shadow-rose-900/40 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isPreparing ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Validating Actions...</span>
                </>
              ) : (
                <>
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Move to Windows Recycle Bin</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    );
  }

  // 3. INITIAL IDLE STATE
  return (
    <div className="space-y-7">
      <div className="border-b border-slate-800/60 pb-5">
        <div className="flex items-center gap-2.5">
          <h1 className="text-xl font-semibold text-slate-100 tracking-tight">Duplicate Files</h1>
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700/60 font-mono">
            Cryptographic Content Match
          </span>
        </div>
        <p className="text-xs text-slate-400 mt-1">
          Find and resolve duplicate files with identical cryptographic content across your user folders.
        </p>
      </div>

      {error && <ErrorBanner message={error} />}

      {/* Hero Action Card */}
      <div className="bg-slate-900/40 rounded-xl p-6 border border-slate-800 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-lg bg-blue-950/50 border border-blue-800/50 flex items-center justify-center text-blue-400 shrink-0">
              <Copy className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-100">Ready to detect duplicates</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Duplicate detection compares <strong className="text-slate-200">file content</strong>, not just filenames.
              </p>
            </div>
          </div>

          <button
            onClick={() => startScan()}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white transition-all shadow-sm shadow-blue-900/40 self-start sm:self-auto"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Scan for Duplicates</span>
          </button>
        </div>

        {/* Algorithm Explanation */}
        <div className="pt-4 border-t border-slate-800/60 space-y-3">
          <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wider">
            How the 3-stage engine works:
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="p-3.5 rounded-lg bg-slate-950/60 border border-slate-800/80 space-y-1">
              <div className="font-semibold text-slate-200">1. Size Binning</div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Files are grouped by exact byte size. Unique sizes cannot be duplicates and are never hashed.
              </p>
            </div>

            <div className="p-3.5 rounded-lg bg-slate-950/60 border border-slate-800/80 space-y-1">
              <div className="font-semibold text-slate-200">2. Quick Fingerprint</div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Reads deterministic samples from the start, middle, and end to eliminate non-duplicates fast.
              </p>
            </div>

            <div className="p-3.5 rounded-lg bg-slate-950/60 border border-slate-800/80 space-y-1">
              <div className="font-semibold text-slate-200">3. Streaming SHA-256 + Cache</div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Surviving candidates are verified against the local SQLite hash cache or streamed directly.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Persistent Hash Cache Card */}
      {cacheStats && (
        <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-purple-950/50 border border-purple-800/50 flex items-center justify-center text-purple-400 shrink-0">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-200">
                Persistent SQLite Hash Cache
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                {cacheStats.entryCount.toLocaleString()} indexed hashes ({formatBytes(cacheStats.dbSizeBytes)}) · {cacheStats.cacheHitsTotal.toLocaleString()} total cache hits
              </div>
            </div>
          </div>

          {cacheStats.entryCount > 0 && (
            <button
              onClick={() => clearCache()}
              className="px-3 py-1.5 rounded-md text-xs font-medium border border-slate-700 bg-slate-900 text-slate-400 hover:text-slate-200 hover:border-slate-600 transition-colors self-start sm:self-auto"
            >
              Clear Cache
            </button>
          )}
        </div>
      )}

      {/* Safety Notice Banner */}
      <div className="p-4 rounded-lg bg-slate-900/30 border border-slate-800/60 flex items-center justify-between text-xs text-slate-400">
        <div className="flex items-center gap-2.5">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>
            Safe boundaries: Duplicate scans only crawl user folders (Desktop, Downloads, Documents, Media). Files removed are always sent to the Windows Recycle Bin.
          </span>
        </div>
        <span className="text-[11px] text-slate-500 font-mono">Protected Boundaries</span>
      </div>
    </div>
  );
};
