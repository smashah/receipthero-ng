import { RefreshCw, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from '@tanstack/react-router';
import { cn } from '@/lib/utils';

interface DashboardHeaderProps {
  lastRefresh: Date | null;
  onRefresh: () => void;
  isRefreshing: boolean;
  isTriggeringScan: boolean;
}

export function DashboardHeader({
  lastRefresh,
  onRefresh,
  isRefreshing,
  isTriggeringScan,
}: DashboardHeaderProps) {
  const formatTime = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
    }).format(date);
  };

  return (
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
          variant={isTriggeringScan ? "secondary" : "outline"}
          size="sm"
          onClick={onRefresh}
          disabled={isTriggeringScan || isRefreshing}
        >
          <RefreshCw className={cn("h-4 w-4 mr-2", (isTriggeringScan || isRefreshing) && "animate-spin")} />
          {isTriggeringScan ? "Scanning..." : "Refresh"}
        </Button>
        <Link to="/settings">
          <Button>
            <Settings className="h-4 w-4 mr-2" />
            Configure
          </Button>
        </Link>
      </div>
    </div>
  );
}
