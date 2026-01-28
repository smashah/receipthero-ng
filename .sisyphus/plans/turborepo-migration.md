# Turborepo Migration: Next.js to Hono + TanStack Start

## Context

### Original Request
Complete replacement of Next.js with a Turborepo monorepo architecture:
- `apps/api`: Hono API with Bun runtime
- `apps/webapp`: TanStack Start with React 19
- `packages/shared`: Shared types, schemas, utilities

### Interview Summary
**Key Discussions**:
- **Package Manager**: Bun (user preference, faster than pnpm)
- **API Communication**: Webapp calls API via TanStack Start server functions wrapping Hono RPC client
- **Rate Limiting**: Configurable via config, default OFF, Upstash-only (no fallback)
- **Config Storage**: Dual approach - env vars (SCREAMING_SNAKE_CASE) + file (camelCase), file overrides env
- **Helicone**: Configurable observability, default OFF
- **Retry Queue**: SQLite via Drizzle ORM + bun:sqlite, fresh start (no JSON migration)
- **Testing**: TDD with bun:test for new code only
- **Migration Strategy**: Clean slate with `_legacy/` backup folder

**Research Findings**:
- Turborepo 2.6+ has stable Bun support with granular lockfile analysis
- TanStack Start uses Vite + Nitro, outputs to `.output/server/index.mjs`
- Hono RPC exports `AppType` for end-to-end type safety via `hc<AppType>()`
- TanStack Start server functions use `createServerFn()` from `@tanstack/react-start`
- Drizzle ORM works with `bun:sqlite` via `drizzle-orm/bun-sqlite` adapter

### Metis Review
**Identified Gaps** (addressed):
- shadcn "lyra" preset: Confirmed as valid custom preset URL from shadcn website
- Worker process strategy: Turborepo manages both API + webapp via `turbo run dev/start`
- Retry queue migration: Fresh start, no JSON→SQLite migration needed
- Rate limiting scope: Upstash-only, skip if credentials missing
- Config migration: Seamless, existing config.json must work without modification

---

## Work Objectives

### Core Objective
Replace the Next.js application with a Turborepo monorepo containing a Hono API backend and TanStack Start frontend, preserving all existing functionality while improving type safety and development experience.

### Concrete Deliverables
- Turborepo monorepo with Bun workspaces
- `@sm-rn/shared` package with types, schemas, utilities
- `@sm-rn/api` package (Hono + Bun, background worker, SQLite via Drizzle)
- `@sm-rn/webapp` package (TanStack Start + shadcn lyra preset)
- Docker configuration for production deployment
- Test suite for new API code

### Definition of Done
- [ ] `bun install` succeeds at monorepo root
- [ ] `bun run dev` starts both API (3001) and webapp (3000)
- [ ] `bun run test` passes all API tests
- [ ] Setup wizard can configure Paperless + Together AI connections
- [ ] Dashboard shows health status correctly
- [ ] Worker processes documents from Paperless-NGX
- [ ] Docker build succeeds and container runs
- [ ] Existing `/app/data/config.json` works without modification

### Must Have
- All 5 current API endpoints functional (health, config, test-paperless, test-together, ocr)
- Setup wizard with same functionality as current
- Dashboard with health status display
- Background worker polling Paperless-NGX
- Retry queue with exponential backoff (1min, 5min, 15min)
- Config priority: file > env vars > defaults
- Masked API key handling in config responses
- Graceful worker shutdown (finish current doc on SIGTERM)

### Must NOT Have (Guardrails)
- No changes to OCR prompt engineering or categorization logic
- No changes to retry queue backoff algorithm (keep [60000, 300000, 900000] ms)
- No new features beyond current 5 API routes + 2 pages
- No multi-backend rate limiting (Upstash-only or disabled)
- No retroactive tests for migrated business logic
- No changes to Paperless-NGX API interaction patterns
- No refactoring of business logic "for better architecture"
- No UI/UX changes beyond framework requirements

---

## Verification Strategy (MANDATORY)

### Test Decision
- **Infrastructure exists**: NO (creating new)
- **User wants tests**: TDD for new code only
- **Framework**: bun:test (native Bun testing)

### Test Setup Task
Task 0 includes setting up bun:test infrastructure.

### Manual Verification Procedures
Each TODO includes specific verification steps. Final verification before deleting `_legacy/`:
1. All `bun test` passes
2. Manual smoke test:
   - Setup wizard completes successfully
   - Dashboard shows health status
   - Worker processes at least one document from Paperless-NGX

---

## Task Flow

