
import { Database } from 'bun:sqlite';
import * as path from 'path';

const DB_PATH = './receipthero.db';
console.log(`Checking database at: ${DB_PATH}`);

const sqlite = new Database(DB_PATH);
const tables = sqlite.query("SELECT name FROM sqlite_master WHERE type='table'").all();
console.log('Tables:', tables);

const workflowsSchema = sqlite.query("PRAGMA table_info(workflows)").all();
console.log('Workflows Schema:', workflowsSchema);

const processingLogsSchema = sqlite.query("PRAGMA table_info(processing_logs)").all();
console.log('Processing Logs Schema:', processingLogsSchema);

sqlite.close();
