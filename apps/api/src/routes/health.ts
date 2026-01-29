import { Hono } from 'hono';
import { loadConfig } from '@sm-rn/core';
import { PaperlessClient } from '@sm-rn/core';

const health = new Hono();

interface HealthStatus {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  checks: {
    paperlessConnection: 'ok' | 'error';
    togetherAiConnection: 'ok' | 'error';
    config: 'ok' | 'error';
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

  // 3. Paperless Connection Check
  if (config) {
    try {
      const client = new PaperlessClient({
        host: config.paperless.host,
        apiKey: config.paperless.apiKey,
        processedTagName: config.processing.processedTag,
      });
      await client.getTags();
    } catch (error) {
      status.checks.paperlessConnection = 'error';
      status.status = 'unhealthy';
      errors.push(`Paperless connection failed: ${error instanceof Error ? error.message : String(error)}`);
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
