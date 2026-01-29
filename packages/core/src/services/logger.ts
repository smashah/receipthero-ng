import { reporter } from './reporter';
import { type LogLevel, type LogSource, type LogEntry } from '@sm-rn/shared/types';

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  
  // Log levels
  error: '\x1b[31m',    // red
  warn: '\x1b[33m',     // yellow
  info: '\x1b[36m',     // cyan
  debug: '\x1b[90m',    // gray
  
  // Sources (distinct colors for easy identification)
  worker: '\x1b[35m',   // magenta
  api: '\x1b[32m',      // green
  core: '\x1b[34m',     // blue
  db: '\x1b[33m',       // yellow
  config: '\x1b[36m',   // cyan
  queue: '\x1b[95m',    // light magenta
  ws: '\x1b[92m',       // light green
  ocr: '\x1b[94m',      // light blue
  paperless: '\x1b[96m', // light cyan
} as const;

// Emoji prefixes for visual scanning
const levelEmoji: Record<LogLevel, string> = {
  error: '❌',
  warn: '⚠️ ',
  info: '→',
  debug: '🔍',
};

// Check if we're in a TTY (supports colors)
const isTTY = process.stdout.isTTY ?? false;

function colorize(text: string, color: keyof typeof colors): string {
  if (!isTTY) return text;
  return `${colors[color]}${text}${colors.reset}`;
}

function formatTimestamp(): string {
  const now = new Date();
  const time = now.toISOString().slice(11, 23); // HH:MM:SS.mmm
  return colorize(time, 'dim');
}

function formatLevel(level: LogLevel): string {
  const emoji = levelEmoji[level];
  const label = level.toUpperCase().padEnd(5);
  return `${emoji} ${colorize(label, level)}`;
}

function formatSource(source: LogSource): string {
  const label = source.toUpperCase().padEnd(9);
  const color = (colors[source as keyof typeof colors] ? source : 'info') as keyof typeof colors;
  return colorize(`[${label}]`, color);
}

function formatContext(context: any): string {
  if (!context) return '';
  
  // Handle Error objects specially
  if (context instanceof Error) {
    return colorize(`\n  ${context.stack || context.message}`, 'dim');
  }
  
  // For objects, format as compact JSON
  if (typeof context === 'object') {
    try {
      const json = JSON.stringify(context, null, 0);
      // Truncate long context
      const maxLen = 200;
      const truncated = json.length > maxLen ? json.slice(0, maxLen) + '...' : json;
      return colorize(` ${truncated}`, 'dim');
    } catch {
      return '';
    }
  }
  
  return colorize(` ${String(context)}`, 'dim');
}

export class Logger {
  private source: LogSource;

  constructor(source: LogSource) {
    this.source = source;
  }

  private async emit(level: LogLevel, message: string, context?: any) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      source: this.source,
      message,
      context: context ? (typeof context === 'string' ? context : JSON.stringify(context)) : undefined,
    };

    // 1. Output to console with structured formatting
    const line = `${formatTimestamp()} ${formatLevel(level)} ${formatSource(this.source)} ${message}${formatContext(context)}`;
    
    if (level === 'error') {
      console.error(line);
    } else if (level === 'warn') {
      console.warn(line);
    } else {
      console.log(line);
    }

    // 2. Report to API for real-time streaming and persistence
    // We use a background promise to not block the main execution
    reporter.report('log:entry' as any, entry).catch(() => {
      // Silently fail if API is down - don't want logger to crash the app
    });
  }

  info(msg: string, ctx?: any) { this.emit('info', msg, ctx); }
  warn(msg: string, ctx?: any) { this.emit('warn', msg, ctx); }
  error(msg: string, ctx?: any) { this.emit('error', msg, ctx); }
  debug(msg: string, ctx?: any) { this.emit('debug', msg, ctx); }
  
  /**
   * Log with a specific emoji prefix for key lifecycle events
   */
  lifecycle(emoji: string, msg: string, ctx?: any) {
    // Override the default emoji just for this message
    const line = `${formatTimestamp()} ${emoji}  ${colorize('INFO ', 'info')} ${formatSource(this.source)} ${msg}${formatContext(ctx)}`;
    console.log(line);
    
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: 'info',
      source: this.source,
      message: `${emoji} ${msg}`,
      context: ctx ? JSON.stringify(ctx) : undefined,
    };
    reporter.report('log:entry' as any, entry).catch(() => {});
  }
}

export const logger = new Logger('core');
export const createLogger = (source: LogSource) => new Logger(source);