```
Phase 0: Preparation
  └─> Task 0: Create _legacy/ and initialize Turborepo

Phase 1: Foundation (Sequential)
  Task 1: packages/shared
    └─> Task 2: apps/api structure
      └─> Task 3: Drizzle + SQLite setup
        └─> Task 4: Config loader
          └─> Task 5: PaperlessClient
            └─> Task 6: OCR service
              └─> Task 7: Bridge + RetryQueue
                └─> Task 8: Hono routes
                  └─> Task 9: Worker integration
                    └─> Task 10: API tests

Phase 2: Frontend (After API complete)
  Task 11: TanStack Start + shadcn setup
    └─> Task 12: API client + server functions
      └─> Task 13: Dashboard page
        └─> Task 14: Setup wizard page

Phase 3: Infrastructure (After frontend)
  Task 15: Docker configuration
    └─> Task 16: Final verification + cleanup
```

## Parallelization

| Group | Tasks | Reason |
|-------|-------|--------|
| A | 13, 14 | Dashboard and Setup pages can be developed in parallel after API client |

| Task | Depends On | Reason |
|------|------------|--------|
| 2 | 1 | API needs shared types |
| 3 | 2 | Drizzle setup needs API structure |
| 4-10 | Previous | Sequential API development |
| 11 | 10 | Frontend needs API complete |
| 15 | 14 | Docker needs both apps |
| 16 | 15 | Verification after Docker |

---

## TODOs

### Phase 0: Preparation

- [x] 0. Initialize Turborepo and Archive Legacy Code

  **What to do**:
  - Move all existing files to `_legacy/` folder (except `.git`, `node_modules`, `.sisyphus`)
  - Initialize Turborepo with Bun: `bunx create-turbo@latest . --skip-install`
  - Configure root `package.json` with workspaces: `["apps/*", "packages/*"]`
  - Set `packageManager: "bun@1.2.0"` in root package.json
  - Create `turbo.json` with task configuration
  - Run `bun install` to verify structure

  **Must NOT do**:
  - Delete any files permanently (only move to `_legacy/`)
  - Modify `.git` directory
  - Change `.sisyphus/` directory

  **Parallelizable**: NO (foundation task)

  **References**:
  - `_legacy/package.json` - Current dependencies to migrate
  - `_legacy/tsconfig.json` - TypeScript configuration reference
  - Turborepo docs: https://turborepo.dev/docs/getting-started

  **Acceptance Criteria**:
  - [ ] `_legacy/` folder contains all original source files
  - [ ] Root `package.json` has `workspaces: ["apps/*", "packages/*"]`
  - [ ] `turbo.json` exists with dev/build/test tasks
  - [ ] `bun install` completes without errors
  - [ ] Directory structure:
    ```
    receipthero-ng/
    ├── _legacy/           # All old files
    ├── apps/              # Empty, ready for apps
    ├── packages/          # Empty, ready for packages
    ├── package.json       # Turborepo root
    ├── turbo.json         # Task configuration
    └── bun.lock           # Generated
    ```

  **Commit**: YES
  - Message: `chore: initialize turborepo with bun, archive legacy code`
  - Files: `_legacy/`, `package.json`, `turbo.json`, `bun.lock`

---

### Phase 1: Foundation - Shared Package

- [x] 1. Create @sm-rn/shared Package

  **What to do**:
  - Create `packages/shared/` directory structure
  - Create `package.json` with name `@sm-rn/shared`, exports map
  - Migrate types from `_legacy/lib/types.ts` (ProcessedReceiptSchema, etc.)
  - Migrate config schema from `_legacy/lib/config.ts` (ConfigSchema)
  - Add new config fields: `rateLimit.enabled`, `observability.heliconeEnabled`
  - Create barrel exports in `src/index.ts`
  - Create `tsconfig.json` extending base config

  **Must NOT do**:
  - Change existing Zod schema definitions (preserve exactly)
  - Add build step (use JIT TypeScript exports)

  **Parallelizable**: NO (foundation for all other packages)

  **References**:
  - `_legacy/lib/types.ts` - ProcessedReceiptSchema, StoredReceipt, FileStatus, UploadedFile
  - `_legacy/lib/config.ts:8-23` - ConfigSchema definition
  - Turborepo shared packages: https://turborepo.dev/docs/guides/tools/typescript

  **Acceptance Criteria**:
  - [ ] `packages/shared/package.json` exists with:
    ```json
    {
      "name": "@sm-rn/shared",
      "exports": {
        "./types": "./src/types.ts",
        "./schemas": "./src/schemas.ts"
      }
    }
    ```
  - [ ] `packages/shared/src/types.ts` contains ProcessedReceiptSchema (unchanged from legacy)
  - [ ] `packages/shared/src/schemas.ts` contains ConfigSchema with new fields
  - [ ] `bun run --filter @sm-rn/shared typecheck` passes (if typecheck script added)

  **Commit**: YES
  - Message: `feat(shared): add @sm-rn/shared package with types and schemas`
  - Files: `packages/shared/`

