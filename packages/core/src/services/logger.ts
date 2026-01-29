import { reporter } from './reporter';
import { type LogLevel, type LogSource, type LogEntry } from '@sm-rn/shared/types';

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
      context: context ? JSON.stringify(context) : undefined,
    };

    // 1. Output to console for standard log viewing (Docker/systemd)
    const prefix = `[${entry.timestamp.slice(11, 19)}] [${entry.source.toUpperCase()}] [${entry.level.toUpperCase()}]`;
    if (level === 'error') {
      console.error(prefix, message, context || '');
    } else if (level === 'warn') {
      console.warn(prefix, message, context || '');
    } else {
      console.log(prefix, message, context || '');
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
}

export const logger = new Logger('core');
export const createLogger = (source: LogSource) => new Logger(source);
