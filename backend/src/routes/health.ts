import { type FastifyPluginAsync } from 'fastify'

const healthRoutes: FastifyPluginAsync = async (server) => {
  server.get('/health', async (_request, reply) => {
    return reply.send({ status: 'ok' })
  })
}

export { healthRoutes }
