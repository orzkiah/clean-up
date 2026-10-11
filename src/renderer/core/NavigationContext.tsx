import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { NavigationPage, StorageOverview, DiskInfo } from '../models/storage';
import { storageService } from '../services/storageService';

interface NavigationContextType {
  currentPage: NavigationPage;
  setCurrentPage: (page: NavigationPage) => void;
  storageOverview: StorageOverview | null;
  selectedDrive: DiskInfo | null;
  selectedDriveId: string;
  setSelectedDriveId: (id: string) => void;
  isLoading: boolean;
  error: string | null;
  refreshStorage: () => Promise<void>;
  appVersion: string;
}

const NavigationContext = createContext<NavigationContextType | undefined>(undefined);

export const NavigationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentPage, setCurrentPage] = useState<NavigationPage>('dashboard');
  const [storageOverview, setStorageOverview] = useState<StorageOverview | null>(null);
  const [selectedDriveId, setSelectedDriveId] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [appVersion, setAppVersion] = useState<string>('1.0.0');

  const fetchStorage = useCallback(async (isManualRefresh = false) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = isManualRefresh
        ? await storageService.refreshStorage()
        : await storageService.getStorageOverview();

      setStorageOverview(data);

      // Default selected drive to system drive or first available drive
      if (!selectedDriveId && data.systemDrive) {
        setSelectedDriveId(data.systemDrive.id);
      } else if (!selectedDriveId && data.drives.length > 0) {
        setSelectedDriveId(data.drives[0].id);
      }
    } catch (err) {
      console.error('Storage detection error:', err);
      setError(
        err instanceof Error
          ? err.message
          : 'Could not access Windows storage devices. Please check permissions.'
      );
    } finally {
      setIsLoading(false);
    }
  }, [selectedDriveId]);

  useEffect(() => {
    fetchStorage();

    if (window.cleanUpApi?.getAppVersion) {
      window.cleanUpApi.getAppVersion().then(setAppVersion).catch(() => {});
    }
  }, [fetchStorage]);

  const selectedDrive = storageOverview?.drives.find((d) => d.id === selectedDriveId) || storageOverview?.systemDrive || null;

  return (
    <NavigationContext.Provider
      value={{
        currentPage,
        setCurrentPage,
        storageOverview,
        selectedDrive,
        selectedDriveId,
        setSelectedDriveId,
        isLoading,
        error,
        refreshStorage: () => fetchStorage(true),
        appVersion,
      }}
    >
      {children}
    </NavigationContext.Provider>
  );
};

export const useNavigation = (): NavigationContextType => {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error('useNavigation must be used within a NavigationProvider');
  }
  return context;
};
