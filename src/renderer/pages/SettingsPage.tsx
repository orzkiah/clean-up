import React from 'react';
import { Settings, Shield, HardDrive, Info } from 'lucide-react';
import { useNavigation } from '../core/NavigationContext';
import { formatBytes } from '../utils/formatters';

export const SettingsPage: React.FC = () => {
  const { storageOverview, appVersion } = useNavigation();

  return (
    <div className="space-y-7">
      <div className="border-b border-slate-800/60 pb-5">
        <div className="flex items-center gap-2.5">
          <h1 className="text-xl font-semibold text-slate-100 tracking-tight">Settings & System</h1>
          <Settings className="w-4 h-4 text-slate-400" />
        </div>
        <p className="text-xs text-slate-400 mt-1">
          Application configuration, safety safeguards, and detected hardware storage volumes.
        </p>
      </div>

      {/* Safety Safeguards Section */}
      <div className="bg-slate-900/40 rounded-xl p-5 border border-slate-800 space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
          <Shield className="w-4 h-4 text-emerald-400" />
          <span>Safety Safeguards</span>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 rounded-lg bg-slate-950/60 border border-slate-800/80">
            <div>
              <div className="text-xs font-medium text-slate-200">Phase 1 Read-Only Mode</div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                Destructive file deletion is completely disabled at the engine level.
              </div>
            </div>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-400 border border-emerald-900/50">
              Enforced
            </span>
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg bg-slate-950/60 border border-slate-800/80">
            <div>
              <div className="text-xs font-medium text-slate-200">Mandatory Confirmation Prompt</div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                Every future cleanup operation will require explicit manual confirmation.
              </div>
            </div>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-blue-950/60 text-blue-400 border border-blue-900/50">
              Enabled
            </span>
          </div>
        </div>
      </div>

      {/* Detected Volumes Section */}
      <div className="bg-slate-900/40 rounded-xl p-5 border border-slate-800 space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
          <HardDrive className="w-4 h-4 text-slate-300" />
          <span>Detected Storage Volumes</span>
        </div>

        <div className="space-y-2">
          {storageOverview?.drives.map((drive) => (
            <div
              key={drive.id}
              className="flex items-center justify-between p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 text-xs"
            >
              <div className="flex items-center gap-2.5">
                <span className="font-semibold text-slate-200">{drive.id}</span>
                <span className="text-slate-400">({drive.label || 'Local Disk'})</span>
                {drive.isSystemDrive && (
                  <span className="text-[10px] px-1 rounded bg-blue-950/60 text-blue-400 border border-blue-900/40">
                    Windows Boot
                  </span>
                )}
              </div>

              <div className="flex items-center gap-4 text-slate-400">
                <span>{drive.fileSystem}</span>
                <span>{formatBytes(drive.freeBytes)} free of {formatBytes(drive.totalBytes)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Application Diagnostics */}
      <div className="bg-slate-900/40 rounded-xl p-5 border border-slate-800 space-y-3 text-xs text-slate-400">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-200 mb-2">
          <Info className="w-4 h-4 text-slate-400" />
          <span>Environment & Diagnostics</span>
        </div>
        <div className="grid grid-cols-2 gap-2 text-[11px]">
          <div>CleanUp Version: <span className="text-slate-200 font-mono">v{appVersion}</span></div>
          <div>Platform: <span className="text-slate-200 font-mono">Windows x64</span></div>
          <div>Architecture: <span className="text-slate-200 font-mono">Electron + React 19 + TypeScript</span></div>
          <div>Storage Engine: <span className="text-slate-200 font-mono">PowerShell CIM + Node statfs</span></div>
        </div>
      </div>
    </div>
  );
};
