import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchApi,
  healthKeys,
  configKeys,
  type HealthStatus,
  type Config,
  type SaveConfigResponse,
  type TestConnectionResponse,
  type ProcessingLog,
} from './api';

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
    queryFn: () => fetchApi<HealthStatus>('/api/health'),
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
    queryFn: () => fetchApi<ProcessingLog[]>('/api/events'),
  });
}

/**
 * Fetches historical app logs.
 */
export function useAppLogs(source?: string) {
  return useQuery({
    queryKey: ['app-logs', source],
    queryFn: () => fetchApi<LogEntry[]>(`/api/events/logs${source ? `?source=${source}` : ''}`),
  });
}

/**
 * Triggers a manual retry for a document.
 */
export function useRetryProcessing() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, strategy }: { id: number; strategy: 'full' | 'partial' }) =>
      fetchApi<any>(`/api/processing/${id}/retry`, {
        method: 'POST',
        body: JSON.stringify({ strategy }),
      }),
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
    queryFn: () => fetchApi<Config>('/api/config'),
  });
}

/**
 * Saves configuration to the server.
 * Invalidates config cache on success.
 */
export function useSaveConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (config: Partial<Config>) =>
      fetchApi<SaveConfigResponse>('/api/config', {
        method: 'PATCH',
        body: JSON.stringify(config),
      }),
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
      fetchApi<TestConnectionResponse>('/api/config/test-paperless', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  });
}

/**
 * Tests Together AI connection with provided apiKey.
 */
export function useTestTogether() {
  return useMutation({
    mutationFn: (data: { apiKey: string }) =>
      fetchApi<TestConnectionResponse>('/api/config/test-together', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  });
}
