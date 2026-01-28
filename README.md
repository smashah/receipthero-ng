# ReceiptHero - Turborepo Monorepo

An open source receipt management system with AI-powered OCR, integrated with Paperless-NGX.

## Architecture

This is a Turborepo monorepo with:
- **`@sm-rn/api`**: Hono API backend (Bun runtime)
- **`@sm-rn/webapp`**: React frontend (Vite)
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
- Vite (build tool)
- TypeScript

**Infrastructure:**
- Turborepo (monorepo orchestration)
- Bun workspaces
- Docker + Docker Compose

## Quick Start

### Development

```bash
# Install dependencies
bun install

# Start all services (API + Worker + Webapp)
bun run dev

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

## API Endpoints

- `GET /api/health` - Health check
- `GET /api/config` - Get configuration (masked keys)
- `POST /api/config` - Save configuration
- `POST /api/config/test-paperless` - Test Paperless connection
- `POST /api/config/test-together` - Test Together AI key
- `POST /api/ocr` - Extract receipt data from image

## How It Works

1. Worker polls Paperless-NGX for documents tagged with `receipt`
2. Downloads document (prefers thumbnail for OCR)
3. Sends to Together AI's Llama model for structured extraction
4. Updates Paperless document with:
   - Title: `{vendor} - {amount} {currency}`
   - Created date from receipt
   - Correspondent (vendor)
   - Tags: `ai-processed`, category tag
5. Failed documents retry with exponential backoff: 1min, 5min, 15min
6. After max retries, documents are tagged as `ai-failed`

## Development Commands

```bash
# Run tests
bun run test

# Type check
bun run --filter @sm-rn/api typecheck
bun run --filter @sm-rn/webapp typecheck

# Database migrations
bun run --filter @sm-rn/api db:generate
bun run --filter @sm-rn/api db:migrate

# Build for production
bun run build
```

## Project Structure

```
receipthero-ng/
├── apps/
│   ├── api/          # Hono API + Worker
│   │   ├── src/
│   │   │   ├── routes/      # API endpoints
│   │   │   ├── services/    # Business logic
│   │   │   ├── db/          # Drizzle schema
│   │   │   ├── index.ts     # API server
│   │   │   └── worker.ts    # Background worker
│   │   └── Dockerfile
│   └── webapp/       # React frontend
│       ├── src/
│       └── Dockerfile
├── packages/
│   └── shared/       # Shared types & schemas
├── docker-compose.yml
├── turbo.json
└── package.json
```

## License

MIT
