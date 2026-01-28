# ReceiptHero Paperless-NGX Integration - Implementation Plan V2

This plan transforms ReceiptHero from a standalone receipt processing app into a robust, self-hosted AI enrichment service for Paperless-NGX.

---

## 1. Core Strategy

### What We KEEP from ReceiptHero
- Together AI client with Llama-4-Maverick OCR model (`lib/ocr.ts`)
- `ProcessedReceipt` Zod schema and validation
- Receipt categorization logic (groceries, dining, gas, etc.)
- Currency detection and date normalization

### What We ADOPT from Paperless-AI (Architecture Only)
- Polling-based document discovery (`/api/documents/`)
- Tag-based workflow state management (`receipt`, `ai-processed`, `ai-failed`)
- Correspondent/Tag creation on-the-fly
- Health check endpoint for Docker
- Configuration file with volume persistence

### What We DO NOT Adopt
- Paperless-AI's AI implementation (OpenAI/Ollama/Custom)
- RAG-based document chat (future enhancement)

---

## 2. Configuration System

### Dual Configuration Approach
Priority: **Config file > Environment variables**

```
/app/data/config.json  (Docker volume: /app/data)
```

### Config Schema
```typescript
interface Config {
  paperless: {
    host: string;           // PAPERLESS_HOST
    apiKey: string;         // PAPERLESS_API_KEY
  };
  togetherAi: {
    apiKey: string;         // TOGETHER_API_KEY
  };
  processing: {
    scanInterval: number;   // SCAN_INTERVAL (ms, default: 300000)
    receiptTag: string;     // RECEIPT_TAG (default: "receipt")
    processedTag: string;   // PROCESSED_TAG (default: "ai-processed")
    failedTag: string;      // FAILED_TAG (default: "ai-failed")
    maxRetries: number;     // MAX_RETRIES (default: 3)
  };
}
```

### Config Loading Priority
1. Load from `/app/data/config.json` if exists
2. Fall back to environment variables for missing values
3. Validate with Zod on startup (fail-fast)

---

## 3. Document Processing Workflow

### Overview
```
[Paperless-NGX]                    [ReceiptHero Worker]
     │                                     │
     │  Poll /api/documents/?tags=receipt  │
     │  ◄──────────────────────────────────│
     │                                     │
     │  Return docs with 'receipt' tag     │
     │  (excluding 'ai-processed')         │
     │─────────────────────────────────────►│
     │                                     │
     │                          ┌──────────┴──────────┐
     │                          │ For each document:  │
     │                          │ 1. Download file    │
     │                          │ 2. Convert to image │
     │                          │ 3. Extract via AI   │
     │                          │ 4. Update metadata  │
     │                          └──────────┬──────────┘
     │                                     │
     │  PATCH /api/documents/{id}/         │
     │  ◄──────────────────────────────────│
     │  (title, date, correspondent, tags) │
```

### Tag-Based State Machine
```
                ┌─────────────┐
                │   receipt   │  (User adds this tag)
                └──────┬──────┘
                       │
              Worker picks up
                       │
                       ▼
         ┌─────────────────────────┐
         │     Processing...       │
         └────────────┬────────────┘
                      │
           ┌──────────┴──────────┐
           │                     │
      Success               Failure (3x)
           │                     │
           ▼                     ▼
   ┌───────────────┐    ┌───────────────┐
   │ ai-processed  │    │   ai-failed   │
   └───────────────┘    └───────────────┘
```

---

## 4. Technical Improvements

### 4.1 Remove Upstash Dependency
The `/api/ocr` route currently requires Upstash Redis. For self-hosted:
- Make rate limiting optional (only enable if Upstash vars present)
- Or use in-memory rate limiting for basic protection

**References:**
- `app/api/ocr/route.ts:5-17` - Current Upstash Redis initialization

### 4.2 Pagination Support
Paperless-NGX paginates results (default 25 per page). Must fetch ALL:
```typescript
async function getAllDocuments(query: string): Promise<Document[]> {
  let allDocs: Document[] = [];
  let nextUrl = `/api/documents/${query}`;
  
  while (nextUrl) {
    const res = await this.fetchApi(nextUrl);
    const data = await res.json();
    allDocs = allDocs.concat(data.results);
    nextUrl = data.next ? new URL(data.next).pathname + new URL(data.next).search : null;
  }
  
  return allDocs;
}
```

