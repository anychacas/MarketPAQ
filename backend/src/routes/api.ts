/**
 * api.ts
 *
 * Main REST API consumed by the frontend. Registered under /api/v1.
 *
 *   Addons            ← Prisma CRUD   (/entities/Addons)
 *   DeveloperProfiles ← Prisma CRUD   (/entities/DeveloperProfiles)
 *   User              ← list/filter + /entities/User/me (JWT auth)
 *   Functions         ← POST /functions/<name> RPC-style handlers
 *   Auth              ← register, login, password reset, email verification
 *   Uploads           ← avatar, developer logo, addon cover and gallery images
 *
 * Dev-bypass auth (local testing only):
 *   Set DEV_BYPASS=1 in .env and send header  x-dev-bypass: 1
 *   GET  /entities/User/me → 200 with stub user (stub@marketpaq.internal)
 *   PUT  /entities/User/me → updates stub user fields, returns updated user
 */
import { type FastifyPluginAsync } from 'fastify'
import { PrismaClient, type Prisma } from '@prisma/client'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import fs from 'fs/promises'
import { createWriteStream } from 'fs'
import { pipeline } from 'stream/promises'
import path from 'path'
import crypto from 'crypto'
import '@fastify/multipart'
import { sendPasswordResetEmail, sendVerificationEmail } from '../services/mail'
import {
  notifyAddonSubmitted,
  notifyAddonStatusChanged,
  notifyWelcome,
} from '../email/notifications'
import { runWeeklyDigest } from '../jobs/handlers/weeklyDigest'
import { runRemindCompleteProfile } from '../jobs/handlers/remindCompleteProfile'
import { UPLOAD_DIR } from '../config/paths'

// ── Admin allowlist helper ────────────────────────────────────────────────────

/**
 * Backend source of truth for admin access.
 * Uses ADMIN_EMAILS env var (comma-separated). No admins when unset.
 */
function isAdminUser(user: { email: string }): boolean {
  const adminEmails = (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean)
  return adminEmails.includes(user.email.toLowerCase())
}

// ── Serialisation ─────────────────────────────────────────────────────────────

function serializeAddon(a: {
  id: string; slug: string; name: string; summary: string | null
  description: string | null; vendor: string | null
  contpaqi: boolean; softrestaurant: boolean; status: string
  manufacturer: string | null; system: string | null; classification: string
  tags: string[]; priceFrom: number | null; youtubeLinks: string[]
  images: string[]; coverImage: string | null; website: string | null
  contactEmail: string | null; contactWhatsApp: string | null
  ownerUserId: string; developerId: string | null
  licenseType: string[]; licenseDescription: string | null
  createdAt: Date; updatedAt: Date
}) {
  return {
    id: a.id, slug: a.slug, name: a.name, summary: a.summary,
    description: a.description, vendor: a.vendor,
    contpaqi: a.contpaqi, softrestaurant: a.softrestaurant,
    status: a.status, manufacturer: a.manufacturer, system: a.system,
    classification: a.classification, tags: a.tags, priceFrom: a.priceFrom,
    youtubeLinks: a.youtubeLinks, images: a.images, coverImage: a.coverImage,
    website: a.website, contactEmail: a.contactEmail,
    contactWhatsApp: a.contactWhatsApp, ownerUserId: a.ownerUserId,
    developerId: a.developerId,
    licenseType: a.licenseType, licenseDescription: a.licenseDescription,
    created_date: a.createdAt.toISOString(),
    updated_date: a.updatedAt.toISOString(),
  }
}

function serializeDeveloperProfile(p: {
  id: string; userId: string; displayName: string; bio: string | null
  website: string | null; whatsapp: string | null; supportEmail: string | null
  contpaqi: boolean; softrestaurant: boolean
  logoUrl: string | null; location: string | null
  services: string | null; responseTime: string | null
  createdAt: Date; updatedAt: Date
  user?: { handle: string | null } | null
}) {
  return {
    id: p.id, userId: p.userId, displayName: p.displayName,
    bio: p.bio, website: p.website, whatsapp: p.whatsapp,
    supportEmail: p.supportEmail,
    contpaqi: p.contpaqi, softrestaurant: p.softrestaurant,
    logoUrl: p.logoUrl, location: p.location,
    services: p.services, responseTime: p.responseTime,
    developerHandle: p.user?.handle ?? null,
    created_date: p.createdAt.toISOString(),
    updated_date: p.updatedAt.toISOString(),
  }
}

/**
 * Serialises a User row to the shape the frontend expects.
 *   DB field   → API field
 *   name       → full_name
 *   handle     → developerHandle
 */
function serializeUser(u: {
  id: string; email: string; name: string | null; handle: string | null
  userType: string; onboardingComplete: boolean
  role: string | null; company: string | null; facebook: string | null
  avatarUrl: string | null; whatsapp: string | null
  emailVerified: boolean
  partnerLeaderCode: string | null
  canPublishAddons: boolean; uplinePartnerLeaderId: string | null
  createdAt: Date; updatedAt: Date
}) {
  return {
    id: u.id, email: u.email,
    full_name: u.name,
    developerHandle: u.handle,
    userType: u.userType,
    onboardingComplete: u.onboardingComplete,
    role: u.role, company: u.company, facebook: u.facebook,
    avatarUrl: u.avatarUrl, whatsapp: u.whatsapp,
    emailVerified: u.emailVerified,
    partnerLeaderCode: u.partnerLeaderCode,
    canPublishAddons: u.canPublishAddons,
    uplinePartnerLeaderId: u.uplinePartnerLeaderId,
    created_date: u.createdAt.toISOString(),
    updated_date: u.updatedAt.toISOString(),
  }
}

// ── Where / OrderBy parsers ───────────────────────────────────────────────────

function addonOrderByFromSort(sort: string | undefined): Prisma.AddonOrderByWithRelationInput {
  if (!sort) return { createdAt: 'desc' }
  const desc = sort.startsWith('-')
  const field = sort.replace(/^-/, '')
  const fieldMap: Record<string, keyof Prisma.AddonOrderByWithRelationInput> = {
    created_date: 'createdAt', updated_date: 'updatedAt', name: 'name', status: 'status',
  }
  return { [fieldMap[field] ?? 'createdAt']: desc ? 'desc' : 'asc' }
}

/**
 * Map frontend User filter keys to Prisma column names.
 *   developerHandle → handle
 */
function userWhereFromQuery(q: string | undefined): Prisma.UserWhereInput {
  if (!q) return {}
  try {
    const f = JSON.parse(q) as Record<string, unknown>
    const w: Prisma.UserWhereInput = {}
    if (typeof f.developerHandle === 'string') w.handle = f.developerHandle
    if (typeof f.email === 'string') w.email = f.email
    if (typeof f.userType === 'string') w.userType = f.userType
    return w
  } catch { return {} }
}

// ── Stub-user helper ──────────────────────────────────────────────────────────

const STUB_EMAIL = 'stub@marketpaq.internal'

async function getOrCreateStubUser(prisma: PrismaClient): Promise<string> {
  const existing = await prisma.user.findFirst({
    where: { email: STUB_EMAIL },
    select: { id: true },
  })
  if (existing) return existing.id

  const created = await prisma.user.create({
    data: {
      email: STUB_EMAIL,
      userType: 'developer',
      onboardingComplete: true,
      name: 'Stub Developer',
      emailVerified: true,
    },
    select: { id: true },
  })
  return created.id
}

// ── Partner Leader code generator ────────────────────────────────────────────

/**
 * Generates a unique 7-character uppercase alphanumeric Partner Leader code.
 * Format: e.g. D345DGF — avoids ambiguous chars O, 0, I, 1.
 * Retries up to maxAttempts times on collision.
 */
const PARTNER_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function randomPartnerCode(): string {
  const bytes = crypto.randomBytes(7)
  return Array.from(bytes)
    .map(b => PARTNER_CODE_ALPHABET[b % PARTNER_CODE_ALPHABET.length])
    .join('')
}

async function generatePartnerLeaderCode(
  prisma: PrismaClient,
  _user: { handle: string | null; name: string | null },
  maxAttempts = 10,
): Promise<string> {
  for (let i = 0; i < maxAttempts; i++) {
    const code = randomPartnerCode()
    const existing = await prisma.user.findUnique({
      where: { partnerLeaderCode: code },
      select: { id: true },
    })
    if (!existing) return code
  }
  // Extremely unlikely — use more bytes for guaranteed uniqueness
  return randomPartnerCode() + crypto.randomBytes(2).toString('hex').toUpperCase()
}

// ── Dev-bypass helper ─────────────────────────────────────────────────────────

function isDevBypass(request: { headers: Record<string, string | string[] | undefined> }): boolean {
  return (
    process.env.NODE_ENV !== 'production' &&
    process.env.DEV_BYPASS === '1' &&
    request.headers['x-dev-bypass'] === '1'
  )
}

// ── JWT helpers ───────────────────────────────────────────────────────────────

function getAuthSecret(): string | null {
  return process.env.AUTH_SECRET ?? null
}

function signToken(userId: string, secret: string): string {
  return jwt.sign({ sub: userId }, secret, { expiresIn: '7d' })
}

/**
 * Extract and verify a Bearer JWT from the Authorization header.
 * Returns the userId (sub claim) on success, or null on any failure.
 */
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

// ── OTP helpers ───────────────────────────────────────────────────────────────

function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

function hashOtp(code: string, secret: string, userId: string): string {
  return crypto.createHash('sha256').update(`${code}:${secret}:${userId}`).digest('hex')
}

const MAX_PASSWORD_LENGTH = 128

// ── Route plugin ──────────────────────────────────────────────────────────────

