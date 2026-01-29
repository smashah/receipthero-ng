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
import { API_BASE_URL } from '@/lib/api';
import { useRetryProcessing } from '@/lib/queries';

export function ProcessingList({ logs }: { logs: ProcessingLog[] }) {
  const [selectedLog, setSelectedLog] = useState<ProcessingLog | null>(null);

  const activeLogs = logs.filter(l => l.status !== 'completed' && l.status !== 'failed');
  const processedLogs = logs
    .filter(l => l.status === 'completed' || l.status === 'failed')
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
  
  if (!log) return null;

  const isComplete = log.status === 'completed';
  const isFailed = log.status === 'failed';
  const receiptData = log.receiptData ? JSON.parse(log.receiptData) : null;

  const thumbnailUrl = `${API_BASE_URL}/api/documents/${log.documentId}/thumbnail`;
  const originalUrl = `${API_BASE_URL}/api/documents/${log.documentId}/image`;

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
              <a 
                href={originalUrl} 
                target="_blank" 
                rel="noreferrer"
                className="text-xs text-primary hover:underline flex items-center gap-1"
              >
                View Original <ExternalLink className="h-3 w-3" />
              </a>
            </div>
            <div className="flex-1 bg-white rounded-lg border shadow-inner overflow-auto flex items-center justify-center p-4">
              <img 
                src={thumbnailUrl} 
                alt="Receipt Preview" 
                className="max-w-full max-h-full object-contain shadow-md rounded-sm"
                onError={(e) => {
                  (e.target as any).src = 'https://placehold.co/400x600?text=Preview+Unavailable';
                }}
              />
            </div>
          </div>

          {/* Right Side: Logs or JSON */}
          <div className="w-1/2 flex flex-col p-4 overflow-hidden bg-zinc-50">
            {receiptData ? (
              <div className="flex-1 flex flex-col overflow-hidden space-y-4">
                {/* JSON Section (Top 3/4) */}
                <div className="flex-[3] flex flex-col overflow-hidden min-h-0">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2 mb-2">
                    <Brain className="h-4 w-4" /> Extracted Data
                  </h3>
                  <JsonViewer 
                    data={receiptData} 
                    className="flex-1 overflow-hidden"
                    searchable={true} 
                  />
                </div>
                
                {/* Logs Section (Bottom 1/4) */}
                <div className="flex-1 flex flex-col overflow-hidden border-t pt-4 min-h-0">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2 mb-2">
                    <Activity className="h-4 w-4" /> Processing History
                  </h3>
                  <CliOutput 
                    output={[{ 
                      text: log.message || 'Processing complete', 
                      timestamp: log.updatedAt, 
                      level: 'info' 
                    }]} 
                    showTimestamps 
                    prompt=">"
                    className="flex-1 min-h-[100px]"
                  />
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col overflow-hidden">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2 mb-4">
                  <Activity className="h-4 w-4" /> Real-time Logs
                </h3>
                <CliOutput 
                  output={[{ 
                    text: log.message || 'Waiting for progress updates...', 
                    timestamp: log.updatedAt, 
                    level: log.status === 'failed' ? 'error' : 'info' 
                  }]} 
                  showTimestamps 
                  prompt=">"
                  className="flex-1"
                />
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
  
  return (
    <div className="flex items-center justify-between p-3 rounded-lg border bg-card/50 text-sm animate-in fade-in duration-300">
      <div className="flex items-center gap-3">
        {isSuccess ? (
          <CheckCircle2 className="h-4 w-4 text-green-600" />
        ) : (
          <XCircle className="h-4 w-4 text-destructive" />
        )}
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
        <Badge variant={isSuccess ? 'outline' : 'destructive'} className="text-[10px] h-5 px-1.5 uppercase">
          {isSuccess ? 'Success' : 'Failed'}
        </Badge>
      </div>
    </div>
  );
}