**References:**
- `lib/paperless.ts:70-81` - Current getUnprocessedDocuments (no pagination)

### 4.3 PDF Support
Paperless-NGX stores documents as PDFs. We need to:
1. Download the document's thumbnail/preview (always an image)
2. Use `/api/documents/{id}/thumb/` endpoint for image extraction
3. Fall back to original file if thumbnail unavailable

**References:**
- `lib/bridge.ts:13-15` - Current file download (assumes image)

### 4.4 Retry Logic with Exponential Backoff
```typescript
interface RetryState {
  documentId: number;
  attempts: number;
  lastError: string;
  nextRetryAt: Date;
}

// Store in /app/data/retry-queue.json
```

- Retry up to 3 times with exponential backoff (1min, 5min, 15min)
- After 3 failures, add `ai-failed` tag and stop retrying
- Removing `ai-failed` tag resets retry count

**References:**
- `lib/bridge.ts:67-72` - Current error handling (just logs and continues)

### 4.5 Health Endpoint
```typescript
// GET /api/health
{
  "status": "healthy",
  "worker": "running",
  "lastScan": "2024-01-15T10:30:00Z",
  "documentsProcessed": 42,
  "paperlessConnection": "ok",
  "togetherAiConnection": "ok"
}
```

### 4.6 Graceful Shutdown
```typescript
let isShuttingDown = false;

process.on('SIGTERM', async () => {
  console.log('SIGTERM received. Finishing current document...');
  isShuttingDown = true;
  // Wait for current processing to complete
  await currentProcessingPromise;
  process.exit(0);
});
```

**References:**
- `scripts/worker.ts:8-17` - Current infinite loop (no shutdown handling)

---

## 5. Web UI for Configuration

### Setup Page (`/setup`)
Required when `config.json` doesn't exist:
- Paperless-NGX host URL
- Paperless-NGX API token (with "Test Connection" button)
- Together AI API key (with "Test Connection" button)
- Tag names configuration
- Scan interval

### Dashboard Page (`/`)
- Current worker status
- Documents processed today
- Recent processing history
- Quick actions (trigger scan, view failed docs)

---

## 6. Docker Configuration

### Dockerfile Improvements
```dockerfile
# Build stage compiles worker into standalone bundle
FROM node:20-slim AS base
RUN corepack enable

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build
# Bundle worker with esbuild for production
RUN pnpm exec esbuild scripts/worker.ts --bundle --platform=node --outfile=dist/worker.js

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder /app/dist/worker.js ./worker.js
COPY --from=builder /app/start-services.sh ./start-services.sh
RUN chmod +x start-services.sh

# Persistent data volume
VOLUME ["/app/data"]

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

CMD ["./start-services.sh"]
```

**References:**
- `Dockerfile` - Current implementation (has issues with runtime install)

### docker-compose.yml Example
```yaml
services:
  receipthero:
    image: receipthero:latest
    container_name: receipthero
    restart: unless-stopped
    ports:
      - "3000:3000"
    volumes:
      - receipthero_data:/app/data
    environment:
      - PAPERLESS_HOST=http://paperless:8000
      - PAPERLESS_API_KEY=your-api-token
      - TOGETHER_API_KEY=your-together-key
    depends_on:
      - paperless

volumes:
  receipthero_data:
```

---

## 7. File Structure (After Implementation)

```
receipthero-ng/
├── app/
│   ├── api/
│   │   ├── health/route.ts        # NEW: Health check endpoint
│   │   ├── ocr/route.ts           # MODIFIED: Optional rate limiting
│   │   ├── config/route.ts        # NEW: Config CRUD
│   │   └── trigger/route.ts       # NEW: Manual scan trigger
│   ├── setup/page.tsx             # NEW: Setup wizard
│   └── page.tsx                   # MODIFIED: Dashboard
├── lib/
│   ├── config.ts                  # NEW: Config loader
│   ├── paperless.ts               # MODIFIED: Pagination, thumbnails
│   ├── ocr.ts                     # EXISTING
│   ├── bridge.ts                  # MODIFIED: Retry logic
│   └── retry-queue.ts             # NEW: Retry state management
├── scripts/
│   └── worker.ts                  # MODIFIED: Graceful shutdown
├── data/                          # Docker volume mount point
│   ├── config.json
│   └── retry-queue.json
├── Dockerfile
├── docker-compose.yml
└── start-services.sh
```

---