const apiRoutes: FastifyPluginAsync = async (server) => {

  // ── Auth: register ─────────────────────────────────────────────────────────
  server.post<{
    Body: {
      email?: string; password?: string
      full_name?: string; whatsapp?: string; company?: string
      facebook?: string; developerHandle?: string
      /** Optional invite code from a Partner Leader's /join link */
      partnerLeaderCode?: string
    }
  }>(
    '/auth/register',
    { config: { rateLimit: { max: 5, timeWindow: '10 minutes' } } },
    async (request, reply) => {
      const secret = getAuthSecret()
      if (!secret) return reply.status(500).send({ message: 'AUTH_SECRET not configured', code: 'SERVER_ERROR' })

      const { email, password, full_name, whatsapp, company, facebook, developerHandle, partnerLeaderCode } = request.body ?? {}
      if (typeof email !== 'string' || !email.includes('@')) {
        return reply.status(400).send({ message: 'Valid email required', code: 'VALIDATION_ERROR' })
      }
      if (typeof password !== 'string' || password.length < 6) {
        return reply.status(400).send({ message: 'Password must be at least 6 characters', code: 'VALIDATION_ERROR' })
      }
      if (password.length > MAX_PASSWORD_LENGTH) {
        return reply.status(400).send({ message: 'Password too long', code: 'PASSWORD_TOO_LONG' })
      }

      // Validate handle format and uniqueness if provided
      if (typeof developerHandle === 'string' && developerHandle) {
        if (!/^[a-z0-9-]{2,30}$/.test(developerHandle)) {
          return reply.status(400).send({
            message: 'developerHandle must be 2–30 lowercase alphanumeric characters or hyphens',
            code: 'VALIDATION_ERROR',
          })
        }
        const handleConflict = await server.prisma.user.findFirst({
          where: { handle: developerHandle }, select: { id: true },
        })
        if (handleConflict) {
          return reply.status(409).send({ message: 'developerHandle already taken', code: 'CONFLICT' })
        }
      }

      const existing = await server.prisma.user.findUnique({ where: { email } })
      if (existing) {
        return reply.status(409).send({ message: 'Email already registered', code: 'CONFLICT' })
      }

      // Resolve optional Partner Leader upline from invite code.
      // Invalid / missing codes are silently ignored — never block registration.
      let uplinePartnerLeaderId: string | undefined
      if (typeof partnerLeaderCode === 'string' && partnerLeaderCode) {
        const leader = await server.prisma.user.findUnique({
          where: { partnerLeaderCode },
          select: { id: true, userType: true },
        })
        if (leader?.userType === 'partner_leader') {
          uplinePartnerLeaderId = leader.id
        }
      }

      const passwordHash = await bcrypt.hash(password, 10)
      const user = await server.prisma.user.create({
        data: {
          email, passwordHash,
          name: typeof full_name === 'string' && full_name ? full_name : null,
          whatsapp: typeof whatsapp === 'string' && whatsapp ? whatsapp : null,
          company: typeof company === 'string' && company ? company : null,
          facebook: typeof facebook === 'string' && facebook ? facebook : null,
          handle: typeof developerHandle === 'string' && developerHandle ? developerHandle : undefined,
          uplinePartnerLeaderId,
        },
      })

      // Generate OTP and send verification email
      const otp = generateOtp()
      const codeHash = hashOtp(otp, secret, user.id)
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000)
      await server.prisma.emailVerificationToken.upsert({
        where: { userId: user.id },
        create: { userId: user.id, codeHash, expiresAt, attempts: 0, lastSentAt: new Date() },
        update: { codeHash, expiresAt, attempts: 0, lastSentAt: new Date() },
      })
      const mailResult = await sendVerificationEmail(user.email, otp)
      if (!mailResult.ok) {
        server.log.error({ userId: user.id }, '[register] verification email failed to send — user will need to use resend')
      }

      const access_token = signToken(user.id, secret)
      return reply.status(201).send({
        access_token,
        user: serializeUser(user),
        emailSent: mailResult.ok,
      })
    },
  )

  // ── Auth: login ────────────────────────────────────────────────────────────
  server.post<{
    Body: { email?: string; password?: string }
  }>(
    '/auth/login',
    { config: { rateLimit: { max: 5, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const secret = getAuthSecret()
      if (!secret) return reply.status(500).send({ message: 'AUTH_SECRET not configured', code: 'SERVER_ERROR' })

      const { email, password } = request.body ?? {}
      if (typeof email !== 'string' || typeof password !== 'string') {
        return reply.status(400).send({ message: 'email and password required', code: 'VALIDATION_ERROR' })
      }

      const user = await server.prisma.user.findUnique({ where: { email } })
      if (!user || !user.passwordHash) {
        return reply.status(401).send({ message: 'Invalid credentials', code: 'UNAUTHORIZED' })
      }

      const valid = await bcrypt.compare(password, user.passwordHash)
      if (!valid) {
        return reply.status(401).send({ message: 'Invalid credentials', code: 'UNAUTHORIZED' })
      }

      const access_token = signToken(user.id, secret)
      return reply.send({ access_token, user: serializeUser(user) })
    },
  )

  // ── Auth: request-password-reset ──────────────────────────────────────────
  // Always returns 200 { success: true } regardless of whether the email exists
  // to avoid leaking user enumeration information.
  server.post<{
    Body: { email?: string }
  }>(
    '/auth/request-password-reset',
    { config: { rateLimit: { max: 3, timeWindow: '1 hour' } } },
    async (request, reply) => {
      const { email } = (request.body ?? {}) as { email?: string }
      if (typeof email !== 'string' || !email.includes('@')) {
        return reply.status(400).send({ message: 'Valid email required', code: 'VALIDATION_ERROR' })
      }

      try {
        const user = await server.prisma.user.findUnique({ where: { email } })
        if (user) {
          // Invalidate any existing unused tokens for this user
          await server.prisma.passwordResetToken.updateMany({
            where: { userId: user.id, usedAt: null },
            data: { usedAt: new Date() },
          })

          const token = crypto.randomBytes(32).toString('hex')
          const expiresAt = new Date(Date.now() + 60 * 60 * 1000) // 1 hour

          await server.prisma.passwordResetToken.create({
            data: { userId: user.id, token, expiresAt },
          })

          const baseUrl = process.env.FRONTEND_BASE_URL ?? 'http://localhost:5173'
          const resetLink = `${baseUrl}/ResetPassword?token=${token}`

          const resetMailResult = await sendPasswordResetEmail(email, resetLink)
          if (resetMailResult.ok) {
            server.log.info({ userId: user.id }, '[request-password-reset] email sent')
          } else {
            server.log.error({ userId: user.id }, '[request-password-reset] email failed to send')
          }
        } else {
          server.log.info({ email }, '[request-password-reset] email not found, silently ignoring')
        }
      } catch (err) {
        server.log.error(err, '[request-password-reset] error')
        return reply.status(500).send({ message: 'No se pudo procesar la solicitud', code: 'SERVER_ERROR' })
      }

      return reply.send({ success: true })
    },
  )

  // ── Auth: reset-password ───────────────────────────────────────────────────
  server.post<{
    Body: { token?: string; newPassword?: string }
  }>(
    '/auth/reset-password',
    { config: { rateLimit: { max: 10, timeWindow: '1 hour' } } },
    async (request, reply) => {
      const { token, newPassword } = (request.body ?? {}) as { token?: string; newPassword?: string }

      if (typeof newPassword !== 'string' || newPassword.length < 8) {
        return reply.status(400).send({ message: 'Password must be at least 8 characters', code: 'VALIDATION_ERROR' })
      }
      if (newPassword.length > MAX_PASSWORD_LENGTH) {
        return reply.status(400).send({ message: 'Password too long', code: 'PASSWORD_TOO_LONG' })
      }
      if (typeof token !== 'string' || !token) {
        return reply.status(400).send({ error: 'INVALID_OR_EXPIRED_TOKEN' })
      }

      try {
        const resetToken = await server.prisma.passwordResetToken.findUnique({
          where: { token },
        })

        if (!resetToken || resetToken.usedAt !== null || resetToken.expiresAt < new Date()) {
          return reply.status(400).send({ error: 'INVALID_OR_EXPIRED_TOKEN' })
        }

        const passwordHash = await bcrypt.hash(newPassword, 10)
        await server.prisma.user.update({
          where: { id: resetToken.userId },
          data: { passwordHash },
        })

        await server.prisma.passwordResetToken.update({
          where: { id: resetToken.id },
          data: { usedAt: new Date() },
        })

        server.log.info({ userId: resetToken.userId }, '[reset-password] password updated')
        return reply.send({ success: true })
      } catch (err) {
        server.log.error(err, '[reset-password] error')
        return reply.status(500).send({ message: 'Error al restablecer la contraseña', code: 'SERVER_ERROR' })
      }
    },
  )

  // ── Auth: verify-email/confirm ─────────────────────────────────────────────
  server.post<{ Body: { code?: string } }>(
    '/auth/verify-email/confirm',
    async (request, reply) => {
      const secret = getAuthSecret()
      if (!secret) return reply.status(500).send({ message: 'AUTH_SECRET not configured', code: 'SERVER_ERROR' })

      const userId = getAuthUserId(request, secret)
      if (!userId) return reply.status(401).send({ message: 'No autorizado', code: 'auth_required' })

      const { code } = request.body ?? {}
      if (typeof code !== 'string' || !/^\d{6}$/.test(code)) {
        return reply.status(400).send({ message: 'Código inválido (debe ser 6 dígitos)', code: 'VALIDATION_ERROR' })
      }

      const token = await server.prisma.emailVerificationToken.findUnique({ where: { userId } })
      if (!token) {
        return reply.status(400).send({ message: 'No hay código pendiente. Usa el botón "Reenviar".', code: 'NO_TOKEN' })
      }
      if (token.expiresAt < new Date()) {
        return reply.status(400).send({ message: 'El código expiró. Solicita uno nuevo.', code: 'TOKEN_EXPIRED' })
      }
      if (token.attempts >= 5) {
        return reply.status(400).send({ message: 'Demasiados intentos fallidos. Solicita un nuevo código.', code: 'TOO_MANY_ATTEMPTS' })
      }

      const expectedHash = hashOtp(code, secret, userId)
      if (token.codeHash !== expectedHash) {
        await server.prisma.emailVerificationToken.update({
          where: { userId },
          data: { attempts: { increment: 1 } },
        })
        return reply.status(400).send({ message: 'Código incorrecto. Verifica e intenta de nuevo.', code: 'INVALID_CODE' })
      }

      // Success — verify user and remove token
      await server.prisma.user.update({
        where: { id: userId },
        data: { emailVerified: true, emailVerifiedAt: new Date() },
      })
      await server.prisma.emailVerificationToken.delete({ where: { userId } })

      server.log.info({ userId }, '[verify-email] email verified')
      // Welcome email — fire-and-forget
      void notifyWelcome(server.prisma, userId)
      return reply.send({ success: true })
    },
  )

  // ── Auth: verify-email/resend ──────────────────────────────────────────────
  server.post(
    '/auth/verify-email/resend',
    async (request, reply) => {
      const secret = getAuthSecret()
      if (!secret) return reply.status(500).send({ message: 'AUTH_SECRET not configured', code: 'SERVER_ERROR' })

      const userId = getAuthUserId(request, secret)
      if (!userId) return reply.status(401).send({ message: 'No autorizado', code: 'auth_required' })

      const user = await server.prisma.user.findUnique({ where: { id: userId } })
      if (!user) return reply.status(401).send({ message: 'Usuario no encontrado', code: 'user_not_registered' })

      if (user.emailVerified) {
        return reply.status(400).send({ message: 'El correo ya fue verificado', code: 'ALREADY_VERIFIED' })
      }

      // Rate-limit: 60 s between resends
      const existingToken = await server.prisma.emailVerificationToken.findUnique({ where: { userId } })
      if (existingToken?.lastSentAt) {
        const elapsed = Date.now() - existingToken.lastSentAt.getTime()
        if (elapsed < 60_000) {
          const remaining = Math.ceil((60_000 - elapsed) / 1000)
          return reply.status(429).send({
            message: `Espera ${remaining} segundo${remaining !== 1 ? 's' : ''} antes de reenviar`,
            code: 'RATE_LIMITED',
            retryAfter: remaining,
          })
        }
      }

      const otp = generateOtp()
      const codeHash = hashOtp(otp, secret, userId)
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000)
      await server.prisma.emailVerificationToken.upsert({
        where: { userId },
        create: { userId, codeHash, expiresAt, attempts: 0, lastSentAt: new Date() },
        update: { codeHash, expiresAt, attempts: 0, lastSentAt: new Date() },
      })

      const mailResult = await sendVerificationEmail(user.email, otp)
      if (!mailResult.ok) {
        server.log.error({ userId }, '[verify-email/resend] failed to send email')
        return reply.status(503).send({
          message: 'No se pudo enviar el correo. Verifica tu dirección o intenta en unos minutos.',
          code: 'EMAIL_SEND_FAILED',
          retryAfter: 60,
        })
      }

      server.log.info({ userId }, '[verify-email/resend] code resent')
      return reply.send({ success: true })
    },
  )

  // ── Auth: me ───────────────────────────────────────────────────────────────
  server.get(
    '/entities/User/me',
    async (request, reply) => {
      // Dev-bypass path (local testing only)
      if (isDevBypass(request)) {
        const userId = await getOrCreateStubUser(server.prisma)
        const user = await server.prisma.user.findUniqueOrThrow({ where: { id: userId } })
        return reply.send(serializeUser(user))
      }

      const secret = getAuthSecret()
      if (!secret) return reply.status(500).send({ message: 'AUTH_SECRET not configured', code: 'SERVER_ERROR' })

      const userId = getAuthUserId(request, secret)
      if (!userId) return reply.status(401).send({ message: 'Unauthorized', code: 'auth_required' })

      const user = await server.prisma.user.findUnique({ where: { id: userId } })
      if (!user) return reply.status(401).send({ message: 'User not found', code: 'user_not_registered' })

      return reply.send(serializeUser(user))
    },
  )

  server.put<{ Body: Record<string, unknown> }>(
    '/entities/User/me',
    async (request, reply) => {
      // Dev-bypass path (local testing only)
      if (isDevBypass(request)) {
        const userId = await getOrCreateStubUser(server.prisma)
        const b = request.body ?? {}
        const data: Prisma.UserUpdateInput = {}
        if ('developerHandle' in b) data.handle = b.developerHandle as string | null
        if ('full_name' in b) data.name = b.full_name as string | null
        if ('name' in b) data.name = b.name as string | null
        if ('company' in b) data.company = b.company as string | null
        if ('whatsapp' in b) data.whatsapp = b.whatsapp as string | null
        if ('avatarUrl' in b) data.avatarUrl = b.avatarUrl as string | null
        const user = await server.prisma.user.update({ where: { id: userId }, data })
        return reply.send(serializeUser(user))
      }

      const secret = getAuthSecret()
      if (!secret) return reply.status(500).send({ message: 'AUTH_SECRET not configured', code: 'SERVER_ERROR' })

      const userId = getAuthUserId(request, secret)
      if (!userId) return reply.status(401).send({ message: 'Unauthorized', code: 'auth_required' })

      const b = request.body ?? {}
      const data: Prisma.UserUpdateInput = {}

      // Validate developerHandle if provided
      if ('developerHandle' in b) {
        const handle = b.developerHandle
        if (handle !== null && handle !== undefined) {
          if (typeof handle !== 'string' || !/^[a-z0-9-]{2,30}$/.test(handle)) {
            server.log.warn(
              {
                reqId: request.id,
                userId,
                bodyKeys: Object.keys(b),
                handleType: typeof handle,
                handleValue: typeof handle === 'string' ? handle : null,
                code: 'VALIDATION_ERROR',
              },
              '[PUT /User/me] 400 – invalid developerHandle',
            )
            return reply.status(400).send({
              message: 'developerHandle must be 2–30 lowercase alphanumeric characters or hyphens',
              code: 'VALIDATION_ERROR',
            })
          }
          // Check uniqueness
          const conflict = await server.prisma.user.findFirst({
            where: { handle, NOT: { id: userId } },
            select: { id: true },
          })
          if (conflict) {
            return reply.status(409).send({ message: 'developerHandle already taken', code: 'CONFLICT' })
          }
        }
        data.handle = handle as string | null
      }

      if ('full_name' in b) data.name = b.full_name as string | null
      if ('company' in b) data.company = b.company as string | null
      if ('facebook' in b) data.facebook = b.facebook as string | null
      if ('whatsapp' in b) data.whatsapp = b.whatsapp as string | null
      if ('avatarUrl' in b) data.avatarUrl = b.avatarUrl as string | null
      // Privilege escalation guard: userType, onboardingComplete, role,
      // canPublishAddons, partnerLeaderCode, and uplinePartnerLeaderId are
      // intentionally excluded. These are managed by server-side controlled flows
      // (setMyRole, admin endpoints) and must never be user-settable.

      try {
        const user = await server.prisma.user.update({ where: { id: userId }, data })
        return reply.send(serializeUser(user))
      } catch {
        return reply.status(404).send({ message: 'User not found', code: 'NOT_FOUND' })
      }
    },
  )

  // ── Entity list / filter ───────────────────────────────────────────────────
  server.get<{
    Params: { entity: string }
    Querystring: { q?: string; sort?: string; limit?: string; skip?: string }
  }>(
    '/entities/:entity',
    async (request, reply) => {
      const { entity } = request.params
      const { q, sort, limit, skip } = request.query
      const take = limit ? parseInt(limit, 10) : undefined
      const skp  = skip  ? parseInt(skip,  10) : undefined

      if (entity === 'Addons') {
        let addonWhere: Prisma.AddonWhereInput = {}
        if (q) {
          try {
            const f = JSON.parse(q) as Record<string, unknown>
            if (typeof f.id === 'string')          addonWhere.id          = f.id
            if (typeof f.status === 'string')      addonWhere.status      = f.status
            if (typeof f.slug === 'string')        addonWhere.slug        = f.slug
            if (typeof f.ownerUserId === 'string') addonWhere.ownerUserId = f.ownerUserId
            if (typeof f.developerHandle === 'string') {
              const u = await server.prisma.user.findUnique({
                where: { handle: f.developerHandle },
                select: { id: true },
              })
              if (!u) return reply.send([])
              addonWhere.ownerUserId = u.id
            }
          } catch { /* bad JSON — ignore */ }
        }
        const rows = await server.prisma.addon.findMany({
          where: addonWhere,
          orderBy: addonOrderByFromSort(sort),
          take, skip: skp,
        })
        return reply.send(rows.map(r => serializeAddon(r)))
      }

      if (entity === 'DeveloperProfiles') {
        let dpWhere: Prisma.DeveloperProfileWhereInput = {}
        if (q) {
          try {
            const f = JSON.parse(q) as Record<string, unknown>
            if (typeof f.id === 'string')          dpWhere.id          = f.id
            if (typeof f.userId === 'string')      dpWhere.userId      = f.userId
            if (typeof f.displayName === 'string') dpWhere.displayName = f.displayName
            if (typeof f.developerHandle === 'string') {
              const u = await server.prisma.user.findUnique({
                where: { handle: f.developerHandle },
                select: { id: true },
              })
              if (!u) return reply.send([])
              dpWhere.userId = u.id
            }
          } catch { /* bad JSON — ignore */ }
        }
        const rows = await server.prisma.developerProfile.findMany({
          where: dpWhere,
          orderBy: { createdAt: 'desc' },
          take, skip: skp,
          include: { user: { select: { handle: true } } },
        })
        return reply.send(rows.map(r => serializeDeveloperProfile(r)))
      }

      if (entity === 'User') {
        const userSecret = getAuthSecret()
        if (!userSecret) return reply.status(500).send({ message: 'AUTH_SECRET not configured', code: 'SERVER_ERROR' })
        const callerId = getAuthUserId(request, userSecret)
        if (!callerId) return reply.status(401).send({ message: 'Unauthorized', code: 'auth_required' })

        const rows = await server.prisma.user.findMany({
          where: userWhereFromQuery(q),
          orderBy: { createdAt: 'desc' },
          take, skip: skp,
        })
        return reply.send(rows.map(serializeUser))
      }

      return reply.status(404).send({ message: 'Unknown entity', code: 'NOT_FOUND' })
    },
  )

  // ── Entity get by id ───────────────────────────────────────────────────────
  server.get<{ Params: { entity: string; id: string } }>(
    '/entities/:entity/:id',
    async (request, reply) => {
      const { entity, id } = request.params

      if (entity === 'Addons') {
        const row = await server.prisma.addon.findUnique({ where: { id } })
        if (!row) return reply.status(404).send({ message: 'Not found', code: 'NOT_FOUND' })
        return reply.send(serializeAddon(row))
      }

      if (entity === 'DeveloperProfiles') {
        const row = await server.prisma.developerProfile.findUnique({
          where: { id },
          include: { user: { select: { handle: true } } },
        })
        if (!row) return reply.status(404).send({ message: 'Not found', code: 'NOT_FOUND' })
        return reply.send(serializeDeveloperProfile(row))
      }

      return reply.status(404).send({ message: 'Not found', code: 'NOT_FOUND' })
    },
  )

  // ── Entity create ──────────────────────────────────────────────────────────
  server.post<{
    Params: { entity: string }
    Body: Record<string, unknown>
  }>(
    '/entities/:entity',
    async (request, reply) => {
      const { entity } = request.params
      const b = request.body ?? {}

      if (entity === 'Addons') {
        // ── Auth: JWT required ────────────────────────────────────────────────
        const addonSecret = getAuthSecret()
        if (!addonSecret) return reply.status(500).send({ message: 'AUTH_SECRET not configured', code: 'SERVER_ERROR' })
        const addonActorId = getAuthUserId(request, addonSecret)
        if (!addonActorId) return reply.status(401).send({ message: 'Unauthorized', code: 'auth_required' })

        const addonActor = await server.prisma.user.findUnique({
          where: { id: addonActorId },
          select: { id: true, email: true, canPublishAddons: true },
        })
        if (!addonActor) return reply.status(401).send({ message: 'User not found', code: 'auth_required' })

        const addonActorIsAdmin = isAdminUser(addonActor)
        if (!addonActorIsAdmin && !addonActor.canPublishAddons) {
          return reply.status(403).send({ message: 'No tienes permiso para publicar add-ons', code: 'FORBIDDEN' })
        }

        // Slug: use provided or derive from name
        let slug = typeof b.slug === 'string' && b.slug ? b.slug : ''
        if (!slug) {
          const base = String(b.name ?? 'addon')
            .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60)
          slug = `${base}-${Date.now().toString(36)}`
        }
        const existingSlug = await server.prisma.addon.findUnique({ where: { slug } })
        if (existingSlug) return reply.status(409).send({ message: 'slug already exists', code: 'CONFLICT' })

        // Owner: admin may set ownerUserId from body; everyone else uses their own id
        let ownerUserId = addonActorId
        if (addonActorIsAdmin && typeof b.ownerUserId === 'string' && b.ownerUserId) {
          const found = await server.prisma.user.findUnique({ where: { id: b.ownerUserId }, select: { id: true } })
          if (found) ownerUserId = found.id
        }

        const addon = await server.prisma.addon.create({
          data: {
            slug,
            name: String(b.name ?? 'Untitled'),
            summary: typeof b.summary === 'string' ? b.summary : null,
            description: typeof b.description === 'string' ? b.description : null,
            vendor: typeof b.vendor === 'string' ? b.vendor : null,
            contpaqi: Boolean(b.contpaqi),
            softrestaurant: Boolean(b.softrestaurant),
            status: typeof b.status === 'string' ? b.status : 'draft',
            manufacturer: typeof b.manufacturer === 'string' ? b.manufacturer : null,
            system: typeof b.system === 'string' ? b.system : null,
            classification: typeof b.classification === 'string' ? b.classification : 'propuesta',
            tags: Array.isArray(b.tags) ? (b.tags as string[]).slice(0, 3) : [],
            priceFrom: typeof b.priceFrom === 'number' ? b.priceFrom : null,
            licenseType: Array.isArray(b.licenseType) ? (b.licenseType as string[]) : [],
            licenseDescription: typeof b.licenseDescription === 'string' ? b.licenseDescription : null,
            youtubeLinks: Array.isArray(b.youtubeLinks) ? (b.youtubeLinks as string[]) : [],
            images: Array.isArray(b.images) ? (b.images as string[]) : [],
            coverImage: typeof b.coverImage === 'string' ? b.coverImage : null,
            website: typeof b.website === 'string' ? b.website : null,
            contactEmail: typeof b.contactEmail === 'string' ? b.contactEmail : null,
            contactWhatsApp: typeof b.contactWhatsApp === 'string' ? b.contactWhatsApp : null,
            ownerUserId,
          },
        })
        // Notify on submission (status='pending') — fire-and-forget
        if (addon.status === 'pending') {
          void notifyAddonSubmitted(server.prisma, addon.id)
        }

        return reply.status(201).send(serializeAddon(addon))
      }

      if (entity === 'DeveloperProfiles') {
        // ── Auth: JWT required ────────────────────────────────────────────────
        const dpSecret = getAuthSecret()
        if (!dpSecret) return reply.status(500).send({ message: 'AUTH_SECRET not configured', code: 'SERVER_ERROR' })
        const dpActorId = getAuthUserId(request, dpSecret)
        if (!dpActorId) return reply.status(401).send({ message: 'Unauthorized', code: 'auth_required' })

        const dpActor = await server.prisma.user.findUnique({
          where: { id: dpActorId },
          select: { id: true, email: true, role: true, userType: true },
        })
        if (!dpActor) return reply.status(401).send({ message: 'User not found', code: 'auth_required' })

        const dpActorIsAdmin = isAdminUser(dpActor)
        const canHaveDevProfile = dpActorIsAdmin || dpActor.userType === 'developer' || dpActor.userType === 'partner_leader'
        if (!canHaveDevProfile) {
          return reply.status(403).send({
            message: 'Solo developers y Partner Líderes pueden crear un perfil de developer',
            code: 'FORBIDDEN',
          })
        }

        // Owner: admin may target another userId; everyone else owns their own profile
        let dpUserId = dpActorId
        if (dpActorIsAdmin && typeof b.userId === 'string' && b.userId) {
          const found = await server.prisma.user.findUnique({ where: { id: b.userId }, select: { id: true } })
          if (found) dpUserId = found.id
        }

        // One profile per user — upsert so duplicate creates don't crash
        const profile = await server.prisma.developerProfile.upsert({
          where: { userId: dpUserId },
          include: { user: { select: { handle: true } } },
          create: {
            userId: dpUserId,
            displayName: typeof b.displayName === 'string' ? b.displayName : 'Developer',
            bio: typeof b.bio === 'string' ? b.bio : null,
            website: typeof b.website === 'string' ? b.website : null,
            whatsapp: typeof b.whatsapp === 'string' ? b.whatsapp : null,
            supportEmail: typeof b.supportEmail === 'string' ? b.supportEmail : null,
            contpaqi: Boolean(b.contpaqi),
            softrestaurant: Boolean(b.softrestaurant),
            logoUrl: typeof b.logoUrl === 'string' ? b.logoUrl : null,
            location: typeof b.location === 'string' ? b.location : null,
            services: typeof b.services === 'string' ? b.services : null,
            responseTime: typeof b.responseTime === 'string' ? b.responseTime : null,
          },
          update: {
            displayName: typeof b.displayName === 'string' ? b.displayName : undefined,
            bio: typeof b.bio === 'string' ? b.bio : undefined,
            website: typeof b.website === 'string' ? b.website : undefined,
            whatsapp: typeof b.whatsapp === 'string' ? b.whatsapp : undefined,
            supportEmail: typeof b.supportEmail === 'string' ? b.supportEmail : undefined,
            contpaqi: typeof b.contpaqi === 'boolean' ? b.contpaqi : undefined,
            softrestaurant: typeof b.softrestaurant === 'boolean' ? b.softrestaurant : undefined,
            logoUrl: typeof b.logoUrl === 'string' ? b.logoUrl : undefined,
            location: typeof b.location === 'string' ? b.location : undefined,
            services: typeof b.services === 'string' ? b.services : undefined,
            responseTime: typeof b.responseTime === 'string' ? b.responseTime : undefined,
          },
        })
        return reply.status(201).send(serializeDeveloperProfile(profile))
      }

      return reply.status(404).send({ message: 'Unknown entity', code: 'NOT_FOUND' })
    },
  )

  // ── Entity update ──────────────────────────────────────────────────────────────
  server.put<{
    Params: { entity: string; id: string }
    Body: Record<string, unknown>
  }>(
    '/entities/:entity/:id',
    async (request, reply) => {
      const { entity, id } = request.params
      const b = request.body ?? {}

      if (!new Set(['Addons', 'DeveloperProfiles', 'User']).has(entity)) {
        return reply.status(404).send({ message: 'Unknown entity', code: 'NOT_FOUND' })
      }

      const secret = getAuthSecret()
      if (!secret) return reply.status(500).send({ message: 'Server misconfiguration', code: 'SERVER_ERROR' })

      const userId = getAuthUserId(request, secret)
      if (!userId) return reply.status(401).send({ message: 'Unauthorized', code: 'auth_required' })

      const currentUser = await server.prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true, canPublishAddons: true },
      })
      if (!currentUser) return reply.status(401).send({ message: 'Unauthorized', code: 'auth_required' })

      const isAdmin = isAdminUser(currentUser)

      if (entity === 'Addons') {
        const addon = await server.prisma.addon.findUnique({ where: { id }, select: { ownerUserId: true, status: true } })
        if (!addon) return reply.status(404).send({ message: 'Not found', code: 'NOT_FOUND' })
        const isOwner = addon.ownerUserId === userId
        if (!isAdmin && !(isOwner && currentUser.canPublishAddons)) {
          return reply.status(403).send({ message: 'Forbidden', code: 'FORBIDDEN' })
        }
        const fromStatus = addon.status
        const data: Prisma.AddonUpdateInput = {}
        if ('name' in b) data.name = String(b.name)
        if ('summary' in b) data.summary = b.summary as string | null
        if ('description' in b) data.description = b.description as string | null
        if ('vendor' in b) data.vendor = b.vendor as string | null
        if ('contpaqi' in b) data.contpaqi = Boolean(b.contpaqi)
        if ('softrestaurant' in b) data.softrestaurant = Boolean(b.softrestaurant)
        // Only admin can change status (approve/reject)
        if ('status' in b && isAdmin) data.status = String(b.status)
        if ('manufacturer' in b) data.manufacturer = b.manufacturer as string | null
        if ('system' in b) data.system = b.system as string | null
        if ('classification' in b) data.classification = String(b.classification)
        if ('tags' in b) data.tags = Array.isArray(b.tags) ? (b.tags as string[]).slice(0, 3) : []
        if ('priceFrom' in b) data.priceFrom = typeof b.priceFrom === 'number' ? b.priceFrom : null
        if ('licenseType' in b) data.licenseType = Array.isArray(b.licenseType) ? (b.licenseType as string[]) : []
        if ('licenseDescription' in b) data.licenseDescription = typeof b.licenseDescription === 'string' ? b.licenseDescription : null
        if ('youtubeLinks' in b) data.youtubeLinks = Array.isArray(b.youtubeLinks) ? (b.youtubeLinks as string[]) : []
        if ('images' in b) data.images = Array.isArray(b.images) ? (b.images as string[]) : []
        if ('coverImage' in b) data.coverImage = b.coverImage as string | null
        if ('website' in b) data.website = b.website as string | null
        if ('contactEmail' in b) data.contactEmail = b.contactEmail as string | null
        if ('contactWhatsApp' in b) data.contactWhatsApp = b.contactWhatsApp as string | null
        try {
          const updated = await server.prisma.addon.update({ where: { id }, data })
          // Notify developer when admin changes status — fire-and-forget
          if (isAdmin && 'status' in b && typeof b.status === 'string' && b.status !== fromStatus) {
            const reason = typeof b.reason === 'string' ? b.reason : undefined
            void notifyAddonStatusChanged(server.prisma, {
              addonId: id,
              fromStatus,
              toStatus: b.status,
              reason,
            })
          }
          return reply.send(serializeAddon(updated))
        } catch {
          return reply.status(404).send({ message: 'Not found', code: 'NOT_FOUND' })
        }
      }

      if (entity === 'DeveloperProfiles') {
        const profile = await server.prisma.developerProfile.findUnique({ where: { id }, select: { userId: true } })
        if (!profile) return reply.status(404).send({ message: 'Not found', code: 'NOT_FOUND' })
        if (!isAdmin && profile.userId !== userId) {
          return reply.status(403).send({ message: 'Forbidden', code: 'FORBIDDEN' })
        }
        const data: Prisma.DeveloperProfileUpdateInput = {}
        if ('displayName' in b) data.displayName = String(b.displayName)
        if ('bio' in b) data.bio = b.bio as string | null
        if ('website' in b) data.website = b.website as string | null
        if ('whatsapp' in b) data.whatsapp = b.whatsapp as string | null
        if ('supportEmail' in b) data.supportEmail = b.supportEmail as string | null
        if ('contpaqi' in b) data.contpaqi = Boolean(b.contpaqi)
        if ('softrestaurant' in b) data.softrestaurant = Boolean(b.softrestaurant)
        if ('logoUrl' in b) data.logoUrl = b.logoUrl as string | null
        if ('location' in b) data.location = b.location as string | null
        if ('services' in b) data.services = b.services as string | null
        if ('responseTime' in b) data.responseTime = b.responseTime as string | null
        try {
          const updated = await server.prisma.developerProfile.update({
            where: { id }, data,
            include: { user: { select: { handle: true } } },
          })
          return reply.send(serializeDeveloperProfile(updated))
        } catch {
          return reply.status(404).send({ message: 'Not found', code: 'NOT_FOUND' })
        }
      }

      if (entity === 'User') {
        if (!isAdmin) return reply.status(403).send({ message: 'Forbidden', code: 'FORBIDDEN' })

        // Block role updates — always ignored, with audit log
        if ('role' in b) {
          server.log.warn({ callerId: userId, targetUserId: id }, '[admin] attempted role update blocked')
        }

        // Validate fields before building update
        const VALID_USER_TYPES = ['unset', 'partner', 'developer', 'partner_leader']
        if ('userType' in b && !VALID_USER_TYPES.includes(b.userType as string)) {
          return reply.status(400).send({ message: 'Invalid userType', code: 'VALIDATION_ERROR' })
        }
        if ('developerHandle' in b && b.developerHandle !== null &&
            (typeof b.developerHandle !== 'string' || !/^[a-z0-9-]{2,30}$/.test(b.developerHandle))) {
          return reply.status(400).send({ message: 'Invalid developerHandle', code: 'VALIDATION_ERROR' })
        }
        if ('canPublishAddons' in b && typeof b.canPublishAddons !== 'boolean') {
          return reply.status(400).send({ message: 'canPublishAddons must be boolean', code: 'VALIDATION_ERROR' })
        }
        if ('onboardingComplete' in b && typeof b.onboardingComplete !== 'boolean') {
          return reply.status(400).send({ message: 'onboardingComplete must be boolean', code: 'VALIDATION_ERROR' })
        }

        // Whitelist: role is intentionally excluded
        const data: Prisma.UserUpdateInput = {}
        if ('userType' in b) data.userType = String(b.userType)
        if ('onboardingComplete' in b) data.onboardingComplete = b.onboardingComplete as boolean
        if ('name' in b) data.name = typeof b.name === 'string' ? b.name.trim() : null
        if ('full_name' in b) data.name = typeof b.full_name === 'string' ? (b.full_name as string).trim() : null
        if ('company' in b) data.company = typeof b.company === 'string' ? b.company.trim() : null
        if ('developerHandle' in b) data.handle = b.developerHandle as string | null
        if ('canPublishAddons' in b) data.canPublishAddons = b.canPublishAddons as boolean
        if ('partnerLeaderCode' in b) data.partnerLeaderCode = b.partnerLeaderCode as string | null
        if ('uplinePartnerLeaderId' in b) {
          const uplineId = b.uplinePartnerLeaderId as string | null
          data.uplinePartnerLeader = uplineId ? { connect: { id: uplineId } } : { disconnect: true }
        }
        try {
          const user = await server.prisma.user.update({ where: { id }, data })
          return reply.send(serializeUser(user))
        } catch {
          return reply.status(404).send({ message: 'Not found', code: 'NOT_FOUND' })
        }
      }

      return reply.status(404).send({ message: 'Unknown entity', code: 'NOT_FOUND' })
    },
  )

  // ── Entity delete ──────────────────────────────────────────────────────────────
  server.delete<{ Params: { entity: string; id: string } }>(
    '/entities/:entity/:id',
    async (request, reply) => {
      const { entity, id } = request.params

      if (!new Set(['Addons', 'DeveloperProfiles']).has(entity)) {
        return reply.status(404).send({ message: 'Unknown entity', code: 'NOT_FOUND' })
      }

      const secret = getAuthSecret()
      if (!secret) return reply.status(500).send({ message: 'Server misconfiguration', code: 'SERVER_ERROR' })

      const userId = getAuthUserId(request, secret)
      if (!userId) return reply.status(401).send({ message: 'Unauthorized', code: 'auth_required' })

      const currentUser = await server.prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true },
      })
      if (!currentUser) return reply.status(401).send({ message: 'Unauthorized', code: 'auth_required' })

      const isAdmin = isAdminUser(currentUser)
      try {
        if (entity === 'Addons') {
          const addon = await server.prisma.addon.findUnique({ where: { id }, select: { ownerUserId: true } })
          if (!addon) return reply.status(404).send({ message: 'Not found', code: 'NOT_FOUND' })
          if (!isAdmin && addon.ownerUserId !== userId) {
            return reply.status(403).send({ message: 'Forbidden', code: 'FORBIDDEN' })
          }
          await server.prisma.addon.delete({ where: { id } })
        } else if (entity === 'DeveloperProfiles') {
          const profile = await server.prisma.developerProfile.findUnique({ where: { id }, select: { userId: true } })
          if (!profile) return reply.status(404).send({ message: 'Not found', code: 'NOT_FOUND' })
          if (!isAdmin && profile.userId !== userId) {
            return reply.status(403).send({ message: 'Forbidden', code: 'FORBIDDEN' })
          }
          await server.prisma.developerProfile.delete({ where: { id } })
        }
      } catch { /* already gone */ }
      return reply.status(204).send()
    },
  )

  // ── Functions: ensureExtendedUser ──────────────────────────────────────────
  server.post(
    '/functions/ensureExtendedUser',
    async (request, reply) => {
      const secret = getAuthSecret()
      // If no secret configured, can't validate — return success:false
      if (!secret) return reply.send({ success: false })

      const userId = getAuthUserId(request, secret)
      if (!userId) return reply.send({ success: false })

      const user = await server.prisma.user.findUnique({ where: { id: userId } })
      if (!user) return reply.send({ success: false })

      return reply.send({ success: true, user: serializeUser(user) })
    },
  )

  // ── Functions: setMyRole ───────────────────────────────────────────
  server.post<{
    Body: { role?: string }
  }>(
    '/functions/setMyRole',
    async (request, reply) => {
      const secret = getAuthSecret()
      if (!secret) return reply.status(500).send({ message: 'AUTH_SECRET not configured', code: 'SERVER_ERROR' })

      const userId = getAuthUserId(request, secret)
      if (!userId) return reply.status(401).send({ message: 'Unauthorized', code: 'auth_required' })

      const current = await server.prisma.user.findUnique({
        where: { id: userId },
        select: { userType: true, handle: true, name: true, partnerLeaderCode: true },
      })
      if (!current) return reply.status(401).send({ message: 'Unauthorized', code: 'auth_required' })

      // Block re-enrollment once a role has been chosen
      if (current.userType !== 'unset') {
        return reply.status(409).send({ message: 'Role already set', code: 'ROLE_ALREADY_SET' })
      }

      const { role } = request.body ?? {}
      const VALID_ROLES = ['developer', 'partner', 'partner_leader']
      if (typeof role !== 'string' || !VALID_ROLES.includes(role)) {
        return reply.status(400).send({
          message: `role must be one of: ${VALID_ROLES.join(', ')}`,
          code: 'VALIDATION_ERROR',
        })
      }

      const data: Record<string, unknown> = { userType: role, onboardingComplete: true }

      if (role === 'developer') {
        data.canPublishAddons = true
        data.uplinePartnerLeaderId = null   // clear any provisional upline
      } else if (role === 'partner_leader') {
        data.canPublishAddons = true
        data.uplinePartnerLeaderId = null   // leaders don't have an upline
        // Auto-generate unique invite code if not already set
        if (!current.partnerLeaderCode) {
          data.partnerLeaderCode = await generatePartnerLeaderCode(server.prisma, current)
        }
      }

      const user = await server.prisma.user.update({ where: { id: userId }, data })
      return reply.send({ success: true, user: serializeUser(user) })
    },
  )

  // ── Functions: linkPartnerUpline ───────────────────────────────────────
  server.post<{
    Body: { code?: string }
  }>(
    '/functions/linkPartnerUpline',
    async (request, reply) => {
      const secret = getAuthSecret()
      if (!secret) return reply.status(500).send({ message: 'AUTH_SECRET not configured', code: 'SERVER_ERROR' })

      const userId = getAuthUserId(request, secret)
      if (!userId) return reply.status(401).send({ message: 'Unauthorized', code: 'auth_required' })

      const { code } = request.body ?? {}
      if (typeof code !== 'string' || !code.trim()) {
        return reply.status(400).send({ message: 'code is required', code: 'VALIDATION_ERROR' })
      }

      const user = await server.prisma.user.findUnique({
        where: { id: userId },
        select: { userType: true },
      })
      if (!user) return reply.status(401).send({ message: 'Unauthorized', code: 'auth_required' })

      if (user.userType !== 'partner') {
        return reply.status(400).send({ success: false, reason: 'NOT_PARTNER' })
      }

      const leader = await server.prisma.user.findUnique({
        where: { partnerLeaderCode: code },
        select: { id: true, userType: true },
      })
      if (!leader || leader.userType !== 'partner_leader') {
        return reply.send({ success: false, reason: 'INVALID_CODE' })
      }
      if (leader.id === userId) {
        return reply.status(400).send({ success: false, reason: 'SELF_REFERRAL' })
      }

      // Atomic set-if-null: avoids race between concurrent requests
      const result = await server.prisma.user.updateMany({
        where: { id: userId, uplinePartnerLeaderId: null },
        data: { uplinePartnerLeaderId: leader.id },
      })
      if (result.count === 0) {
        return reply.send({ success: true, alreadyLinked: true })
      }
      return reply.send({ success: true })
    },
  )

  // ── Functions: requestPartnerLeader (DEPRECATED) ─────────────────────────────────────
  // Partner Líder is now selected directly via setMyRole('partner_leader'). No approval needed.
  server.post(
    '/functions/requestPartnerLeader',
    async (_request, reply) => {
      return reply.send({
        success: true,
        note: 'Approval flow removed. Use setMyRole with role=partner_leader instead.',
        code: 'DEPRECATED',
      })
    },
  )

  // ── Functions: approvePartnerLeader (DEPRECATED) ─────────────────────────────────────
  // Approval flow removed. Partner Líder is now self-selected via setMyRole('partner_leader').
  server.post(
    '/functions/approvePartnerLeader',
    async (_request, reply) => {
      return reply.send({
        success: false,
        code: 'DEPRECATED',
        note: 'Approval flow removed. Partner Líder is now self-selected via setMyRole.',
      })
    },
  )

  // ── Functions: rejectPartnerLeader (DEPRECATED) ───────────────────────────────────────
  // Approval flow removed. Partner Líder is now self-selected via setMyRole('partner_leader').
  server.post(
    '/functions/rejectPartnerLeader',
    async (_request, reply) => {
      return reply.send({
        success: false,
        code: 'DEPRECATED',
        note: 'Approval flow removed. Partner Líder is now self-selected via setMyRole.',
      })
    },
  )

  // ── Functions: listPartnerLeaderRequests (DEPRECATED) ─────────────────────────────────
  // Approval flow removed. Partner Líder is now self-selected. Always returns empty list.
  server.post(
    '/functions/listPartnerLeaderRequests',
    async (_request, reply) => {
      return reply.send({ success: true, requests: [], note: 'DEPRECATED: approval flow removed' })
    },
  )

  // ── Functions: lookupPartnerLeader (GET, public) ───────────────────────────
  server.get<{
    Querystring: { code?: string }
  }>(
    '/functions/lookupPartnerLeader',
    async (request, reply) => {
      const { code } = request.query
      if (!code) return reply.status(400).send({ message: 'code query param required', code: 'VALIDATION_ERROR' })

      const leader = await server.prisma.user.findUnique({
        where: { partnerLeaderCode: code },
        select: { id: true, name: true, handle: true, avatarUrl: true, userType: true },
      })
      if (!leader || leader.userType !== 'partner_leader') {
        return reply.status(404).send({ message: 'Partner Leader not found', code: 'NOT_FOUND' })
      }
      return reply.send({ success: true, leader: { id: leader.id, name: leader.name, handle: leader.handle, avatarUrl: leader.avatarUrl } })
    },
  )

  // ── Avatar upload ──────────────────────────────────────────────────────────
  server.post(
    '/uploads/avatar',
    async (request, reply) => {
      const secret = getAuthSecret()
      if (!secret) return reply.status(500).send({ message: 'AUTH_SECRET not configured', code: 'SERVER_ERROR' })
      const userId = getAuthUserId(request, secret)
      if (!userId) return reply.status(401).send({ message: 'Unauthorized', code: 'auth_required' })

      const data = await request.file()
      if (!data) return reply.status(400).send({ message: 'No file uploaded', code: 'VALIDATION_ERROR' })

      const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
      if (!ALLOWED_TYPES.includes(data.mimetype)) {
        return reply.status(400).send({ message: 'Only jpeg, png, or webp images are allowed', code: 'VALIDATION_ERROR' })
      }

      const extMap: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }
      const ext = extMap[data.mimetype]
      const saveName = `${crypto.randomUUID()}.${ext}`
      const avatarsDir = path.join(UPLOAD_DIR, 'avatars')

      await fs.mkdir(avatarsDir, { recursive: true })
      await pipeline(data.file, createWriteStream(path.join(avatarsDir, saveName)))

      return reply.send({ url: `/api/uploads/avatars/${saveName}` })
    },
  )

  // ── Addon cover upload ────────────────────────────────────────────────────
  server.post(
    '/uploads/addons/cover',
    async (request, reply) => {
      const secret = getAuthSecret()
      if (!secret) return reply.status(500).send({ message: 'AUTH_SECRET not configured', code: 'SERVER_ERROR' })
      const userId = getAuthUserId(request, secret)
      if (!userId) return reply.status(401).send({ message: 'Unauthorized', code: 'auth_required' })

      const data = await request.file()
      if (!data) return reply.status(400).send({ message: 'No se proporcionó ningún archivo', code: 'VALIDATION_ERROR' })

      const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
      if (!ALLOWED_TYPES.includes(data.mimetype)) {
        data.file.resume()
        return reply.status(400).send({ message: 'Solo se permiten imágenes jpeg, png o webp', code: 'VALIDATION_ERROR' })
      }

      const MAX_SIZE = 2 * 1024 * 1024
      const chunks: Buffer[] = []
      let totalSize = 0
      let tooBig = false

      for await (const chunk of data.file) {
        totalSize += (chunk as Buffer).length
        if (totalSize > MAX_SIZE) {
          tooBig = true
        } else {
          chunks.push(chunk as Buffer)
        }
      }

      if (tooBig || data.file.truncated) {
        return reply.status(400).send({ message: 'La imagen no debe superar 2MB', code: 'VALIDATION_ERROR' })
      }

      const extMap: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }
      const ext = extMap[data.mimetype]
      const saveName = `${crypto.randomUUID()}-${Date.now()}.${ext}`
      const coversDir = path.join(UPLOAD_DIR, 'addons', 'covers')

      await fs.mkdir(coversDir, { recursive: true })
      await fs.writeFile(path.join(coversDir, saveName), Buffer.concat(chunks))

      return reply.send({ url: `/api/uploads/addons/covers/${saveName}` })
    },
  )

  // ── Addon gallery images upload ───────────────────────────────────────────
  server.post(
    '/uploads/addons/images',
    async (request, reply) => {
      const secret = getAuthSecret()
      if (!secret) return reply.status(500).send({ message: 'AUTH_SECRET not configured', code: 'SERVER_ERROR' })
      const userId = getAuthUserId(request, secret)
      if (!userId) return reply.status(401).send({ message: 'Unauthorized', code: 'auth_required' })

      const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
      const MAX_SIZE = 2 * 1024 * 1024
      const extMap: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }
      const imagesDir = path.join(UPLOAD_DIR, 'addons', 'images')
      await fs.mkdir(imagesDir, { recursive: true })

      const urls: string[] = []
      let errorMsg: { status: number; body: object } | null = null

      try {
        for await (const part of request.files()) {
          if (errorMsg) {
            part.file.resume()
            continue
          }
          if (urls.length >= 5) {
            part.file.resume()
            continue
          }

          if (!ALLOWED_TYPES.includes(part.mimetype)) {
            errorMsg = { status: 400, body: { message: 'Solo se permiten imágenes jpeg, png o webp', code: 'VALIDATION_ERROR' } }
            part.file.resume()
            continue
          }

          const chunks: Buffer[] = []
          let totalSize = 0
          let tooBig = false

          for await (const chunk of part.file) {
            totalSize += (chunk as Buffer).length
            if (totalSize > MAX_SIZE) {
              tooBig = true
            } else {
              chunks.push(chunk as Buffer)
            }
          }

          if (tooBig || part.file.truncated) {
            errorMsg = { status: 400, body: { message: 'Cada imagen no debe superar 2MB', code: 'VALIDATION_ERROR' } }
            continue
          }

          const ext = extMap[part.mimetype]
          const saveName = `${crypto.randomUUID()}-${Date.now()}.${ext}`
          await fs.writeFile(path.join(imagesDir, saveName), Buffer.concat(chunks))
          urls.push(`/api/uploads/addons/images/${saveName}`)
        }
      } catch (err: unknown) {
        const code = (err as { code?: string }).code
        if (code === 'FST_REQ_FILE_TOO_LARGE') {
          return reply.status(400).send({ message: 'Cada imagen no debe superar 2MB', code: 'VALIDATION_ERROR' })
        }
        throw err
      }

      if (errorMsg) return reply.status(errorMsg.status).send(errorMsg.body)
      if (urls.length === 0) return reply.status(400).send({ message: 'No se proporcionaron imágenes', code: 'VALIDATION_ERROR' })

      return reply.send({ urls })
    },
  )

  // ── Developer logo upload ──────────────────────────────────────────────────
  server.post(
    '/uploads/developer-logo',
    async (request, reply) => {
      const secret = getAuthSecret()
      if (!secret) return reply.status(500).send({ message: 'AUTH_SECRET not configured', code: 'SERVER_ERROR' })
      const userId = getAuthUserId(request, secret)
      if (!userId) return reply.status(401).send({ message: 'Unauthorized', code: 'auth_required' })

      const data = await request.file()
      if (!data) return reply.status(400).send({ message: 'No se proporcionó ningún archivo', code: 'VALIDATION_ERROR' })

      const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
      if (!ALLOWED_TYPES.includes(data.mimetype)) {
        data.file.resume()
        return reply.status(400).send({ message: 'Solo se permiten imágenes jpeg, png o webp', code: 'VALIDATION_ERROR' })
      }

      const MAX_SIZE = 2 * 1024 * 1024
      const chunks: Buffer[] = []
      let totalSize = 0
      let tooBig = false

      for await (const chunk of data.file) {
        totalSize += (chunk as Buffer).length
        if (totalSize > MAX_SIZE) {
          tooBig = true
        } else {
          chunks.push(chunk as Buffer)
        }
      }

      if (tooBig || data.file.truncated) {
        return reply.status(400).send({ message: 'El logo no debe superar 2MB', code: 'VALIDATION_ERROR' })
      }

      const extMap: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }
      const ext = extMap[data.mimetype]
      const saveName = `${crypto.randomUUID()}-${Date.now()}.${ext}`
      const logosDir = path.join(UPLOAD_DIR, 'developers', 'logos')

      await fs.mkdir(logosDir, { recursive: true })
      await fs.writeFile(path.join(logosDir, saveName), Buffer.concat(chunks))

      return reply.send({ url: `/api/uploads/developers/logos/${saveName}` })
    },
  )

  // ── Functions: registerAddonView ──────────────────────────────────────────
  server.post<{
    Body: { addonId?: string; slug?: string }
  }>(
    '/functions/registerAddonView',
    { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const { addonId: rawAddonId, slug } = (request.body ?? {}) as { addonId?: string; slug?: string }

      let addonId = rawAddonId
      if (!addonId && slug) {
        const found = await server.prisma.addon.findUnique({ where: { slug } })
        if (!found) {
          return reply.status(404).send({ success: false, error: 'Addon not found' })
        }
        addonId = found.id
      }
      if (!addonId) {
        return reply.status(404).send({ success: false, error: 'Addon not found' })
      }

      const secret = getAuthSecret()
      let userId: string | null = null
      if (secret) {
        userId = getAuthUserId(request, secret) ?? null
      }

      const ip = typeof request.ip === 'string' ? request.ip : null

      await server.prisma.addonView.create({ data: { addonId, userId, ip } })
      server.log.info({ addonId, userId }, '[registerAddonView] ok')
      return reply.send({ success: true })
    },
  )

  // ── Functions: registerContactEvent ───────────────────────────────────────
  server.post<{
    Body: { addonId?: string; slug?: string; channel?: string }
  }>(
    '/functions/registerContactEvent',
    { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const { addonId: rawAddonId, slug } = (request.body ?? {}) as { addonId?: string; slug?: string; channel?: string }

      let addonId = rawAddonId
      if (!addonId && slug) {
        const found = await server.prisma.addon.findUnique({ where: { slug } })
        if (!found) {
          return reply.status(404).send({ success: false, error: 'Addon not found' })
        }
        addonId = found.id
      }
      if (!addonId) {
        return reply.status(404).send({ success: false, error: 'Addon not found' })
      }

      const secret = getAuthSecret()
      let userId: string | null = null
      if (secret) {
        userId = getAuthUserId(request, secret) ?? null
      }

      const ip = typeof request.ip === 'string' ? request.ip : null

      await server.prisma.contactEvent.create({ data: { addonId, userId, ip } })
      server.log.info({ addonId, userId }, '[registerContactEvent] ok')
      return reply.send({ success: true })
    },
  )

  // ── Functions: getDeveloperAddonStats ─────────────────────────────────────
  server.post(
    '/functions/getDeveloperAddonStats',
    async (request, reply) => {
      const secret = getAuthSecret()
      if (!secret) return reply.status(500).send({ error: 'SERVER_ERROR' })

      const userId = getAuthUserId(request, secret)
      if (!userId) return reply.status(401).send({ error: 'UNAUTHORIZED' })

      try {
        const addons = await server.prisma.addon.findMany({
          where: { ownerUserId: userId },
          select: { id: true, name: true, slug: true },
        })

        if (addons.length === 0) {
          return reply.send({ totalViews: 0, totalContacts: 0, topViewed: [], topContacted: [] })
        }

        const addonIds = addons.map(a => a.id)
        const addonMap = new Map(addons.map(a => [a.id, a]))

        const [viewGroups, contactGroups, totalViews, totalContacts] = await Promise.all([
          server.prisma.addonView.groupBy({
            by: ['addonId'],
            where: { addonId: { in: addonIds } },
            _count: { id: true },
            orderBy: { _count: { id: 'desc' } },
            take: 5,
          }),
          server.prisma.contactEvent.groupBy({
            by: ['addonId'],
            where: { addonId: { in: addonIds } },
            _count: { id: true },
            orderBy: { _count: { id: 'desc' } },
            take: 5,
          }),
          server.prisma.addonView.count({ where: { addonId: { in: addonIds } } }),
          server.prisma.contactEvent.count({ where: { addonId: { in: addonIds } } }),
        ])

        const topViewed = viewGroups.map(g => ({
          addonId: g.addonId,
          name: addonMap.get(g.addonId)?.name ?? '',
          slug: addonMap.get(g.addonId)?.slug ?? '',
          viewsCount: g._count.id,
        }))

        const topContacted = contactGroups.map(g => ({
          addonId: g.addonId,
          name: addonMap.get(g.addonId)?.name ?? '',
          slug: addonMap.get(g.addonId)?.slug ?? '',
          contactsCount: g._count.id,
        }))

        server.log.info({ userId, totalViews, totalContacts }, '[getDeveloperAddonStats] ok')
        return reply.send({ totalViews, totalContacts, topViewed, topContacted })
      } catch (err) {
        server.log.error(err, '[getDeveloperAddonStats] error')
        return reply.status(500).send({ error: 'SERVER_ERROR' })
      }
    },
  )

  // ── Functions: getDistributorAddonStats ────────────────────────────────────
  server.post(
    '/functions/getDistributorAddonStats',
    async (request, reply) => {
      const secret = getAuthSecret()
      if (!secret) return reply.status(500).send({ error: 'SERVER_ERROR' })

      const userId = getAuthUserId(request, secret)
      if (!userId) return reply.status(401).send({ error: 'UNAUTHORIZED' })

      server.log.info({ userId }, '[getDistributorAddonStats] request')

      try {
        const [totalAddons, totalContactEvents, developerRows, contactGroups, latestAddons] = await Promise.all([
          server.prisma.addon.count(),
          server.prisma.contactEvent.count(),
          server.prisma.addon.findMany({
            select: { ownerUserId: true },
            distinct: ['ownerUserId'],
          }),
          server.prisma.contactEvent.groupBy({
            by: ['addonId'],
            _count: { id: true },
            orderBy: { _count: { id: 'desc' } },
            take: 10,
          }),
          server.prisma.addon.findMany({
            orderBy: { createdAt: 'desc' },
            take: 10,
            select: { id: true, name: true, slug: true, createdAt: true, manufacturer: true, system: true },
          }),
        ])

        const totalDevelopers = developerRows.length

        const contactAddonIds = contactGroups.map(g => g.addonId)
        const contactAddons = contactAddonIds.length > 0
          ? await server.prisma.addon.findMany({
              where: { id: { in: contactAddonIds } },
              select: { id: true, name: true, slug: true, manufacturer: true, system: true },
            })
          : []
        const addonMap = new Map(contactAddons.map(a => [a.id, a]))

        const topContacted = contactGroups.map(g => ({
          addonId: g.addonId,
          name: addonMap.get(g.addonId)?.name ?? '',
          slug: addonMap.get(g.addonId)?.slug ?? '',
          manufacturer: addonMap.get(g.addonId)?.manufacturer ?? null,
          system: addonMap.get(g.addonId)?.system ?? null,
          contactsCount: g._count.id,
        }))

        server.log.info({ userId, totalAddons, totalContactEvents, totalDevelopers }, '[getDistributorAddonStats] ok')
        return reply.send({ totalAddons, totalDevelopers, totalContactEvents, topContacted, latestAddons })
      } catch (err) {
        server.log.error(err, '[getDistributorAddonStats] error')
        return reply.status(500).send({ error: 'SERVER_ERROR' })
      }
    },
  )

  // ── Functions: changePassword ──────────────────────────────────────────────
  server.post<{
    Body: { currentPassword?: string; newPassword?: string }
  }>(
    '/functions/changePassword',
    async (request, reply) => {
      const secret = getAuthSecret()
      if (!secret) return reply.status(500).send({ error: 'SERVER_ERROR' })

      const userId = getAuthUserId(request, secret)
      if (!userId) return reply.status(401).send({ error: 'UNAUTHORIZED' })

      const { currentPassword, newPassword } = (request.body ?? {}) as { currentPassword?: string; newPassword?: string }

      if (typeof currentPassword !== 'string' || typeof newPassword !== 'string') {
        return reply.status(400).send({ error: 'VALIDATION_ERROR', message: 'currentPassword and newPassword are required' })
      }
      if (newPassword.length < 8) {
        return reply.status(400).send({ error: 'VALIDATION_ERROR', message: 'New password must be at least 8 characters' })
      }

      try {
        const user = await server.prisma.user.findUnique({ where: { id: userId } })
        if (!user || !user.passwordHash) {
          return reply.status(404).send({ error: 'USER_NOT_FOUND' })
        }

        const valid = await bcrypt.compare(currentPassword, user.passwordHash)
        if (!valid) {
          return reply.status(400).send({ error: 'INVALID_CURRENT_PASSWORD' })
        }

        const passwordHash = await bcrypt.hash(newPassword, 10)
        await server.prisma.user.update({ where: { id: userId }, data: { passwordHash } })

        server.log.info({ userId }, '[changePassword] password updated')
        return reply.send({ success: true })
      } catch (err) {
        server.log.error(err, '[changePassword] error')
        return reply.status(500).send({ error: 'SERVER_ERROR' })
      }
    },
  )

  // ── Functions: rateAddon ──────────────────────────────────────────────────
  server.post<{
    Body: { addonId?: string; rating?: number; comment?: string }
  }>(
    '/functions/rateAddon',
    async (request, reply) => {
      const secret = getAuthSecret()
      if (!secret) return reply.status(500).send({ error: 'SERVER_ERROR' })

      const userId = getAuthUserId(request, secret)
      if (!userId) return reply.status(401).send({ error: 'UNAUTHORIZED' })

      const { addonId, rating, comment: rawComment } = (request.body ?? {}) as { addonId?: string; rating?: number; comment?: string }
      const comment = typeof rawComment === 'string' ? rawComment.slice(0, 1000) : null

      if (!addonId) return reply.status(400).send({ error: 'VALIDATION_ERROR', message: 'addonId is required' })
      if (typeof rating !== 'number' || !Number.isInteger(rating) || rating < 1 || rating > 5) {
        return reply.status(400).send({ error: 'INVALID_RATING', message: 'rating must be an integer between 1 and 5' })
      }

      try {
        const addon = await server.prisma.addon.findUnique({ where: { id: addonId }, select: { id: true } })
        if (!addon) return reply.status(404).send({ error: 'ADDON_NOT_FOUND' })

        const result = await server.prisma.addonRating.upsert({
          where: { addonId_userId: { addonId, userId } },
          create: { addonId, userId, score: rating, comment },
          update: { score: rating, comment },
        })

        server.log.info({ addonId, userId, rating }, '[rateAddon] ok')
        return reply.send({ success: true, rating: result })
      } catch (err) {
        server.log.error(err, '[rateAddon] error')
        return reply.status(500).send({ error: 'SERVER_ERROR' })
      }
    },
  )

  // ── Functions: getAddonRatingSummary ──────────────────────────────────────
  server.post<{
    Body: { addonId?: string; slug?: string }
  }>(
    '/functions/getAddonRatingSummary',
    async (request, reply) => {
      const { addonId: rawAddonId, slug } = (request.body ?? {}) as { addonId?: string; slug?: string }

      let addonId = rawAddonId
      if (!addonId && slug) {
        const found = await server.prisma.addon.findUnique({ where: { slug }, select: { id: true } })
        if (!found) return reply.status(404).send({ error: 'ADDON_NOT_FOUND' })
        addonId = found.id
      }
      if (!addonId) return reply.status(404).send({ error: 'ADDON_NOT_FOUND' })

      try {
        const [aggregate, lastRatings] = await Promise.all([
          server.prisma.addonRating.aggregate({
            where: { addonId },
            _count: { id: true },
            _avg: { score: true },
          }),
          server.prisma.addonRating.findMany({
            where: { addonId },
            orderBy: { createdAt: 'desc' },
            take: 5,
            select: { score: true, comment: true, createdAt: true },
          }),
        ])

        const totalCount = aggregate._count.id
        const avgRating = aggregate._avg.score !== null
          ? Math.round(aggregate._avg.score * 10) / 10
          : null

        // myRating — optional, only if valid JWT present
        const secret = getAuthSecret()
        let myRating = null
        if (secret) {
          const userId = getAuthUserId(request, secret)
          if (userId) {
            const my = await server.prisma.addonRating.findUnique({
              where: { addonId_userId: { addonId, userId } },
              select: { score: true, comment: true },
            })
            myRating = my ? { rating: my.score, comment: my.comment } : null
          }
        }

        return reply.send({ addonId, totalCount, avgRating, lastRatings, myRating })
      } catch (err) {
        server.log.error(err, '[getAddonRatingSummary] error')
        return reply.status(500).send({ error: 'SERVER_ERROR' })
      }
    },
  )

  // ── Functions: rateDeveloper ──────────────────────────────────────────────
  server.post<{
    Body: { developerId?: string; rating?: number; comment?: string }
  }>(
    '/functions/rateDeveloper',
    async (request, reply) => {
      const secret = getAuthSecret()
      if (!secret) return reply.status(500).send({ error: 'SERVER_ERROR' })

      const userId = getAuthUserId(request, secret)
      if (!userId) return reply.status(401).send({ error: 'UNAUTHORIZED' })

      const { developerId, rating, comment: rawComment } = (request.body ?? {}) as { developerId?: string; rating?: number; comment?: string }
      const comment = typeof rawComment === 'string' ? rawComment.slice(0, 1000) : null

      if (!developerId) return reply.status(400).send({ error: 'VALIDATION_ERROR', message: 'developerId is required' })
      if (typeof rating !== 'number' || !Number.isInteger(rating) || rating < 1 || rating > 5) {
        return reply.status(400).send({ error: 'INVALID_RATING', message: 'rating must be an integer between 1 and 5' })
      }

      try {
        const developer = await server.prisma.developerProfile.findUnique({ where: { id: developerId }, select: { id: true } })
        if (!developer) return reply.status(404).send({ error: 'DEVELOPER_NOT_FOUND' })

        await server.prisma.developerRating.upsert({
          where: { developerId_userId: { developerId, userId } },
          create: { developerId, userId, score: rating, comment },
          update: { score: rating, comment },
        })

        server.log.info({ developerId, userId, rating }, '[rateDeveloper] ok')
        return reply.send({ success: true })
      } catch (err) {
        server.log.error(err, '[rateDeveloper] error')
        return reply.status(500).send({ error: 'SERVER_ERROR' })
      }
    },
  )

  // ── Functions: getDeveloperRatingSummary ──────────────────────────────────
  server.post<{
    Body: { developerId?: string; handle?: string }
  }>(
    '/functions/getDeveloperRatingSummary',
    async (request, reply) => {
      const { developerId: rawDeveloperId, handle } = (request.body ?? {}) as { developerId?: string; handle?: string }

      let developerId = rawDeveloperId
      if (!developerId && handle) {
        const profile = await server.prisma.developerProfile.findFirst({
          where: { user: { handle } },
          select: { id: true },
        })
        if (!profile) return reply.status(404).send({ error: 'DEVELOPER_NOT_FOUND' })
        developerId = profile.id
      }
      if (!developerId) return reply.status(400).send({ error: 'VALIDATION_ERROR', message: 'developerId or handle is required' })

      try {
        const [aggregate, lastRatings] = await Promise.all([
          server.prisma.developerRating.aggregate({
            where: { developerId },
            _count: { id: true },
            _avg: { score: true },
          }),
          server.prisma.developerRating.findMany({
            where: { developerId },
            orderBy: { createdAt: 'desc' },
            take: 5,
            select: { score: true, comment: true, createdAt: true },
          }),
        ])

        const totalCount = aggregate._count.id
        const avgRating = aggregate._avg.score !== null
          ? Math.round(aggregate._avg.score * 10) / 10
          : null

        const secret = getAuthSecret()
        let myRating = null
        if (secret) {
          const userId = getAuthUserId(request, secret)
          if (userId) {
            const my = await server.prisma.developerRating.findUnique({
              where: { developerId_userId: { developerId, userId } },
              select: { score: true, comment: true },
            })
            myRating = my ? { rating: my.score, comment: my.comment } : null
          }
        }

        server.log.info({ developerId }, '[getDeveloperRatingSummary] ok')
        return reply.send({ developerId, totalCount, avgRating, lastRatings, myRating })
      } catch (err) {
        server.log.error(err, '[getDeveloperRatingSummary] error')
        return reply.status(500).send({ error: 'SERVER_ERROR' })
      }
    },
  )

  // ── Functions: getMyAddonRatings ──────────────────────────────────────────
  server.post(
    '/functions/getMyAddonRatings',
    async (request, reply) => {
      const secret = getAuthSecret()
      if (!secret) return reply.status(500).send({ error: 'SERVER_ERROR' })

      const userId = getAuthUserId(request, secret)
      if (!userId) return reply.status(401).send({ error: 'UNAUTHORIZED' })

      try {
        const ratings = await server.prisma.addonRating.findMany({
          where: { userId },
          orderBy: { updatedAt: 'desc' },
          include: {
            addon: { select: { id: true, name: true, slug: true, manufacturer: true, system: true } },
          },
        })

        server.log.info({ userId, count: ratings.length }, '[getMyAddonRatings] ok')
        return reply.send({ ratings })
      } catch (err) {
        server.log.error(err, '[getMyAddonRatings] error')
        return reply.status(500).send({ error: 'SERVER_ERROR' })
      }
    },
  )

  // ── Functions: getMyDeveloperRatings ─────────────────────────────────────
  server.post(
    '/functions/getMyDeveloperRatings',
    async (request, reply) => {
      const secret = getAuthSecret()
      if (!secret) return reply.status(500).send({ error: 'SERVER_ERROR' })

      const userId = getAuthUserId(request, secret)
      if (!userId) return reply.status(401).send({ error: 'UNAUTHORIZED' })

      try {
        const ratings = await server.prisma.developerRating.findMany({
          where: { userId },
          orderBy: { updatedAt: 'desc' },
          include: {
            developer: {
              select: {
                id: true,
                displayName: true,
                user: { select: { handle: true } },
              },
            },
          },
        })

        server.log.info({ userId, count: ratings.length }, '[getMyDeveloperRatings] ok')
        return reply.send({ ratings })
      } catch (err) {
        server.log.error(err, '[getMyDeveloperRatings] error')
        return reply.status(500).send({ error: 'SERVER_ERROR' })
      }
    },
  )

  // ── Functions: getMyPartnerChannel ─────────────────────────────────────────
  server.post<{
    Body: { leaderUserId?: string }
  }>(
    '/functions/getMyPartnerChannel',
    async (request, reply) => {
      const secret = getAuthSecret()
      if (!secret) return reply.status(500).send({ error: 'SERVER_ERROR' })

      const callerId = getAuthUserId(request, secret)
      if (!callerId) return reply.status(401).send({ error: 'UNAUTHORIZED' })

      const caller = await server.prisma.user.findUnique({
        where: { id: callerId },
        select: {
          id: true,
          email: true,
          userType: true,
          partnerLeaderCode: true,
        },
      })
      if (!caller) return reply.status(401).send({ error: 'UNAUTHORIZED' })

      const isAdmin = isAdminUser(caller)

      if (!isAdmin) {
        if (caller.userType !== 'partner_leader' || !caller.partnerLeaderCode) {
          return reply.status(403).send({
            error: 'FORBIDDEN',
            message: 'Solo Partner Líderes pueden ver su canal',
          })
        }
      }

      const { leaderUserId } = (request.body ?? {}) as { leaderUserId?: string }
      const leaderId = isAdmin && leaderUserId ? leaderUserId : callerId

      try {
        const now = new Date()
        const minus7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        const minus30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

        const partners = await server.prisma.user.findMany({
          where: { uplinePartnerLeaderId: leaderId, userType: 'partner' },
          orderBy: { createdAt: 'desc' },
          take: 200,
          select: { id: true, email: true, name: true, company: true, createdAt: true },
        })

        const totalPartners = partners.length
        const last7Days = partners.filter(p => p.createdAt >= minus7).length
        const last30Days = partners.filter(p => p.createdAt >= minus30).length

        // Count activity events via JOIN on uplinePartnerLeaderId — not limited by take:200
        const netWhere7  = { user: { uplinePartnerLeaderId: leaderId }, createdAt: { gte: minus7  } }
        const netWhere30 = { user: { uplinePartnerLeaderId: leaderId }, createdAt: { gte: minus30 } }

        const [
          viewsLast7,    viewsLast30,
          contactsLast7, contactsLast30,
          votesLast7,    votesLast30,
          addonRatings7, addonRatings30,
          devRatings7,   devRatings30,
        ] = await Promise.all([
          server.prisma.addonView.count({ where: netWhere7 }),
          server.prisma.addonView.count({ where: netWhere30 }),
          server.prisma.contactEvent.count({ where: netWhere7 }),
          server.prisma.contactEvent.count({ where: netWhere30 }),
          server.prisma.featureVote.count({ where: netWhere7 }),
          server.prisma.featureVote.count({ where: netWhere30 }),
          server.prisma.addonRating.count({ where: netWhere7 }),
          server.prisma.addonRating.count({ where: netWhere30 }),
          server.prisma.developerRating.count({ where: netWhere7 }),
          server.prisma.developerRating.count({ where: netWhere30 }),
        ])

        server.log.info({ callerId, leaderId, totalPartners }, '[getMyPartnerChannel] ok')
        return reply.send({
          success: true,
          summary: {
            totalPartners, last7Days, last30Days,
            network_addon_views_last7:    viewsLast7,
            network_addon_views_last30:   viewsLast30,
            network_contact_events_last7: contactsLast7,
            network_contact_events_last30:contactsLast30,
            network_feature_votes_last7:  votesLast7,
            network_feature_votes_last30: votesLast30,
            network_ratings_last7:        addonRatings7  + devRatings7,
            network_ratings_last30:       addonRatings30 + devRatings30,
          },
          partners: partners.map(p => ({
            id: p.id,
            email: p.email,
            full_name: p.name,
            company: p.company,
            createdAt: p.createdAt.toISOString(),
          })),
        })
      } catch (err) {
        server.log.error(err, '[getMyPartnerChannel] error')
        return reply.status(500).send({ error: 'SERVER_ERROR' })
      }
    },
  )

  // ── Functions: adminListPartners ──────────────────────────────────────────
  server.post<{
    Body: {
      q?: string
      leaderUserId?: string
      limit?: number
      offset?: number
      sort?: 'newest' | 'oldest'
    }
  }>(
    '/functions/adminListPartners',
    async (request, reply) => {
      const secret = getAuthSecret()
      if (!secret) return reply.status(500).send({ message: 'AUTH_SECRET not configured', code: 'SERVER_ERROR' })

      const adminId = getAuthUserId(request, secret)
      if (!adminId) return reply.status(401).send({ message: 'Unauthorized', code: 'auth_required' })

      const admin = await server.prisma.user.findUnique({ where: { id: adminId }, select: { email: true } })
      if (!admin || !isAdminUser(admin)) return reply.status(403).send({ message: 'Forbidden', code: 'FORBIDDEN' })

      const body = (request.body ?? {}) as {
        q?: string; leaderUserId?: string; limit?: number; offset?: number; sort?: string
      }
      const q = typeof body.q === 'string' ? body.q.trim() : ''
      const leaderUserId = typeof body.leaderUserId === 'string' && body.leaderUserId ? body.leaderUserId : undefined
      const limit = Math.min(Number(body.limit) || 100, 500)
      const offset = Number(body.offset) || 0
      const sort = body.sort === 'oldest' ? 'asc' : 'desc'

      const baseWhere: Prisma.UserWhereInput = { userType: 'partner' }

      if (leaderUserId) {
        baseWhere.uplinePartnerLeaderId = leaderUserId
      }

      if (q) {
        const textOr: Prisma.UserWhereInput[] = [
          { email: { contains: q, mode: 'insensitive' } },
          { name: { contains: q, mode: 'insensitive' } },
          { company: { contains: q, mode: 'insensitive' } },
        ]
        // Search by partnerLeaderCode on the upline via relation (no extra query needed)
        textOr.push({ uplinePartnerLeader: { partnerLeaderCode: { contains: q, mode: 'insensitive' } } })
        baseWhere.OR = textOr
      }

      const [total, items] = await Promise.all([
        server.prisma.user.count({ where: baseWhere }),
        server.prisma.user.findMany({
          where: baseWhere,
          orderBy: { createdAt: sort },
          take: limit,
          skip: offset,
          select: {
            id: true,
            email: true,
            name: true,
            company: true,
            createdAt: true,
            uplinePartnerLeaderId: true,
            uplinePartnerLeader: {
              select: {
                id: true,
                email: true,
                name: true,
                partnerLeaderCode: true,
                userType: true,
              },
            },
          },
        }),
      ])

      return reply.send({
        success: true,
        total,
        items: items.map(p => ({
          id: p.id,
          email: p.email,
          name: p.name,
          company: p.company,
          createdAt: p.createdAt.toISOString(),
          uplinePartnerLeaderId: p.uplinePartnerLeaderId,
          upline: p.uplinePartnerLeader
            ? {
                id: p.uplinePartnerLeader.id,
                email: p.uplinePartnerLeader.email,
                name: p.uplinePartnerLeader.name,
                partnerLeaderCode: p.uplinePartnerLeader.partnerLeaderCode,
              }
            : null,
        })),
      })
    },
  )

  // ── Functions: adminExportPartnersCsv ─────────────────────────────────────
  server.post<{
    Body: { q?: string; leaderUserId?: string; sort?: string }
  }>(
    '/functions/adminExportPartnersCsv',
    async (request, reply) => {
      const secret = getAuthSecret()
      if (!secret) return reply.status(500).send({ message: 'AUTH_SECRET not configured', code: 'SERVER_ERROR' })

      const adminId = getAuthUserId(request, secret)
      if (!adminId) return reply.status(401).send({ message: 'Unauthorized', code: 'auth_required' })

      const admin = await server.prisma.user.findUnique({ where: { id: adminId }, select: { email: true } })
      if (!admin || !isAdminUser(admin)) return reply.status(403).send({ message: 'Forbidden', code: 'FORBIDDEN' })

      const body = (request.body ?? {}) as { q?: string; leaderUserId?: string; sort?: string }
      const q = typeof body.q === 'string' ? body.q.trim() : ''
      const leaderUserId = typeof body.leaderUserId === 'string' && body.leaderUserId ? body.leaderUserId : undefined
      const sort = body.sort === 'oldest' ? 'asc' : 'desc'

      const baseWhere: Prisma.UserWhereInput = { userType: 'partner' }

      if (leaderUserId) {
        baseWhere.uplinePartnerLeaderId = leaderUserId
      }

      if (q) {
        const textOr: Prisma.UserWhereInput[] = [
          { email: { contains: q, mode: 'insensitive' } },
          { name: { contains: q, mode: 'insensitive' } },
          { company: { contains: q, mode: 'insensitive' } },
        ]
        // Search by partnerLeaderCode on the upline via relation (no extra query needed)
        textOr.push({ uplinePartnerLeader: { partnerLeaderCode: { contains: q, mode: 'insensitive' } } })
        baseWhere.OR = textOr
      }

      const rows = await server.prisma.user.findMany({
        where: baseWhere,
        orderBy: { createdAt: sort },
        take: 2000,
        select: {
          id: true,
          email: true,
          name: true,
          company: true,
          createdAt: true,
          uplinePartnerLeader: {
            select: {
              id: true,
              email: true,
              name: true,
              partnerLeaderCode: true,
            },
          },
        },
      })

      function escapeCsv(val: string | null | undefined): string {
        if (val == null) return ''
        const s = String(val)
        // Prefix formula-injection chars to prevent execution in spreadsheets
        const safe = /^[=+\-@]/.test(s) ? "'" + s : s
        if (safe.includes('"') || safe.includes(',') || safe.includes('\n')) {
          return '"' + safe.replace(/"/g, '""') + '"'
        }
        return safe
      }

      const header = 'partner_id,partner_email,partner_name,partner_company,partner_createdAt,leader_id,leader_email,leader_name,leader_code'
      const lines = rows.map(p => {
        const ul = p.uplinePartnerLeader
        return [
          escapeCsv(p.id),
          escapeCsv(p.email),
          escapeCsv(p.name),
          escapeCsv(p.company),
          escapeCsv(p.createdAt.toISOString()),
          escapeCsv(ul?.id),
          escapeCsv(ul?.email),
          escapeCsv(ul?.name),
          escapeCsv(ul?.partnerLeaderCode),
        ].join(',')
      })

      return reply.send({ success: true, csv: [header, ...lines].join('\n') })
    },
  )

  // ── Functions: adminListPartnerLeaders ───────────────────────────────────
  server.post(
    '/functions/adminListPartnerLeaders',
    async (request, reply) => {
      const secret = getAuthSecret()
      if (!secret) return reply.status(500).send({ message: 'AUTH_SECRET not configured', code: 'SERVER_ERROR' })

      const adminId = getAuthUserId(request, secret)
      if (!adminId) return reply.status(401).send({ message: 'Unauthorized', code: 'auth_required' })

      const admin = await server.prisma.user.findUnique({ where: { id: adminId }, select: { email: true } })
      if (!admin || !isAdminUser(admin)) return reply.status(403).send({ message: 'Forbidden', code: 'FORBIDDEN' })

      const leaders = await server.prisma.user.findMany({
        where: {
          userType: 'partner_leader',
          partnerLeaderCode: { not: null },
        },
        orderBy: [{ name: 'asc' }, { email: 'asc' }],
        take: 500,
        select: { id: true, email: true, name: true, partnerLeaderCode: true },
      })

      return reply.send({ success: true, items: leaders })
    },
  )

  // ── Functions: adminRunJobNow ─────────────────────────────────────────────
  server.post<{
    Body: { jobKey?: string; dryRun?: boolean; emailOverride?: string }
  }>(
    '/functions/adminRunJobNow',
    async (request, reply) => {
      const secret = getAuthSecret()
      if (!secret) return reply.status(500).send({ message: 'AUTH_SECRET not configured', code: 'SERVER_ERROR' })

      const adminId = getAuthUserId(request, secret)
      if (!adminId) return reply.status(401).send({ message: 'Unauthorized', code: 'auth_required' })

      const admin = await server.prisma.user.findUnique({ where: { id: adminId }, select: { email: true } })
      if (!admin || !isAdminUser(admin)) return reply.status(403).send({ message: 'Forbidden', code: 'FORBIDDEN' })

      const { jobKey, dryRun = false, emailOverride } = (request.body ?? {}) as {
        jobKey?: string
        dryRun?: boolean
        emailOverride?: string
      }
      if (!jobKey) return reply.status(400).send({ message: 'jobKey required', code: 'VALIDATION_ERROR' })

      if (jobKey === 'weekly_digest') {
        const result = await runWeeklyDigest({
          prisma: server.prisma,
          dryRun,
          emailOverride,
        })
        return reply.send({ success: true, jobKey, result })
      }

      if (jobKey === 'remind_complete_profile') {
        const result = await runRemindCompleteProfile({
          prisma: server.prisma,
          dryRun,
          emailOverride,
        })
        return reply.send({ success: true, jobKey, result })
      }

      return reply.status(400).send({ message: `No handler for jobKey="${jobKey}"`, code: 'UNKNOWN_JOB' })
    },
  )

  // ── Functions: adminListUsers ─────────────────────────────────────────────
  server.post<{
    Body: {
      q?: string
      userType?: string
      onboardingComplete?: boolean
      limit?: number
      offset?: number
    }
  }>(
    '/functions/adminListUsers',
    async (request, reply) => {
      const secret = getAuthSecret()
      if (!secret) return reply.status(500).send({ message: 'AUTH_SECRET not configured', code: 'SERVER_ERROR' })
      const adminId = getAuthUserId(request, secret)
      if (!adminId) return reply.status(401).send({ message: 'Unauthorized', code: 'auth_required' })
      const admin = await server.prisma.user.findUnique({ where: { id: adminId }, select: { email: true } })
      if (!admin || !isAdminUser(admin)) return reply.status(403).send({ message: 'Forbidden', code: 'FORBIDDEN' })

      const body = (request.body ?? {}) as {
        q?: string; userType?: string
        onboardingComplete?: boolean; limit?: number; offset?: number
      }
      const q = typeof body.q === 'string' ? body.q.trim() : ''
      const limit = Math.min(Number(body.limit) || 50, 200)
      const offset = Number(body.offset) || 0

      const where: Prisma.UserWhereInput = {}
      if (typeof body.userType === 'string' && body.userType) where.userType = body.userType
      if (typeof body.onboardingComplete === 'boolean') where.onboardingComplete = body.onboardingComplete
      if (q) {
        where.OR = [
          { email: { contains: q, mode: 'insensitive' } },
          { name: { contains: q, mode: 'insensitive' } },
          { company: { contains: q, mode: 'insensitive' } },
        ]
      }

      const [total, users] = await Promise.all([
        server.prisma.user.count({ where }),
        server.prisma.user.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          take: limit,
          skip: offset,
          select: {
            id: true, email: true, name: true, company: true,
            userType: true, onboardingComplete: true,
            canPublishAddons: true, partnerLeaderCode: true,
            uplinePartnerLeaderId: true, createdAt: true,
          },
        }),
      ])

      return reply.send({
        success: true,
        total,
        users: users.map(u => ({
          id: u.id, email: u.email, name: u.name, company: u.company,
          userType: u.userType,
          onboardingComplete: u.onboardingComplete,
          canPublishAddons: u.canPublishAddons,
          partnerLeaderCode: u.partnerLeaderCode,
          uplinePartnerLeaderId: u.uplinePartnerLeaderId,
          createdAt: u.createdAt.toISOString(),
        })),
      })
    },
  )

  // ── Functions: logVisit ────────────────────────────────────────────────────
  server.post<{
    Body: { path?: string; fullUrl?: string; referrer?: string; eventType?: string }
  }>(
    '/functions/logVisit',
    { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const body = request.body ?? {}

      // path is required and must be a non-empty string
      const rawPath = typeof body.path === 'string' ? body.path : ''
      if (!rawPath) return reply.status(400).send({ message: 'path is required', code: 'MISSING_PATH' })

      // Truncate all URL fields to 2048 chars to prevent DB bloat
      const MAX = 2048
      const visitPath = rawPath.slice(0, MAX)
      const fullUrl   = typeof body.fullUrl   === 'string' ? body.fullUrl.slice(0, MAX)   : undefined
      const referrer  = typeof body.referrer  === 'string' ? body.referrer.slice(0, MAX)  : undefined

      // Whitelist eventType — unknown values silently fall back to page_view
      const ALLOWED_EVENT_TYPES = ['page_view'] as const
      type AllowedEventType = typeof ALLOWED_EVENT_TYPES[number]
      const rawEventType = typeof body.eventType === 'string' ? body.eventType : 'page_view'
      const eventType: AllowedEventType = (ALLOWED_EVENT_TYPES as readonly string[]).includes(rawEventType)
        ? (rawEventType as AllowedEventType)
        : 'page_view'

      // trustProxy: true is set on the Fastify instance, so request.ip already
      // holds the real client IP resolved from x-forwarded-for by Fastify.
      const ip = typeof request.ip === 'string' ? request.ip : null

      const userAgent = request.headers['user-agent'] ?? null

      // Optionally resolve authenticated user (non-blocking)
      let userId: string | null = null
      let userEmail: string | null = null
      let userType: string | null = null
      let role: string | null = null
      try {
        const secret = getAuthSecret()
        if (secret) {
          const uid = getAuthUserId(request, secret)
          if (uid) {
            const u = await server.prisma.user.findUnique({
              where: { id: uid },
              select: { id: true, email: true, userType: true, role: true },
            })
            if (u) {
              userId = u.id
              userEmail = u.email
              userType = u.userType
              role = u.role ?? null
            }
          }
        }
      } catch {
        // Non-fatal — log anonymously
      }

      await server.prisma.visitLog.create({
        data: { ip, userAgent, path: visitPath, fullUrl, referrer, userId, userEmail, userType, role, eventType },
      })

      return reply.send({ success: true })
    },
  )

  // ── Functions: adminGetVisitLogs ───────────────────────────────────────────
  server.post<{
    Body: { q?: string; limit?: number; offset?: number }
  }>(
    '/functions/adminGetVisitLogs',
    async (request, reply) => {
      const secret = getAuthSecret()
      if (!secret) return reply.status(500).send({ message: 'AUTH_SECRET not configured', code: 'SERVER_ERROR' })

      const adminId = getAuthUserId(request, secret)
      if (!adminId) return reply.status(401).send({ message: 'Unauthorized', code: 'auth_required' })

      const admin = await server.prisma.user.findUnique({ where: { id: adminId }, select: { email: true } })
      if (!admin || !isAdminUser(admin)) return reply.status(403).send({ message: 'Forbidden', code: 'FORBIDDEN' })

      const { q, limit = 50, offset = 0 } = request.body ?? {}
      const where = q
        ? {
            OR: [
              { ip: { contains: q, mode: 'insensitive' as const } },
              { path: { contains: q, mode: 'insensitive' as const } },
              { userEmail: { contains: q, mode: 'insensitive' as const } },
            ],
          }
        : {}

      const [total, logs] = await Promise.all([
        server.prisma.visitLog.count({ where }),
        server.prisma.visitLog.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          take: Math.min(limit, 200),
          skip: offset,
        }),
      ])

      return reply.send({
        success: true,
        total,
        logs: logs.map(l => ({
          id: l.id,
          createdAt: l.createdAt.toISOString(),
          ip: l.ip,
          userAgent: l.userAgent,
          path: l.path,
          fullUrl: l.fullUrl,
          referrer: l.referrer,
          userId: l.userId,
          userEmail: l.userEmail,
          userType: l.userType,
          role: l.role,
          eventType: l.eventType,
        })),
      })
    },
  )
}

export { apiRoutes }
