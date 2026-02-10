import { AlertTriangle } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { HealthStatus } from '@/lib/queries';

interface HealthChecksCardProps {
  health: HealthStatus | undefined;
}

export function HealthChecksCard({ health }: HealthChecksCardProps) {
  const getStatusVariant = (status: 'ok' | 'error' | undefined) => {
    return status === 'ok' ? 'default' : 'destructive';
  };

  return (
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
  );
}
