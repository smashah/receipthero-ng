import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { WS_BASE_URL, type ProcessingLog, type AppEvent, type LogEntry } from '@/lib/api';
import { useProcessingLogs, useAppLogs } from '@/lib/queries';

export function useAppEvents() {
  const queryClient = useQueryClient();
  const { data: initialProcessing, isLoading: isLoadingProcessing } = useProcessingLogs();
  const { data: initialLogs, isLoading: isLoadingLogs } = useAppLogs();

  const [processingLogs, setProcessingLogs] = useState<ProcessingLog[]>([]);
  const [appLogs, setAppLogs] = useState<LogEntry[]>([]);

  useEffect(() => {
    if (initialProcessing) setProcessingLogs(initialProcessing);
  }, [initialProcessing]);

  useEffect(() => {
    if (initialLogs) {
      // Sort initial logs by timestamp descending
      const sorted = [...initialLogs].sort((a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
      setAppLogs(sorted);
    }
  }, [initialLogs]);

  useEffect(() => {
    let socket: WebSocket | null = null;
    let reconnectTimeout: any = null;

    const connect = () => {
      socket = new WebSocket(`${WS_BASE_URL}/ws`);

      socket.onopen = () => {
        console.log('Connected to app events');
      };

      socket.onmessage = (event) => {
        try {
          const data: AppEvent = JSON.parse(event.data);
          const { type, payload } = data;

          if (type === 'log:entry') {
            setAppLogs((prev) => [payload as LogEntry, ...prev].slice(0, 1000));
            return;
          }

          // Refresh currency totals when a document is successfully processed
          if (type === 'receipt:success') {
            queryClient.invalidateQueries({ queryKey: ['stats', 'currency-totals'] });
          }

          // Handle processing events
          setProcessingLogs((prev) => {
            const existingIndex = prev.findIndex((l) => l.documentId === payload.documentId);

            let status = payload.status;
            if (type === 'receipt:detected') status = 'detected';
            if (type === 'receipt:success') status = 'completed';
            if (type === 'receipt:failed') status = 'failed';
            if (type === 'receipt:retry') status = 'retrying';

            if (existingIndex > -1) {
              const updated = [...prev];
              updated[existingIndex] = {
                ...updated[existingIndex],
                ...payload,
                status: status || updated[existingIndex].status,
                updatedAt: new Date().toISOString(),
              } as ProcessingLog;
              return updated;
            } else {
              return [
                {
                  ...payload,
                  status: status || 'processing',
                  progress: payload.progress ?? 0,
                  attempts: payload.attempts ?? 1,
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                } as ProcessingLog,
                ...prev,
              ];
            }
          });
        } catch (err) {
          console.error('Failed to parse WS message:', err);
        }
      };

      socket.onclose = () => {
        console.log('WS connection closed, reconnecting...');
        reconnectTimeout = setTimeout(connect, 3000);
      };

      socket.onerror = (err) => {
        console.error('WS error:', err);
        socket?.close();
      };
    };

    connect();

    return () => {
      if (socket) {
        socket.onclose = null;
        socket.close();
      }
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, [queryClient]);

  return {
    processingLogs,
    appLogs,
    isLoading: isLoadingProcessing || isLoadingLogs
  };
}

