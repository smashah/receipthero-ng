import { Loader2 } from 'lucide-react';

export function LoadingState() {
  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center bg-gray-50/50">
      <div className="text-center space-y-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
        <p className="text-muted-foreground">Loading system status...</p>
      </div>
    </div>
  );
}
