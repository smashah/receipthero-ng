import { Loader2, RefreshCw, Settings2, XCircle } from 'lucide-react';
import { Link } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';

interface ErrorStateProps {
  error: unknown;
  onRetry: () => void;
  isRetrying: boolean;
}

export function ErrorState({ error, onRetry, isRetrying }: ErrorStateProps) {
  const errorMessage = error instanceof Error
    ? error.message
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
          <Button onClick={onRetry} disabled={isRetrying}>
            {isRetrying ? (
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
          <Link
            to="/settings"
            className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground h-9 px-4 py-2 border border-input bg-background"
          >
            <Settings2 className="h-4 w-4" />
            Go to Settings
          </Link>
          <p className="text-xs text-muted-foreground">
            Auto-retry every 30 seconds
          </p>
        </div>
      </div>
    </div>
  );
}
