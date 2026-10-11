import React from 'react';
import {
  ScanLine,
  FolderSearch,
  Globe,
  Trash2,
  FileStack,
  Clock,
  ShieldCheck,
  Play,
} from 'lucide-react';
import { useScanner } from '../core/ScannerContext';
import { useNavigation } from '../core/NavigationContext';
import { useCleanup } from '../core/CleanupContext';
import { ScanProgressView } from '../components/scanner/ScanProgressView';
import { ScanSummaryView } from '../components/scanner/ScanSummaryView';
import { CategoryItemsTable } from '../components/scanner/CategoryItemsTable';
import { CleanupPreviewModal } from '../components/cleanup/CleanupPreviewModal';
import { CleanupProgressView } from '../components/cleanup/CleanupProgressView';
import { CleanupReportView } from '../components/cleanup/CleanupReportView';
import { ErrorBanner } from '../components/common/ErrorBanner';

export const ScanPage: React.FC = () => {
  const {
    status: scanStatus,
    progress: scanProgress,
    results,
    selectedCategory,
    setSelectedCategory,
    startScan,
    cancelScan,
    openItemLocation,
    error: scanError,
  } = useScanner();

  const { selectedDrive, setCurrentPage } = useNavigation();
  const [isCancellingCleanup, setIsCancellingCleanup] = React.useState(false);

  const {
    cleanupStatus,
    cleanupProgress,
    cleanupResult,
    activePlan,
    isConfirmModalOpen,
    executeActivePlan,
    cancelCleanup,
    setIsConfirmModalOpen,
    resetCleanupState,
    error: cleanupError,
  } = useCleanup();

  const handleCancelCleanup = async () => {
    setIsCancellingCleanup(true);
    try {
      await cancelCleanup();
    } finally {
      setIsCancellingCleanup(false);
    }
  };

  const activeError = cleanupError || scanError;

  // 1. If a cleanup has just finished, show the complete audit report
  if (cleanupResult) {
    return (
      <div className="space-y-7">
        <CleanupReportView
          result={cleanupResult}
          onDone={resetCleanupState}
          onScanAgain={() => {
            resetCleanupState();
            startScan();
          }}
          onGoToDashboard={() => {
            resetCleanupState();
            setCurrentPage('dashboard');
          }}
        />
      </div>
    );
  }

  // 2. If cleanup is actively executing
  if (cleanupStatus === 'cleaning') {
    return (
      <div className="space-y-7">
        <div className="border-b border-slate-800/60 pb-5">
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-semibold text-slate-100 tracking-tight">Safe Cleanup</h1>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-rose-950 text-rose-400 border border-rose-900/60 font-mono">
              In Progress
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Executing safe item-by-item removal with in-use locks and verification.
          </p>
        </div>

        {activeError && <ErrorBanner message={activeError} />}

        <CleanupProgressView
          progress={cleanupProgress}
          onCancel={handleCancelCleanup}
          isCancelling={isCancellingCleanup}
        />
      </div>
    );
  }

  // 3. If viewing items inside a specific category
  if (selectedCategory && results) {
    const summary = results.categories[selectedCategory];
    const items = results.itemsByCategory[selectedCategory] || [];
    return (
      <>
        <CategoryItemsTable
          summary={summary}
          items={items}
          onBack={() => setSelectedCategory(null)}
          onOpenLocation={openItemLocation}
        />

        <CleanupPreviewModal
          isOpen={isConfirmModalOpen}
          plan={activePlan}
          onConfirm={executeActivePlan}
          onCancel={() => setIsConfirmModalOpen(false)}
          isLoading={cleanupStatus === 'preparing'}
        />
      </>
    );
  }

  // 4. If scan is actively running
  if (scanStatus === 'preparing' || scanStatus === 'scanning' || scanStatus === 'cancelling') {
    return (
      <div className="space-y-7">
        <div className="border-b border-slate-800/60 pb-5">
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-semibold text-slate-100 tracking-tight">Storage Scan</h1>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-950 text-blue-400 border border-blue-900/60 font-mono">
              In Progress
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Analyzing filesystem structures and estimating recoverable storage space.
          </p>
        </div>

        {activeError && <ErrorBanner message={activeError} />}

        <ScanProgressView
          progress={scanProgress}
          onCancel={cancelScan}
          isCancelling={scanStatus === 'cancelling'}
        />
      </div>
    );
  }

  // 5. If scan has completed and we have results
  if ((scanStatus === 'completed' || scanStatus === 'cancelled') && results) {
    return (
      <div className="space-y-7">
        <div className="border-b border-slate-800/60 pb-5">
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-semibold text-slate-100 tracking-tight">Scan Results</h1>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700/60 font-mono">
              Inspection Complete
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Review discovered files and categorized space consumption. No files will be deleted without your confirmation.
          </p>
        </div>

        {activeError && <ErrorBanner message={activeError} />}

        <ScanSummaryView
          results={results}
          onSelectCategory={(catId) => setSelectedCategory(catId)}
          onRescan={() => startScan()}
        />

        <CleanupPreviewModal
          isOpen={isConfirmModalOpen}
          plan={activePlan}
          onConfirm={executeActivePlan}
          onCancel={() => setIsConfirmModalOpen(false)}
          isLoading={cleanupStatus === 'preparing'}
        />
      </div>
    );
  }

  // 6. Initial Idle State
  return (
    <div className="space-y-7">
      <div className="border-b border-slate-800/60 pb-5">
        <div className="flex items-center gap-2.5">
          <h1 className="text-xl font-semibold text-slate-100 tracking-tight">Storage Scan</h1>
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700/60 font-mono">
            Read-Only Audit
          </span>
        </div>
        <p className="text-xs text-slate-400 mt-1">
          Find temporary, cached, large, and old files on this PC safely without making changes.
        </p>
      </div>

      {activeError && <ErrorBanner message={activeError} />}

      {/* Hero Action Card */}
      <div className="bg-slate-900/40 rounded-xl p-6 border border-slate-800 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-lg bg-blue-950/50 border border-blue-800/50 flex items-center justify-center text-blue-400 shrink-0">
              <ScanLine className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-100">Ready to inspect storage</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Target Volume:{' '}
                <strong className="text-slate-200">
                  {selectedDrive ? `${selectedDrive.id} (${selectedDrive.label || 'Local Disk'})` : 'C:'}
                </strong>
              </p>
            </div>
          </div>

          <button
            onClick={() => startScan()}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white transition-all shadow-sm shadow-blue-900/40 self-start sm:self-auto"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Scan Storage</span>
          </button>
        </div>

        {/* Target breakdown previews */}
        <div className="pt-4 border-t border-slate-800/60 space-y-3">
          <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wider">
            What will be inspected:
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
            <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 flex items-start gap-2.5">
              <FolderSearch className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
              <div>
                <div className="font-medium text-slate-200">Temporary Files</div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  %TEMP% and Windows\Temp scratch data
                </div>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 flex items-start gap-2.5">
              <Globe className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
              <div>
                <div className="font-medium text-slate-200">Browser Caches</div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Chrome & Edge cache only (no logins or cookies)
                </div>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 flex items-start gap-2.5">
              <Trash2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <div className="font-medium text-slate-200">Recycle Bin</div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Size estimation of items pending permanent deletion
                </div>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 flex items-start gap-2.5">
              <FileStack className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <div className="font-medium text-slate-200">Large Files</div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Personal files &gt;= 500 MB (Requires review)
                </div>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 flex items-start gap-2.5">
              <Clock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <div className="font-medium text-slate-200">Old Files</div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Files untouched for 180+ days (Requires review)
                </div>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <div className="font-medium text-slate-200">Safety Guardrails</div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  System32 and program folders strictly protected
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Safety model notice */}
      <div className="p-4 rounded-lg bg-slate-900/30 border border-slate-800/60 flex items-center justify-between text-xs text-slate-400">
        <div className="flex items-center gap-2.5">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>
            CleanUp guarantees zero automatic cleanup. Every removal requires review and your explicit confirmation.
          </span>
        </div>
        <span className="text-[11px] text-slate-500 font-mono">User Confirmation Required</span>
      </div>
    </div>
  );
};
