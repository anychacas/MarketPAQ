/**
 * featureRequests.ts
 *
 * REST endpoints for the "Centro de mejoras" feature-request module.
 *
 * GET    /api/feature-requests               — public list (votesCount, hasVoted)
 * POST   /api/feature-requests               — auth required
 * POST   /api/feature-requests/:id/vote      — auth required
 * DELETE /api/feature-requests/:id/vote      — auth required
 * PATCH  /api/feature-requests/:id/status    — auth + admin allowlist (ADMIN_EMAILS)
 */
import { type FastifyPluginAsync, type FastifyRequest, type FastifyReply } from 'fastify'
import jwt from 'jsonwebtoken'

// ── Auth helpers (mirrors api.ts — no shared module to keep things simple) ────

function getAuthSecret(): string | null {
  return process.env.AUTH_SECRET ?? null
}

function getAuthUserId(
  request: { headers: Record<string, string | string[] | undefined> },
  secret: string,
): string | null {
  const authHeader = request.headers['authorization']
  if (typeof authHeader !== 'string') return null
  const match = authHeader.match(/^Bearer\s+(.+)$/i)
  if (!match) return null
  try {
    const payload = jwt.verify(match[1], secret) as { sub?: unknown }
    return typeof payload.sub === 'string' ? payload.sub : null
  } catch {
    return null
  }
}

/**
 * Backend source of truth for admin access.
 * Uses ADMIN_EMAILS env var (comma-separated). No admins when unset.
 * Mirrors api.ts — single criterion for admin authorization.
 */
function isAdminUser(user: { email: string }): boolean {
  const adminEmails = (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean)
  return adminEmails.includes(user.email.toLowerCase())
}

// ── Serialiser ────────────────────────────────────────────────────────────────

function serializeFeatureRequest(
  fr: {
    id: string; title: string; description: string; status: string
    createdByUserId: string; createdAt: Date; updatedAt: Date
    createdBy?: { name: string | null; handle: string | null } | null
    _count?: { votes: number }
  },
  votesCount: number,
  hasVoted: boolean,
) {
  return {
    id: fr.id,
    title: fr.title,
    description: fr.description,
    status: fr.status,
    createdByUserId: fr.createdByUserId,
    createdByName: fr.createdBy?.name ?? null,
    createdByHandle: fr.createdBy?.handle ?? null,
    votesCount,
    hasVoted,
    created_date: fr.createdAt.toISOString(),
    updated_date: fr.updatedAt.toISOString(),
  }
}

// ── Route plugin ──────────────────────────────────────────────────────────────

