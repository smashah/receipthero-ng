import { createFileRoute, useNavigate, Link } from '@tanstack/react-router';
import { useEffect } from 'react';
import { useDashboard } from '@/hooks/use-dashboard';
import { ProcessingList } from '@/components/processing-list';
import { DashboardHeader } from '@/components/dashboard/dashboard-header';
import { StatusCards } from '@/components/dashboard/status-cards';
import { CurrencyTotalsCard } from '@/components/dashboard/currency-totals-card';
import { IntegrationStatsCard } from '@/components/dashboard/integration-stats-card';
import { WorkerControlCard } from '@/components/dashboard/worker-control-card';
import { HealthChecksCard } from '@/components/dashboard/health-checks-card';
import { ConfigSummaryCard } from '@/components/dashboard/config-summary-card';
import { SystemLogsSection } from '@/components/dashboard/system-logs-section';
import { LoadingState } from '@/components/dashboard/loading-state';
import { AlertTriangle, Loader2, RefreshCw, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const Route = createFileRoute('/')({
  component: DashboardPage,
});

function ConnectionBanner({ error, onRetry, isRetrying }: { error: unknown; onRetry: () => void; isRetrying: boolean }) {
  const errorMessage = error instanceof Error ? error.message : 'Unknown error';

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
      <div className="flex items-start gap-3">
        <div className="shrink-0 mt-0.5">
          <AlertTriangle className="h-5 w-5 text-amber-600" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-amber-900">API Connection Unavailable</h3>
          <p className="text-sm text-amber-700 mt-1">
            Could not reach the backend API. The dashboard data shown may be stale or unavailable.
          </p>
          <p className="text-xs text-amber-600 font-mono bg-amber-100 rounded px-2 py-1 mt-2 inline-block">
            {errorMessage}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link
            to="/settings"
            className="inline-flex items-center gap-1.5 text-sm text-amber-700 hover:text-amber-900 font-medium"
          >
            <Settings2 className="h-4 w-4" />
            Settings
          </Link>
          <Button
            size="sm"
            variant="outline"
            onClick={onRetry}
            disabled={isRetrying}
            className="border-amber-300 text-amber-800 hover:bg-amber-100"
          >
            {isRetrying ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

function DashboardPage() {
  const navigate = useNavigate();
  const { 
    healthQuery, configQuery, appEvents, currencyTotalsQuery, 
    workerActions, state, actions 
  } = useDashboard();

  const { data: health, isLoading: isHealthLoading, isError, error } = healthQuery;
  const { data: config, isLoading: isConfigLoading } = configQuery;
  const isLoading = isHealthLoading || isConfigLoading;

  // Redirect to settings if Paperless is not configured
  useEffect(() => {
    if (health && !health.configComplete) {
      navigate({ to: '/settings' });
    }
  }, [health, navigate]);

  if (isLoading && !health) {
    return <LoadingState />;
  }

  return (
    <div className="min-h-screen bg-gray-50/50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {isError && (
          <ConnectionBanner error={error} onRetry={actions.handleRefresh} isRetrying={isHealthLoading} />
        )}
        <DashboardHeader
          lastRefresh={state.lastRefresh}
          onRefresh={actions.handleRefresh}
          isRefreshing={isHealthLoading}
          isTriggeringScan={workerActions.triggerScan.isPending}
        />
        <StatusCards health={health} config={config} />
        <CurrencyTotalsCard 
          currencyTotals={currencyTotalsQuery.data} 
          targetCurrencies={config?.processing?.currencyConversion?.targetCurrencies}
        />
        <IntegrationStatsCard stats={health?.stats} />
        <WorkerControlCard
          worker={health?.worker}
          stats={health?.stats}
          onPause={() => workerActions.pauseWorker.mutate(undefined)}
          onResume={() => workerActions.resumeWorker.mutate()}
          onRetryAll={() => workerActions.retryAllQueue.mutate()}
          onClearQueue={() => workerActions.clearQueue.mutate()}
          isPausingWorker={workerActions.pauseWorker.isPending}
          isResumingWorker={workerActions.resumeWorker.isPending}
          isRetryingAll={workerActions.retryAllQueue.isPending}
          isClearingQueue={workerActions.clearQueue.isPending}
        />
        <ProcessingList logs={appEvents.processingLogs} />
        <SystemLogsSection appLogs={appEvents.appLogs} />
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-7 pt-8 border-t">
          <HealthChecksCard health={health} />
          <ConfigSummaryCard config={config} />
        </div>
      </div>
    </div>
  );
}
