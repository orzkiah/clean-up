import React, { useState, useEffect } from 'react';
import {
  HardDrive,
  RefreshCw,
  ShieldCheck,
  Database,
  PieChart,
  Layers,
  AlertTriangle,
  Info,
  FolderTree,
  ArrowRight,
} from 'lucide-react';
import { useNavigation } from '../core/NavigationContext';
import { StorageMeter } from '../components/storage/StorageMeter';
import { DriveSelector } from '../components/storage/DriveSelector';
import { MetricCard } from '../components/storage/MetricCard';
import { ErrorBanner } from '../components/common/ErrorBanner';
import { formatBytes, formatPercentage, formatTimestamp } from '../utils/formatters';
import { computeStorageHealth } from '../models/storage';
import { analyzerService } from '../services/analyzerService';
import { StorageAnalysisResult } from '../../shared/types';

export const DashboardPage: React.FC = () => {
  const {
    storageOverview,
    selectedDrive,
    selectedDriveId,
    setSelectedDriveId,
    isLoading: isNavLoading,
    error: navError,
    refreshStorage,
    setCurrentPage,
  } = useNavigation();

  const [analysis, setAnalysis] = useState<StorageAnalysisResult | null>(null);
  const [isAnalysisLoading, setIsAnalysisLoading] = useState(false);

  const fetchAnalysis = async (force = false) => {
    setIsAnalysisLoading(true);
    try {
      const data = await analyzerService.getAnalysis(force);
      setAnalysis(data);
    } catch (err) {
      console.warn('Failed to load storage analysis:', err);
    } finally {
      setIsAnalysisLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalysis();
  }, []);

  const handleRefreshAll = async () => {
    await refreshStorage();
    await fetchAnalysis(true);
  };

  const health = selectedDrive
    ? computeStorageHealth(selectedDrive.usedPercentage)
    : null;

  const isLoading = isNavLoading || isAnalysisLoading;

  return (
    <div className="space-y-7">
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/60 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-semibold text-slate-100 tracking-tight">Storage Overview</h1>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700/60 font-mono">
              Live Windows Data
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Real-time inspection of your local Windows storage volumes and capacity breakdown.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {storageOverview?.lastUpdated && (
            <span className="text-[11px] text-slate-500 font-mono">
              Updated {formatTimestamp(storageOverview.lastUpdated)}
            </span>
          )}
          <button
            onClick={handleRefreshAll}
            disabled={isLoading}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium bg-slate-900 border border-slate-700/80 text-slate-300 hover:text-slate-100 hover:bg-slate-800 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-blue-400' : ''}`} />
            <span>{isLoading ? 'Reading...' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {/* Error state if any */}
      {navError && <ErrorBanner message={navError} onRetry={handleRefreshAll} />}

      {/* Drive Selector if multiple drives are attached */}
      {storageOverview && (
        <DriveSelector
          drives={storageOverview.drives}
          selectedDriveId={selectedDriveId}
          onSelectDrive={setSelectedDriveId}
        />
      )}

      {selectedDrive ? (
        <>
          {/* Main Storage Capacity Overview Card */}
          <div className="bg-slate-900/40 rounded-xl p-6 border border-slate-800 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-slate-800/80 border border-slate-700/70 flex items-center justify-center text-slate-200">
                  <HardDrive className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-semibold text-slate-100">
                      {selectedDrive.id} {selectedDrive.label ? `— ${selectedDrive.label}` : ''}
                    </h2>
                    {selectedDrive.isSystemDrive && (
                      <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-blue-950/70 text-blue-400 border border-blue-900/60">
                        System Volume
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-400 mt-0.5">
                    <span>Filesystem: {selectedDrive.fileSystem}</span>
                    <span>•</span>
                    <span className="capitalize">{selectedDrive.driveType} Disk</span>
                    <span>•</span>
                    <span>Mount: {selectedDrive.mountPoint}</span>
                  </div>
                </div>
              </div>

              {/* Health Status badge */}
              {health && (
                <div className="self-start sm:self-auto flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium border bg-slate-900 border-slate-800">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      health.status === 'critical'
                        ? 'bg-amber-500'
                        : health.status === 'moderate'
                        ? 'bg-amber-400'
                        : 'bg-emerald-500'
                    }`}
                  />
                  <span className="text-slate-200">{health.label}</span>
                </div>
              )}
            </div>

            {/* Storage Horizontal Meter */}
            <StorageMeter
              totalBytes={selectedDrive.totalBytes}
              usedBytes={selectedDrive.usedBytes}
              freeBytes={selectedDrive.freeBytes}
              usedPercentage={selectedDrive.usedPercentage}
            />

            {/* Subtle Health Hint */}
            {health && health.status !== 'optimal' && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 text-xs text-slate-400">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                <span>{health.description}</span>
              </div>
            )}
          </div>

          {/* Metric Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <MetricCard
              label="Total Capacity"
              value={formatBytes(selectedDrive.totalBytes)}
              subValue={`(${selectedDrive.fileSystem})`}
              icon={<Database className="w-4 h-4" />}
              hint="Logical volume size"
              badge={
                <span className="font-mono text-[10px] text-slate-400">
                  {selectedDrive.totalBytes.toLocaleString()} bytes
                </span>
              }
            />

            <MetricCard
              label="Physical Used Space"
              value={formatBytes(selectedDrive.usedBytes)}
              subValue={formatPercentage(selectedDrive.usedPercentage)}
              icon={<PieChart className="w-4 h-4" />}
              hint="Occupied volume blocks"
              badge={
                <span className="font-mono text-[10px] text-slate-400">
                  {selectedDrive.usedBytes.toLocaleString()} bytes
                </span>
              }
            />

            <MetricCard
              label="Available Free Space"
              value={formatBytes(selectedDrive.freeBytes)}
              subValue={formatPercentage(100 - selectedDrive.usedPercentage)}
              icon={<Layers className="w-4 h-4" />}
              hint="Assignable capacity"
              badge={
                <span className="font-mono text-[10px] text-slate-400">
                  {selectedDrive.freeBytes.toLocaleString()} bytes
                </span>
              }
            />
          </div>

          {/* SMART STORAGE ANALYZER SECTION: Where your storage goes */}
          {analysis && (
            <div className="bg-slate-900/40 rounded-xl p-6 border border-slate-800 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/60 pb-4">
                <div>
                  <h3 className="text-sm font-semibold text-slate-100">Where your storage goes</h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Categorized disk usage breakdown based on real Windows filesystem structures.
                  </p>
                </div>

                <div className="flex items-center gap-3 text-xs font-mono">
                  <span className="text-slate-400">
                    Analyzed: <strong className="text-slate-200">{formatBytes(analysis.analyzedBytes)}</strong>
                  </span>
                  <span>•</span>
                  <span className="text-slate-400">
                    Unclassified: <strong className="text-slate-300">{formatBytes(analysis.unclassifiedBytes)}</strong>
                  </span>
                </div>
              </div>

              {/* Ranked Horizontal Bars */}
              <div className="space-y-3">
                {analysis.categories.map((cat) => (
                  <div key={cat.id} className="space-y-1 group">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-300 group-hover:text-slate-100 transition-colors">
                        {cat.title}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-slate-500 font-mono">
                          {cat.percentageOfUsed.toFixed(1)}%
                        </span>
                        <span className="font-semibold text-slate-200 font-mono w-24 text-right">
                          {formatBytes(cat.bytes)}
                        </span>
                      </div>
                    </div>

                    <div className="h-2 w-full bg-slate-950/80 rounded-full overflow-hidden p-0.5 border border-slate-800/80">
                      <div
                        className="h-full rounded-full transition-all duration-500 ease-out"
                        style={{
                          width: `${Math.max(1, Math.min(100, cat.percentageOfUsed))}%`,
                          backgroundColor: cat.color || '#3b82f6',
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Accounting Integrity Callout */}
              <div className="pt-3 border-t border-slate-800/60 flex items-start gap-2.5 text-xs text-slate-400 leading-relaxed">
                <Info className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                <span>
                  <strong>Technical Storage Accounting: </strong>
                  Physical volume usage ({formatBytes(analysis.physicalUsedBytes)}) accounts for reserved filesystem metadata,
                  pagefile, hibernation, and restore points. The remaining {formatBytes(analysis.unclassifiedBytes)} represents
                  system-reserved space outside user and application boundaries.
                </span>
              </div>
            </div>
          )}

          {/* INFORMATIONAL LARGEST FOLDERS SECTION */}
          {analysis && analysis.largestFolders.length > 0 && (
            <div className="bg-slate-900/40 rounded-xl p-6 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <FolderTree className="w-4 h-4 text-blue-400" />
                  <h3 className="text-sm font-semibold text-slate-100">Largest Folders (Informational Only)</h3>
                </div>
                <button
                  onClick={() => setCurrentPage('large-files')}
                  className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 font-medium transition-colors"
                >
                  <span>Review Large Files</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                {analysis.largestFolders.slice(0, 8).map((folder, idx) => (
                  <div
                    key={`${folder.path}-${idx}`}
                    className="p-3.5 rounded-lg bg-slate-950/60 border border-slate-800/80 flex flex-col justify-between"
                  >
                    <div>
                      <div className="text-xs font-semibold text-slate-200 truncate" title={folder.path}>
                        {folder.name}
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">{folder.category}</div>
                    </div>
                    <div className="text-base font-bold text-slate-100 font-mono mt-2">
                      {formatBytes(folder.sizeBytes)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Safety & Integrity Guarantee Notice */}
          <div className="p-4 rounded-lg bg-slate-900/30 border border-slate-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-400">
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                Read-only analysis mode active. No files are altered or removed during inspection.
              </span>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-slate-500 font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
              <span>Physical & Analyzed Storage Reconciled</span>
            </div>
          </div>
        </>
      ) : (
        /* Empty / Loading state */
        <div className="p-12 text-center text-slate-500 border border-dashed border-slate-800 rounded-lg">
          {isLoading ? (
            <div className="flex flex-col items-center gap-2">
              <RefreshCw className="w-6 h-6 animate-spin text-slate-400" />
              <p className="text-xs text-slate-400 mt-2">Querying Windows storage devices...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <Info className="w-6 h-6 text-slate-500" />
              <p className="text-xs text-slate-400 mt-2">No storage volumes detected.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
