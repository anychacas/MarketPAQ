import { type FastifyPluginAsync } from 'fastify'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// Read version at startup; __dirname is dist/routes/ in prod, src/routes/ in dev —
// both two levels above package.json.
const { version } = JSON.parse(
  readFileSync(join(__dirname, '../../package.json'), 'utf8'),
) as { version: string }

const configRoutes: FastifyPluginAsync = async (server) => {
  server.get('/config', async (_request, reply) => {
    return reply.send({
      status: 'ok',
      service: 'marketpaq-backend',
      version,
      environment: process.env.NODE_ENV ?? 'development',
      time: new Date().toISOString(),
    })
  })
}

export { configRoutes }
