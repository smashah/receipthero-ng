import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchApi,
  healthKeys,
  configKeys,
  type HealthStatus,
  type Config,
  type SaveConfigResponse,
  type TestConnectionResponse,
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
    mutationFn: (config: Config) =>
      fetchApi<SaveConfigResponse>('/api/config', {
        method: 'POST',
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
 * Tests Paperless NGX connection with current config.
 */
export function useTestPaperless() {
  return useMutation({
    mutationFn: () =>
      fetchApi<TestConnectionResponse>('/api/config/test-paperless', {
        method: 'POST',
      }),
  });
}

/**
 * Tests Together AI connection with current API key.
 */
export function useTestTogether() {
  return useMutation({
    mutationFn: () =>
      fetchApi<TestConnectionResponse>('/api/config/test-together', {
        method: 'POST',
      }),
  });
}
