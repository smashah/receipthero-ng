import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import * as schema from './schema';
import * as fs from 'fs';
import * as path from 'path';
import { createLogger } from '../services/logger';

const logger = createLogger('db');
const DB_PATH = process.env.DATABASE_PATH || '/app/data/receipthero.db';

// Ensure directory exists
const dir = path.dirname(DB_PATH);
if (!fs.existsSync(dir)) {
  logger.lifecycle('📂', `Creating database directory: ${dir}`);
  fs.mkdirSync(dir, { recursive: true });
}

logger.lifecycle('🗄️', `Using database at: ${DB_PATH}`);
const sqlite = new Database(DB_PATH, { create: true });
export const db = drizzle(sqlite, { schema });

export { schema };
