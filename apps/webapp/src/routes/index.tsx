import { createFileRoute } from '@tanstack/react-router';
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
import { ErrorState } from '@/components/dashboard/error-state';
import { LoadingState } from '@/components/dashboard/loading-state';

export const Route = createFileRoute('/')({
  component: DashboardPage,
});

function DashboardPage() {
  const { 
    healthQuery, configQuery, appEvents, currencyTotalsQuery, 
    workerActions, state, actions 
  } = useDashboard();

  const { data: health, isLoading: isHealthLoading, isError, error } = healthQuery;
  const { data: config, isLoading: isConfigLoading } = configQuery;
  const isLoading = isHealthLoading || isConfigLoading;

  if (isError && !health) {
    return <ErrorState error={error} onRetry={actions.handleRefresh} isRetrying={isHealthLoading} />;
  }

  if (isLoading && !health) {
    return <LoadingState />;
  }

  return (
    <div className="min-h-screen bg-gray-50/50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-8">
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
