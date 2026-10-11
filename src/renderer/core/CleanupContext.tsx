import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import {
  CleanupPlan,
  CleanupResult,
  CleanupProgress,
  CleanupStatus,
  HistoryRecord,
} from '../../shared/types';
import { cleanupService } from '../services/cleanupService';
import { historyFrontendService } from '../services/historyService';
import { useNavigation } from './NavigationContext';

interface CleanupContextType {
  selectedItemIds: Set<string>;
  toggleItem: (id: string) => void;
  selectItems: (ids: string[]) => void;
  deselectItems: (ids: string[]) => void;
  clearSelection: () => void;

  activePlan: CleanupPlan | null;
  preparePlanForSelected: () => Promise<boolean>;
  executeActivePlan: () => Promise<boolean>;
  cancelCleanup: () => Promise<void>;

  cleanupStatus: CleanupStatus;
  cleanupProgress: CleanupProgress | null;
  cleanupResult: CleanupResult | null;

  isConfirmModalOpen: boolean;
  setIsConfirmModalOpen: (open: boolean) => void;

  history: HistoryRecord[];
  fetchHistory: () => Promise<void>;
  clearHistory: () => Promise<void>;

  resetCleanupState: () => void;
  error: string | null;
}

const CleanupContext = createContext<CleanupContextType | undefined>(undefined);

export const CleanupProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  const [activePlan, setActivePlan] = useState<CleanupPlan | null>(null);
  const [cleanupStatus, setCleanupStatus] = useState<CleanupStatus>('idle');
  const [cleanupProgress, setCleanupProgress] = useState<CleanupProgress | null>(null);
  const [cleanupResult, setCleanupResult] = useState<CleanupResult | null>(null);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [error, setError] = useState<string | null>(null);

  const { refreshStorage } = useNavigation();

  const fetchHistory = useCallback(async () => {
    try {
      const records = await historyFrontendService.getHistory();
      setHistory(records);
    } catch (err: any) {
      console.warn('Failed to load history:', err);
    }
  }, []);

  useEffect(() => {
    fetchHistory();

    const unsubscribe = cleanupService.subscribeProgress((prog) => {
      setCleanupProgress(prog);
      setCleanupStatus(prog.status);
    });

    return () => {
      unsubscribe();
    };
  }, [fetchHistory]);

  const toggleItem = useCallback((id: string) => {
    setSelectedItemIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const selectItems = useCallback((ids: string[]) => {
    setSelectedItemIds((prev) => {
      const next = new Set(prev);
      for (const id of ids) next.add(id);
      return next;
    });
  }, []);

  const deselectItems = useCallback((ids: string[]) => {
    setSelectedItemIds((prev) => {
      const next = new Set(prev);
      for (const id of ids) next.delete(id);
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedItemIds(new Set());
  }, []);

  const preparePlanForSelected = useCallback(async (): Promise<boolean> => {
    setError(null);
    if (selectedItemIds.size === 0) {
      setError('Please select at least one item to clean.');
      return false;
    }

    try {
      const plan = await cleanupService.preparePlan(Array.from(selectedItemIds));
      setActivePlan(plan);
      setIsConfirmModalOpen(true);
      return true;
    } catch (err: any) {
      setError(err?.message || 'Failed to prepare cleanup plan');
      return false;
    }
  }, [selectedItemIds]);

  const executeActivePlan = useCallback(async (): Promise<boolean> => {
    if (!activePlan) return false;

    setError(null);
    setIsConfirmModalOpen(false);
    setCleanupStatus('cleaning');
    setCleanupProgress({
      status: 'cleaning',
      currentIndex: 0,
      totalItems: activePlan.items.length,
      bytesFreed: 0,
      skippedCount: 0,
      currentItemName: 'Starting...',
    });

    try {
      const result = await cleanupService.executeCleanup(activePlan.planId);
      setCleanupResult(result);
      setCleanupStatus(result.status);

      // Deselect cleaned items
      setSelectedItemIds(new Set());
      setActivePlan(null);

      // Refresh storage metrics and history
      await refreshStorage();
      await fetchHistory();

      return true;
    } catch (err: any) {
      setError(err?.message || 'Cleanup execution failed');
      setCleanupStatus('failed');
      return false;
    }
  }, [activePlan, refreshStorage, fetchHistory]);

  const cancelCleanup = useCallback(async () => {
    try {
      await cleanupService.cancelCleanup();
      setCleanupStatus('cancelled');
    } catch (err: any) {
      console.warn('Cancel cleanup failed:', err);
    }
  }, []);

  const clearHistory = useCallback(async () => {
    try {
      await historyFrontendService.clearHistory();
      setHistory([]);
    } catch (err: any) {
      console.warn('Failed to clear history:', err);
    }
  }, []);

  const resetCleanupState = useCallback(() => {
    setActivePlan(null);
    setCleanupResult(null);
    setCleanupStatus('idle');
    setCleanupProgress(null);
    setError(null);
  }, []);

  return (
    <CleanupContext.Provider
      value={{
        selectedItemIds,
        toggleItem,
        selectItems,
        deselectItems,
        clearSelection,
        activePlan,
        preparePlanForSelected,
        executeActivePlan,
        cancelCleanup,
        cleanupStatus,
        cleanupProgress,
        cleanupResult,
        isConfirmModalOpen,
        setIsConfirmModalOpen,
        history,
        fetchHistory,
        clearHistory,
        resetCleanupState,
        error,
      }}
    >
      {children}
    </CleanupContext.Provider>
  );
};

export const useCleanup = (): CleanupContextType => {
  const context = useContext(CleanupContext);
  if (!context) {
    throw new Error('useCleanup must be used within a CleanupProvider');
  }
  return context;
};
