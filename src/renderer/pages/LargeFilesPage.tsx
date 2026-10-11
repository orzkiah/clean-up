import React, { useState, useMemo } from 'react';
import {
  FileStack,
  FolderOpen,
  ArrowUpDown,
  AlertCircle,
  Play,
  Filter,
} from 'lucide-react';
import { useScanner } from '../core/ScannerContext';
import { formatBytes } from '../utils/formatters';
import { EmptyState } from '../components/common/EmptyState';

const THRESHOLDS = [
  { label: '500 MB', bytes: 500 * 1024 * 1024 },
  { label: '1 GB', bytes: 1024 * 1024 * 1024 },
  { label: '2 GB', bytes: 2 * 1024 * 1024 * 1024 },
  { label: '5 GB', bytes: 5 * 1024 * 1024 * 1024 },
];

export const LargeFilesPage: React.FC = () => {
  const { results, startScan, openItemLocation, status } = useScanner();
  const [selectedThreshold, setSelectedThreshold] = useState<number>(500 * 1024 * 1024);
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [openingId, setOpeningId] = useState<string | null>(null);

  const rawLargeFiles = results?.itemsByCategory.large_files || [];

  const filteredFiles = useMemo(() => {
    return rawLargeFiles
      .filter((file) => file.sizeBytes >= selectedThreshold)
      .sort((a, b) => (sortOrder === 'desc' ? b.sizeBytes - a.sizeBytes : a.sizeBytes - b.sizeBytes));
  }, [rawLargeFiles, selectedThreshold, sortOrder]);

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
          <h1 className="text-xl font-semibold text-slate-100 tracking-tight">Large Files</h1>
          <p className="text-xs text-slate-400 mt-1">
            Identify space-consuming files, ISOs, archive dumps, and large media files.
          </p>
        </div>

        <EmptyState
          icon={<FileStack className="w-6 h-6" />}
          title="No Large Files Indexed Yet"
          description="Run a storage scan to discover files larger than 500 MB located in your personal library folders."
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
            <h1 className="text-xl font-semibold text-slate-100 tracking-tight">Large Files</h1>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700/60 font-mono">
              {filteredFiles.length} Found
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Files in user folders (Desktop, Downloads, Documents, Media) exceeding the size threshold.
          </p>
        </div>

        {/* Threshold Filter Selector */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-900 border border-slate-800 rounded-lg text-xs">
          <Filter className="w-3.5 h-3.5 text-slate-500 ml-1.5" />
          <span className="text-[11px] text-slate-400 mr-1">Minimum Size:</span>
          {THRESHOLDS.map((th) => (
            <button
              key={th.bytes}
              onClick={() => setSelectedThreshold(th.bytes)}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                selectedThreshold === th.bytes
                  ? 'bg-slate-800 text-slate-100 border border-slate-700 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {th.label}
            </button>
          ))}
        </div>
      </div>

      {/* Warning / Safety Reminder */}
      <div className="p-3.5 rounded-lg bg-amber-950/20 border border-amber-800/40 flex items-start gap-2.5 text-xs text-amber-300/90">
        <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
        <div>
          <strong className="text-amber-200">Review Required: </strong>
          Large files are not necessarily unnecessary. They often include critical application installers, virtual machines, media assets, or backup archives. Review files manually in File Explorer before taking action.
        </div>
      </div>

      {/* Files Table */}
      <div className="border border-slate-800 rounded-lg overflow-hidden bg-slate-900/30">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-900/90 text-slate-400 border-b border-slate-800 select-none">
            <tr>
              <th className="py-2.5 px-4 font-medium">File Name / Location</th>
              <th
                onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
                className="py-2.5 px-4 font-medium text-right cursor-pointer hover:text-slate-200 w-32"
              >
                <div className="flex items-center justify-end gap-1.5">
                  <span>Size</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-500" />
                </div>
              </th>
              <th className="py-2.5 px-4 font-medium w-36">Last Modified</th>
              <th className="py-2.5 px-4 font-medium text-right w-28">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {filteredFiles.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-8 text-center text-slate-500">
                  No files found matching the selected threshold ({formatBytes(selectedThreshold)}).
                </td>
              </tr>
            ) : (
              filteredFiles.map((file) => (
                <tr key={file.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="py-2.5 px-4 max-w-md">
                    <div className="font-medium text-slate-200 truncate">{file.name}</div>
                    <div className="text-[10px] text-slate-500 font-mono truncate" title={file.fullPath}>
                      {file.fullPath}
                    </div>
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono font-medium text-slate-100">
                    {formatBytes(file.sizeBytes)}
                  </td>
                  <td className="py-2.5 px-4 text-slate-400 text-[11px]">
                    {new Date(file.modifiedAt).toLocaleDateString([], {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
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
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
