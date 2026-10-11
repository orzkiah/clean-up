import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
import {
  DuplicateScanResult,
  DuplicateScanProgress,
  DuplicateActionItem,
  DuplicateResolutionPlan,
  DuplicateResolutionResult,
  HashCacheStats,
} from '../../shared/types';
import { duplicateService } from '../services/duplicateService';

interface DuplicateContextType {
  status: DuplicateScanProgress['status'];
  progress: DuplicateScanProgress | null;
  results: DuplicateScanResult | null;
  fileActions: Map<string, 'KEEP' | 'REMOVE'>;
  reclaimableSelectedBytes: number;
  selectedRemoveCount: number;
  setItemAction: (itemId: string, action: 'KEEP' | 'REMOVE') => void;
  keepNewest: (groupId: string) => void;
  keepOldest: (groupId: string) => void;
  keepAll: (groupId: string) => void;
  startScan: () => Promise<void>;
  cancelScan: () => Promise<void>;
  resetResults: () => void;
  prepareResolution: () => Promise<DuplicateResolutionPlan>;
  executeResolution: (planId: string) => Promise<DuplicateResolutionResult>;
  resolutionPlan: DuplicateResolutionPlan | null;
  setResolutionPlan: (plan: DuplicateResolutionPlan | null) => void;
  resolutionResult: DuplicateResolutionResult | null;
  dismissReport: () => void;
  cacheStats: HashCacheStats | null;
  refreshCacheStats: () => Promise<void>;
  clearCache: () => Promise<void>;
  error: string | null;
}

const DuplicateContext = createContext<DuplicateContextType | undefined>(undefined);

