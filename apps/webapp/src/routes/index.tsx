import { createFileRoute, Link } from '@tanstack/react-router';
import {
  Activity,
  Settings,
  CheckCircle,
  XCircle,
  RefreshCw,
  AlertTriangle,
  Server,
  FileText,
  Loader2,
  Pause,
  Play,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useHealth, useConfig, usePauseWorker, useResumeWorker, useRetryAllQueue, useClearQueue, useTriggerScan } from '@/lib/queries';
import { useAppEvents } from '@/hooks/use-app-events';
import { ProcessingList } from '@/components/processing-list';
import { CliOutput } from '@/components/ui/cli-output';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { useState, useEffect } from 'react';

export const Route = createFileRoute('/')({
  component: DashboardPage,
});

function DashboardPage() {
  const {
    data: health,
    isLoading: isHealthLoading,
    isError: isHealthError,
    error: healthError,
    refetch: refetchHealth,
    dataUpdatedAt: healthUpdatedAt,
  } = useHealth();

  const { data: config, isLoading: isConfigLoading } = useConfig();
  const { processingLogs, appLogs } = useAppEvents();
  
  // Worker control mutations
  const pauseWorker = usePauseWorker();
  const resumeWorker = useResumeWorker();
  const retryAllQueue = useRetryAllQueue();
  const clearQueue = useClearQueue();
  const triggerScan = useTriggerScan();

  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  useEffect(() => {
    if (healthUpdatedAt) {
      setLastRefresh(new Date(healthUpdatedAt));
    }
  }, [healthUpdatedAt]);

  const handleRefresh = () => {
    refetchHealth();
    triggerScan.mutate(undefined, {
      onSuccess: (data) => {
        const result = data.scanResult;
        if (result && result.documentsQueued > 0) {
          toast.success(`Found ${result.documentsQueued} document${result.documentsQueued > 1 ? 's' : ''} to process`, {
            description: `${result.documentsFound} new receipt${result.documentsFound !== 1 ? 's' : ''} detected`,
          });
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

  const formatTime = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
    }).format(date);
  };

  const isConfigured = health?.checks.config === 'ok';
  const isLoading = isHealthLoading || isConfigLoading;

  // Error state - show connection error with retry info
  if (isHealthError && !health) {
    const errorMessage = healthError instanceof Error 
      ? healthError.message 
      : 'Unknown error';
    
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center bg-gray-50/50">
        <div className="text-center space-y-4 max-w-md px-4">
          <div className="mx-auto w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
            <XCircle className="h-6 w-6 text-red-600" />
          </div>
          <div className="space-y-2">
            <h2 className="text-lg font-semibold text-gray-900">Connection Failed</h2>
            <p className="text-sm text-muted-foreground">
              Could not connect to the API server. This usually means the backend is unreachable or you're not connected to the right network.
            </p>
            <p className="text-xs text-muted-foreground font-mono bg-muted p-2 rounded">
              {errorMessage}
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <Button onClick={handleRefresh} disabled={isHealthLoading}>
              {isHealthLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Retrying...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Try Again
                </>
              )}
            </Button>
            <p className="text-xs text-muted-foreground">
              Auto-retry every 30 seconds
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading && !health) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center bg-gray-50/50">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">Loading system status...</p>
        </div>
      </div>
    );
  }

  // Helper for status badge variant
  const getStatusVariant = (status: 'ok' | 'error' | undefined) => {
    return status === 'ok' ? 'default' : 'destructive'; // Shadcn badge variants: default, secondary, destructive, outline
  };

  // Filter logs for tabs
  const workerLogs = appLogs.filter(l => l.source === 'worker' || (l.source === 'core' && l.message.toLowerCase().includes('paperless'))).map(l => ({
    text: l.message,
    timestamp: l.timestamp,
    level: l.level
  }));

  const apiLogs = appLogs.filter(l => l.source === 'api').map(l => ({
    text: l.message,
    timestamp: l.timestamp,
    level: l.level
  }));

  return (
    <div className="min-h-screen bg-gray-50/50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              ReceiptHero Dashboard
            </h1>
            <p className="text-muted-foreground">
              Paperless-NGX Integration & Worker Status
            </p>
          </div>
          <div className="flex items-center gap-2">
            {lastRefresh && (
              <span className="text-sm text-muted-foreground hidden md:inline-block">
                Last updated: {formatTime(lastRefresh)}
              </span>
            )}
            <a
              href="https://github.com/smashah/receipthero-ng"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button variant="outline" size="sm">
                <svg className="h-4 w-4 mr-2" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
                </svg>
                ⭐ Star
              </Button>
            </a>
            <Button 
              variant={triggerScan.isPending ? "secondary" : "outline"} 
              size="sm" 
              onClick={handleRefresh}
              disabled={triggerScan.isPending || isHealthLoading}
            >
              <RefreshCw className={cn("h-4 w-4 mr-2", (triggerScan.isPending || isHealthLoading) && "animate-spin")} />
              {triggerScan.isPending ? "Scanning..." : "Refresh"}
            </Button>
            <Link to="/settings">
              <Button>
                <Settings className="h-4 w-4 mr-2" />
                Configure
              </Button>
            </Link>
          </div>
        </div>

        {/* Status Overview Cards */}
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {/* System Health Card */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                System Health
              </CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold capitalize flex items-center gap-2">
                {health?.status === 'healthy' ? (
                  <span className="text-green-600">Healthy</span>
                ) : (
                  <span className="text-red-600">Unhealthy</span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {health?.errors
                  ? `${health.errors.length} active issues`
                  : 'All systems operational'}
              </p>
            </CardContent>
          </Card>

          {/* Paperless Connection Card */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Paperless Connection
              </CardTitle>
              <Server className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {health?.checks.paperlessConnection === 'ok' ? (
                  <span className="text-green-600 flex items-center gap-2">
                    <CheckCircle className="h-5 w-5" /> Connected
                  </span>
                ) : (
                  <span className="text-red-600 flex items-center gap-2">
                    <XCircle className="h-5 w-5" /> Disconnected
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Host: {config?.paperless.host || 'Not configured'}
              </p>
            </CardContent>
          </Card>

          {/* Together AI Card */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Together AI
              </CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                 {health?.checks.togetherAiConnection === 'ok' ? (
                    <span className="text-green-600 flex items-center gap-2"><CheckCircle className="h-5 w-5"/> Active</span>
                 ) : (
                    <span className="text-yellow-600 flex items-center gap-2"><AlertTriangle className="h-5 w-5"/> Missing Key</span>
                 )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                API Key: {config?.togetherAi.apiKey ? "Configured" : "Not configured"}
              </p>
            </CardContent>
          </Card>

          {/* Integration Stats Card - Spanning wide screens */}
          <Card className="md:col-span-2 lg:col-span-3">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                Integration Statistics
              </CardTitle>
            </CardHeader>
            <CardContent>
              {health?.stats ? (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div className="space-y-1">
                    <span className="text-3xl font-bold tracking-tight">{health.stats.detected}</span>
                    <p className="text-xs text-muted-foreground uppercase font-medium">Detected</p>
                  </div>
                  <div className="space-y-1 border-l pl-4">
                    <span className="text-3xl font-bold tracking-tight text-green-600">{health.stats.processed}</span>
                    <p className="text-xs text-muted-foreground uppercase font-medium">Processed</p>
                  </div>
                  <div className="space-y-1 border-l pl-4">
                    <span className="text-3xl font-bold tracking-tight text-destructive">{health.stats.failed}</span>
                    <p className="text-xs text-muted-foreground uppercase font-medium">Failed</p>
                  </div>
                  <div className="space-y-1 border-l pl-4">
                    <span className="text-3xl font-bold tracking-tight text-gray-500">{health.stats.skipped}</span>
                    <p className="text-xs text-muted-foreground uppercase font-medium">Skipped</p>
                  </div>
                  <div className="space-y-1 border-l pl-4">
                    <span className="text-3xl font-bold tracking-tight text-yellow-600">{health.stats.inQueue}</span>
                    <p className="text-xs text-muted-foreground uppercase font-medium">In Queue</p>
                  </div>
                </div>
              ) : (
                <div className="py-4 text-center text-muted-foreground text-sm">
                  Waiting for integration data...
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Worker Control Card */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                Worker Control
              </CardTitle>
              {health?.worker?.isPaused ? (
                <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
                  <Pause className="h-3 w-3 mr-1" /> Paused
                </Badge>
              ) : (
                <Badge variant="secondary" className="bg-green-100 text-green-800">
                  <Play className="h-3 w-3 mr-1" /> Running
                </Badge>
              )}
            </div>
            {health?.worker?.isPaused && health.worker.pauseReason && (
              <p className="text-xs text-muted-foreground mt-1">
                Reason: {health.worker.pauseReason}
              </p>
            )}
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {health?.worker?.isPaused ? (
                <Button
                  size="sm"
                  onClick={() => resumeWorker.mutate()}
                  disabled={resumeWorker.isPending}
                >
                  {resumeWorker.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4 mr-2" />
                  )}
                  Resume Worker
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => pauseWorker.mutate()}
                  disabled={pauseWorker.isPending}
                >
                  {pauseWorker.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Pause className="h-4 w-4 mr-2" />
                  )}
                  Pause Worker
                </Button>
              )}
              
              <Button
                size="sm"
                variant="outline"
                onClick={() => retryAllQueue.mutate()}
                disabled={retryAllQueue.isPending || !health?.stats?.inQueue}
              >
                {retryAllQueue.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RotateCcw className="h-4 w-4 mr-2" />
                )}
                Retry All ({health?.stats?.inQueue || 0})
              </Button>
              
              <Button
                size="sm"
                variant="outline"
                onClick={() => clearQueue.mutate()}
                disabled={clearQueue.isPending || !health?.stats?.inQueue}
              >
                {clearQueue.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4 mr-2" />
                )}
                Clear Queue
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Real-time Activity Section */}
        <ProcessingList logs={processingLogs} />

        {/* System Logs Section */}
        <section className="space-y-4 pt-8 border-t">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-semibold">System Logs</h2>
            </div>
          </div>
          
          <Tabs defaultValue="worker" className="w-full">
            <TabsList className="mb-4">
              <TabsTrigger value="worker">Worker Output</TabsTrigger>
              <TabsTrigger value="api">API Output</TabsTrigger>
            </TabsList>
            <TabsContent value="worker">
              <CliOutput 
                output={workerLogs} 
                showTimestamps 
                prompt=">"
                className="border-zinc-800 shadow-xl"
              />
            </TabsContent>
            <TabsContent value="api">
              <CliOutput 
                output={apiLogs} 
                showTimestamps 
                prompt="$"
                className="border-zinc-800 shadow-xl"
              />
            </TabsContent>
          </Tabs>
        </section>

        {/* Detailed Status Section */}
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-7 pt-8 border-t">
          {/* Health Checks Detail */}
          <Card className="col-span-1 lg:col-span-4">
            <CardHeader>
              <CardTitle>Health Checks</CardTitle>
              <CardDescription>
                Diagnostic status of integration components
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b pb-4">
                  <div className="space-y-1">
                    <p className="text-sm font-medium leading-none">
                      Paperless-NGX API
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Connectivity to document management system
                    </p>
                  </div>
                  <Badge
                    variant={getStatusVariant(health?.checks.paperlessConnection)}
                    className={health?.checks.paperlessConnection === 'ok' ? "bg-green-100 text-green-800 hover:bg-green-200" : "bg-red-100 text-red-800 hover:bg-red-200"}
                  >
                    {health?.checks.paperlessConnection === 'ok'
                      ? 'Operational'
                      : 'Error'}
                  </Badge>
                </div>

                <div className="flex items-center justify-between border-b pb-4">
                  <div className="space-y-1">
                    <p className="text-sm font-medium leading-none">
                      Together AI API
                    </p>
                    <p className="text-sm text-muted-foreground">
                      LLM service for OCR processing
                    </p>
                  </div>
                  <Badge
                    variant={getStatusVariant(health?.checks.togetherAiConnection)}
                     className={health?.checks.togetherAiConnection === 'ok' ? "bg-green-100 text-green-800 hover:bg-green-200" : "bg-red-100 text-red-800 hover:bg-red-200"}
                  >
                    {health?.checks.togetherAiConnection === 'ok'
                      ? 'Operational'
                      : 'Error'}
                  </Badge>
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-medium leading-none">
                      Configuration
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Settings validation
                    </p>
                  </div>
                   <Badge
                    variant={getStatusVariant(health?.checks.config)}
                     className={health?.checks.config === 'ok' ? "bg-green-100 text-green-800 hover:bg-green-200" : "bg-red-100 text-red-800 hover:bg-red-200"}
                  >
                    {health?.checks.config === 'ok' ? 'Valid' : 'Invalid'}
                  </Badge>
                </div>
              </div>

              {health?.errors && health.errors.length > 0 && (
                <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-md">
                  <h4 className="text-sm font-semibold text-red-800 mb-2 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" /> Active Errors
                  </h4>
                  <ul className="list-disc list-inside text-sm text-red-700 space-y-1">
                    {health.errors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Configuration Summary */}
          <Card className="col-span-1 lg:col-span-3">
            <CardHeader>
              <CardTitle>Current Configuration</CardTitle>
              <CardDescription>Active processing rules</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!config ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground mb-4">
                    Configuration not loaded
                  </p>
                  <Link to="/settings">
                    <Button>Setup Integration</Button>
                  </Link>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground block mb-1">
                        Source Tag
                      </span>
                      <div className="font-mono bg-muted p-1 rounded px-2 overflow-hidden text-ellipsis">
                        {config.processing.receiptTag}
                      </div>
                    </div>
                    <div>
                      <span className="text-muted-foreground block mb-1">
                        Success Tag
                      </span>
                      <div className="font-mono bg-muted p-1 rounded px-2 overflow-hidden text-ellipsis">
                        {config.processing.processedTag}
                      </div>
                    </div>
                  </div>
                  <div className="text-sm">
                    <span className="text-muted-foreground block mb-1">
                      Failure Tag
                    </span>
                    <div className="font-mono bg-muted p-1 rounded px-2 w-full md:w-1/2 overflow-hidden text-ellipsis">
                      {config.processing.failedTag}
                    </div>
                  </div>

                  <div className="border-t pt-4 mt-4">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Max Retries</span>
                      <span className="font-medium">
                        {config.processing.maxRetries}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm mt-2">
                      <span className="text-muted-foreground">
                        Scan Interval
                      </span>
                      <span className="font-medium">
                        {config.processing.scanInterval / 1000}s
                      </span>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
            {config && (
              <CardFooter>
                <Link to="/settings" className="w-full">
                  <Button variant="outline" className="w-full">
                    <Settings className="h-4 w-4 mr-2" />
                    Edit Configuration
                  </Button>
                </Link>
              </CardFooter>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
