import { Activity } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CliOutput } from '@/components/ui/cli-output';
import type { LogEntry } from '@/lib/api';

interface SystemLogsSectionProps {
  appLogs: LogEntry[];
}

export function SystemLogsSection({ appLogs }: SystemLogsSectionProps) {
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
  );
}
