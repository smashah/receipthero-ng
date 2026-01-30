import { Pause, Play, RotateCcw, Trash2, Loader2 } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { HealthStatus } from '@/lib/queries';

interface WorkerControlCardProps {
  worker: HealthStatus['worker'] | undefined;
  stats: HealthStatus['stats'] | undefined;
  onPause: () => void;
  onResume: () => void;
  onRetryAll: () => void;
  onClearQueue: () => void;
  isPausingWorker: boolean;
  isResumingWorker: boolean;
  isRetryingAll: boolean;
  isClearingQueue: boolean;
}

export function WorkerControlCard({
  worker,
  stats,
  onPause,
  onResume,
  onRetryAll,
  onClearQueue,
  isPausingWorker,
  isResumingWorker,
  isRetryingAll,
  isClearingQueue,
}: WorkerControlCardProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Worker Control
          </CardTitle>
          {worker?.isPaused ? (
            <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
              <Pause className="h-3 w-3 mr-1" /> Paused
            </Badge>
          ) : (
            <Badge variant="secondary" className="bg-green-100 text-green-800">
              <Play className="h-3 w-3 mr-1" /> Running
            </Badge>
          )}
        </div>
        {worker?.isPaused && worker.pauseReason && (
          <p className="text-xs text-muted-foreground mt-1">
            Reason: {worker.pauseReason}
          </p>
        )}
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          {worker?.isPaused ? (
            <Button
              size="sm"
              onClick={onResume}
              disabled={isResumingWorker}
            >
              {isResumingWorker ? (
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
              onClick={onPause}
              disabled={isPausingWorker}
            >
              {isPausingWorker ? (
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
            onClick={onRetryAll}
            disabled={isRetryingAll || !stats?.inQueue}
          >
            {isRetryingAll ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RotateCcw className="h-4 w-4 mr-2" />
            )}
            Retry All ({stats?.inQueue || 0})
          </Button>
          
          <Button
            size="sm"
            variant="outline"
            onClick={onClearQueue}
            disabled={isClearingQueue || !stats?.inQueue}
          >
            {isClearingQueue ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4 mr-2" />
            )}
            Clear Queue
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
