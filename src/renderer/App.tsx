import React from 'react';
import { NavigationProvider, useNavigation } from './core/NavigationContext';
import { ScannerProvider } from './core/ScannerContext';
import { CleanupProvider } from './core/CleanupContext';
import { DuplicateProvider } from './core/DuplicateContext';
import { AppShell } from './components/layout/AppShell';
import { DashboardPage } from './pages/DashboardPage';
import { ScanPage } from './pages/ScanPage';
import { LargeFilesPage } from './pages/LargeFilesPage';
import { OldFilesPage } from './pages/OldFilesPage';
import { DuplicatesPage } from './pages/DuplicatesPage';
import { HistoryPage } from './pages/HistoryPage';
import { SettingsPage } from './pages/SettingsPage';

const PageRouter: React.FC = () => {
  const { currentPage } = useNavigation();

  switch (currentPage) {
    case 'dashboard':
      return <DashboardPage />;
    case 'scan':
      return <ScanPage />;
    case 'large-files':
      return <LargeFilesPage />;
    case 'old-files':
      return <OldFilesPage />;
    case 'duplicates':
      return <DuplicatesPage />;
    case 'history':
      return <HistoryPage />;
    case 'settings':
      return <SettingsPage />;
    default:
      return <DashboardPage />;
  }
};

export const App: React.FC = () => {
  return (
    <NavigationProvider>
      <ScannerProvider>
        <CleanupProvider>
          <DuplicateProvider>
            <AppShell>
              <PageRouter />
            </AppShell>
          </DuplicateProvider>
        </CleanupProvider>
      </ScannerProvider>
    </NavigationProvider>
  );
};

export default App;
