import React, { ReactNode } from 'react';
import { Sidebar } from './Sidebar';

interface AppShellProps {
  children: ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({ children }) => {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-950 text-slate-100 font-sans">
      <Sidebar />
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto bg-slate-950">
        <div className="flex-1 p-8 max-w-5xl mx-auto w-full">
          {children}
        </div>
      </main>
    </div>
  );
};
