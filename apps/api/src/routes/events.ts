import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { broadcastHub } from '../lib/broadcast';
import { db, schema } from '@sm-rn/core';
import { eq, desc } from 'drizzle-orm';

const events = new Hono();

const ProcessingEventSchema = z.object({
  type: z.string(),
  payload: z.any()
});

// GET /api/events/logs - Get recent logs
events.get('/logs', async (c) => {
  const source = c.req.query('source') as any;
  const limit = parseInt(c.req.query('limit') || '100', 10);

  try {
    let query: any = db
      .select()
      .from(schema.logs)
      .orderBy(desc(schema.logs.timestamp))
      .limit(limit);
    
    if (source) {
      query = query.where(eq(schema.logs.source, source));
    }

    const logs = await query.all();
    return c.json(logs);
  } catch (error) {
    return c.json({ error: String(error) }, 500);
  }
});

// GET /api/events - Get recent processing logs
events.get('/', async (c) => {
  try {
    const logs = await db
      .select()
      .from(schema.processingLogs)
      .orderBy(desc(schema.processingLogs.updatedAt))
      .limit(50)
      .all();
    return c.json(logs);
  } catch (error) {
    return c.json({ error: String(error) }, 500);
  }
});

// POST /api/events - Receive event from worker
events.post('/', zValidator('json', ProcessingEventSchema), async (c) => {
  const event = c.req.valid('json');
  const { type, payload } = event;

  try {
    if (type === 'log:entry') {
      // 1. Persist to Logs table
      await db.insert(schema.logs).values({
        timestamp: payload.timestamp,
        level: payload.level,
        source: payload.source,
        message: payload.message,
        context: payload.context,
      }).run();

      // 2. Broadcast to WS
      broadcastHub.emit('app:event', event);
      return c.json({ success: true });
    }

    const { documentId } = payload;
    // 1. Persist to DB
    const existing = await db
      .select()
      .from(schema.processingLogs)
      .where(eq(schema.processingLogs.documentId, documentId))
      .orderBy(desc(schema.processingLogs.id))
      .get();

    const now = new Date().toISOString();
    
    // Status mapping from event type
    let status = payload.status || 'processing';
    if (type === 'receipt:detected') status = 'detected';
    if (type === 'receipt:success') status = 'completed';
    if (type === 'receipt:failed') status = 'failed';
    if (type === 'receipt:retry') status = 'retrying';

    if (existing && existing.status !== 'completed' && existing.status !== 'failed') {
      await db
        .update(schema.processingLogs)
        .set({
          status,
          message: payload.message || existing.message,
          progress: payload.progress ?? existing.progress,
          attempts: payload.attempts ?? existing.attempts,
          fileName: payload.fileName || existing.fileName,
          vendor: payload.vendor || existing.vendor,
          amount: payload.amount || existing.amount,
          currency: payload.currency || existing.currency,
          receiptData: payload.receiptData || existing.receiptData,
          updatedAt: now,
        })
        .where(eq(schema.processingLogs.id, existing.id))
        .run();
    } else {
      await db
        .insert(schema.processingLogs)
        .values({
          documentId,
          status,
          message: payload.message,
          progress: payload.progress ?? 0,
          attempts: payload.attempts ?? 1,
          fileName: payload.fileName,
          vendor: payload.vendor,
          amount: payload.amount,
          currency: payload.currency,
          receiptData: payload.receiptData,
          createdAt: now,
          updatedAt: now,
        })
        .run();
    }

    // 2. Broadcast to WS
    broadcastHub.emit('app:event', event);

    return c.json({ success: true });
  } catch (error) {
    console.error('Failed to process event:', error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

export default events;
