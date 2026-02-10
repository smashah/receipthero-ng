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
- TanStack AI (multi-provider LLM OCR)
- Supports: Together AI, Ollama, OpenRouter, any OpenAI-compatible API

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

# AI Provider (new — replaces TOGETHER_API_KEY)
AI_PROVIDER=openai-compat          # openai-compat | ollama | openrouter
AI_API_KEY=your-api-key            # Required for openai-compat and openrouter
AI_BASE_URL=https://api.together.xyz/v1  # Optional, provider-specific default
AI_MODEL=meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8

# Backward compatible — still works, auto-migrates to AI_* settings
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

### Supported AI Providers

| Provider | `AI_PROVIDER` | `AI_BASE_URL` (default) | API Key Required |
|----------|---------------|--------------------------|------------------|
| Together AI | `openai-compat` | `https://api.together.xyz/v1` | Yes |
| Ollama (local) | `ollama` | `http://localhost:11434` | No |
| OpenRouter | `openrouter` | (OpenRouter default) | Yes |
| vLLM / LiteLLM / LM Studio | `openai-compat` | Your endpoint URL | Depends on setup |

## API Endpoints

- `GET /api/health` - Health check
- `GET /api/config` - Get configuration (masked keys)
- `POST /api/config` - Save configuration
- `POST /api/config/test-paperless` - Test Paperless connection
- `POST /api/config/test-ai` - Test AI provider connection
- `POST /api/ocr` - Extract receipt data from image

## How It Works

1. Worker polls Paperless-NGX for documents tagged with `receipt`
2. Downloads document (prefers thumbnail for OCR)
3. Sends to configured AI provider (via TanStack AI) for structured extraction
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
