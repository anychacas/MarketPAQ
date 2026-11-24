// Side-effect import: loads backend/.env before any module reads process.env.
// It must stay the FIRST import of this file.
import './config/env'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import multipart from '@fastify/multipart'
import staticPlugin from '@fastify/static'
import rateLimit from '@fastify/rate-limit'
import fs from 'fs'
import { prismaPlugin } from './plugins/prisma'
import { requestLogger } from './plugins/requestLogger'
import { healthRoutes } from './routes/health'
import { configRoutes } from './routes/config'
import { apiRoutes } from './routes/api'
import { featureRequestRoutes } from './routes/featureRequests'
import { seedJobDefinitions, startJobRunner } from './jobs'
import { UPLOAD_DIR } from './config/paths'

async function main(): Promise<void> {
  const server = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? 'info',
    },
    // Trust the first proxy hop so request.ip reflects the real client IP
    // (Traefik sets x-forwarded-for before the request reaches this server).
    trustProxy: true,
  })

  await server.register(cors, {
    origin: process.env.CORS_ORIGIN ?? 'https://marketpaq.com',
  })

  // Rate limiting — global: false means limits are opt-in per route.
  // Individual routes declare their own max/timeWindow via config.rateLimit.
  await server.register(rateLimit, { global: false })

  await server.register(multipart, { limits: { fileSize: 2 * 1024 * 1024 } })

  // The upload directory must exist before @fastify/static is registered —
  // create it on boot so a fresh checkout works out of the box.
  fs.mkdirSync(UPLOAD_DIR, { recursive: true })
  await server.register(staticPlugin, { root: UPLOAD_DIR, prefix: '/api/uploads/' })

  await server.register(prismaPlugin)
  await server.register(requestLogger)

  await server.register(healthRoutes, { prefix: '/api' })
  await server.register(configRoutes, { prefix: '/api/v1' })
  await server.register(apiRoutes, { prefix: '/api/v1' })
  await server.register(featureRequestRoutes, { prefix: '/api' })

  const port = parseInt(process.env.PORT ?? '3000', 10)
  const host = process.env.HOST ?? '0.0.0.0'

  await server.listen({ port, host })

  // Seed job definitions and start background job runner
  await seedJobDefinitions(server.prisma)
  startJobRunner(server.prisma)
}

main().catch((err: unknown) => {
  console.error(err)
  process.exit(1)
})