---

### Phase 1: Foundation - API Package

- [x] 2. Create @sm-rn/api Package Structure

  **What to do**:
  - Create `apps/api/` directory structure
  - Create `package.json` with name `@sm-rn/api`
  - Add dependencies: `hono`, `@hono/zod-validator`, `drizzle-orm`, `together-ai`, `zod`
  - Add dev dependencies: `@types/bun`, `drizzle-kit`
  - Add `@sm-rn/shared` as workspace dependency
  - Create basic `src/index.ts` with Hono app skeleton
  - Create `tsconfig.json`
  - Add scripts: `dev`, `start`, `test`, `db:generate`, `db:migrate`

  **Must NOT do**:
  - Implement routes yet (just skeleton)
  - Set up database yet (separate task)

  **Parallelizable**: NO (depends on Task 1)

  **References**:
  - `_legacy/package.json` - Dependencies reference
  - Hono + Bun: https://hono.dev/docs/getting-started/bun

  **Acceptance Criteria**:
  - [ ] `apps/api/package.json` exists with all dependencies
  - [ ] `apps/api/src/index.ts` exports basic Hono app:
    ```typescript
    import { Hono } from 'hono'
    const app = new Hono()
    app.get('/', (c) => c.text('ReceiptHero API'))
    export default app
    export type AppType = typeof app
    ```
  - [ ] `bun run --filter @sm-rn/api dev` starts server on port 3001
  - [ ] `curl http://localhost:3001/` returns "ReceiptHero API"

  **Commit**: YES
  - Message: `feat(api): scaffold @sm-rn/api hono package`
  - Files: `apps/api/`

---

- [ ] 3. Set Up Drizzle ORM with SQLite

  **What to do**:
  - Create `apps/api/src/db/` directory
  - Create `schema.ts` with retry_queue table:
    - `id` (integer, primary key, autoincrement)
    - `documentId` (integer, unique)
    - `attempts` (integer)
    - `lastError` (text)
    - `nextRetryAt` (text, ISO date string)
  - Create `index.ts` with database connection using bun:sqlite
  - Create `drizzle.config.ts` for migrations
  - Create initial migration
  - Add auto-migration on startup

  **Must NOT do**:
  - Add tables beyond retry_queue (keep scope minimal)
  - Change retry queue field types from current implementation

  **Parallelizable**: NO (depends on Task 2)

  **References**:
  - `_legacy/lib/retry-queue.ts:7-12` - RetryState interface definition
  - Drizzle + bun:sqlite: https://orm.drizzle.team/docs/connect-bun-sqlite
  - Drizzle migrations: https://orm.drizzle.team/docs/migrations

  **Acceptance Criteria**:
  - [ ] `apps/api/src/db/schema.ts` defines retry_queue table
  - [ ] `apps/api/drizzle/` contains migration files
  - [ ] `bun run --filter @sm-rn/api db:generate` creates migration
  - [ ] Database file created at `/app/data/receipthero.db` (or configurable path)
  - [ ] Table schema matches:
    ```sql
    CREATE TABLE retry_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      documentId INTEGER UNIQUE NOT NULL,
      attempts INTEGER NOT NULL,
      lastError TEXT NOT NULL,
      nextRetryAt TEXT NOT NULL
    );
    ```

  **Commit**: YES
  - Message: `feat(api): add drizzle orm with sqlite for retry queue`
  - Files: `apps/api/src/db/`, `apps/api/drizzle/`, `apps/api/drizzle.config.ts`

---

