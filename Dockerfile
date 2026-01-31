# syntax=docker/dockerfile:1

# =============================
# Bun Dockerfile for ReceiptHero (with pnpm for dependencies)
# Uses: Bun runtime + pnpm package manager
# Based on: https://pnpm.io/docker
# =============================

FROM oven/bun:1 AS base
WORKDIR /app

# Setup pnpm via corepack
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN bun add -g pnpm

# =============================
# Install dependencies
# =============================
FROM base AS deps
WORKDIR /app

# Copy root package files for monorepo
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY turbo.json ./

# Copy workspace package files
COPY apps/api/package.json ./apps/api/
COPY apps/worker/package.json ./apps/worker/
COPY apps/webapp/package.json ./apps/webapp/
COPY packages/shared/package.json ./packages/shared/
COPY packages/core/package.json ./packages/core/

# Install all dependencies using pnpm with BuildKit cache
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile --reporter ndjson

# =============================
# Runner stage
# =============================
FROM base AS runner
WORKDIR /app

# Set database path - critical for migrations and runtime
ENV DATABASE_PATH=/app/data/receipthero.db
ENV CONFIG_PATH=/app/data/config.json
ENV TURBO_TELEMETRY_DISABLED=1
ENV DO_NOT_TRACK=1

# Create data directory for SQLite
RUN mkdir -p /app/data

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=deps /app/apps/worker/node_modules ./apps/worker/node_modules
COPY --from=deps /app/apps/webapp/node_modules ./apps/webapp/node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=deps /app/packages/core/node_modules ./packages/core/node_modules

# Copy source code
COPY . .

# Generate database migrations (doesn't need DB connection)
RUN cd packages/core && bun run db:generate

# Build webapp for production (required for vite preview)
RUN cd apps/webapp && pnpm run build

# Expose webapp port only - API (3001) and Worker are internal
EXPOSE 3000

# Default command - start production server via turborepo
CMD ["pnpm", "run", "start"]
