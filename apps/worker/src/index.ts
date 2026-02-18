import { runAutomation, loadConfig, createLogger, workerState, seedDefaultWorkflows, webhookQueueService, processDocumentsByIds } from '@sm-rn/core';

const logger = createLogger('worker');
let isShuttingDown = false;

// Track periodic cleanup (run once per hour)
let lastWebhookCleanup = Date.now();
const WEBHOOK_CLEANUP_INTERVAL = 3600000; // 1 hour

async function workerLoop() {
  logger.lifecycle('🚀', 'Starting ReceiptHero Paperless-NGX Integration Worker...');

  // Initialize worker state on startup
  await workerState.initialize();

  // Seed default workflows on first run
  await seedDefaultWorkflows();

  // Short poll interval to stay responsive to manual triggers
  const POLL_INTERVAL = 5000; // 5 seconds

  while (!isShuttingDown) {
    try {
      const config = loadConfig();
      const scanInterval = config.processing.scanInterval;

      // Check if worker is paused
      const isPaused = await workerState.isPaused();
      if (isPaused) {
        const state = await workerState.getState();
        logger.info(`Worker paused${state.pauseReason ? `: ${state.pauseReason}` : ''}. Waiting for resume...`);
        await sleep(POLL_INTERVAL);
        continue;
      }

      // ── Webhook Queue Processing (priority) ──────────────────────────
      // Process webhook-queued documents before checking scheduled scans.
      // This ensures near-instant processing when Paperless sends a webhook.
      let webhookProcessed = false;
      const hasWebhookItems = await webhookQueueService.hasPending();
      if (hasWebhookItems) {
        const webhookLock = await workerState.acquireLock();
        if (webhookLock) {
          try {
            const pendingIds = await webhookQueueService.consumePending();
            if (pendingIds.length > 0) {
              logger.info(`📡 Processing ${pendingIds.length} webhook-queued document(s)...`);
              try {
                await processDocumentsByIds(pendingIds);
                // Mark all as completed (processing outcome tracked in processing_logs)
                for (const id of pendingIds) {
                  await webhookQueueService.markCompleted(id);
                }
                webhookProcessed = true;
              } catch (error: any) {
                logger.error('Webhook queue processing failed', error.message || error);
                for (const id of pendingIds) {
                  await webhookQueueService.markFailed(id);
                }
              }
            }
          } finally {
            await workerState.releaseLock();
          }
        } else {
          logger.debug('Webhook items pending but lock not available, will retry next cycle');
        }
      }

      // ── Periodic Webhook Queue Cleanup ────────────────────────────────
      if (Date.now() - lastWebhookCleanup > WEBHOOK_CLEANUP_INTERVAL) {
        try {
          const cleaned = await webhookQueueService.cleanup();
          if (cleaned > 0) {
            logger.info(`Cleaned up ${cleaned} old webhook queue entries`);
          }
        } catch {
          // Non-fatal: ignore cleanup errors
        }
        lastWebhookCleanup = Date.now();
      }

      // ── Scheduled / Manual Scan ──────────────────────────────────────
      // Check if a scan was manually triggered
      const wasTriggered = await workerState.consumeScanRequest();

      // Check elapsed time since last scan
      const timeSinceLastScan = await workerState.getTimeSinceLastScan();
      const shouldRunScheduled = timeSinceLastScan >= scanInterval;

      // Decide whether to run
      if (!wasTriggered && !shouldRunScheduled) {
        // Not time yet, wait and check again
        await sleep(POLL_INTERVAL);
        continue;
      }

      // Try to acquire the lock (prevents duplicate runs if API is also running)
      const lockAcquired = await workerState.acquireLock();
      if (!lockAcquired) {
        logger.debug('Lock not acquired, another scan in progress. Waiting...');
        await sleep(POLL_INTERVAL);
        continue;
      }

      try {
        if (wasTriggered) {
          logger.info('📡 Manual scan triggered, running automation cycle...');
        } else {
          logger.info(`Running scheduled automation cycle (${Math.round(timeSinceLastScan / 1000)}s since last scan)...`);
        }

        const scanResult = await runAutomation();

        // Save scan results for API to read
        await workerState.setScanResult({
          ...scanResult,
          timestamp: new Date().toISOString(),
        });

        logger.info(`Automation cycle complete. Next scan in ${scanInterval / 1000}s (unless manually triggered)`);
      } finally {
        // Always release the lock when done
        await workerState.releaseLock();
      }

    } catch (error: any) {
      logger.error('Worker error', error.message || error);

      // Make sure lock is released on error
      try {
        await workerState.releaseLock();
      } catch {
        // Ignore errors during cleanup
      }

      if (!isShuttingDown) {
        logger.info('Waiting 60s before retry...');
        await sleep(60000);
      }
    }
  }

  logger.lifecycle('✅', 'Worker shutdown complete');
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function gracefulShutdown(signal: string) {
  logger.lifecycle('🛑', `Received ${signal}, shutting down gracefully...`);
  isShuttingDown = true;

  // Release lock if we hold it
  try {
    await workerState.releaseLock();
  } catch {
    // Ignore
  }

  process.exit(0);
}

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Start worker
workerLoop().catch((error) => {
  logger.error('Fatal worker error', error);
  process.exit(1);
});