- [ ] 4. Implement Config Loader

  **What to do**:
  - Create `apps/api/src/services/config.ts`
  - Implement `loadConfig()` function matching legacy behavior:
    - Read from `/app/data/config.json` (if exists)
    - Fall back to environment variables
    - Apply Zod schema defaults
    - Priority: file > env vars > defaults
  - Implement env var mapping (camelCase → SCREAMING_SNAKE_CASE):
    - `paperless.host` → `PAPERLESS_HOST`
    - `paperless.apiKey` → `PAPERLESS_API_KEY`
    - `togetherAi.apiKey` → `TOGETHER_API_KEY`
    - `processing.scanInterval` → `SCAN_INTERVAL`
    - `rateLimit.enabled` → `RATE_LIMIT_ENABLED`
    - `observability.heliconeEnabled` → `HELICONE_ENABLED`
  - Export CONFIG_PATH constant

  **Must NOT do**:
  - Change config file format (must be seamless migration)
  - Change priority order (file > env > defaults)

  **Parallelizable**: NO (depends on Task 3)

  **References**:
  - `_legacy/lib/config.ts` - Full implementation to migrate
  - `@sm-rn/shared/schemas` - ConfigSchema

  **Acceptance Criteria**:
  - [ ] `loadConfig()` reads from file when present
  - [ ] `loadConfig()` reads from env vars when file missing
  - [ ] Schema defaults apply when neither present
  - [ ] Test with existing `_legacy/` config.json format (if available)
  - [ ] Manual verification:
    ```bash
    # Set env var
    PAPERLESS_HOST=http://test:8000 bun run apps/api/src/test-config.ts
    # Should output config with env var value
    ```

  **Commit**: YES
  - Message: `feat(api): implement config loader with env var fallback`
  - Files: `apps/api/src/services/config.ts`

---

- [ ] 5. Migrate PaperlessClient

  **What to do**:
  - Create `apps/api/src/services/paperless.ts`
  - Copy PaperlessClient class from `_legacy/lib/paperless.ts`
  - Update imports to use `@sm-rn/shared`
  - Keep ALL methods exactly as-is:
    - `fetchApi()` - private API wrapper
    - `getTags()` - list tags
    - `getOrCreateTag()` - find or create tag
    - `getOrCreateCorrespondent()` - find or create correspondent
    - `getUnprocessedDocuments()` - paginated document fetch
    - `getDocument()` - single document
    - `getDocumentFile()` - download file
    - `getDocumentThumbnail()` - download thumbnail
    - `updateDocument()` - update metadata

  **Must NOT do**:
  - Refactor or "improve" the client
  - Change pagination logic in `getUnprocessedDocuments()`
  - Change error handling in `fetchApi()`

  **Parallelizable**: NO (depends on Task 4)

  **References**:
  - `_legacy/lib/paperless.ts` - Full implementation (140 lines, copy exactly)

  **Acceptance Criteria**:
  - [ ] All 9 methods present and unchanged
  - [ ] Pagination while loop in `getUnprocessedDocuments()` preserved exactly
  - [ ] Error handling in `fetchApi()` preserved exactly
  - [ ] TypeScript compiles without errors

  **Commit**: YES
  - Message: `feat(api): migrate paperless client`
  - Files: `apps/api/src/services/paperless.ts`

---

- [ ] 6. Migrate OCR Service

  **What to do**:
  - Create `apps/api/src/services/ocr.ts`
  - Create `apps/api/src/services/together-client.ts` for Together AI client
  - Copy OCR extraction logic from `_legacy/lib/ocr.ts`
  - Implement Helicone integration (configurable):
    - If `observability.heliconeEnabled` and `HELICONE_API_KEY` present, add headers
    - Otherwise, use plain Together AI client
  - Keep OCR prompt EXACTLY as-is (character for character)

  **Must NOT do**:
  - Change the OCR system prompt
  - Change the model name
  - Change the response_format configuration
  - Refactor extraction logic

  **Parallelizable**: NO (depends on Task 5)

  **References**:
  - `_legacy/lib/ocr.ts` - Full implementation (81 lines)
  - `_legacy/lib/client.ts` - Together AI client initialization

  **Acceptance Criteria**:
  - [ ] `extractReceiptData(base64Image)` function works identically
  - [ ] OCR prompt matches `_legacy/lib/ocr.ts:17-48` exactly
  - [ ] Model is `meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8`
  - [ ] Helicone headers added only when configured
  - [ ] TypeScript compiles without errors

  **Commit**: YES
  - Message: `feat(api): migrate ocr service with optional helicone`
  - Files: `apps/api/src/services/ocr.ts`, `apps/api/src/services/together-client.ts`

---