export const DuplicateProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [status, setStatus] = useState<DuplicateScanProgress['status']>('idle');
  const [progress, setProgress] = useState<DuplicateScanProgress | null>(null);
  const [results, setResults] = useState<DuplicateScanResult | null>(null);
  const [fileActions, setFileActions] = useState<Map<string, 'KEEP' | 'REMOVE'>>(new Map());
  const [resolutionPlan, setResolutionPlan] = useState<DuplicateResolutionPlan | null>(null);
  const [resolutionResult, setResolutionResult] = useState<DuplicateResolutionResult | null>(null);
  const [cacheStats, setCacheStats] = useState<HashCacheStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refreshCacheStats = useCallback(async () => {
    try {
      const stats = await duplicateService.getCacheStats();
      setCacheStats(stats);
    } catch {
      // Ignore
    }
  }, []);

  const clearCache = useCallback(async () => {
    try {
      await duplicateService.clearCache();
      await refreshCacheStats();
    } catch {
      // Ignore
    }
  }, [refreshCacheStats]);

  useEffect(() => {
    refreshCacheStats();

    const unsubscribe = duplicateService.subscribeProgress((prog) => {
      setProgress(prog);
      setStatus(prog.status);

      if (prog.status === 'completed') {
        duplicateService
          .getResults()
          .then((res) => {
            if (res) {
              setResults(res);
              // Initialize all files as KEEP by default
              const initialActions = new Map<string, 'KEEP' | 'REMOVE'>();
              for (const group of res.groups) {
                for (const file of group.files) {
                  initialActions.set(file.itemId, 'KEEP');
                }
              }
              setFileActions(initialActions);
              refreshCacheStats();
            }
          })
          .catch((err) => {
            setError(err?.message || 'Failed to fetch scan results');
          });
      }
    });

    return () => {
      unsubscribe();
    };
  }, [refreshCacheStats]);

  const startScan = useCallback(async () => {
    setError(null);
    setResults(null);
    setFileActions(new Map());
    setResolutionPlan(null);
    setResolutionResult(null);
    setStatus('scanning');
    setProgress({
      status: 'scanning',
      filesExamined: 0,
      candidatesCount: 0,
      hashedCount: 0,
      currentFile: 'Starting...',
    });

    try {
      await duplicateService.startScan();
    } catch (err: any) {
      setError(err?.message || 'Failed to initiate duplicate scan');
      setStatus('failed');
    }
  }, []);

  const cancelScan = useCallback(async () => {
    try {
      await duplicateService.cancelScan();
      setStatus('cancelled');
    } catch (err: any) {
      console.warn('Cancel duplicate scan failed:', err);
    }
  }, []);

  const setItemAction = useCallback((itemId: string, action: 'KEEP' | 'REMOVE') => {
    setFileActions((prev) => {
      const next = new Map(prev);
      next.set(itemId, action);
      return next;
    });
  }, []);

  const keepNewest = useCallback(
    (groupId: string) => {
      if (!results) return;
      const group = results.groups.find((g) => g.groupId === groupId);
      if (!group || group.files.length === 0) return;

      // Find file with newest modified date
      const sorted = [...group.files].sort(
        (a, b) => new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime()
      );
      const newest = sorted[0];

      setFileActions((prev) => {
        const next = new Map(prev);
        for (const file of group.files) {
          if (file.itemId === newest.itemId) {
            next.set(file.itemId, 'KEEP');
          } else {
            next.set(file.itemId, 'REMOVE');
          }
        }
        return next;
      });
    },
    [results]
  );

  const keepOldest = useCallback(
    (groupId: string) => {
      if (!results) return;
      const group = results.groups.find((g) => g.groupId === groupId);
      if (!group || group.files.length === 0) return;

      // Find file with oldest modified date
      const sorted = [...group.files].sort(
        (a, b) => new Date(a.modifiedAt).getTime() - new Date(b.modifiedAt).getTime()
      );
      const oldest = sorted[0];

      setFileActions((prev) => {
        const next = new Map(prev);
        for (const file of group.files) {
          if (file.itemId === oldest.itemId) {
            next.set(file.itemId, 'KEEP');
          } else {
            next.set(file.itemId, 'REMOVE');
          }
        }
        return next;
      });
    },
    [results]
  );

  const keepAll = useCallback(
    (groupId: string) => {
      if (!results) return;
      const group = results.groups.find((g) => g.groupId === groupId);
      if (!group) return;

      setFileActions((prev) => {
        const next = new Map(prev);
        for (const file of group.files) {
          next.set(file.itemId, 'KEEP');
        }
        return next;
      });
    },
    [results]
  );

  const { reclaimableSelectedBytes, selectedRemoveCount } = useMemo(() => {
    if (!results) return { reclaimableSelectedBytes: 0, selectedRemoveCount: 0 };
    let bytes = 0;
    let count = 0;

    for (const group of results.groups) {
      for (const file of group.files) {
        if (fileActions.get(file.itemId) === 'REMOVE') {
          bytes += file.sizeBytes;
          count++;
        }
      }
    }

    return { reclaimableSelectedBytes: bytes, selectedRemoveCount: count };
  }, [results, fileActions]);

  const prepareResolution = useCallback(async (): Promise<DuplicateResolutionPlan> => {
    setError(null);
    const actions: DuplicateActionItem[] = [];
    for (const [itemId, action] of fileActions.entries()) {
      actions.push({ itemId, action });
    }

    try {
      const plan = await duplicateService.prepareResolution(actions);
      setResolutionPlan(plan);
      return plan;
    } catch (err: any) {
      setError(err?.message || 'Failed to prepare duplicate resolution plan');
      throw err;
    }
  }, [fileActions]);

  const executeResolution = useCallback(
    async (planId: string): Promise<DuplicateResolutionResult> => {
      setError(null);
      try {
        const result = await duplicateService.executeResolution(planId);
        setResolutionResult(result);
        setResolutionPlan(null);

        // Fetch remaining duplicates
        const updated = await duplicateService.getResults();
        setResults(updated);

        // Reset fileActions with updated duplicates
        const newActions = new Map<string, 'KEEP' | 'REMOVE'>();
        if (updated) {
          for (const group of updated.groups) {
            for (const file of group.files) {
              newActions.set(file.itemId, 'KEEP');
            }
          }
        }
        setFileActions(newActions);
        await refreshCacheStats();

        return result;
      } catch (err: any) {
        setError(err?.message || 'Duplicate resolution failed');
        throw err;
      }
    },
    [refreshCacheStats]
  );

  const dismissReport = useCallback(() => {
    setResolutionResult(null);
  }, []);

  const resetResults = useCallback(() => {
    setResults(null);
    setStatus('idle');
    setProgress(null);
    setFileActions(new Map());
    setResolutionPlan(null);
    setResolutionResult(null);
    setError(null);
  }, []);

  return (
    <DuplicateContext.Provider
      value={{
        status,
        progress,
        results,
        fileActions,
        reclaimableSelectedBytes,
        selectedRemoveCount,
        setItemAction,
        keepNewest,
        keepOldest,
        keepAll,
        startScan,
        cancelScan,
        resetResults,
        prepareResolution,
        executeResolution,
        resolutionPlan,
        setResolutionPlan,
        resolutionResult,
        dismissReport,
        cacheStats,
        refreshCacheStats,
        clearCache,
        error,
      }}
    >
      {children}
    </DuplicateContext.Provider>
  );
};

export const useDuplicates = (): DuplicateContextType => {
  const context = useContext(DuplicateContext);
  if (!context) {
    throw new Error('useDuplicates must be used within a DuplicateProvider');
  }
  return context;
};
