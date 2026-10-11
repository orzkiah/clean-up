import {
  LayoutDashboard,
  ScanLine,
  FileStack,
  Clock,
  Copy,
  History,
  Settings,
} from 'lucide-react';
import logoImg from '../../assets/logo.png';
import { useNavigation } from '../../core/NavigationContext';
import { NavigationPage } from '../../models/storage';

interface NavItem {
  id: NavigationPage;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
}

const navItems: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'scan', label: 'Scan', icon: ScanLine },
  { id: 'large-files', label: 'Large Files', icon: FileStack },
  { id: 'old-files', label: 'Old Files', icon: Clock },
  { id: 'duplicates', label: 'Duplicates', icon: Copy },
  { id: 'history', label: 'History', icon: History },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export const Sidebar: React.FC = () => {
  const { currentPage, setCurrentPage, storageOverview, appVersion } = useNavigation();

  return (
    <aside className="w-56 bg-slate-900/90 border-r border-slate-800/80 flex flex-col justify-between select-none">
      <div>
        {/* Brand header */}
        <div className="px-5 py-6 flex items-center justify-between border-b border-slate-800/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg overflow-hidden flex items-center justify-center shrink-0 shadow-sm shadow-blue-500/10">
              <img src={logoImg} alt="CleanUp Logo" className="w-full h-full object-contain" />
            </div>
            <div>
              <span className="font-semibold text-sm tracking-tight text-slate-100">CleanUp</span>
              <span className="block text-[10px] text-slate-500 font-mono leading-none mt-0.5">Desktop</span>
            </div>
          </div>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800/80 text-slate-400 font-mono border border-slate-700/40">
            v{appVersion}
          </span>
        </div>

        {/* Navigation links */}
        <nav className="p-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentPage === item.id;

            return (
              <button
                key={item.id}
                onClick={() => setCurrentPage(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-xs font-medium transition-colors text-left ${
                  isActive
                    ? 'bg-slate-800 text-slate-100 shadow-sm border border-slate-700/60'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-blue-400' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span className="text-[10px] text-slate-500 px-1 rounded bg-slate-800">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer system status */}
      <div className="p-4 border-t border-slate-800/50 text-[11px] text-slate-400">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500/80 inline-block" />
          <span className="text-slate-300 font-medium">Windows Storage</span>
        </div>
        <div className="text-[10px] text-slate-500 mt-1 truncate">
          {storageOverview?.systemDrive
            ? `${storageOverview.systemDrive.id} (${storageOverview.systemDrive.label})`
            : 'Scanning drives...'}
        </div>
      </div>
    </aside>
  );
};
