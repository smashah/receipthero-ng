import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Config } from '@sm-rn/shared/schemas';
import type { ProcessingLog } from '@sm-rn/shared/types';

import {
  getHealthStatus,
  getConfig as getConfigFn,
  saveConfig as saveConfigFn,
  getAvailableCurrencies as getAvailableCurrenciesFn,
  pauseWorker as pauseWorkerFn,
  resumeWorker as resumeWorkerFn,
  triggerScanAndWait,
  getQueueStatus as getQueueStatusFn,
  retryAllQueue as retryAllQueueFn,
  clearQueue as clearQueueFn,
  clearSkippedDocuments,
  getProcessingLogs,
  getDocumentLogs,
  getAppLogs,
  retryDocument,
  testPaperlessConnection,
  testTogetherConnection,
  getCurrencyTotals as getCurrencyTotalsFn,
  getDocumentThumbnail,
  getDocumentImage,
  type HealthStatus,
  type SaveConfigResponse,
  type TestConnectionResponse,
  type WorkerStatus,
  type QueueStatus,
  type QueueActionResponse,
  type TriggerScanResponse,
  type CurrencyTotalsResponse,
  type DocumentImageResponse,
} from './server';

// Re-export types for convenience
export type {
  HealthStatus,
  SaveConfigResponse,
  TestConnectionResponse,
  WorkerStatus,
  QueueStatus,
  QueueActionResponse,
  TriggerScanResponse,
  ProcessingLog,
  CurrencyTotalsResponse,
  DocumentImageResponse,
};
export type { Config };

// ─────────────────────────────────────────────────────────────────────────────
// Query Keys (kept for cache invalidation)
// ─────────────────────────────────────────────────────────────────────────────

export const healthKeys = {
  all: ['health'] as const,
  status: () => [...healthKeys.all, 'status'] as const,
};

export const configKeys = {
  all: ['config'] as const,
  current: () => [...configKeys.all, 'current'] as const,
  currencies: () => [...configKeys.all, 'currencies'] as const,
};

export const statsKeys = {
  all: ['stats'] as const,
  currencyTotals: () => [...statsKeys.all, 'currency-totals'] as const,
};

export const workerKeys = {
  all: ['worker'] as const,
  status: () => [...workerKeys.all, 'status'] as const,
};

export const queueKeys = {
  all: ['queue'] as const,
  status: () => [...queueKeys.all, 'status'] as const,
};

// ─────────────────────────────────────────────────────────────────────────────
// Health Query
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Polls health endpoint every 30 seconds.
 * Pauses polling when the tab is hidden to save resources.
 */
export function useHealth() {
  return useQuery({
    queryKey: healthKeys.status(),
    queryFn: () => getHealthStatus(),
    refetchInterval: 30_000, // 30 seconds
    // Pause polling when tab is hidden
    refetchIntervalInBackground: false,
    // Also consider stale immediately for fresh data on focus
    staleTime: 0,
  });
}

/**
 * Fetches recent processing logs.
 */
export function useProcessingLogs() {
  return useQuery({
    queryKey: ['processing-logs'],
    queryFn: () => getProcessingLogs(),
    refetchInterval: 5_000, // Poll every 5 seconds for real-time feel
  });
}

/**
 * Fetches historical app logs.
 */
export function useAppLogs(source?: string) {
  return useQuery({
    queryKey: ['app-logs', source],
    queryFn: () => getAppLogs({ data: { source } }),
  });
}

/**
 * Fetches logs for a specific document.
 */
export function useDocumentLogs(documentId: number | null) {
  return useQuery({
    queryKey: ['document-logs', documentId],
    queryFn: () => getDocumentLogs({ data: { documentId: documentId! } }),
    enabled: !!documentId, // Only fetch when documentId is provided
  });
}

/**
 * Fetches document thumbnail via server function proxy.
 * This allows fetching from internal Docker network when only webapp is exposed.
 */
export function useDocumentThumbnail(documentId: number | null) {
  return useQuery({
    queryKey: ['document-thumbnail', documentId],
    queryFn: () => getDocumentThumbnail({ data: { documentId: documentId! } }),
    enabled: !!documentId,
    staleTime: 1000 * 60 * 60, // Cache thumbnail for 1 hour
  });
}

