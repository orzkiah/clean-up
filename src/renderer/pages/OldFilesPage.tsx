import React, { useState, useMemo } from 'react';
import {
  Clock,
  FolderOpen,
  ArrowUpDown,
  AlertCircle,
  Play,
  Calendar,
} from 'lucide-react';
import { useScanner } from '../core/ScannerContext';
import { formatBytes } from '../utils/formatters';
import { EmptyState } from '../components/common/EmptyState';

const AGE_OPTIONS = [
  { label: '90 Days', days: 90 },
  { label: '180 Days', days: 180 },
  { label: '1 Year', days: 365 },
  { label: '2 Years', days: 730 },
];

export const OldFilesPage: React.FC = () => {
  const { results, startScan, openItemLocation, status } = useScanner();
  const [selectedAgeDays, setSelectedAgeDays] = useState<number>(180);
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [openingId, setOpeningId] = useState<string | null>(null);

  const rawOldFiles = results?.itemsByCategory.old_files || [];

  const filteredFiles = useMemo(() => {
    const cutoff = Date.now() - selectedAgeDays * 24 * 60 * 60 * 1000;

    return rawOldFiles
      .filter((file) => {
        const time = new Date(file.accessedAt || file.modifiedAt).getTime();
        return time < cutoff;
      })
      .sort((a, b) => {
        const timeA = new Date(a.accessedAt || a.modifiedAt).getTime();
        const timeB = new Date(b.accessedAt || b.modifiedAt).getTime();
        return sortOrder === 'desc' ? timeA - timeB : timeB - timeA;
      });
  }, [rawOldFiles, selectedAgeDays, sortOrder]);

  const handleOpen = async (itemId: string) => {
    setOpeningId(itemId);
    try {
      await openItemLocation(itemId);
    } finally {
      setOpeningId(null);
    }
  };

  if (!results && status !== 'scanning') {
    return (
      <div className="space-y-7">
        <div className="border-b border-slate-800/60 pb-5">
          <h1 className="text-xl font-semibold text-slate-100 tracking-tight">Old Files</h1>
          <p className="text-xs text-slate-400 mt-1">
            Review untouched files based on last accessed and modified timestamps.
          </p>
        </div>

        <EmptyState
          icon={<Clock className="w-6 h-6" />}
          title="No Old Files Indexed Yet"
          description="Run a storage scan to discover personal documents and downloads untouched for 6+ months."
          action={
            <button
              onClick={() => startScan()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white transition-colors"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Scan Now</span>
            </button>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-7">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/60 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-semibold text-slate-100 tracking-tight">Old Files</h1>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700/60 font-mono">
              {filteredFiles.length} Found
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Files in user folders untouched for the selected duration.
          </p>
        </div>

        {/* Age Filter Selector */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-900 border border-slate-800 rounded-lg text-xs">
          <Calendar className="w-3.5 h-3.5 text-slate-500 ml-1.5" />
          <span className="text-[11px] text-slate-400 mr-1">Older than:</span>
          {AGE_OPTIONS.map((opt) => (
            <button
              key={opt.days}
              onClick={() => setSelectedAgeDays(opt.days)}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                selectedAgeDays === opt.days
                  ? 'bg-slate-800 text-slate-100 border border-slate-700 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Safety Notice Banner */}
      <div className="p-3.5 rounded-lg bg-amber-950/20 border border-amber-800/40 flex items-start gap-2.5 text-xs text-amber-300/90">
        <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
        <div>
          <strong className="text-amber-200">Old does not mean unnecessary: </strong>
          These files require your careful review. Never delete documents, media, or archives without
          ensuring you have backups.
        </div>
      </div>

      {/* Files Table */}
      <div className="border border-slate-800 rounded-lg overflow-hidden bg-slate-900/30">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-900/90 text-slate-400 border-b border-slate-800 select-none">
            <tr>
              <th className="py-2.5 px-4 font-medium">File Name / Location</th>
              <th className="py-2.5 px-4 font-medium text-right w-28">Size</th>
              <th
                onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
                className="py-2.5 px-4 font-medium cursor-pointer hover:text-slate-200 w-44"
              >
                <div className="flex items-center gap-1.5">
                  <span>Last Accessed / Modified</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-500" />
                </div>
              </th>
              <th className="py-2.5 px-4 font-medium text-right w-28">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {filteredFiles.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-8 text-center text-slate-500">
                  No files untouched for more than {selectedAgeDays} days found.
                </td>
              </tr>
            ) : (
              filteredFiles.map((file) => {
                const targetTime = new Date(file.accessedAt || file.modifiedAt).getTime();
                const daysAgo = Math.floor((Date.now() - targetTime) / (1000 * 60 * 60 * 24));

                return (
                  <tr key={file.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-2.5 px-4 max-w-md">
                      <div className="font-medium text-slate-200 truncate">{file.name}</div>
                      <div className="text-[10px] text-slate-500 font-mono truncate" title={file.fullPath}>
                        {file.fullPath}
                      </div>
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono text-slate-300">
                      {formatBytes(file.sizeBytes)}
                    </td>
                    <td className="py-2.5 px-4 text-slate-400 text-[11px]">
                      <div>{daysAgo} days ago</div>
                      <div className="text-[10px] text-slate-500">
                        {new Date(targetTime).toLocaleDateString([], {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </div>
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      <button
                        onClick={() => handleOpen(file.id)}
                        disabled={openingId === file.id}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-slate-100 transition-colors border border-slate-700/60 disabled:opacity-50"
                        title="Reveal in File Explorer"
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
  );
};
