import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { migrate } from 'drizzle-orm/bun-sqlite/migrator';
import * as schema from './schema';

const DB_PATH = process.env.DATABASE_PATH || '/app/data/receipthero.db';

// Create database connection
const sqlite = new Database(DB_PATH, { create: true });
export const db = drizzle(sqlite, { schema });

// Run migrations on startup
try {
  migrate(db, { migrationsFolder: './drizzle' });
  console.log('✅ Database migrations completed');
} catch (error) {
  console.error('❌ Database migration failed:', error);
  throw error;
}

export { schema };
