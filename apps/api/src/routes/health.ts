import { Hono } from 'hono';
import { loadConfig, workerState } from '@sm-rn/core';
import { PaperlessClient, RetryQueue, workerStateSchema, skippedDocuments } from '@sm-rn/core';

const health = new Hono();

interface HealthStatus {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  configComplete: boolean;
  checks: {
    paperlessConnection: 'ok' | 'error';
    aiConnection: 'ok' | 'error';
    config: 'ok' | 'error';
  };
  worker?: {
    isPaused: boolean;
    pausedAt: string | null;
    pauseReason: string | null;
  };
  stats?: {
    detected: number;
    processed: number;
    failed: number;
    skipped: number;
    inQueue: number;
  };
  errors?: string[];
}

/**
 * Checks whether the Paperless host/apiKey are actually configured
 * (not empty, not placeholder values from the default template).
 */
function isPaperlessConfigured(config: { paperless: { host: string; apiKey: string } }): boolean {
  const { host, apiKey } = config.paperless;
  if (!host || !apiKey) return false;
  // Detect placeholder values from the default template
  if (host === 'http://localhost:8000' && apiKey === 'YOUR_PAPERLESS_API_KEY') return false;
  if (apiKey === 'YOUR_PAPERLESS_API_KEY') return false;
  // Must be a valid URL
  try { new URL(host); } catch { return false; }
  return true;
}

health.get('/', async (c) => {
  const status: HealthStatus = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    configComplete: false,
    checks: {
      paperlessConnection: 'ok',
      aiConnection: 'ok',
      config: 'ok',
    },
  };
  const errors: string[] = [];

  // Get worker state
  try {
    status.worker = await workerState.getState();
  } catch (error) {
    // Worker state not critical, continue
  }

  // 1. Config Check
  let config;
  try {
    config = loadConfig();
    // Check if essential config (Paperless) is actually filled in
    status.configComplete = isPaperlessConfigured(config);
  } catch (error) {
    status.checks.config = 'error';
    status.status = 'unhealthy';
    errors.push(`Config validation failed: ${error instanceof Error ? error.message : String(error)}`);
  }

  // 2. AI Connection Check — verify API key is present for cloud providers
  if (config) {
    const needsApiKey = config.ai.provider === 'openai-compat' || config.ai.provider === 'openrouter';
    if (needsApiKey && (!config.ai.apiKey || config.ai.apiKey.length < 10)) {
      status.checks.aiConnection = 'error';
      status.status = 'unhealthy';
      errors.push('AI API key is missing or too short');
    }
  } else {
    status.checks.aiConnection = 'error';
    status.status = 'unhealthy';
  }

  // 3. Paperless Connection & Stats Check
  if (config && isPaperlessConfigured(config)) {
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
      const skippedCount = await skippedDocuments.count();

      status.stats = {
        detected: detectedCount,
        processed: processedCount,
        failed: failedCount,
        skipped: skippedCount,
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
    if (config) {
      errors.push('Paperless-ngx is not configured. Go to Settings to set it up.');
    }
  }

  if (errors.length > 0) {
    status.errors = errors;
  }

  return c.json(status, status.status === 'healthy' ? 200 : 503);
});

export default health;