- [ ] 7. Migrate Bridge and RetryQueue

  **What to do**:
  - Create `apps/api/src/services/retry-queue.ts`
  - Implement RetryQueue class using Drizzle + SQLite (not JSON file)
  - Keep exact same interface and behavior:
    - `add(documentId, error)` - add/increment with backoff
    - `remove(documentId)` - remove on success/final failure
    - `getReadyForRetry()` - get documents ready for retry
    - `shouldGiveUp(documentId)` - check max retries
    - `getAttempts(documentId)` - get current attempts
    - `calculateBackoff(attempts)` - MUST use [60000, 300000, 900000] ms
  - Create `apps/api/src/services/bridge.ts`
  - Copy bridge logic from `_legacy/lib/bridge.ts`
  - Update to use new RetryQueue and services

  **Must NOT do**:
  - Change backoff delays: [60000, 300000, 900000] ms
  - Change max retries logic
  - Change `processPaperlessDocument()` flow
  - Change `runAutomation()` orchestration

  **Parallelizable**: NO (depends on Task 6)

  **References**:
  - `_legacy/lib/retry-queue.ts` - Full RetryQueue implementation (212 lines)
  - `_legacy/lib/bridge.ts` - Full bridge implementation (175 lines)

  **Acceptance Criteria**:
  - [ ] RetryQueue uses SQLite via Drizzle (not JSON file)
  - [ ] Backoff delays exactly: `[60000, 300000, 900000]` ms
  - [ ] `processPaperlessDocument()` logic unchanged
  - [ ] `runAutomation()` logic unchanged
  - [ ] Failed documents tagged with `failedTag` after max retries

  **Commit**: YES
  - Message: `feat(api): migrate bridge and retry queue with sqlite storage`
  - Files: `apps/api/src/services/retry-queue.ts`, `apps/api/src/services/bridge.ts`

---

- [ ] 8. Implement Hono API Routes

  **What to do**:
  - Create `apps/api/src/routes/health.ts` - health check endpoint
  - Create `apps/api/src/routes/config.ts` - config GET/POST with masked keys
  - Create `apps/api/src/routes/ocr.ts` - OCR endpoint with optional rate limiting
  - Update `apps/api/src/index.ts` to mount all routes
  - Implement rate limiting:
    - Check `rateLimit.enabled` config
    - If enabled AND Upstash credentials present, apply rate limit
    - If enabled but no credentials, log warning and skip
    - If disabled, skip entirely
  - Export `AppType` for RPC client

  **Must NOT do**:
  - Change API response formats (must match Next.js routes)
  - Implement in-memory rate limiting fallback
  - Change masked key format (`abc...xyz`)

  **Parallelizable**: NO (depends on Task 7)

  **References**:
  - `_legacy/app/api/health/route.ts` - Health check (115 lines)
  - `_legacy/app/api/config/route.ts` - Config CRUD (104 lines)
  - `_legacy/app/api/config/test-paperless/route.ts` - Connection test (48 lines)
  - `_legacy/app/api/config/test-together/route.ts` - Connection test (21 lines)
  - `_legacy/app/api/ocr/route.ts` - OCR endpoint (156 lines)
  - Hono RPC: https://hono.dev/docs/guides/rpc

  **Acceptance Criteria**:
  - [ ] `GET /api/health` returns health status JSON
  - [ ] `GET /api/config` returns config with masked API keys
  - [ ] `POST /api/config` saves config, preserves masked keys
  - [ ] `POST /api/config/test-paperless` tests Paperless connection
  - [ ] `POST /api/config/test-together` validates Together AI key format
  - [ ] `POST /api/ocr` extracts receipt data from base64 image
  - [ ] Rate limiting applies only when enabled + Upstash configured
  - [ ] `AppType` exported for RPC client
  - [ ] Manual verification:
    ```bash
    curl http://localhost:3001/api/health | jq
    # Returns: {"status":"healthy"|"unhealthy", "checks":{...}}
    ```

  **Commit**: YES
  - Message: `feat(api): implement all hono api routes`
  - Files: `apps/api/src/routes/`, `apps/api/src/index.ts`

---