## 8. TODOs

### Phase 1: Critical Fixes (No New Features)

- [x] 1. Remove Upstash dependency from OCR route
  
  **What to do**:
  - Make Upstash Redis initialization conditional
  - Only apply rate limiting if `UPSTASH_REDIS_REST_URL` is set
  - Otherwise, skip rate limiting entirely for self-hosted
  
  **Must NOT do**:
  - Remove the rate limiting logic entirely (keep for hosted version)
  
  **References**:
  - `app/api/ocr/route.ts:5-17` - Current Redis/Ratelimit setup
  - `app/api/ocr/route.ts:30-46` - Rate limit check
  
  **Acceptance Criteria**:
  - [ ] OCR route works without Upstash env vars
  - [ ] Rate limiting still works when Upstash vars ARE present
  
  **Commit**: YES
  - Message: `fix(ocr): make upstash rate limiting optional for self-hosted`
  - Files: `app/api/ocr/route.ts`

---

- [x] 2. Add pagination to Paperless document fetching
  
  **What to do**:
  - Modify `getUnprocessedDocuments()` to follow `next` links
  - Collect all pages of results into a single array
  
  **References**:
  - `lib/paperless.ts:70-81` - Current implementation
  
  **Acceptance Criteria**:
  - [ ] Fetches ALL documents, not just first page
  - [ ] Works with Paperless instances with 100+ documents
  
  **Commit**: YES
  - Message: `fix(paperless): add pagination support for document listing`
  - Files: `lib/paperless.ts`

---

- [x] 3. Add PDF thumbnail extraction support
  
  **What to do**:
  - Add `getDocumentThumbnail(id)` method to PaperlessClient
  - Use `/api/documents/{id}/thumb/` endpoint
  - Modify bridge to prefer thumbnail over raw file
  
  **References**:
  - `lib/paperless.ts:88-92` - Current `getDocumentFile()`
  - `lib/bridge.ts:13-15` - Current file download usage
  
  **Acceptance Criteria**:
  - [ ] PDFs are processed via their thumbnail (image)
  - [ ] Falls back to raw file if thumbnail unavailable
  
  **Commit**: YES
  - Message: `feat(paperless): add thumbnail extraction for PDF support`
  - Files: `lib/paperless.ts`, `lib/bridge.ts`

---

- [x] 4. Add document filtering by 'receipt' tag
  
  **What to do**:
  - Modify query to require BOTH conditions:
    - Has `receipt` tag
    - Does NOT have `ai-processed` tag
  - Make tag names configurable via config/env
  
  **References**:
  - `lib/paperless.ts:70-81` - Current query logic
  
  **Acceptance Criteria**:
  - [ ] Only processes documents with 'receipt' tag
  - [ ] Ignores documents already having 'ai-processed' tag
  
  **Commit**: YES
  - Message: `feat(paperless): filter documents by receipt tag`
  - Files: `lib/paperless.ts`, `lib/bridge.ts`

---

### Phase 2: Reliability

- [x] 5. Create config loader with env var fallback
  
  **What to do**:
  - Create `lib/config.ts` with Zod schema
  - Load from `/app/data/config.json` if exists
  - Fall back to environment variables
  - Validate on startup, fail-fast on invalid config
  
  **Acceptance Criteria**:
  - [ ] Config file takes priority over env vars
  - [ ] Worker fails immediately if required config missing
  - [ ] Config schema is validated with Zod
  
  **Commit**: YES
  - Message: `feat(config): add dual config system with file and env vars`
  - Files: `lib/config.ts`

---

- [x] 6. Implement retry queue with exponential backoff
  
  **What to do**:
  - Create `lib/retry-queue.ts`
  - Store retry state in `/app/data/retry-queue.json`
  - Implement exponential backoff (1min, 5min, 15min)
  - Tag as `ai-failed` after 3 attempts
  
  **References**:
  - `lib/bridge.ts:67-72` - Current error handling
  
  **Acceptance Criteria**:
  - [x] Failed documents are retried up to 3 times
  - [x] Backoff increases between retries
  - [x] `ai-failed` tag added after final failure
  - [x] Retry state persists across restarts
  
  **Commit**: YES
  - Message: `feat(retry): add exponential backoff retry queue`
  - Files: `lib/retry-queue.ts`, `lib/bridge.ts`

---

