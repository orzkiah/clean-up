import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import {
  ScanStatus,
  ScanProgress,
  ScanResult,
  ScanCategoryId,
  ScanFilterOptions,
} from '../../shared/types';
import { scannerService } from '../services/scannerService';

interface ScannerContextType {
  status: ScanStatus;
  progress: ScanProgress | null;
  results: ScanResult | null;
  selectedCategory: ScanCategoryId | null;
  setSelectedCategory: (cat: ScanCategoryId | null) => void;
  startScan: (opts?: ScanFilterOptions) => Promise<void>;
  cancelScan: () => Promise<void>;
  openItemLocation: (itemId: string) => Promise<boolean>;
  largeFileThresholdBytes: number;
  setLargeFileThresholdBytes: (bytes: number) => void;
  oldFileDays: number;
  setOldFileDays: (days: number) => void;
  error: string | null;
}

const ScannerContext = createContext<ScannerContextType | undefined>(undefined);

export const ScannerProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [status, setStatus] = useState<ScanStatus>('idle');
  const [progress, setProgress] = useState<ScanProgress | null>(null);
  const [results, setResults] = useState<ScanResult | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<ScanCategoryId | null>(null);
  const [largeFileThresholdBytes, setLargeFileThresholdBytes] = useState<number>(500 * 1024 * 1024); // 500 MB
  const [oldFileDays, setOldFileDays] = useState<number>(180); // 180 days
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = scannerService.subscribeProgress((prog) => {
      setProgress(prog);
      setStatus(prog.status);

      if (prog.status === 'completed' || prog.status === 'cancelled') {
        scannerService
          .getResults()
          .then((res) => {
            if (res) setResults(res);
          })
          .catch((err) => {
            console.error('Failed to get scan results after completion:', err);
          });
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const startScan = useCallback(async (opts?: ScanFilterOptions) => {
    setError(null);
    setStatus('preparing');
    setProgress(null);
    setSelectedCategory(null);

    const mergedOptions: ScanFilterOptions = {
      largeFileMinBytes: opts?.largeFileMinBytes ?? largeFileThresholdBytes,
      oldFileMinDays: opts?.oldFileMinDays ?? oldFileDays,
    };

    try {
      await scannerService.startScan(mergedOptions);
    } catch (err: any) {
      setError(err?.message || 'Failed to start scan');
      setStatus('failed');
    }
  }, [largeFileThresholdBytes, oldFileDays]);

  const cancelScan = useCallback(async () => {
    try {
      await scannerService.cancelScan();
      setStatus('cancelling');
    } catch (err: any) {
      console.error('Cancel scan error:', err);
    }
  }, []);

  const openItemLocation = useCallback(async (itemId: string): Promise<boolean> => {
    try {
      return await scannerService.openLocation(itemId);
    } catch (err: any) {
      setError(err?.message || 'Failed to open location');
      return false;
    }
  }, []);

  return (
    <ScannerContext.Provider
      value={{
        status,
        progress,
        results,
        selectedCategory,
        setSelectedCategory,
        startScan,
        cancelScan,
        openItemLocation,
        largeFileThresholdBytes,
        setLargeFileThresholdBytes,
        oldFileDays,
        setOldFileDays,
        error,
      }}
    >
      {children}
    </ScannerContext.Provider>
  );
};

export const useScanner = (): ScannerContextType => {
  const context = useContext(ScannerContext);
  if (!context) {
    throw new Error('useScanner must be used within a ScannerProvider');
  }
  return context;
};
