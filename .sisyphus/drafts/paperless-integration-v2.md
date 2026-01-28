# Draft: ReceiptHero → Paperless-NGX Integration (V2 Review)

## Current Implementation Analysis

### What Exists
- `lib/ocr.ts`: Together AI extraction logic (reusable)
- `lib/paperless.ts`: Basic Paperless-NGX API client
- `lib/bridge.ts`: Orchestration logic
- `scripts/worker.ts`: Simple polling worker
- `Dockerfile`: Multi-process container

### Identified Gaps (Critical)

1. **No Pagination Handling**: `getUnprocessedDocuments()` only fetches first page
2. **No PDF Support**: Assumes all files are images; PDFs need thumbnail/preview extraction
3. **No Error Recovery**: Failed documents are logged but never retried
4. **Upstash Dependency in OCR Route**: Self-hosted won't have Upstash Redis
5. **No Config Validation**: Worker doesn't fail-fast on missing env vars
6. **Dockerfile Issues**: Runs `pnpm install` at runtime, `start-services.sh` uses npm

### Identified Gaps (Important)

7. **No Health Endpoint**: No way to verify worker is alive
8. **No Structured Logging**: Just console.log
9. **No Graceful Shutdown**: SIGTERM not handled
10. **No Rate Limiting for AI**: Could overwhelm Together AI
11. **No Custom Fields**: Plan mentions storing amounts but not implemented
12. **No Document Type Filtering**: Processes ALL documents, not just receipts

### User Requirements (Confirmed from Chat)
- **KEEP**: ReceiptHero's Together AI + Llama OCR logic
- **ADOPT**: Paperless-AI's integration architecture (polling, tagging, patching)
- **DO NOT ADOPT**: Paperless-AI's AI implementation (OpenAI/Ollama)

## Decisions Made (User Confirmed)

### Priority Issues to Fix
1. ✅ **Remove Upstash Dependency** - OCR route must work without Redis
2. ✅ **PDF Support** - Extract thumbnail/preview from PDFs for OCR
3. ✅ **Error Retry Logic** - Retry 3 times, then tag as 'ai-failed'
4. ✅ **Health Endpoint** - Add /health for Docker healthchecks
5. ✅ **Pagination** - Fetch ALL documents, not just first page

### Document Filtering
- **Only process docs with 'receipt' tag** - Explicit opt-in workflow

### Error Handling
- **Retry 3 times, then tag as 'ai-failed'** - Automatic retry with eventual failure tagging

### Configuration Method
- **Dual approach**: 
  - Web UI saves to `config.json` (Docker volume mountable)
  - All configs have env var counterparts
  - Config file values OVERRIDE env vars
