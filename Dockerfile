# Use Node.js LTS as base
FROM node:20-slim AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml* ./
RUN corepack enable && pnpm install --frozen-lockfile

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED 1
RUN corepack enable && pnpm build

# Bundle worker with esbuild
RUN mkdir -p dist
RUN pnpm run bundle:worker

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public

# Copy bundled worker and startup script
COPY --from=builder /app/dist/worker.js ./worker.js
COPY --from=builder /app/start-services.sh ./start-services.sh
RUN chmod +x start-services.sh

# Set the correct permission for prerender cache
RUN mkdir .next
RUN chown nextjs:nodejs .next

# Automatically leverage output traces to reduce image size
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

# Runtime Environment Variables:
# PAPERLESS_HOST: Paperless-NGX URL
# PAPERLESS_API_KEY: Paperless-NGX API Token
# TOGETHER_API_KEY: Together AI API Key
# SCAN_INTERVAL: Interval in ms (default 300000)

CMD ["./start-services.sh"]
