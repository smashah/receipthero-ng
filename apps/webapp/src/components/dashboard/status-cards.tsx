import { Activity, Server, FileText, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import type { HealthStatus, Config } from '@/lib/queries';

interface StatusCardsProps {
  health: HealthStatus | undefined;
  config: Config | undefined;
}

export function StatusCards({ health, config }: StatusCardsProps) {
  return (
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
            API Key: {config?.togetherAi?.apiKey ? "Configured" : "Not configured"}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
