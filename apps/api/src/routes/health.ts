import { Hono } from 'hono';
import { loadConfig } from '../services/config';
import { PaperlessClient } from '../services/paperless';

const health = new Hono();

interface HealthStatus {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  checks: {
    paperlessConnection: 'ok' | 'error';
    aiConnection: 'ok' | 'error';
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
      aiConnection: 'ok',
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