- [x] 7. Add graceful shutdown handler
  
  **What to do**:
  - Handle SIGTERM/SIGINT signals
  - Complete current document processing before exit
  - Save retry queue state on shutdown
  
  **References**:
  - `scripts/worker.ts:8-17` - Current infinite loop
  
  **Acceptance Criteria**:
  - [x] Worker completes current document on SIGTERM
  - [x] No data loss on container restart
  
  **Commit**: YES
  - Message: `feat(worker): add graceful shutdown handling`
  - Files: `scripts/worker.ts`

---

- [x] 8. Add /api/health endpoint
  
  **What to do**:
  - Create `app/api/health/route.ts`
  - Return worker status, last scan time, connection status
  - Test Paperless and Together AI connections
  
  **Acceptance Criteria**:
  - [x] Returns JSON with health status
  - [x] Docker HEALTHCHECK can use this endpoint
  - [x] Shows meaningful error if services unreachable
  
  **Commit**: YES
  - Message: `feat(api): add health check endpoint`
  - Files: `app/api/health/route.ts`

---

### Phase 3: Web UI

- [x] 9. Create /setup page for initial configuration
  
  **What to do**:
  - Create `app/setup/page.tsx`
  - Form for Paperless host, API key, Together AI key
  - "Test Connection" buttons
  - Save to `config.json`
  
  **Acceptance Criteria**:
  - [x] Setup page accessible at /setup
  - [x] Can test connections before saving
  - [x] Saves to /app/data/config.json
  
  **Commit**: YES
  - Message: `feat(ui): add setup wizard page`
  - Files: `app/setup/page.tsx`, `app/api/config/route.ts`

---

- [x] 10. Create dashboard with processing status
  
  **What to do**:
  - Modify `app/page.tsx` to show:
    - Worker status (running/stopped)
    - Documents processed count
    - Recent processing history
    - Failed documents list
  
  **Acceptance Criteria**:
  - [x] Dashboard shows live worker status
  - [x] Can see recent processing history
  - [x] Can see failed documents
  
  **Commit**: YES
  - Message: `feat(ui): add dashboard with processing status`
  - Files: `app/page.tsx`

---

### Phase 4: Polish

- [x] 11. Fix Dockerfile (bundle worker at build time)
  
  **What to do**:
  - Use esbuild to bundle worker.ts
  - Remove runtime `pnpm install`
  - Fix start-services.sh to use bundled worker
  
  **References**:
  - `Dockerfile` - Current implementation
  - `start-services.sh` - Current startup script
  
  **Acceptance Criteria**:
  - [x] No `pnpm install` at runtime
  - [x] Worker runs from bundled JS file
  - [x] Image size reduced
  
  **Commit**: YES
  - Message: `fix(docker): bundle worker at build time`
  - Files: `Dockerfile`, `start-services.sh`, `package.json`

---

- [x] 12. Add docker-compose.yml example
  
  **What to do**:
  - Create example docker-compose.yml
  - Include volume mount for /app/data
  - Document environment variables
  
  **Acceptance Criteria**:
  - [x] docker-compose.yml in repo root
  - [x] Works alongside Paperless-NGX compose
  
  **Commit**: YES
  - Message: `docs: add docker-compose.yml example`
  - Files: `docker-compose.yml`

---

## 9. Environment Variables Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PAPERLESS_HOST` | Yes | - | Paperless-NGX URL |
| `PAPERLESS_API_KEY` | Yes | - | Paperless-NGX API Token |
| `TOGETHER_API_KEY` | Yes | - | Together AI API Key |
| `SCAN_INTERVAL` | No | 300000 | Poll interval in ms (5 min) |
| `RECEIPT_TAG` | No | receipt | Tag that marks docs for processing |
| `PROCESSED_TAG` | No | ai-processed | Tag added after success |
| `FAILED_TAG` | No | ai-failed | Tag added after 3 failures |
| `MAX_RETRIES` | No | 3 | Retry attempts before failure |

---

## 10. Success Criteria

- [ ] Worker processes all `receipt`-tagged documents without `ai-processed` tag
- [ ] PDFs are handled correctly (via thumbnail extraction)
- [ ] Failed documents are retried 3 times, then tagged `ai-failed`
- [ ] Health endpoint returns proper status for Docker healthchecks
- [ ] Configuration can be done via web UI or env vars
- [ ] Docker container runs without external dependencies (no Upstash)
- [ ] Graceful shutdown completes current document before exiting
