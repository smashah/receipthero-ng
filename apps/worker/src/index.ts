import { runAutomation, loadConfig, createLogger, workerState } from '@sm-rn/core';

const logger = createLogger('worker');
let isShuttingDown = false;
let currentRunPromise: Promise<void> | null = null;

async function workerLoop() {
  logger.lifecycle('🚀', 'Starting ReceiptHero Paperless-NGX Integration Worker...');
  
  // Initialize worker state on startup
  await workerState.initialize();

  while (!isShuttingDown) {
    try {
      const config = loadConfig();
      const scanInterval = config.processing.scanInterval;

      // Check if worker is paused
      const isPaused = await workerState.isPaused();
      if (isPaused) {
        const state = await workerState.getState();
        logger.info(`Worker paused${state.pauseReason ? `: ${state.pauseReason}` : ''}. Waiting for resume...`);
        await sleep(5000); // Check every 5 seconds if still paused
        continue;
      }

      logger.info('Running automation cycle...');
      currentRunPromise = runAutomation();
      await currentRunPromise;
      currentRunPromise = null;

      if (!isShuttingDown) {
        logger.info(`Waiting ${scanInterval / 1000}s until next scan...`);
        await sleep(scanInterval);
      }
    } catch (error: any) {
      logger.error('Worker error', error.message || error);
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

  if (currentRunPromise) {
    logger.info('Waiting for current automation run to complete...');
    await currentRunPromise;
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
