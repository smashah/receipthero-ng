import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { migrate } from 'drizzle-orm/bun-sqlite/migrator';
import * as fs from 'fs';
import * as path from 'path';

const DB_PATH = process.env.DATABASE_PATH || '/app/data/receipthero.db';

// Ensure directory exists
const dir = path.dirname(DB_PATH);
if (!fs.existsSync(dir)) {
    console.log(`📂 Creating database directory: ${dir}`);
    fs.mkdirSync(dir, { recursive: true });
}

console.log(`🗄️ Running migrations on: ${DB_PATH}`);

const sqlite = new Database(DB_PATH, { create: true });

// Enable WAL mode for better concurrency
sqlite.run('PRAGMA journal_mode = WAL;');
sqlite.run('PRAGMA busy_timeout = 5000;');

const db = drizzle(sqlite);

// Find migrations folder relative to this file
const migrationsFolder = path.resolve(import.meta.dirname, '../../drizzle');

console.log(`📁 Migrations folder: ${migrationsFolder}`);

try {
    migrate(db, { migrationsFolder });
    console.log('✅ Migrations applied successfully!');
} catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
} finally {
    sqlite.close();
}
