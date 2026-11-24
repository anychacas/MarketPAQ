/**
 * requestLogger.ts
 *
 * Logs every request that enters the /api/v1/* namespace (method, URL,
 * status and latency) for auditing.
 *
 * Output (INFO level):
 *   [api] GET /api/v1/entities/Addons?q=... → 200  +45ms
 */
import fp from 'fastify-plugin'
import { type FastifyPluginAsync } from 'fastify'

const requestLogger: FastifyPluginAsync = fp(async (server) => {
  server.addHook('onResponse', (request, reply, done) => {
    const url = request.url
    if (url.startsWith('/api/v1/')) {
      const elapsed = reply.elapsedTime.toFixed(0)
      server.log.info(
        { method: request.method, url, status: reply.statusCode, ms: Number(elapsed) },
        `[api] ${request.method} ${url} → ${reply.statusCode}  +${elapsed}ms`,
      )
    }
    done()
  })
})

export { requestLogger }
