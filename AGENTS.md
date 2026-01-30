# ReceiptHero

AI-powered receipt management companion for Paperless-ngx. Automatically extracts, organizes, and converts receipts using Together AI's Llama 4 Maverick vision model.

## Architecture

Turborepo monorepo with separate frontend, API, and worker processes sharing a core business logic layer:

```
receipthero-ng/
├── apps/
│   ├── api/           # Hono REST API (Bun runtime, port 3001)
│   ├── webapp/        # TanStack Start frontend (React 19, port 3002)
│   └── worker/        # Background polling & processing (single file)
├── packages/
│   ├── core/          # Core services & business logic (~31k tokens)
│   └── shared/        # Shared types, schemas, Zod validators
└── _legacy/           # Old Next.js implementation (DO NOT USE)
```

## Intent Layer

**Before modifying code in subdirectories with AGENTS.md, read that file first** to understand local patterns and invariants.

Future child nodes (not yet created):
- **Core Services**: `packages/core/AGENTS.md` - Business logic, external integrations, database
- **Frontend**: `apps/webapp/AGENTS.md` - TanStack Router patterns, UI components, real-time updates

## System Flow

```
1. Worker polls Paperless-ngx every N seconds for documents tagged "receipt"
2. Downloads document thumbnail (PDF first page → image)
3. Calls Together AI vision model to extract structured receipt data
4. (Optional) Converts currency using fawazahmed0 exchange API
5. Updates Paperless document with:
   - New title: "{Vendor} - {Amount} {Currency}"
   - Correspondent (vendor)
   - Custom fields (full receipt JSON)
   - Tags ("ai-processed")
6. Logs results to SQLite for dashboard display
```

## Runtime Architecture

### Three Separate Processes

**API Server** (`apps/api`)
- Hono-based REST API serving `/api/*` endpoints
- WebSocket server for live log streaming (`/api/ws`)
- Stateless - reads/writes SQLite and config.json
- Does NOT process receipts (that's the worker's job)

**Worker** (`apps/worker`)
- Single background process with infinite loop
- Polls `worker_state` table to check if paused or manually triggered
- Calls `runAutomation()` from core to scan Paperless and process receipts
- Acquires lock before running to prevent duplicate scans
- Graceful shutdown handling (SIGTERM/SIGINT)

**Webapp** (`apps/webapp`)
- TanStack Start SPA (Vite + React 19)
- Real-time dashboard consuming API endpoints
- WebSocket connection for live log streaming
- Fully client-side (no SSR in production)

### Communication Patterns

- **API ↔ Core**: Direct function calls (same process)
- **Worker ↔ Core**: Direct function calls (same process)
- **API ↔ Worker**: Shared SQLite database (`worker_state` table for control)
- **Webapp ↔ API**: REST + WebSocket
- **All ↔ Paperless**: HTTP via `PaperlessClient` in core
- **All ↔ Together AI**: HTTP via `Together` SDK in core

## Key Technologies

| Layer | Stack |
|-------|-------|
| Runtime | Bun (API + Worker), Vite (Webapp) |
| Frontend | React 19, TanStack Router/Query, Base UI, Tailwind CSS 4 |
| Backend | Hono, Zod validation, Drizzle ORM |
| Database | SQLite (better-sqlite3) |
| AI/ML | Together AI (Llama 4 Maverick vision model) |
| External APIs | Paperless-ngx (document management), fawazahmed0 (currency rates) |

## Database Schema

Single SQLite database (`receipthero.db`) with 5 tables:

1. **`retry_queue`**: Failed documents awaiting retry (exponential backoff)
2. **`processing_logs`**: Full audit trail of all document processing attempts
3. **`logs`**: Application logs (worker, api, core) for debugging
4. **`worker_state`**: Single-row table for pause/resume/trigger control
5. **`skipped_documents`**: Documents permanently skipped (e.g., no receipt data)

See `packages/core/src/db/schema.ts` for full DDL.

## Configuration

**Two configuration sources:**

1. **Environment variables** (`.env`)
   - `DATABASE_PATH`: SQLite file location (default: `./receipthero.db`)
   - `CONFIG_PATH`: JSON config location (default: `./config.json`)
   - `PORT`: API server port (default: 3001)
   - Optional: `PAPERLESS_HOST`, `PAPERLESS_API_KEY`, `TOGETHER_API_KEY` (can be set via UI)

2. **`config.json`** (runtime configuration, editable via webapp)
   - Paperless-ngx connection details
   - Together AI API key
   - Processing settings (scan interval, tag names, currency conversion)
   - Use document type detection instead of tag-based filtering

