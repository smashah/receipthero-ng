# syntax=docker/dockerfile:1

FROM oven/bun:1 AS base

# Install dependencies
FROM base AS deps
WORKDIR /app

# Copy root package files
COPY package.json bun.lock ./
COPY turbo.json ./

# Copy workspace package files
COPY apps/api/package.json ./apps/api/
COPY apps/worker/package.json ./apps/worker/
COPY apps/webapp/package.json ./apps/webapp/
COPY packages/shared/package.json ./packages/shared/
COPY packages/core/package.json ./packages/core/

# Install dependencies
RUN bun install --frozen-lockfile

# Build stage
FROM base AS builder
WORKDIR /app

# Copy dependencies
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=deps /app/apps/worker/node_modules ./apps/worker/node_modules
COPY --from=deps /app/apps/webapp/node_modules ./apps/webapp/node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=deps /app/packages/core/node_modules ./packages/core/node_modules

# Copy source code
COPY . .

# Run database migrations generation in core
RUN cd packages/core && bun run db:generate

# Production stage
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

# Create data directory
RUN mkdir -p /app/data

# Copy necessary files (everything for production)
COPY --from=builder /app ./

# Install only production dependencies
RUN bun install --frozen-lockfile --production

# Default command (can be overridden)
CMD ["bun", "run", "--filter", "@sm-rn/api", "start"]
