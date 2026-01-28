import { runAutomation } from './services/bridge';
import { loadConfig } from './services/config';

let isShuttingDown = false;
let currentRunPromise: Promise<void> | null = null;

async function workerLoop() {
  console.log('🤖 Starting ReceiptHero Paperless-NGX Integration Worker...');

  while (!isShuttingDown) {
    try {
      const config = loadConfig();
      const scanInterval = config.processing.scanInterval;

      console.log(`\n📋 Running automation cycle...`);
      currentRunPromise = runAutomation();
      await currentRunPromise;
      currentRunPromise = null;

      if (!isShuttingDown) {
        console.log(`⏱️  Waiting ${scanInterval / 1000}s until next scan...`);
        await sleep(scanInterval);
      }
    } catch (error) {
      console.error('❌ Worker error:', error);
      if (!isShuttingDown) {
        console.log('⏱️  Waiting 60s before retry...');
        await sleep(60000);
      }
    }
  }

  console.log('✅ Worker shutdown complete');
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function gracefulShutdown(signal: string) {
  console.log(`\n⚠️  Received ${signal}, shutting down gracefully...`);
  isShuttingDown = true;

  if (currentRunPromise) {
    console.log('⏳ Waiting for current automation run to complete...');
    await currentRunPromise;
  }

  process.exit(0);
}

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Start worker
workerLoop().catch((error) => {
  console.error('💥 Fatal worker error:', error);
  process.exit(1);
});