export const featureRequestRoutes: FastifyPluginAsync = async (server) => {

  // Allow Content-Type: application/json with an empty body (vote endpoints
  // don't send a body but some HTTP clients still include the header).
  server.addContentTypeParser(
    'application/json',
    { parseAs: 'string' },
    (_req, body, done) => {
      if (!body || (body as string) === '') return done(null, {})
      try { done(null, JSON.parse(body as string)) }
      catch (err) { done(err as Error, undefined) }
    },
  )

  // ── GET /feature-requests — public list ────────────────────────────────────
  server.get('/feature-requests', async (request, reply) => {
    const rows = await server.prisma.featureRequest.findMany({
      include: {
        createdBy: { select: { name: true, handle: true } },
        _count: { select: { votes: true } },
      },
      orderBy: [
        { votes: { _count: 'desc' } },
        { createdAt: 'desc' },
      ],
    })

    // Batch-fetch which items the current user already voted on
    let votedSet = new Set<string>()
    const secret = getAuthSecret()
    if (secret) {
      const userId = getAuthUserId(request, secret)
      if (userId && rows.length > 0) {
        const ids = rows.map(r => r.id)
        const myVotes = await server.prisma.featureVote.findMany({
          where: { userId, featureRequestId: { in: ids } },
          select: { featureRequestId: true },
        })
        votedSet = new Set(myVotes.map(v => v.featureRequestId))
      }
    }

    return reply.send(
      rows.map(r => serializeFeatureRequest(r, r._count.votes, votedSet.has(r.id))),
    )
  })

  // ── POST /feature-requests — create (authenticated users) ──────────────────
  server.post<{ Body: { title?: string; description?: string } }>(
    '/feature-requests',
    async (request, reply) => {
      const secret = getAuthSecret()
      if (!secret) return reply.status(500).send({ message: 'AUTH_SECRET not configured', code: 'SERVER_ERROR' })

      const userId = getAuthUserId(request, secret)
      if (!userId) return reply.status(401).send({ message: 'Debes iniciar sesión', code: 'auth_required' })

      const user = await server.prisma.user.findUnique({
        where: { id: userId },
        select: { id: true },
      })
      if (!user) return reply.status(401).send({ message: 'Debes iniciar sesión', code: 'auth_required' })

      const { title, description } = request.body ?? {}
      if (typeof title !== 'string' || title.trim().length < 5) {
        return reply.status(400).send({ message: 'El título debe tener al menos 5 caracteres', code: 'VALIDATION_ERROR' })
      }
      if (title.trim().length > 200) {
        return reply.status(400).send({ message: 'El título es demasiado largo (máx. 200 caracteres)', code: 'TITLE_TOO_LONG' })
      }
      if (typeof description !== 'string' || description.trim().length < 10) {
        return reply.status(400).send({ message: 'La descripción debe tener al menos 10 caracteres', code: 'VALIDATION_ERROR' })
      }
      if (description.trim().length > 5000) {
        return reply.status(400).send({ message: 'La descripción es demasiado larga (máx. 5000 caracteres)', code: 'DESCRIPTION_TOO_LONG' })
      }

      const fr = await server.prisma.featureRequest.create({
        data: { title: title.trim(), description: description.trim(), createdByUserId: userId },
        include: { createdBy: { select: { name: true, handle: true } } },
      })

      return reply.status(201).send(serializeFeatureRequest(fr, 0, false))
    },
  )

  // ── POST /feature-requests/:id/vote — add vote (authenticated users) ──────
  server.post<{ Params: { id: string } }>(
    '/feature-requests/:id/vote',
    async (request, reply) => {
      const secret = getAuthSecret()
      if (!secret) return reply.status(500).send({ message: 'AUTH_SECRET not configured', code: 'SERVER_ERROR' })

      const userId = getAuthUserId(request, secret)
      if (!userId) return reply.status(401).send({ message: 'Debes iniciar sesión', code: 'auth_required' })

      const user = await server.prisma.user.findUnique({
        where: { id: userId },
        select: { id: true },
      })
      if (!user) return reply.status(401).send({ message: 'Debes iniciar sesión', code: 'auth_required' })

      const { id } = request.params
      const fr = await server.prisma.featureRequest.findUnique({ where: { id }, select: { id: true } })
      if (!fr) return reply.status(404).send({ message: 'Mejora no encontrada', code: 'NOT_FOUND' })

      try {
        await server.prisma.featureVote.create({ data: { featureRequestId: id, userId } })
      } catch {
        // Unique constraint violation = already voted; treat as idempotent 200
      }

      const votesCount = await server.prisma.featureVote.count({ where: { featureRequestId: id } })
      return reply.send({ featureRequestId: id, votesCount, hasVoted: true })
    },
  )

  // ── DELETE /feature-requests/:id/vote — remove vote (authenticated users) ──
  server.delete<{ Params: { id: string } }>(
    '/feature-requests/:id/vote',
    async (request, reply) => {
      const secret = getAuthSecret()
      if (!secret) return reply.status(500).send({ message: 'AUTH_SECRET not configured', code: 'SERVER_ERROR' })

      const userId = getAuthUserId(request, secret)
      if (!userId) return reply.status(401).send({ message: 'Debes iniciar sesión', code: 'auth_required' })

      const user = await server.prisma.user.findUnique({
        where: { id: userId },
        select: { id: true },
      })
      if (!user) return reply.status(401).send({ message: 'Debes iniciar sesión', code: 'auth_required' })

      const { id } = request.params
      await server.prisma.featureVote.deleteMany({
        where: { featureRequestId: id, userId },
      })

      const votesCount = await server.prisma.featureVote.count({ where: { featureRequestId: id } })
      return reply.send({ featureRequestId: id, votesCount, hasVoted: false })
    },
  )

  // ── PATCH /feature-requests/:id/status — admin only ───────────────────────
  server.patch<{ Params: { id: string }; Body: { status?: string } }>(
    '/feature-requests/:id/status',
    async (request, reply) => {
      const secret = getAuthSecret()
      if (!secret) return reply.status(500).send({ message: 'AUTH_SECRET not configured', code: 'SERVER_ERROR' })

      const userId = getAuthUserId(request, secret)
      if (!userId) return reply.status(401).send({ message: 'Debes iniciar sesión', code: 'auth_required' })

      const user = await server.prisma.user.findUnique({
        where: { id: userId },
        select: { email: true },
      })
      if (!user || !isAdminUser(user)) {
        server.log.warn({ callerId: userId, email: user?.email }, '[admin] forbidden')
        return reply.status(403).send({ message: 'Acceso denegado', code: 'FORBIDDEN' })
      }

      const VALID_STATUSES = ['open', 'planned', 'in_progress', 'done', 'rejected'] as const
      const { status } = request.body ?? {}
      if (!status || !VALID_STATUSES.includes(status as typeof VALID_STATUSES[number])) {
        return reply.status(400).send({
          message: `status debe ser uno de: ${VALID_STATUSES.join(', ')}`,
          code: 'VALIDATION_ERROR',
        })
      }

      const { id } = request.params
      try {
        const updated = await server.prisma.featureRequest.update({
          where: { id },
          data: { status },
          include: { createdBy: { select: { name: true, handle: true } }, _count: { select: { votes: true } } },
        })
        return reply.send(serializeFeatureRequest(updated, updated._count.votes, false))
      } catch {
        return reply.status(404).send({ message: 'Mejora no encontrada', code: 'NOT_FOUND' })
      }
    },
  )
}
