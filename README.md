# ReceiptHero - Turborepo Monorepo

An open source receipt management system with AI-powered OCR, integrated with Paperless-NGX.

## Architecture

This is a Turborepo monorepo with:
- **`@sm-rn/api`**: Hono API backend (Bun runtime)
- **`@sm-rn/webapp`**: TanStack Start frontend
- **`@sm-rn/core`**: Core services (Paperless, OCR, currency conversion, logging)
- **`@sm-rn/shared`**: Shared types and schemas

## Tech Stack

**Backend:**
- Hono (API framework)
- Bun (JavaScript runtime)
- Drizzle ORM + SQLite (database)
- Together AI (LLM-powered OCR)
- Llama 4 Maverick 17B (receipt extraction)

**Frontend:**
- React 19
- TanStack Start / Router
- TypeScript

**Infrastructure:**
- Turborepo (monorepo orchestration)
- pnpm workspaces
- Docker + Docker Compose

## Features

### AI-Powered Receipt Extraction
- Automatic OCR using Together AI's Llama model
- Extracts vendor, amount, currency, date, items, and payment method
- Updates Paperless-NGX with structured metadata

### Currency Conversion
- Automatic conversion to configured target currencies
- Uses fawazahmed0 exchange-api with dual CDN fallback
- Weekly average exchange rates for accuracy
- Source currency always included in conversions

### Dashboard
- Real-time system health monitoring
- **Currency Totals Card**: Aggregated totals in all configured currencies
- Integration statistics (detected, processed, failed, skipped, in queue)
- Worker control (pause/resume, retry all, clear queue)
- Live processing logs via WebSocket

## Quick Start

### Development

```bash
# Install dependencies
pnpm install

# Start all services (API + Worker + Webapp)
pnpm run dev

# API: http://localhost:3001
# Webapp: http://localhost:3000
```

### Production (Docker)

```bash
# Build and start
docker compose up -d

# Webapp accessible at http://localhost:3000
# API runs internally on port 3001
```

## Configuration

Configuration can be provided via:
1. File: `/app/data/config.json` (highest priority)
2. Environment variables (fallback)
3. Schema defaults (fallback)

### Environment Variables

```bash
# Required
PAPERLESS_HOST=http://paperless:8000
PAPERLESS_API_KEY=your-paperless-api-key
TOGETHER_API_KEY=your-together-ai-api-key

# Optional
SCAN_INTERVAL=300000  # 5 minutes
RECEIPT_TAG=receipt
PROCESSED_TAG=ai-processed
FAILED_TAG=ai-failed
MAX_RETRIES=3

# Optional: Rate Limiting
RATE_LIMIT_ENABLED=false
UPSTASH_URL=https://your-upstash-redis.upstash.io
UPSTASH_TOKEN=your-upstash-token

# Optional: Observability
HELICONE_ENABLED=false
HELICONE_API_KEY=your-helicone-api-key
```

### Currency Conversion

Enable currency conversion in `config.json` or via the webapp settings:

```json
{
  "processing": {
    "currencyConversion": {
      "enabled": true,
      "targetCurrencies": ["GBP", "USD", "SAR"]
    }
  }
}
```

When enabled, receipts will include converted amounts:

```json
{
  "amount": 10,
  "currency": "AED",
  "conversions": {
    "AED": 10.00,
    "GBP": 2.15,
    "USD": 2.72,
    "SAR": 10.22
  }
}
```

## API Endpoints

### Health & Configuration
- `GET /api/health` - Health check with stats
- `GET /api/config` - Get configuration (masked keys)
- `POST /api/config` - Save configuration
- `GET /api/config/currencies` - Get available currencies
- `POST /api/config/test-paperless` - Test Paperless connection
- `POST /api/config/test-together` - Test Together AI key

### Processing
- `POST /api/ocr` - Extract receipt data from image
- `GET /api/processing/logs` - Get processing logs
- `GET /api/processing/logs/:documentId` - Get document-specific logs

### Worker Control
- `GET /api/worker/status` - Get worker status
- `POST /api/worker/pause` - Pause worker
- `POST /api/worker/resume` - Resume worker
- `POST /api/worker/trigger-scan` - Trigger immediate scan

### Queue Management
- `GET /api/queue/status` - Get queue status
- `POST /api/queue/retry-all` - Retry all failed items
- `POST /api/queue/clear` - Clear the queue

### Statistics
- `GET /api/stats/currency-totals` - Get aggregated currency totals

## How It Works

1. Worker polls Paperless-NGX for documents tagged with `receipt`
2. Downloads document (prefers thumbnail for OCR)
3. Sends to Together AI's Llama model for structured extraction
4. **Currency Conversion** (if enabled): Converts to target currencies using weekly average rates
5. Updates Paperless document with:
   - Title: `{vendor} - {amount} {currency}`
   - Created date from receipt
   - Correspondent (vendor)
   - Tags: `ai-processed`, category tag
   - Custom field with full receipt JSON (including conversions)
6. Failed documents retry with exponential backoff: 1min, 5min, 15min
7. After max retries, documents are tagged as `ai-failed`

## Development Commands

```bash
# Run tests
pnpm run test

# Type check
pnpm turbo run typecheck

# Database migrations
cd packages/core && pnpm run db:generate && pnpm run db:migrate

# Build for production
pnpm run build
```

## Project Structure

```
receipthero-ng/
├── apps/
│   ├── api/              # Hono API server
│   │   ├── src/
│   │   │   ├── routes/   # API endpoints
│   │   │   └── index.ts  # API server
│   │   └── Dockerfile
│   ├── webapp/           # TanStack Start frontend
│   │   ├── src/
│   │   │   ├── routes/   # File-based routing
│   │   │   ├── components/
│   │   │   └── lib/      # Queries, server functions
│   │   └── Dockerfile
│   └── worker/           # Background worker
├── packages/
│   ├── core/             # Core services
│   │   └── src/
│   │       ├── services/
│   │       │   ├── bridge.ts       # Receipt processing pipeline
│   │       │   ├── fawazahmed0.ts  # Currency conversion API
│   │       │   ├── ecb.ts          # ECB API (backup)
│   │       │   ├── ocr.ts          # Together AI integration
│   │       │   └── paperless.ts    # Paperless-NGX client
│   │       └── db/                 # Drizzle schema
│   └── shared/           # Shared types & schemas
├── docker-compose.yml
├── turbo.json
└── package.json
```

## License

MIT
