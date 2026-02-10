import { type ProcessingLog } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FileText, CheckCircle2, XCircle, Loader2, Eye, ExternalLink, Activity, Brain, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { JsonViewer } from './devtools/json-viewer';
import { CliOutput } from './ui/cli-output';
import { useRetryProcessing, useDocumentLogs, useDocumentThumbnail, useDocumentImage } from '@/lib/queries';

export function ProcessingList({ logs }: { logs: ProcessingLog[] }) {
  const [selectedLog, setSelectedLog] = useState<ProcessingLog | null>(null);

  const activeLogs = logs.filter(l => l.status !== 'completed' && l.status !== 'failed' && l.status !== 'skipped');
  const processedLogs = logs
    .filter(l => l.status === 'completed' || l.status === 'failed' || l.status === 'skipped')
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 10);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {activeLogs.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <h2 className="text-xl font-semibold">Active Processing</h2>
          </div>
          <div className="grid gap-4">
            {activeLogs.map((log) => (
              <div key={log.documentId} onClick={() => setSelectedLog(log)} className="cursor-pointer">
                <ProcessingItem log={log} />
              </div>
            ))}
          </div>
        </section>
      )}

      {processedLogs.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center gap-2 border-t pt-8">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            <h2 className="text-xl font-semibold text-muted-foreground">Recent Activity</h2>
          </div>
          <div className="grid gap-2">
            {processedLogs.map((log) => (
              <div key={log.documentId} onClick={() => setSelectedLog(log)} className="cursor-pointer">
                <ProcessedItem log={log} />
              </div>
            ))}
          </div>
        </section>
      )}

      <ProcessingDetailsDialog 
        log={selectedLog} 
        open={!!selectedLog} 
        onOpenChange={(open) => !open && setSelectedLog(null)} 
      />
    </div>
  );
}

