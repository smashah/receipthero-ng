# syntax=docker/dockerfile:1

FROM oven/bun:1 AS base

# Install dependencies
FROM base AS deps
WORKDIR /app

COPY package.json bun.lock ./
COPY turbo.json ./
COPY apps/webapp/package.json ./apps/webapp/
COPY packages/shared/package.json ./packages/shared/

RUN bun install --frozen-lockfile

# Build stage
FROM base AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/webapp/node_modules ./apps/webapp/node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules

COPY . .

# Build webapp
RUN cd apps/webapp && bun run build

# Production stage
FROM oven/bun:1-slim AS runner
WORKDIR /app

ENV NODE_ENV=production

# Install serve for static files
RUN bun add -g serve

# Copy built files
COPY --from=builder /app/apps/webapp/dist ./dist

EXPOSE 3000

CMD ["serve", "-s", "dist", "-l", "3000"]
