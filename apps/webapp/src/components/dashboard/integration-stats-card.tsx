import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

interface IntegrationStats {
  detected: number;
  processed: number;
  failed: number;
  skipped: number;
  inQueue: number;
}

interface IntegrationStatsCardProps {
  stats: IntegrationStats | undefined;
}

export function IntegrationStatsCard({ stats }: IntegrationStatsCardProps) {
  return (
    <Card className="md:col-span-2 lg:col-span-3">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Integration Statistics
        </CardTitle>
      </CardHeader>
      <CardContent>
        {stats ? (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="space-y-1">
              <span className="text-3xl font-bold tracking-tight">{stats.detected}</span>
              <p className="text-xs text-muted-foreground uppercase font-medium">Detected</p>
            </div>
            <div className="space-y-1 border-l pl-4">
              <span className="text-3xl font-bold tracking-tight text-green-600">{stats.processed}</span>
              <p className="text-xs text-muted-foreground uppercase font-medium">Processed</p>
            </div>
            <div className="space-y-1 border-l pl-4">
              <span className="text-3xl font-bold tracking-tight text-destructive">{stats.failed}</span>
              <p className="text-xs text-muted-foreground uppercase font-medium">Failed</p>
            </div>
            <div className="space-y-1 border-l pl-4">
              <span className="text-3xl font-bold tracking-tight text-gray-500">{stats.skipped}</span>
              <p className="text-xs text-muted-foreground uppercase font-medium">Skipped</p>
            </div>
            <div className="space-y-1 border-l pl-4">
              <span className="text-3xl font-bold tracking-tight text-yellow-600">{stats.inQueue}</span>
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
  );
}