**Priority**: `config.json` values override env vars (except paths/port).

Load config via `loadConfig()` from `@sm-rn/core` - never read files directly.

## Core Services Overview

All services in `packages/core/src/services/`:

| Service | Responsibility |
|---------|----------------|
| `paperless.ts` | Paperless-ngx API client (fetch documents, update metadata, manage tags/correspondents) |
| `ocr.ts` | Together AI vision model wrapper (extract receipt data from images) |
| `together-client.ts` | Together AI SDK singleton with rate limiting (Upstash Redis) |
| `fawazahmed0.ts` | Currency conversion (primary - dual CDN fallback) |
| `ecb.ts` | European Central Bank rates (backup - not currently used) |
| `retry-queue.ts` | Exponential backoff retry logic for failed documents |
| `bridge.ts` | Main automation orchestrator (`runAutomation` entry point) |
| `reporter.ts` | Progress reporting bridge between worker and API |
| `logger.ts` | Structured logging with DB persistence |
| `worker-state.ts` | Pause/resume/trigger control via database |
| `skipped-documents.ts` | Permanently skip documents (don't retry) |
| `config.ts` | Load/save configuration from JSON file |

## Global Invariants

### Never Import Between Apps

- `apps/api`, `apps/webapp`, `apps/worker` are separate deployment units
- They share code ONLY via `packages/*`
- ❌ BAD: `import { foo } from '../../api/src/utils'`
- ✅ GOOD: Move shared code to `packages/core` or `packages/shared`

### All External API Calls Go Through Core Services

- Never call Paperless or Together AI directly from apps
- Always use `PaperlessClient`, `extractReceiptData`, or `Together` client from core
- Rate limiting and retry logic are built into core services

### All Database Operations Use Drizzle

- Never write raw SQL queries
- Import `db` from `@sm-rn/core` and use Drizzle query builder
- Schema is single source of truth: `packages/core/src/db/schema.ts`

### Date Format: ISO 8601 Strings

- All dates stored as ISO 8601 strings (`new Date().toISOString()`)
- Never store Unix timestamps or other formats in SQLite
- Receipt extraction enforces YYYY-MM-DD format for date fields

### Configuration Must Be Testable

- All config-dependent code accepts `config` parameter or uses `loadConfig()`
- Never access `process.env.PAPERLESS_HOST` directly (use config.json)
- Allows test overrides without env manipulation

### Worker State Changes Require Database Transaction

- Pause/resume/trigger operations are serialized via `worker_state` table
- Worker polls this table, never relies on in-memory state
- Multiple worker instances (discouraged) won't conflict due to `isRunning` lock

## Anti-patterns

### Don't Use _legacy/ Directory

- Old Next.js implementation kept for reference only
- Has its own `AGENTS.md` but is not maintained
- All new work goes in `apps/` or `packages/`

### Don't Store Secrets in config.json

- API keys in config.json are acceptable (file is `.gitignore`d)
- But prefer env vars for production deployments
- Docker Compose uses env vars, not config.json

### Don't Skip Validation

- All API inputs validated with Zod schemas from `@sm-rn/shared`
- Worker inputs (Paperless responses) also validated before processing
- Validation failures should be logged and document moved to `skipped_documents`

### Don't Modify Documents Outside Paperless API

- Never write to Paperless uploads directory or database directly
- Always use `PaperlessClient` methods
- Paperless has webhooks, but we poll instead (simpler, more reliable)

### Don't Block the Worker Loop

- Worker runs infinite loop with sleep intervals
- Never add synchronous long-running tasks (use `await` for async)
- Errors should be caught, logged, and loop continues (no crash)

## Development Workflow

### Local Setup

```bash
# Install dependencies (pnpm workspace)
pnpm install

# Generate Drizzle migrations (first time only)
cd packages/core && bun run db:generate

# Create .env with secrets
cp .env.example .env
# Edit .env: add PAPERLESS_HOST, PAPERLESS_API_KEY, TOGETHER_API_KEY

# Start all services (uses Turborepo)
pnpm run dev
# API: http://localhost:3001
# Webapp: http://localhost:3002 (configured to proxy /api to 3001)
```

### Adding a New API Endpoint

1. Add route in `apps/api/src/routes/{domain}.ts`
2. Use Zod validator from `@hono/zod-validator`
3. Import schema from `@sm-rn/shared/schemas` (create if needed)
4. Add corresponding React Query hook in `apps/webapp/src/hooks/`
5. Update API client types if using hono-rpc (not currently used)

### Adding a New Core Service

1. Create `packages/core/src/services/{name}.ts`
2. Export from `packages/core/src/index.ts`
3. Add unit tests in `packages/core/src/__tests__/{name}.test.ts`
4. Update this AGENTS.md with service description

### Modifying Database Schema

```bash
cd packages/core

# 1. Edit src/db/schema.ts
# 2. Generate migration
bun run db:generate

# 3. Migration files created in drizzle/ directory
# 4. Apply migration (runs automatically on worker/api startup)
bun run db:migrate
```

Drizzle migrations are applied on first run - no manual steps in production.

## Docker Deployment

`docker-compose.yml` runs three containers:
- **api**: Runs `@sm-rn/api` (Hono server)
- **worker**: Runs `@sm-rn/worker` (background processor)
- **webapp**: Runs `@sm-rn/webapp` (Vite preview server)

All share `app-data` volume for SQLite database persistence.

Build from root Dockerfile (multi-stage, Bun-based).

## Testing Strategy

| Package | Framework | Coverage |
|---------|-----------|----------|
| `packages/core` | Bun test | Services, currency APIs, config loading |
| `apps/api` | Bun test | Route handlers, validation |
| `apps/webapp` | Vitest + Testing Library | Component rendering, query hooks |
| `apps/worker` | None (integration tests planned) | - |

Run tests: `pnpm run test` (uses Turborepo caching)

## Common Gotchas

### Worker Won't Process Documents

Check in this order:
1. Worker not paused (`SELECT * FROM worker_state WHERE id = 1`)
2. Correct tag configured (`config.json` → `processing.receiptTag`)
3. Paperless API key has read/write permissions
4. Documents actually tagged (not just document type)
5. Check `processing_logs` for errors (`status = 'failed'`)

### Currency Conversion Not Working

- Primary API (fawazahmed0) has dual CDN fallback (jsdelivr + github)
- Check network connectivity to both CDNs
- Fallback to ECB available but not enabled (comment in `packages/core/src/index.ts`)
- Currency codes must be uppercase ISO 4217 (e.g., "USD", not "usd")

### Together AI Rate Limits

- Upstash rate limiting configured in `together-client.ts`
- Default: 10 requests per 10 seconds
- Set `RATE_LIMIT_ENABLED=false` in .env to disable
- Or configure Upstash Redis via `UPSTASH_URL` and `UPSTASH_TOKEN`

### Webapp Not Connecting to API

- Vite dev server proxies `/api` to `http://localhost:3001`
- Check `apps/webapp/vite.config.ts` proxy configuration
- API must start BEFORE webapp (worker has `sleep 3` delay for this)
- WebSocket connection requires HTTP upgrade support (works in dev, check reverse proxy in prod)

## Observability

### Logs

Three log levels (controlled per service):
- **Database logs**: `SELECT * FROM logs ORDER BY timestamp DESC`
- **Processing logs**: `SELECT * FROM processing_logs ORDER BY updatedAt DESC`
- **Real-time logs**: WebSocket stream at `ws://localhost:3001/api/ws`

Logs auto-rotate (configurable max entries) - see `logger.ts`.

### Metrics

No built-in metrics yet. Planned:
- Receipt processing rate (per hour)
- Currency conversion success rate
- Together AI latency percentiles
- Retry queue depth over time

### External Monitoring

Together AI supports Helicone for LLM observability:
- Set `HELICONE_ENABLED=true` in .env
- Add `HELICONE_API_KEY`
- See `together-client.ts` for integration

## Future Child Nodes

When these areas grow beyond 64k tokens or develop complex invariants:

1. **`packages/core/AGENTS.md`** (~31k tokens currently)
   - Service architecture patterns
   - Paperless integration contracts
   - Currency conversion strategy
   - Retry queue mechanics
   - Database migration workflow

2. **`apps/webapp/AGENTS.md`** (~51k tokens currently)
   - TanStack Router file-based routing
   - React Query patterns (optimistic updates, invalidation)
   - WebSocket integration for live logs
   - Component architecture (Base UI + custom components)
   - State management approach (React Query only, no Redux/Zustand)

## References

- **Paperless-ngx API**: `paperless_schema.yml` (OpenAPI spec in root)
- **Together AI Docs**: https://docs.together.ai/
- **TanStack Router**: https://tanstack.com/router
- **Drizzle ORM**: https://orm.drizzle.team/
- **Hono**: https://hono.dev/

## Project Status

Active development. Current focus:
- ✅ Core extraction pipeline (stable)
- ✅ Multi-currency conversion (stable)
- ✅ Real-time dashboard (stable)
- 🚧 Receipt analytics and charts (planned)
- 🚧 Batch reprocessing UI (planned)
- 🚧 Mobile-responsive design (in progress)
