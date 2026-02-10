import { Hono } from 'hono';
import { loadConfig, RetryQueue, skippedDocuments } from '@sm-rn/core';

const queue = new Hono();

// GET /api/queue - Get queue status
queue.get('/', async (c) => {
  try {
    const config = loadConfig();
    const retryQueue = new RetryQueue(config.processing.maxRetries);
    
    const items = await retryQueue.getAll();
    const skippedCount = await skippedDocuments.count();
    
    return c.json({
      success: true,
      queue: {
        size: items.length,
        items: items.map(item => ({
          documentId: item.documentId,
          attempts: item.attempts,
          lastError: item.lastError,
          nextRetryAt: item.nextRetryAt,
        })),
      },
      skipped: {
        count: skippedCount,
      },
    });
  } catch (error) {
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// POST /api/queue/retry-all - Reset all items for immediate retry
queue.post('/retry-all', async (c) => {
  try {
    const config = loadConfig();
    const retryQueue = new RetryQueue(config.processing.maxRetries);
    
    const count = await retryQueue.retryAll();
    
    return c.json({
      success: true,
      message: `Reset ${count} items for immediate retry`,
      count,
    });
  } catch (error) {
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// POST /api/queue/clear - Clear all items from the queue
queue.post('/clear', async (c) => {
  try {
    const config = loadConfig();
    const retryQueue = new RetryQueue(config.processing.maxRetries);
    
    const count = await retryQueue.clear();
    
    return c.json({
      success: true,
      message: `Cleared ${count} items from queue`,
      count,
    });
  } catch (error) {
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// GET /api/queue/skipped - Get skipped documents
queue.get('/skipped', async (c) => {
  try {
    const items = await skippedDocuments.getAll();
    
    return c.json({
      success: true,
      count: items.length,
      items,
    });
  } catch (error) {
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// POST /api/queue/skipped/clear - Clear skipped documents list
queue.post('/skipped/clear', async (c) => {
  try {
    const count = await skippedDocuments.clear();
    
    return c.json({
      success: true,
      message: `Cleared ${count} skipped documents`,
      count,
    });
  } catch (error) {
    return c.json({ success: false, error: String(error) }, 500);
  }
});

export default queue;
