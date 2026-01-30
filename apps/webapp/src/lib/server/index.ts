// Re-export all server functions for convenient importing
export { getHealthStatus, type HealthStatus } from './health.functions';
export { getConfig, saveConfig, getAvailableCurrencies, type SaveConfigResponse, type CurrenciesResponse } from './config.functions';
export {
    getWorkerStatus,
    pauseWorker,
    resumeWorker,
    triggerScanAndWait,
    type WorkerStatus,
    type ScanResult,
    type TriggerScanResponse,
} from './worker.functions';
export {
    getQueueStatus,
    retryAllQueue,
    clearQueue,
    getSkippedDocuments,
    clearSkippedDocuments,
    type QueueStatus,
    type QueueItem,
    type QueueActionResponse,
} from './queue.functions';
export {
    getProcessingLogs,
    getDocumentLogs,
    retryDocument,
    getAppLogs,
    type ProcessingLog,
    type RetryDocumentResponse,
} from './processing.functions';
export {
    testPaperlessConnection,
    testTogetherConnection,
    type TestConnectionResponse,
} from './test.functions';
