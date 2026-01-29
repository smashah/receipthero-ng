import { Hono } from 'hono';
import { loadConfig } from '@sm-rn/core';
import { PaperlessClient, RetryQueue } from '@sm-rn/core';

const health = new Hono();

interface HealthStatus {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  checks: {
    paperlessConnection: 'ok' | 'error';
    togetherAiConnection: 'ok' | 'error';
    config: 'ok' | 'error';
  };
  stats?: {
    detected: number;
    processed: number;
    failed: number;
    inQueue: number;
  };
  errors?: string[];
}

health.get('/', async (c) => {
  const status: HealthStatus = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    checks: {
      paperlessConnection: 'ok',
      togetherAiConnection: 'ok',
      config: 'ok',
    },
  };
  const errors: string[] = [];

  // 1. Config Check
  let config;
  try {
    config = loadConfig();
  } catch (error) {
    status.checks.config = 'error';
    status.status = 'unhealthy';
    errors.push(`Config validation failed: ${error instanceof Error ? error.message : String(error)}`);
  }

  // 2. Together AI Connection Check
  if (config) {
    if (!config.togetherAi.apiKey || config.togetherAi.apiKey.length < 10) {
      status.checks.togetherAiConnection = 'error';
      status.status = 'unhealthy';
      errors.push('Together AI API key is missing or too short');
    }
  } else {
    status.checks.togetherAiConnection = 'error';
    status.status = 'unhealthy';
  }

  // 3. Paperless Connection & Stats Check
  if (config) {
    try {
      const client = new PaperlessClient({
        host: config.paperless.host,
        apiKey: config.paperless.apiKey,
        processedTagName: config.processing.processedTag,
      });
      
      const tags = await client.getTags();
      const processedTag = tags.find((t: any) => t.name.toLowerCase() === config.processing.processedTag.toLowerCase());
      const receiptTag = tags.find((t: any) => t.name.toLowerCase() === config.processing.receiptTag.toLowerCase());
      const failedTag = tags.find((t: any) => t.name.toLowerCase() === config.processing.failedTag.toLowerCase());

      // Fetch stats
      let detectedCount = 0;
      let processedCount = 0;
      let failedCount = 0;

      if (receiptTag) {
        const res = await fetch(`${config.paperless.host.replace(/\/$/, "")}/api/documents/?tags__id__all=${receiptTag.id}&page_size=1`, {
          headers: { Authorization: `Token ${config.paperless.apiKey}` }
        });
        const data = await res.json() as any;
        detectedCount = data.count || 0;
      }

      if (processedTag) {
        const res = await fetch(`${config.paperless.host.replace(/\/$/, "")}/api/documents/?tags__id__all=${processedTag.id}&page_size=1`, {
          headers: { Authorization: `Token ${config.paperless.apiKey}` }
        });
        const data = await res.json() as any;
        processedCount = data.count || 0;
      }

      if (failedTag) {
        const res = await fetch(`${config.paperless.host.replace(/\/$/, "")}/api/documents/?tags__id__all=${failedTag.id}&page_size=1`, {
          headers: { Authorization: `Token ${config.paperless.apiKey}` }
        });
        const data = await res.json() as any;
        failedCount = data.count || 0;
      }

      const retryQueue = new RetryQueue(config.processing.maxRetries);
      const inQueueCount = await retryQueue.size();

      status.stats = {
        detected: detectedCount,
        processed: processedCount,
        failed: failedCount,
        inQueue: inQueueCount,
      };

    } catch (error) {
      status.checks.paperlessConnection = 'error';
      status.status = 'unhealthy';
      errors.push(`Paperless connection/stats failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  } else {
    status.checks.paperlessConnection = 'error';
    status.status = 'unhealthy';
  }

  if (errors.length > 0) {
    status.errors = errors;
  }

  return c.json(status, status.status === 'healthy' ? 200 : 503);
});

export default health;