- [ ] 9. Integrate Background Worker

  **What to do**:
  - Create `apps/api/src/worker.ts`
  - Implement worker loop with graceful shutdown:
    - Poll using `runAutomation()` from bridge
    - Sleep for `processing.scanInterval` between runs
    - Handle SIGTERM/SIGINT: finish current run, then exit
  - Update `apps/api/package.json` scripts:
    - `dev`: Start both Hono server AND worker
    - `start`: Start both for production
  - Integrate with Turborepo task configuration

  **Must NOT do**:
  - Change worker polling logic
  - Change graceful shutdown behavior
  - Use external process manager (use Bun's native capabilities)

  **Parallelizable**: NO (depends on Task 8)

  **References**:
  - `_legacy/scripts/worker.ts` - Worker implementation (46 lines)
  - Bun process management patterns

  **Acceptance Criteria**:
  - [ ] Worker starts alongside API server
  - [ ] Worker polls at configured `scanInterval`
  - [ ] SIGTERM completes current automation run before exit
  - [ ] SIGINT completes current automation run before exit
  - [ ] Logs show: "Starting ReceiptHero Paperless-NGX Integration Worker..."
  - [ ] Manual verification:
    ```bash
    bun run --filter @sm-rn/api dev
    # Should see both API and worker output
    # Ctrl+C should show graceful shutdown
    ```

  **Commit**: YES
  - Message: `feat(api): integrate background worker with graceful shutdown`
  - Files: `apps/api/src/worker.ts`, `apps/api/package.json`

---

- [ ] 10. Add API Tests

  **What to do**:
  - Create `apps/api/src/__tests__/` directory
  - Add test file for each route:
    - `health.test.ts` - health endpoint tests
    - `config.test.ts` - config CRUD tests (mock file system)
    - `ocr.test.ts` - OCR endpoint tests (mock Together AI)
  - Configure bun:test in package.json
  - Add test utilities for mocking

  **Must NOT do**:
  - Test migrated business logic (PaperlessClient, Bridge, etc.)
  - Add integration tests with real external services
  - Over-engineer test infrastructure

  **Parallelizable**: NO (depends on Task 9)

  **References**:
  - Bun testing: https://bun.sh/docs/cli/test
  - Hono testing: https://hono.dev/docs/guides/testing

  **Acceptance Criteria**:
  - [ ] `bun run --filter @sm-rn/api test` passes
  - [ ] Health route: tests healthy/unhealthy states
  - [ ] Config route: tests GET (masked keys), POST (saves correctly)
  - [ ] OCR route: tests success response format
  - [ ] At least 1 test per route minimum
  - [ ] Manual verification:
    ```bash
    bun run --filter @sm-rn/api test
    # All tests pass
    ```

  **Commit**: YES
  - Message: `test(api): add bun tests for hono routes`
  - Files: `apps/api/src/__tests__/`

---

### Phase 2: Frontend

- [ ] 11. Create @sm-rn/webapp with TanStack Start

  **What to do**:
  - Create `apps/webapp/` using shadcn preset command:
    ```bash
    cd apps
    pnpm dlx shadcn@latest create --preset "https://ui.shadcn.com/init?base=base&style=lyra&baseColor=neutral&theme=neutral&iconLibrary=hugeicons&font=noto-sans&menuAccent=bold&menuColor=default&radius=default&template=start" --template start webapp
    ```
  - Update `package.json` name to `@sm-rn/webapp`
  - Add `@sm-rn/shared` as workspace dependency
  - Configure Vite for port 3000
  - Update Turborepo to include webapp in dev/build tasks

  **Must NOT do**:
  - Customize shadcn components yet
  - Add pages yet (separate tasks)

  **Parallelizable**: NO (depends on API being complete, Task 10)

  **References**:
  - TanStack Start: https://tanstack.com/start
  - shadcn/ui: https://ui.shadcn.com

  **Acceptance Criteria**:
  - [ ] `apps/webapp/` directory created with TanStack Start
  - [ ] shadcn components installed with lyra preset styling
  - [ ] `bun run --filter @sm-rn/webapp dev` starts on port 3000
  - [ ] Root route (`/`) renders default TanStack Start page
  - [ ] Hugeicons available for use

  **Commit**: YES
  - Message: `feat(webapp): scaffold tanstack start with shadcn lyra preset`
  - Files: `apps/webapp/`

---

- [ ] 12. Set Up API Client and Server Functions

  **What to do**:
  - Create `apps/webapp/src/lib/api-client.ts`:
    - Import `hc` from `hono/client`
    - Import `AppType` from `@sm-rn/api`
    - Create typed client: `hc<AppType>('http://api:3001')` (for Docker)
    - Add environment-based URL (localhost for dev)
  - Create `apps/webapp/src/lib/server-fns.ts`:
    - Create server functions wrapping each API call
    - `getHealth()` - GET /api/health
    - `getConfig()` - GET /api/config
    - `saveConfig(data)` - POST /api/config
    - `testPaperless(data)` - POST /api/config/test-paperless
    - `testTogether(data)` - POST /api/config/test-together
    - `processOcr(data)` - POST /api/ocr
  - Create `apps/webapp/src/hooks/use-api.ts`:
    - TanStack Query hooks using server functions

  **Must NOT do**:
  - Expose API client to browser (only use in server functions)
  - Add caching logic beyond TanStack Query defaults

  **Parallelizable**: NO (depends on Task 11)

  **References**:
  - Hono RPC client: https://hono.dev/docs/guides/rpc
  - TanStack Start server functions: https://tanstack.com/start/latest/docs/framework/react/server-functions
  - `@sm-rn/api/src/index.ts` - AppType export

  **Acceptance Criteria**:
  - [ ] API client created with proper typing
  - [ ] All 6 server functions created and typed
  - [ ] TanStack Query hooks work with server functions
  - [ ] TypeScript compiles without errors
  - [ ] API URL configurable via environment variable

  **Commit**: YES
  - Message: `feat(webapp): add hono rpc client and server functions`
  - Files: `apps/webapp/src/lib/api-client.ts`, `apps/webapp/src/lib/server-fns.ts`, `apps/webapp/src/hooks/use-api.ts`

---

- [ ] 13. Implement Dashboard Page

  **What to do**:
  - Create `apps/webapp/src/routes/index.tsx`
  - Implement dashboard with:
    - Health status display (paperless, together AI, config checks)
    - Configuration overview
    - Link to setup wizard
  - Use shadcn components (Card, Badge, etc.)
  - Use TanStack Query for data fetching via server functions
  - Match functionality of `_legacy/app/page.tsx`

  **Must NOT do**:
  - Add new features not in current dashboard
  - Significantly change UI layout (functional equivalence)

  **Parallelizable**: YES (with Task 14, after Task 12)

  **References**:
  - `_legacy/app/page.tsx` - Current dashboard (339 lines)
  - shadcn Card, Badge, Button components

  **Acceptance Criteria**:
  - [ ] Dashboard shows health status for all checks
  - [ ] Status badges show healthy (green) / unhealthy (red)
  - [ ] Config overview displays (masked API keys)
  - [ ] Link to `/setup` works
  - [ ] Manual verification: Navigate to `/`, see health status

  **Commit**: YES
  - Message: `feat(webapp): implement dashboard page`
  - Files: `apps/webapp/src/routes/index.tsx`

---

- [ ] 14. Implement Setup Wizard Page

  **What to do**:
  - Create `apps/webapp/src/routes/setup.tsx`
  - Implement multi-step wizard:
    - Step 1: Paperless-NGX connection (host, API key, test button)
    - Step 2: Together AI configuration (API key, test button)
    - Step 3: Processing settings (scan interval, tags)
    - Step 4: Summary and save
  - Use shadcn form components
  - Implement connection testing with visual feedback
  - Match functionality of `_legacy/app/setup/page.tsx`

  **Must NOT do**:
  - Add new configuration options not in current wizard
  - Change the step flow significantly

  **Parallelizable**: YES (with Task 13, after Task 12)

  **References**:
  - `_legacy/app/setup/page.tsx` - Current setup wizard (13K+ characters)
  - shadcn Input, Button, Form, Stepper components

  **Acceptance Criteria**:
  - [ ] All 4 steps present and functional
  - [ ] Paperless connection test works with visual feedback
  - [ ] Together AI key validation works
  - [ ] Config saves successfully on final step
  - [ ] Manual verification:
    - Navigate to `/setup`
    - Enter test Paperless URL, test connection
    - Enter Together AI key
    - Save configuration
    - Verify config.json created/updated

  **Commit**: YES
  - Message: `feat(webapp): implement setup wizard page`
  - Files: `apps/webapp/src/routes/setup.tsx`

---

### Phase 3: Infrastructure

- [ ] 15. Docker Configuration

  **What to do**:
  - Create `apps/api/Dockerfile`:
    - Multi-stage build with `oven/bun:1`
    - Use `turbo prune api --docker` pattern
    - Run Drizzle migrations on startup
    - Start with `bun run start`
  - Create `apps/webapp/Dockerfile`:
    - Multi-stage build with `oven/bun:1`
    - Build TanStack Start app
    - Start with `bun run start`
  - Create root `docker-compose.yml`:
    - `api` service on port 3001 (internal only, no ports mapping)
    - `webapp` service on port 3000 (exposed to host)
    - Shared `/app/data` volume
    - Environment variables for configuration
  - Create `.dockerignore` at root

  **Must NOT do**:
  - Expose API port externally
  - Use Node.js images (use Bun)
  - Add unnecessary services

  **Parallelizable**: NO (depends on Tasks 13, 14)

  **References**:
  - `_legacy/Dockerfile` - Current Docker setup
  - Turborepo Docker: https://turborepo.dev/docs/guides/tools/docker
  - Bun Docker: https://hub.docker.com/r/oven/bun

  **Acceptance Criteria**:
  - [ ] `docker compose build` succeeds
  - [ ] `docker compose up` starts both services
  - [ ] Webapp accessible at `http://localhost:3000`
  - [ ] API NOT accessible externally (only internal network)
  - [ ] `/app/data` volume persists config and database
  - [ ] Manual verification:
    ```bash
    docker compose up -d
    curl http://localhost:3000  # Works
    curl http://localhost:3001  # Connection refused (not exposed)
    docker compose down
    ```

  **Commit**: YES
  - Message: `feat: add docker configuration with turbo prune`
  - Files: `apps/api/Dockerfile`, `apps/webapp/Dockerfile`, `docker-compose.yml`, `.dockerignore`

---

- [ ] 16. Final Verification and Cleanup

  **What to do**:
  - Run full test suite: `bun run test`
  - Manual smoke test:
    1. Start dev environment: `bun run dev`
    2. Navigate to `http://localhost:3000`
    3. Complete setup wizard with test credentials
    4. Verify dashboard shows health status
    5. Verify worker logs show polling activity
  - If all tests pass and smoke test succeeds:
    - Update README.md with new instructions
    - Delete `_legacy/` folder
  - If any test fails:
    - Document failure
    - Do NOT delete `_legacy/`

  **Must NOT do**:
  - Delete `_legacy/` if any test fails
  - Delete `_legacy/` without user confirmation

  **Parallelizable**: NO (final task)

  **References**:
  - All previous tasks
  - `_legacy/README.md` - Current documentation

  **Acceptance Criteria**:
  - [ ] `bun run test` passes all tests
  - [ ] Manual smoke test passes all steps
  - [ ] README.md updated with:
    - New installation instructions (`bun install`)
    - New dev command (`bun run dev`)
    - Docker instructions (`docker compose up`)
  - [ ] `_legacy/` folder deleted (after user confirmation)
  - [ ] Git status clean (all changes committed)

  **Commit**: YES (two commits)
  - Message 1: `docs: update readme for turborepo structure`
  - Message 2: `chore: remove legacy code after successful migration`
  - Files: `README.md`, removal of `_legacy/`

---

## Commit Strategy

| After Task | Message | Files | Verification |
|------------|---------|-------|--------------|
| 0 | `chore: initialize turborepo with bun, archive legacy code` | Root + _legacy | `bun install` |
| 1 | `feat(shared): add @sm-rn/shared package with types and schemas` | packages/shared | TypeScript compiles |
| 2 | `feat(api): scaffold @sm-rn/api hono package` | apps/api | API starts |
| 3 | `feat(api): add drizzle orm with sqlite for retry queue` | apps/api/src/db | Migration runs |
| 4 | `feat(api): implement config loader with env var fallback` | apps/api/src/services | Config loads |
| 5 | `feat(api): migrate paperless client` | apps/api/src/services | TypeScript compiles |
| 6 | `feat(api): migrate ocr service with optional helicone` | apps/api/src/services | TypeScript compiles |
| 7 | `feat(api): migrate bridge and retry queue with sqlite storage` | apps/api/src/services | TypeScript compiles |
| 8 | `feat(api): implement all hono api routes` | apps/api/src/routes | Routes respond |
| 9 | `feat(api): integrate background worker with graceful shutdown` | apps/api/src/worker.ts | Worker runs |
| 10 | `test(api): add bun tests for hono routes` | apps/api/src/__tests__ | `bun test` passes |
| 11 | `feat(webapp): scaffold tanstack start with shadcn lyra preset` | apps/webapp | Webapp starts |
| 12 | `feat(webapp): add hono rpc client and server functions` | apps/webapp/src/lib | TypeScript compiles |
| 13 | `feat(webapp): implement dashboard page` | apps/webapp/src/routes | Page renders |
| 14 | `feat(webapp): implement setup wizard page` | apps/webapp/src/routes | Wizard works |
| 15 | `feat: add docker configuration with turbo prune` | Dockerfiles, compose | Docker builds |
| 16a | `docs: update readme for turborepo structure` | README.md | - |
| 16b | `chore: remove legacy code after successful migration` | Remove _legacy | Clean repo |

---

## Success Criteria

### Verification Commands
```bash
# All tests pass
bun run test

# Dev environment starts
bun run dev
# Expected: API on 3001, webapp on 3000, worker polling

# Docker builds and runs
docker compose build && docker compose up -d
# Expected: Webapp accessible at localhost:3000
```

### Final Checklist
- [ ] All "Must Have" features present and functional
- [ ] All "Must NOT Have" guardrails respected
- [ ] All tests pass
- [ ] Docker deployment works
- [ ] Existing config.json works without modification
- [ ] `_legacy/` folder removed
- [ ] README.md updated