function ProcessingDetailsDialog({ log, open, onOpenChange }: { 
  log: ProcessingLog | null, 
  open: boolean, 
  onOpenChange: (open: boolean) => void 
}) {
  const retryMutation = useRetryProcessing();
  const { data: documentLogs, isLoading: logsLoading } = useDocumentLogs(log?.documentId ?? null);
  const { data: thumbnailData, isLoading: thumbnailLoading } = useDocumentThumbnail(log?.documentId ?? null);
  const { data: imageData } = useDocumentImage(log?.documentId ?? null);
  
  if (!log) return null;

  const isComplete = log.status === 'completed';
  const isFailed = log.status === 'failed';
  const receiptData = log.receiptData ? JSON.parse(log.receiptData) : null;

  // Build data URLs from base64 responses
  const thumbnailSrc = thumbnailData 
    ? `data:${thumbnailData.contentType};base64,${thumbnailData.base64}` 
    : undefined;
  const originalSrc = imageData 
    ? `data:${imageData.contentType};base64,${imageData.base64}` 
    : undefined;

  const handleRetry = (strategy: 'full' | 'partial') => {
    retryMutation.mutate(
      { id: log.documentId, strategy },
      {
        onSuccess: () => {
          onOpenChange(false);
        },
      }
    );
  };

  // Format logs for CliOutput component
  const formattedLogs = documentLogs?.length 
    ? documentLogs.slice().reverse().map(entry => ({
        text: `[${entry.source.toUpperCase()}] ${entry.message}`,
        timestamp: entry.timestamp,
        level: entry.level as 'info' | 'warn' | 'error' | 'debug',
      }))
    : [{ 
        text: log.message || 'Waiting for progress updates...', 
        timestamp: log.updatedAt, 
        level: (log.status === 'failed' ? 'error' : 'info') as 'info' | 'error'
      }];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="min-w-[80vw] max-w-[90vw] w-[90vw] h-[80vh] flex flex-col p-0 overflow-hidden bg-background">
        <DialogHeader className="p-6 pb-2 border-b">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              {log.fileName || `Document #${log.documentId}`}
            </DialogTitle>
            <div className="flex items-center gap-2 mr-6">
              {isComplete && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleRetry('full')}
                  disabled={retryMutation.isPending}
                  title="Reprocess this document (force re-extraction)"
                >
                  {retryMutation.isPending ? (
                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                  ) : (
                    <RefreshCw className="h-3 w-3 mr-1" />
                  )}
                  Reprocess
                </Button>
              )}
              {isFailed && (
                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleRetry('partial')}
                    disabled={retryMutation.isPending}
                  >
                    {retryMutation.isPending ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <RefreshCw className="h-3 w-3" />
                    )}
                    Retry
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleRetry('full')}
                    disabled={retryMutation.isPending}
                    title="Full retry (re-extract from image)"
                  >
                    Full
                  </Button>
                </div>
              )}
              <Badge variant={isComplete ? "default" : isFailed ? "destructive" : "secondary"} className="capitalize">
                {log.status}
              </Badge>
              {log.attempts > 1 && (
                <Badge variant="outline" className="text-yellow-600 border-yellow-200 bg-yellow-50">
                  Attempt #{log.attempts}
                </Badge>
              )}
            </div>
          </div>
        </DialogHeader>
        
        <div className="flex-1 flex overflow-hidden">
          {/* Left Side: Image */}
          <div className="w-1/2 border-r bg-zinc-50 flex flex-col p-4 overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <Eye className="h-4 w-4" /> Document Preview
              </h3>
              {originalSrc && (
                <a 
                  href={originalSrc} 
                  target="_blank" 
                  rel="noreferrer"
                  className="text-xs text-primary hover:underline flex items-center gap-1"
                  download={`document-${log.documentId}`}
                >
                  View Original <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
            <div className="flex-1 bg-white rounded-lg border shadow-inner overflow-auto flex items-center justify-center p-4">
              {thumbnailLoading ? (
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              ) : thumbnailSrc ? (
                <img 
                  src={thumbnailSrc} 
                  alt="Receipt Preview" 
                  className="max-w-full max-h-full object-contain shadow-md rounded-sm"
                />
              ) : (
                <div className="text-muted-foreground text-sm">Preview unavailable</div>
              )}
            </div>
          </div>

          {/* Right Side: Logs or JSON - Scrollable */}
          <div className="w-1/2 flex flex-col p-4 overflow-y-auto bg-zinc-50">
            {receiptData ? (
              <div className="flex flex-col gap-6">
                {/* JSON Section */}
                <div className="flex flex-col min-h-[50vh]">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2 mb-2 sticky top-0 bg-zinc-50 py-2 -mt-2">
                    <Brain className="h-4 w-4" /> Extracted Data
                  </h3>
                  <JsonViewer 
                    data={receiptData} 
                    className="flex-1"
                    searchable={true} 
                  />
                </div>
                
                {/* Logs Section */}
                <div className="flex flex-col min-h-[50vh] border-t pt-4">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2 mb-2 sticky top-0 bg-zinc-50 py-2 -mt-2">
                    <Activity className="h-4 w-4" /> Processing Logs ({documentLogs?.length ?? 0})
                  </h3>
                  {logsLoading ? (
                    <div className="flex items-center justify-center flex-1">
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    <CliOutput 
                      output={formattedLogs} 
                      showTimestamps 
                      prompt=">"
                      className="flex-1"
                    />
                  )}
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2 mb-4">
                  <Activity className="h-4 w-4" /> Real-time Logs ({documentLogs?.length ?? 0})
                </h3>
                {logsLoading ? (
                  <div className="flex items-center justify-center flex-1">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <CliOutput 
                    output={formattedLogs} 
                    showTimestamps 
                    prompt=">"
                    className="flex-1"
                  />
                )}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ProcessingItem({ log }: { log: ProcessingLog }) {
  return (
    <Card className="overflow-hidden border-l-4 border-l-primary animate-in fade-in zoom-in-95 duration-300">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg text-primary">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-medium truncate max-w-[250px] md:max-w-md">
                {log.fileName || `Document #${log.documentId}`}
              </h3>
              <p className="text-sm text-muted-foreground">
                {log.message || 'Processing receipt details...'}
              </p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2 flex-shrink-0">
            <div className="flex items-center gap-2">
              {log.attempts > 1 && (
                <Badge variant="outline" className="text-yellow-600 border-yellow-200 bg-yellow-50 text-[10px]">
                  Retry #{log.attempts - 1}
                </Badge>
              )}
              <Badge variant="secondary" className="capitalize text-[10px]">
                {log.status}
              </Badge>
            </div>
            <span className="text-xs text-muted-foreground font-mono">
              {log.progress}%
            </span>
          </div>
        </div>
        <Progress value={log.progress} className="mt-4 h-1.5" />
      </CardContent>
    </Card>
  );
}

function ProcessedItem({ log }: { log: ProcessingLog }) {
  const isSuccess = log.status === 'completed';
  const isSkipped = log.status === 'skipped';
  
  const getIcon = () => {
    if (isSuccess) return <CheckCircle2 className="h-4 w-4 text-green-600" />;
    if (isSkipped) return <XCircle className="h-4 w-4 text-amber-500" />;
    return <XCircle className="h-4 w-4 text-destructive" />;
  };

  const getBadge = () => {
    if (isSuccess) return <Badge variant="outline" className="text-[10px] h-5 px-1.5 uppercase">Success</Badge>;
    if (isSkipped) return <Badge variant="outline" className="text-[10px] h-5 px-1.5 uppercase text-amber-600 border-amber-200 bg-amber-50">Skipped</Badge>;
    return <Badge variant="destructive" className="text-[10px] h-5 px-1.5 uppercase">Failed</Badge>;
  };
  
  return (
    <div className="flex items-center justify-between p-3 rounded-lg border bg-card/50 text-sm animate-in fade-in duration-300">
      <div className="flex items-center gap-3">
        {getIcon()}
        <span className="font-medium max-w-[150px] md:max-w-[300px] truncate">
          {log.vendor || log.fileName || `Document #${log.documentId}`}
        </span>
        {log.amount !== undefined && (
          <span className="text-muted-foreground hidden sm:inline">
            • {(log.amount / 100).toFixed(2)} {log.currency}
          </span>
        )}
      </div>
      <div className="flex items-center gap-4 flex-shrink-0">
        <span className="text-xs text-muted-foreground tabular-nums">
          {new Date(log.updatedAt).toLocaleTimeString()}
        </span>
        {getBadge()}
      </div>
    </div>
  );
}
