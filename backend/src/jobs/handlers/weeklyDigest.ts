/**
 * jobs/handlers/weeklyDigest.ts
 *
 * Weekly digest email — sent every Monday at 09:00 (server local time).
 *
 * Content (data real only):
 *  1. Nuevos add-ons APROBADOS (últimos 7 días) — top 10
 *  2. Add-ons actualizados (updatedAt != createdAt, últimos 7 días)
 *  3. Nuevos feature requests (últimos 7 días) + top votado
 *  4. Nuevos Partner Líderes aprobados (últimos 7 días)
 *
 * Segmentación por userType: partner, developer, partner_leader (ligera, mismo template + sección extra).
 * Idempotencia: EmailDigestLog(kind='weekly_digest', periodKey=YYYY-MM-DD lunes local).
 */
import type { PrismaClient } from '@prisma/client'
import { sendMail } from '../../services/mail'
import {
  renderEmailLayout,
  renderParagraph,
  renderPrimaryButton,
  renderDivider,
  renderNoteBox,
  escapeHtml,
} from '../../email/theme'

const BASE_URL = process.env.MARKETPAQ_PUBLIC_URL ?? 'https://marketpaq.com'
const CATALOG_URL = `${BASE_URL}/AddonsCatalog`
const FEATURE_URL = `${BASE_URL}/FeatureRequests`
const DASHBOARD_URL = `${BASE_URL}/Dashboard`

export interface WeeklyDigestOptions {
  prisma: PrismaClient
  /** If set, only send to this email (for testing). Skips idempotency guard. */
  emailOverride?: string
  /** If true, don't send any emails — return a preview object instead. */
  dryRun?: boolean
}

export interface WeeklyDigestResult {
  skipped?: boolean
  skipReason?: string
  dryRun?: boolean
  preview?: Record<string, unknown>
  sentTo?: number
  periodKey?: string
}

