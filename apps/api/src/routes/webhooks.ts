import { Hono } from 'hono';
import { loadConfig, workerState, webhookQueueService, createLogger } from '@sm-rn/core';

const logger = createLogger('api');
const webhooks = new Hono();

// POST /api/webhooks/paperless — Receive Paperless-ngx workflow webhook
webhooks.post('/paperless', async (c) => {
  const config = loadConfig();

  // 1. Check if webhooks are enabled
  if (!config.webhooks?.enabled) {
    return c.json({ error: 'Webhooks are disabled' }, 403);
  }

  // 2. Validate Authorization header (if secret is configured)
  if (config.webhooks.secret) {
    const authHeader = c.req.header('Authorization');
    const expectedToken = `Bearer ${config.webhooks.secret}`;
    if (!authHeader || authHeader !== expectedToken) {
      logger.warn('Webhook rejected: invalid or missing Authorization header');
      return c.json({ error: 'Unauthorized' }, 401);
    }
  }

  // 3. Parse payload (flexible: JSON or form data)
  let documentId: number | undefined;
  let rawPayload: string | undefined;

  try {
    const contentType = c.req.header('Content-Type') || '';
    if (contentType.includes('application/json')) {
      const body = await c.req.json();
      documentId = parseInt(body.document_id, 10);
      rawPayload = JSON.stringify(body);
    } else if (contentType.includes('form')) {
      const body = await c.req.parseBody();
      documentId = parseInt(body.document_id as string, 10);
      rawPayload = JSON.stringify(body);
    } else {
      // Try JSON parsing as fallback
      try {
        const body = await c.req.json();
        documentId = parseInt(body.document_id, 10);
        rawPayload = JSON.stringify(body);
      } catch {
        return c.json({ error: 'Unsupported content type. Use application/json or form data.' }, 400);
      }
    }
  } catch (error) {
    logger.error('Failed to parse webhook payload', error);
    return c.json({ error: 'Failed to parse request body' }, 400);
  }

  // 4. Validate document ID
  if (!documentId || isNaN(documentId)) {
    return c.json({ error: 'Missing or invalid document_id in payload' }, 400);
  }

  // 5. Queue for processing and trigger scan
  try {
    await webhookQueueService.enqueue(documentId, rawPayload);
    await workerState.triggerScan();

    logger.info(`Webhook received: document ${documentId} queued for processing`);

    // 6. Return 200 immediately (Paperless has 5s timeout)
    return c.json({ status: 'queued', documentId });
  } catch (error) {
    logger.error('Failed to enqueue webhook', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// GET /api/webhooks/status — Webhook configuration info and queue stats
webhooks.get('/status', async (c) => {
  try {
    const config = loadConfig();
    const stats = await webhookQueueService.getStats();

    return c.json({
      enabled: config.webhooks?.enabled ?? false,
      hasSecret: !!config.webhooks?.secret,
      queue: stats,
    });
  } catch (error) {
    return c.json({ error: String(error) }, 500);
  }
});

// GET /api/webhooks/history — Recent webhook deliveries
webhooks.get('/history', async (c) => {
  try {
    const limit = parseInt(c.req.query('limit') || '50', 10);
    const entries = await webhookQueueService.getRecent(limit);

    return c.json(entries);
  } catch (error) {
    return c.json({ error: String(error) }, 500);
  }
});

export default webhooks;