/**
 * Fetches document image via server function proxy.
 * This allows fetching from internal Docker network when only webapp is exposed.
 */
export function useDocumentImage(documentId: number | null) {
  return useQuery({
    queryKey: ['document-image', documentId],
    queryFn: () => getDocumentImage({ data: { documentId: documentId! } }),
    enabled: !!documentId,
    staleTime: 1000 * 60 * 60, // Cache image for 1 hour
  });
}

/**
 * Triggers a manual retry for a document.
 */
export function useRetryProcessing() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, strategy }: { id: number; strategy: 'full' | 'partial' }) =>
      retryDocument({ data: { id, strategy } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['processing-logs'] });
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Config Queries & Mutations
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetches current configuration (with masked API keys).
 */
export function useConfig() {
  return useQuery({
    queryKey: configKeys.current(),
    queryFn: () => getConfigFn(),
  });
}

/**
 * Fetches available ECB currencies (cached on server for 24h).
 */
export function useAvailableCurrencies() {
  return useQuery({
    queryKey: configKeys.currencies(),
    queryFn: async () => {
      const response = await getAvailableCurrenciesFn();
      return response.currencies;
    },
    staleTime: 1000 * 60 * 60, // Cache for 1 hour on client
  });
}

/**
 * Fetches currency totals from processed receipts.
 */
export function useCurrencyTotals() {
  return useQuery({
    queryKey: statsKeys.currencyTotals(),
    queryFn: () => getCurrencyTotalsFn(),
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });
}

/**
 * Saves configuration to the server.
 * Invalidates config cache on success.
 */
export function useSaveConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (config: Partial<Config>) => saveConfigFn({ data: config }),
    onSuccess: () => {
      // Invalidate config and health queries to refresh state
      queryClient.invalidateQueries({ queryKey: configKeys.all });
      queryClient.invalidateQueries({ queryKey: healthKeys.all });
    },
  });
}

/**
 * Tests Paperless NGX connection with provided host and apiKey.
 */
export function useTestPaperless() {
  return useMutation({
    mutationFn: (data: { host: string; apiKey: string }) =>
      testPaperlessConnection({ data }),
  });
}

/**
 * Tests Together AI connection with provided apiKey.
 */
export function useTestTogether() {
  return useMutation({
    mutationFn: (data: { apiKey: string }) =>
      testTogetherConnection({ data }),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Worker Control Mutations
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Pauses the worker.
 */
export function usePauseWorker() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (reason?: string) => pauseWorkerFn({ data: { reason } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: healthKeys.all });
      queryClient.invalidateQueries({ queryKey: workerKeys.all });
    },
  });
}

/**
 * Resumes the worker.
 */
export function useResumeWorker() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => resumeWorkerFn(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: healthKeys.all });
      queryClient.invalidateQueries({ queryKey: workerKeys.all });
    },
  });
}

/**
 * Triggers an immediate worker scan and waits for completion.
 */
export function useTriggerScan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => triggerScanAndWait(),
    onSuccess: () => {
      // Invalidate all relevant queries so UI refreshes
      queryClient.invalidateQueries({ queryKey: healthKeys.all });
      queryClient.invalidateQueries({ queryKey: workerKeys.all });
      queryClient.invalidateQueries({ queryKey: ['processing-logs'] });
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Queue Control Mutations
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetches queue status.
 */
export function useQueueStatus() {
  return useQuery({
    queryKey: queueKeys.status(),
    queryFn: () => getQueueStatusFn(),
    refetchInterval: 30_000,
  });
}

/**
 * Retry all items in the queue immediately.
 */
export function useRetryAllQueue() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => retryAllQueueFn(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: healthKeys.all });
      queryClient.invalidateQueries({ queryKey: queueKeys.all });
    },
  });
}

/**
 * Clear all items from the queue.
 */
export function useClearQueue() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => clearQueueFn(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: healthKeys.all });
      queryClient.invalidateQueries({ queryKey: queueKeys.all });
    },
  });
}

/**
 * Clear skipped documents list.
 */
export function useClearSkipped() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => clearSkippedDocuments(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: healthKeys.all });
      queryClient.invalidateQueries({ queryKey: queueKeys.all });
    },
  });
}