/** Returns the Monday YYYY-MM-DD string for the current week (server local time). */
function getMondayPeriodKey(): string {
  const now = new Date()
  // Day 0=Sun, 1=Mon, ..., 6=Sat
  const dayOfWeek = now.getDay()
  // Days since Monday (Sunday wraps to 6)
  const daysBack = dayOfWeek === 0 ? 6 : dayOfWeek - 1
  const monday = new Date(now)
  monday.setDate(now.getDate() - daysBack)
  const y = monday.getFullYear()
  const m = String(monday.getMonth() + 1).padStart(2, '0')
  const d = String(monday.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

interface DigestData {
  newApproved: { id: string; name: string; slug: string }[]
  totalNewApproved: number
  updatedAddons: { id: string; name: string; slug: string }[]
  totalUpdated: number
  newLeadersCount: number
  topFeatureRequest: { title: string; votesCount: number } | null
  newFeatureRequests: number
}

async function fetchDigestData(prisma: PrismaClient): Promise<DigestData> {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

  // New approved addons (last 7 days)
  const [newApproved, totalNewApproved] = await Promise.all([
    prisma.addon.findMany({
      where: { status: 'published', createdAt: { gte: since } },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: { id: true, name: true, slug: true },
    }),
    prisma.addon.count({ where: { status: 'published', createdAt: { gte: since } } }),
  ])

  // Updated addons (updatedAt > createdAt + 10min, last 7 days, already published)
  const tenMin = 10 * 60 * 1000
  const updatedAddons = await prisma.$queryRaw<{ id: string; name: string; slug: string }[]>`
    SELECT id, name, slug
    FROM "Addon"
    WHERE status = 'published'
      AND "updatedAt" >= ${since}
      AND EXTRACT(EPOCH FROM ("updatedAt" - "createdAt")) > ${tenMin / 1000}
    ORDER BY "updatedAt" DESC
    LIMIT 5
  `
  const totalUpdated = updatedAddons.length

  // New Partner Líderes (last 7 days)
  const newLeadersCount = await prisma.user.count({
    where: { userType: 'partner_leader', updatedAt: { gte: since } },
  })

  // Feature requests
  const newFeatureRequests = await prisma.featureRequest.count({
    where: { createdAt: { gte: since } },
  })

  // Top voted feature request (all time)
  const topFR = await prisma.featureRequest.findMany({
    where: { status: { in: ['open', 'planned', 'in_progress'] } },
    include: { _count: { select: { votes: true } } },
    orderBy: { votes: { _count: 'desc' } },
    take: 1,
  })
  const topFeatureRequest = topFR[0]
    ? { title: topFR[0].title, votesCount: topFR[0]._count.votes }
    : null

  return {
    newApproved,
    totalNewApproved,
    updatedAddons,
    totalUpdated,
    newLeadersCount,
    topFeatureRequest,
    newFeatureRequests,
  }
}

function buildAddonListHtml(addons: { name: string; slug: string }[]): string {
  if (addons.length === 0) return ''
  const items = addons
    .map(a => `&bull; <a href="${escapeHtml(`${BASE_URL}/AddonDetail?slug=${a.slug}`)}" style="color:#2563eb;">${escapeHtml(a.name)}</a>`)
    .join('<br />')
  return `<p style="margin:8px 0;font-family:Arial,sans-serif;font-size:14px;line-height:1.7;color:#4b5563;">${items}</p>`
}

function buildBodyRows(data: DigestData, userType: string, leaderNewPartners?: number): string {
  const rows: string[] = []

  // Intro by userType
  if (userType === 'partner') {
    rows.push(renderParagraph('Aquí tienes el resumen semanal de lo nuevo en MarketPAQ para distribuidores.'))
  } else if (userType === 'developer') {
    rows.push(renderParagraph('El resumen semanal de tendencias y novedades en la plataforma para developers.'))
  } else if (userType === 'leader') {
    rows.push(renderParagraph('Tu resumen semanal como Partner L&iacute;der: novedades de la plataforma y tu canal.'))
  } else {
    rows.push(renderParagraph('Aquí tienes el resumen semanal de MarketPAQ.'))
  }

  rows.push(renderDivider())

  // 1. New approved addons
  if (data.totalNewApproved > 0) {
    rows.push(renderParagraph(
      `<strong>Nuevos add-ons disponibles esta semana (${data.totalNewApproved}):</strong>`,
    ))
    rows.push(renderParagraph(buildAddonListHtml(data.newApproved)))
  } else {
    rows.push(renderNoteBox('Esta semana no hubo nuevos add-ons aprobados.'))
  }

  // 2. Updated addons
  if (data.totalUpdated > 0) {
    rows.push(renderParagraph(`<strong>Add-ons actualizados (${data.totalUpdated}):</strong>`))
    rows.push(renderParagraph(buildAddonListHtml(data.updatedAddons)))
  }

  rows.push(renderDivider())

  // 3. Feature requests
  if (data.newFeatureRequests > 0 || data.topFeatureRequest) {
    rows.push(renderParagraph('<strong>Centro de mejoras:</strong>'))
    if (data.newFeatureRequests > 0) {
      rows.push(renderParagraph(`Nuevas solicitudes esta semana: <strong>${data.newFeatureRequests}</strong>`))
    }
    if (data.topFeatureRequest) {
      rows.push(renderNoteBox(
        `Solicitud m&aacute;s votada: <strong>${escapeHtml(data.topFeatureRequest.title)}</strong> ` +
        `(${data.topFeatureRequest.votesCount} votos)`,
      ))
    }
  }

  // 4. New Partner Líderes
  if (data.newLeadersCount > 0) {
    rows.push(renderDivider())
    rows.push(renderParagraph(
      `<strong>Nuevos Partner L&iacute;deres aprobados esta semana:</strong> ${data.newLeadersCount}`,
    ))
  }

  // 5. Partner Líder: canal stats
  if (userType === 'leader' && leaderNewPartners !== undefined && leaderNewPartners > 0) {
    rows.push(renderDivider())
    rows.push(renderNoteBox(
      `<strong>Tu canal esta semana:</strong><br />` +
      `Nuevos distribuidores en tu red: <strong>${leaderNewPartners}</strong>.<br />` +
      `Ve las m&eacute;tricas completas en tu Dashboard.`,
    ))
  }

  rows.push(renderDivider())
  rows.push(renderPrimaryButton('Explorar lo nuevo', CATALOG_URL))

  if (data.newFeatureRequests > 0 || data.topFeatureRequest) {
    rows.push(renderParagraph(
      `<a href="${escapeHtml(FEATURE_URL)}" style="color:#2563eb;">Ver centro de mejoras</a>`,
    ))
  }

  return rows.join('')
}

function buildSubject(): string {
  return 'MarketPAQ · Resumen semanal'
}

function buildPreheader(data: DigestData): string {
  if (data.totalNewApproved > 0) {
    return `${data.totalNewApproved} nuevo${data.totalNewApproved !== 1 ? 's' : ''} add-on${data.totalNewApproved !== 1 ? 's' : ''} aprobado${data.totalNewApproved !== 1 ? 's' : ''} esta semana en MarketPAQ.`
  }
  return 'Tu resumen semanal de MarketPAQ.'
}

export async function runWeeklyDigest(opts: WeeklyDigestOptions): Promise<WeeklyDigestResult> {
  const { prisma, emailOverride, dryRun } = opts
  const periodKey = getMondayPeriodKey()

  // Idempotency check (skip for emailOverride/dryRun)
  if (!emailOverride && !dryRun) {
    const existing = await prisma.emailDigestLog.findUnique({
      where: { kind_periodKey: { kind: 'weekly_digest', periodKey } },
    })
    if (existing) {
      return { skipped: true, skipReason: 'Already sent for this period', periodKey }
    }
  }

  const data = await fetchDigestData(prisma)

  if (dryRun) {
    return {
      dryRun: true,
      periodKey,
      preview: {
        totalNewApproved: data.totalNewApproved,
        top10Addons: data.newApproved.map(a => a.name),
        totalUpdated: data.totalUpdated,
        updatedAddons: data.updatedAddons.map(a => a.name),
        newLeadersCount: data.newLeadersCount,
        newFeatureRequests: data.newFeatureRequests,
        topFeatureRequest: data.topFeatureRequest,
      },
    }
  }

  // Fetch recipients
  let recipients: { id: string; email: string; userType: string }[]

  if (emailOverride) {
    recipients = [{
      id: 'override',
      email: emailOverride,
      userType: 'partner',
    }]
  } else {
    recipients = await prisma.user.findMany({
      where: {
        emailVerified: true,
        email: { not: '' },
      },
      select: { id: true, email: true, userType: true },
    })
  }

  // For leaders, prefetch their new-partner counts efficiently
  const leaderIds = recipients
    .filter(r => r.userType === 'partner_leader')
    .map(r => r.id)

  const leaderPartnerCounts = new Map<string, number>()
  if (leaderIds.length > 0) {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const counts = await prisma.user.groupBy({
      by: ['uplinePartnerLeaderId'],
      where: {
        uplinePartnerLeaderId: { in: leaderIds },
        createdAt: { gte: since },
      },
      _count: { id: true },
    })
    for (const row of counts) {
      if (row.uplinePartnerLeaderId) {
        leaderPartnerCounts.set(row.uplinePartnerLeaderId, row._count.id)
      }
    }
  }

  let sentTo = 0
  const subject = buildSubject()
  const preheader = buildPreheader(data)

  for (const r of recipients) {
    try {
      const uType = r.userType === 'partner_leader' ? 'leader' : r.userType
      const leaderNewPartners = r.userType === 'partner_leader' ? (leaderPartnerCounts.get(r.id) ?? 0) : undefined
      const bodyRows = buildBodyRows(data, uType, leaderNewPartners)

      const html = renderEmailLayout({ title: 'Resumen semanal', preheader, bodyRows })
      const textLines: string[] = [
        'Resumen semanal de MarketPAQ',
        '',
        data.totalNewApproved > 0
          ? `Nuevos add-ons (${data.totalNewApproved}): ${data.newApproved.map(a => a.name).join(', ')}`
          : 'Sin nuevos add-ons aprobados esta semana.',
        data.totalUpdated > 0
          ? `Add-ons actualizados (${data.totalUpdated}): ${data.updatedAddons.map(a => a.name).join(', ')}`
          : '',
        data.newLeadersCount > 0 ? `Nuevos Partner Líderes: ${data.newLeadersCount}` : '',
        data.newFeatureRequests > 0 ? `Nuevas solicitudes de mejoras: ${data.newFeatureRequests}` : '',
        data.topFeatureRequest ? `Solicitud más votada: "${data.topFeatureRequest.title}" (${data.topFeatureRequest.votesCount} votos)` : '',
        '',
        `Explorar: ${CATALOG_URL}`,
        '',
        '— El equipo de MarketPAQ',
      ].filter(l => l !== undefined && l !== '')

      const result = await sendMail({ to: r.email, subject, html, text: textLines.join('\n') })
      if (result.ok) sentTo++
    } catch (err) {
      console.error('[weeklyDigest] error sending to %s: %s', r.email, err)
    }
  }

  // Mark as sent (idempotency)
  if (!emailOverride) {
    await prisma.emailDigestLog.upsert({
      where: { kind_periodKey: { kind: 'weekly_digest', periodKey } },
      create: {
        kind: 'weekly_digest',
        periodKey,
        meta: { sentTo, totalNewApproved: data.totalNewApproved },
      },
      update: { meta: { sentTo, totalNewApproved: data.totalNewApproved } },
    })
  }

  return { sentTo, periodKey }
}
