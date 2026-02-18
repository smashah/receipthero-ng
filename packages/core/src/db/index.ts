import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import * as schema from './schema';
import * as fs from 'fs';
import * as path from 'path';
import { createLogger } from '../services/logger';

const logger = createLogger('db');
const DB_PATH = process.env.DATABASE_PATH || (process.env.NODE_ENV === 'test' ? './receipthero.test.db' : '/app/data/receipthero.db');

// Ensure directory exists
const dir = path.dirname(DB_PATH);
if (!fs.existsSync(dir)) {
  logger.lifecycle('📂', `Creating database directory: ${dir}`);
  fs.mkdirSync(dir, { recursive: true });
}

/**
 * Initialize SQLite database with retry logic for handling race conditions.
 * This is needed because both API and worker might try to initialize simultaneously.
 */
function initializeDatabase(maxRetries = 5, baseDelayMs = 100): Database {
  logger.lifecycle('🗄️', `Using database at: ${DB_PATH}`);

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const sqlite = new Database(DB_PATH, { create: true });

      // Enable WAL mode for better concurrency (prevents "database is locked" errors)
      sqlite.run('PRAGMA journal_mode = WAL;');
      sqlite.run('PRAGMA busy_timeout = 5000;'); // Wait up to 5 seconds if locked

      if (attempt > 1) {
        logger.debug(`Database initialized successfully on attempt ${attempt}`);
      }

      return sqlite;
    } catch (error: any) {
      const isLocked = error.code === 'SQLITE_BUSY_RECOVERY' ||
        error.code === 'SQLITE_BUSY' ||
        error.message?.includes('database is locked');

      if (isLocked && attempt < maxRetries) {
        const delayMs = baseDelayMs * Math.pow(2, attempt - 1); // Exponential backoff
        logger.warn(`Database locked (attempt ${attempt}/${maxRetries}), retrying in ${delayMs}ms...`);

        // Synchronous sleep using Bun.sleepSync or busy-wait
        const start = Date.now();
        while (Date.now() - start < delayMs) {
          // Busy wait
        }
      } else {
        throw error;
      }
    }
  }

  throw new Error(`Failed to initialize database after ${maxRetries} attempts`);
}

const sqlite = initializeDatabase();

export const db = drizzle(sqlite, { schema });

export { schema };
