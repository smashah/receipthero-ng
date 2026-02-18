import { Hono } from 'hono'
import { cors } from 'hono/cors'
import health from './routes/health'
import config from './routes/config'
import testPaperless from './routes/test-paperless'
import testAi from './routes/test-ai'
import workflows from './routes/workflows'
import ocr from './routes/ocr'
import events from './routes/events'
import documents from './routes/documents'
import processing from './routes/processing'
import worker from './routes/worker'
import queue from './routes/queue'
import stats from './routes/stats'
import webhooks from './routes/webhooks'
import ws from './routes/ws'
import { websocket } from 'hono/bun'
import { createLogger, seedDefaultWorkflows } from '@sm-rn/core'
import { logger as honoLogger } from 'hono/logger'

const logger = createLogger('api')
const app = new Hono()

// Enable CORS for webapp communication
app.use('/*', cors())

// Root route
app.get('/', (c) => c.text('ReceiptHero API'))

// Mount routes
app.route('/api/health', health)
app.route('/api/events', events)
app.route('/ws', ws)
app.use(honoLogger())
app.route('/api/config', config)
app.route('/api/config/test-paperless', testPaperless)
app.route('/api/config/test-ai', testAi)
app.route('/api/ocr', ocr)
app.route('/api/documents', documents)
app.route('/api/processing', processing)
app.route('/api/worker', worker)
app.route('/api/queue', queue)
app.route('/api/stats', stats)
app.route('/api/workflows', workflows)
app.route('/api/webhooks', webhooks)

// Export app for RPC type inference (named export to avoid Bun's auto-serve)
export { app }
export type AppType = typeof app

// Start server only if this file is run directly
if (import.meta.main) {
  const port = parseInt('3001', 10)
  logger.info(`🚀 API server starting on port ${port}...`)

  // Seed default workflows on first run
  await seedDefaultWorkflows()

  Bun.serve({
    port,
    fetch: app.fetch,
    websocket,
  })

  logger.info(`✅ API server running at http://localhost:${port}`)
}
