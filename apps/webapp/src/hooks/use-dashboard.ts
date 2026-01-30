import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import {
  useHealth,
  useConfig,
  usePauseWorker,
  useResumeWorker,
  useRetryAllQueue,
  useClearQueue,
  useTriggerScan,
  useCurrencyTotals,
} from '@/lib/queries';
import { useAppEvents } from '@/hooks/use-app-events';

export function useDashboard() {
  const healthQuery = useHealth();
  const configQuery = useConfig();
  const appEvents = useAppEvents();
  const currencyTotalsQuery = useCurrencyTotals();
  
  const pauseWorker = usePauseWorker();
  const resumeWorker = useResumeWorker();
  const retryAllQueue = useRetryAllQueue();
  const clearQueue = useClearQueue();
  const triggerScan = useTriggerScan();

  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  useEffect(() => {
    if (healthQuery.dataUpdatedAt) {
      setLastRefresh(new Date(healthQuery.dataUpdatedAt));
    }
  }, [healthQuery.dataUpdatedAt]);

  const handleRefresh = () => {
    healthQuery.refetch();
    triggerScan.mutate(undefined, {
      onSuccess: (data) => {
        const result = data.scanResult;
        if (result && result.documentsQueued > 0) {
          toast.success(
            `Found ${result.documentsQueued} document${result.documentsQueued > 1 ? 's' : ''} to process`,
            {
              description: `${result.documentsFound} new receipt${result.documentsFound !== 1 ? 's' : ''} detected`,
            }
          );
        } else if (result) {
          toast.info('No new documents found');
        }
      },
      onError: (error) => {
        toast.error('Scan failed', {
          description: error.message,
        });
      },
    });
  };

  return {
    healthQuery,
    configQuery,
    appEvents,
    currencyTotalsQuery,
    workerActions: {
      pauseWorker,
      resumeWorker,
      retryAllQueue,
      clearQueue,
      triggerScan,
    },
    state: {
      lastRefresh,
    },
    actions: {
      handleRefresh,
    },
  };
}
