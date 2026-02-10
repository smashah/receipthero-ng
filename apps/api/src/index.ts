import { Hono } from 'hono'
import { cors } from 'hono/cors'
import health from './routes/health'
import config from './routes/config'
import testPaperless from './routes/test-paperless'
import testAi from './routes/test-ai'
import ocr from './routes/ocr'

const app = new Hono()

// Enable CORS for webapp communication
app.use('/*', cors())

// Root route
app.get('/', (c) => c.text('ReceiptHero API'))

// Mount routes
app.route('/api/health', health)
app.route('/api/config', config)
app.route('/api/config/test-paperless', testPaperless)
app.route('/api/config/test-ai', testAi)
app.route('/api/ocr', ocr)

// Export app and type for RPC
export default app
export type AppType = typeof app

// Start server only if this file is run directly
if (import.meta.main) {
  const port = parseInt(process.env.PORT || '3001', 10)
  console.log(`🚀 API server starting on port ${port}...`)

  Bun.serve({
    port,
    fetch: app.fetch,
  })

  console.log(`✅ API server running at http://localhost:${port}`)
}
