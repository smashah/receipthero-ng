import { Hono } from 'hono'
import { cors } from 'hono/cors'

const app = new Hono()

// Enable CORS for webapp communication
app.use('/*', cors())

// Root route
app.get('/', (c) => c.text('ReceiptHero API'))

// Export app and type for RPC
export default app
export type AppType = typeof app

// Start server
const port = parseInt(process.env.PORT || '3001', 10)
console.log(`🚀 API server starting on port ${port}...`)

export const server = Bun.serve({
  port,
  fetch: app.fetch,
})

console.log(`✅ API server running at http://localhost:${port}`)
