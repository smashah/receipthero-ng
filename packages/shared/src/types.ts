import { z } from "zod";

// Schema for line items on a receipt
export const LineItemSchema = z.object({
  name: z.string(),
  quantity: z.number().optional(),
  unitPrice: z.number().optional(),
  totalPrice: z.number(),
});

// Schema for a processed receipt
export const ProcessedReceiptSchema = z.object({
  id: z.string(),
  fileName: z.string(),
  date: z.string(),
  vendor: z.string(),
  category: z.string(),
  paymentMethod: z.string(),
  taxAmount: z.number(),
  amount: z.number(),
  currency: z.string().default('USD'),
  originalAmount: z.number().optional(),
  originalTaxAmount: z.number().optional(),
  exchangeRate: z.number().optional(),
  thumbnail: z.string(),
  base64: z.string(),
  mimeType: z.string(),
  // AI-generated fields for Paperless
  title: z.string().optional(), // Human-readable document title
  summary: z.string().optional(), // Text summary of the receipt
  line_items: z.array(LineItemSchema).optional(), // Individual items on the receipt
  suggested_tags: z.array(z.string()).optional(), // AI-suggested tags based on content
});

// Type exports
export type ProcessedReceipt = z.infer<typeof ProcessedReceiptSchema>;

// Storage-optimized version without large base64 data
export interface StoredReceipt {
  id: string;
  fileName: string;
  date: string;
  vendor: string;
  category: string;
  paymentMethod: string;
  taxAmount: number;
  amount: number;
  currency?: string;
  originalAmount?: number;
  originalTaxAmount?: number;
  exchangeRate?: number;
  mimeType: string;
}

// Status for uploaded files
export type FileStatus = 'processing' | 'receipt' | 'not-receipt' | 'error';

export interface UploadedFile {
  id: string;
  name: string;
  file: File;
  status: FileStatus;
  receipt?: ProcessedReceipt;
  /** Error message - only present when status === 'error' */
  error?: string;
  base64?: string;
  mimeType?: string;
}

export interface SpendingCategory {
  name: string;
  amount: number;
  percentage: number;
}

export interface SpendingBreakdown {
  categories: SpendingCategory[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Processing Events & Logs
// ─────────────────────────────────────────────────────────────────────────────

export type ProcessingStatus = 'detected' | 'processing' | 'completed' | 'failed' | 'retrying';

export interface ProcessingLog {
  id: number;
  documentId: number;
  status: ProcessingStatus;
  message?: string;
  progress: number;
  attempts: number;
  fileName?: string;
  vendor?: string;
  amount?: number;
  currency?: string;
  receiptData?: string; // Full extracted JSON string
  createdAt: string;
  updatedAt: string;
}

export type ProcessingEventType =
  | 'receipt:detected'
  | 'receipt:processing'
  | 'receipt:success'
  | 'receipt:failed'
  | 'receipt:retry'
  | 'receipt:skipped';

export interface ProcessingEvent {
  type: ProcessingEventType;
  payload: Partial<ProcessingLog> & { documentId: number };
}

// ─────────────────────────────────────────────────────────────────────────────
// Logging Types
// ─────────────────────────────────────────────────────────────────────────────

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export type LogSource = 'worker' | 'api' | 'core' | 'db' | 'config' | 'queue' | 'ws' | 'ocr' | 'paperless';

export interface LogEntry {
  id?: number;
  timestamp: string;
  level: LogLevel;
  source: LogSource;
  message: string;
  context?: string; // JSON string
  documentId?: number; // Optional: links log to a specific document
}

export interface LogEvent {
  type: 'log:entry';
  payload: LogEntry;
}

export type AppEventType = ProcessingEventType | 'log:entry';

export interface AppEvent {
  type: AppEventType;
  payload: any;
}
