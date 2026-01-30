import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { workerState } from '@sm-rn/core';

const worker = new Hono();

// GET /api/worker - Get worker status
worker.get('/', async (c) => {
  try {
    const state = await workerState.getState();
    return c.json({
      success: true,
      ...state,
    });
  } catch (error) {
    return c.json({ success: false, error: String(error) }, 500);
  }
});

const PauseSchema = z.object({
  reason: z.string().optional(),
});

// POST /api/worker/pause - Pause the worker
worker.post('/pause', zValidator('json', PauseSchema.optional()), async (c) => {
  try {
    const body = c.req.valid('json');
    await workerState.pause(body?.reason);
    const state = await workerState.getState();
    return c.json({
      success: true,
      message: 'Worker paused',
      ...state,
    });
  } catch (error) {
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// POST /api/worker/resume - Resume the worker
worker.post('/resume', async (c) => {
  try {
    await workerState.resume();
    const state = await workerState.getState();
    return c.json({
      success: true,
      message: 'Worker resumed',
      ...state,
    });
  } catch (error) {
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// POST /api/worker/scan - Trigger an immediate scan
worker.post('/scan', async (c) => {
  try {
    await workerState.triggerScan();
    return c.json({
      success: true,
      message: 'Scan triggered',
    });
  } catch (error) {
    return c.json({ success: false, error: String(error) }, 500);
  }
});

export default worker;
