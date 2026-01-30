import { Settings } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link } from '@tanstack/react-router';
import type { Config } from '@/lib/queries';

interface ConfigSummaryCardProps {
  config: Config | undefined;
}

export function ConfigSummaryCard({ config }: ConfigSummaryCardProps) {
  return (
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
  );
}
