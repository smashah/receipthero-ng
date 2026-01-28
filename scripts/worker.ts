import { runAutomation } from "../lib/bridge";

const SCAN_INTERVAL = parseInt(process.env.SCAN_INTERVAL || "300000", 10); // Default 5 minutes

let isShuttingDown = false;
let currentProcessing: Promise<void> | null = null;

async function shutdown(signal: string) {
  console.log(`${signal} received. Finishing current automation run...`);
  isShuttingDown = true;
  
  // Wait for current processing to complete
  if (currentProcessing) {
    await currentProcessing;
    console.log("Current automation run complete.");
  }
  
  console.log('Shutdown complete.');
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

async function startWorker() {
  console.log("Starting ReceiptHero Paperless-NGX Integration Worker...");
  
  while (!isShuttingDown) {
    try {
      currentProcessing = runAutomation();
      await currentProcessing;
      currentProcessing = null;
    } catch (error) {
      console.error("Worker error during automation run:", error);
      currentProcessing = null;
    }
    
    if (!isShuttingDown) {
      console.log(`Waiting ${SCAN_INTERVAL / 1000} seconds for next scan...`);
      await new Promise(resolve => setTimeout(resolve, SCAN_INTERVAL));
    }
  }
}

startWorker();
