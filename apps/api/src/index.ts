import { Hono } from 'hono'
import { cors } from 'hono/cors'
import health from './routes/health'
import config from './routes/config'
import testPaperless from './routes/test-paperless'
import testTogether from './routes/test-together'
import ocr from './routes/ocr'
import events from './routes/events'
import documents from './routes/documents'
import processing from './routes/processing'
import worker from './routes/worker'
import queue from './routes/queue'
import stats from './routes/stats'
import ws from './routes/ws'
import { websocket } from 'hono/bun'
import { createLogger } from '@sm-rn/core'
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
app.route('/api/config/test-together', testTogether)
app.route('/api/ocr', ocr)
app.route('/api/documents', documents)
app.route('/api/processing', processing)
app.route('/api/worker', worker)
app.route('/api/queue', queue)
app.route('/api/stats', stats)

// Export app for RPC type inference (named export to avoid Bun's auto-serve)
export { app }
export type AppType = typeof app

// Start server only if this file is run directly
if (import.meta.main) {
  const port = parseInt(process.env.API_PORT || process.env.PORT || '3001', 10)
  logger.info(`🚀 API server starting on port ${port}...`)

  Bun.serve({
    port,
    fetch: app.fetch,
    websocket,
  })

  logger.info(`✅ API server running at http://localhost:${port}`)
}
