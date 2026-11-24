/**
 * email/notifications.ts — Event-driven transactional email notifications.
 *
 * All exported functions:
 *  - Resolve recipients from DB
 *  - Build HTML using theme v2
 *  - Call sendMail
 *  - Log errors but NEVER throw (endpoint flow must not break)
 *
 * Anti-spam: uses EmailSendLog for one-time emails (welcome, remind_profile_48h).
 */
import type { PrismaClient } from '@prisma/client'
import { sendMail } from '../services/mail'
import {
  renderEmailLayout,
  renderParagraph,
  renderPrimaryButton,
  renderSecondaryButton,
  renderNoteBox,
  renderWarningBox,
  renderDivider,
  escapeHtml,
} from './theme'

const BASE_URL = process.env.MARKETPAQ_PUBLIC_URL ?? 'https://marketpaq.com'

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function adminEmails(prisma: PrismaClient): Promise<{ email: string }[]> {
  return prisma.user.findMany({
    where: { role: 'admin' },
    select: { email: true },
  })
}

function addonUrl(slug: string): string {
  return `${BASE_URL}/AddonDetail?slug=${encodeURIComponent(slug)}`
}

const DASHBOARD_URL = `${BASE_URL}/Dashboard`
const ADMIN_ADDONS_URL = `${BASE_URL}/AdminAddons`
const ADMIN_DEVELOPERS_URL = `${BASE_URL}/AdminDevelopers`
const CATALOG_URL = `${BASE_URL}/AddonsCatalog`

// ─────────────────────────────────────────────────────────────────────────────
// C1 — Add-on: submitted for review
// ─────────────────────────────────────────────────────────────────────────────

export async function notifyAddonSubmitted(
  prisma: PrismaClient,
  addonId: string,
): Promise<void> {
  try {
    const addon = await prisma.addon.findUnique({
      where: { id: addonId },
      select: {
        id: true, name: true, slug: true, status: true,
        user: { select: { email: true, name: true } },
      },
    })
    if (!addon) return

    const devName = addon.user.name ?? addon.user.email
    const devEmail = addon.user.email
    const submittedAt = new Date().toLocaleString('es-MX', { timeZone: 'America/Mexico_City' })

    // — To admins —
    const admins = await adminEmails(prisma)
    for (const admin of admins) {
      const bodyRows = [
        renderParagraph(`Se ha enviado un nuevo add-on a revisi&oacute;n.`),
        renderParagraph(
          `<strong>Add-on:</strong> ${escapeHtml(addon.name)}<br />` +
          `<strong>Developer:</strong> ${escapeHtml(devName)} (${escapeHtml(devEmail)})<br />` +
          `<strong>Fecha/hora:</strong> ${escapeHtml(submittedAt)}`,
        ),
        renderPrimaryButton('Revisar en Admin', ADMIN_ADDONS_URL),
      ].join('')

      await sendMail({
        to: admin.email,
        subject: `[MarketPAQ] Nuevo add-on enviado a revisión: ${addon.name}`,
        html: renderEmailLayout({
          title: 'Nuevo add-on enviado a revisión',
          preheader: `${devName} envió "${addon.name}" a revisión.`,
          bodyRows,
        }),
        text: [
          `Nuevo add-on enviado a revisión.`,
          `Add-on: ${addon.name}`,
          `Developer: ${devName} (${devEmail})`,
          `Fecha/hora: ${submittedAt}`,
          ``,
          `Revisar: ${ADMIN_ADDONS_URL}`,
          ``,
          `— MarketPAQ`,
        ].join('\n'),
      })
    }

    // — To developer —
    const bodyRows = [
      renderParagraph(`Hola${addon.user.name ? `, ${escapeHtml(addon.user.name)}` : ''},`),
      renderParagraph(
        `Recibimos tu add-on <strong>${escapeHtml(addon.name)}</strong> y ya est&aacute; en revisi&oacute;n.`,
      ),
      renderNoteBox(
        '<strong>&iquest;Qu&eacute; sigue?</strong><br />' +
        'Nuestro equipo revisar&aacute; tu add-on. Te notificaremos por correo cuando haya una decisi&oacute;n. ' +
        'Mientras tanto, puedes seguir editando los detalles desde tu Dashboard.',
      ),
      renderPrimaryButton('Ir a mi Dashboard', DASHBOARD_URL),
    ].join('')

    await sendMail({
      to: devEmail,
      subject: `MarketPAQ · Recibimos tu add-on "${addon.name}"`,
      html: renderEmailLayout({
        title: 'Recibimos tu add-on',
        preheader: `Tu add-on "${addon.name}" está en revisión. Te avisamos en cuanto haya novedades.`,
        bodyRows,
      }),
      text: [
        `Hola${addon.user.name ? `, ${addon.user.name}` : ''},`,
        ``,
        `Recibimos tu add-on "${addon.name}" y ya está en revisión.`,
        ``,
        `¿Qué sigue? Nuestro equipo lo revisará y te notificaremos cuando haya una decisión.`,
        `Mientras tanto, puedes seguir editando desde tu Dashboard:`,
        DASHBOARD_URL,
        ``,
        `— El equipo de MarketPAQ`,
      ].join('\n'),
    })
  } catch (err) {
    console.error('[notifications] notifyAddonSubmitted error — addonId=%s err=%s', addonId, err)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// C1 — Add-on: status changed (approved / rejected)
// ─────────────────────────────────────────────────────────────────────────────

export async function notifyAddonStatusChanged(
  prisma: PrismaClient,
  opts: { addonId: string; fromStatus: string; toStatus: string; reason?: string },
): Promise<void> {
  const { addonId, fromStatus, toStatus, reason } = opts
  if (fromStatus === toStatus) return

  try {
    const addon = await prisma.addon.findUnique({
      where: { id: addonId },
      select: {
        id: true, name: true, slug: true,
        user: { select: { email: true, name: true } },
      },
    })
    if (!addon) return

    const devEmail = addon.user.email
    const devName = addon.user.name ?? devEmail

    if (toStatus === 'published') {
      const publicUrl = addonUrl(addon.slug)
      const bodyRows = [
        renderParagraph(`Hola${addon.user.name ? `, ${escapeHtml(addon.user.name)}` : ''},`),
        renderParagraph(
          `&iexcl;Buenas noticias! Tu add-on <strong>${escapeHtml(addon.name)}</strong> fue revisado y <strong>aprobado</strong>. ` +
          `Ya est&aacute; visible para todos los distribuidores en el cat&aacute;logo.`,
        ),
        renderPrimaryButton('Ver mi add-on publicado', publicUrl),
        renderDivider(),
        renderNoteBox(
          '<strong>Consejos para destacar:</strong><br />' +
          '&bull; Agrega im&aacute;genes y capturas de pantalla de calidad.<br />' +
          '&bull; Mantén tu descripci&oacute;n clara y actualizada.<br />' +
          '&bull; Responde r&aacute;pido a los contactos de distribuidores.',
        ),
      ].join('')

      await sendMail({
        to: devEmail,
        subject: `MarketPAQ · Tu add-on "${addon.name}" fue aprobado ✓`,
        html: renderEmailLayout({
          title: '¡Tu add-on fue aprobado!',
          preheader: `"${addon.name}" ya está publicado en el catálogo de MarketPAQ.`,
          bodyRows,
        }),
        text: [
          `Hola${addon.user.name ? `, ${addon.user.name}` : ''},`,
          ``,
          `¡Buenas noticias! Tu add-on "${addon.name}" fue aprobado y ya está en el catálogo.`,
          ``,
          `Ver tu add-on: ${publicUrl}`,
          ``,
          `Consejos:`,
          `• Agrega imágenes y capturas de calidad.`,
          `• Mantén tu descripción clara y actualizada.`,
          `• Responde rápido a los contactos.`,
          ``,
          `— El equipo de MarketPAQ`,
        ].join('\n'),
      })
    }

    if (toStatus === 'rejected') {
      const reasonText = reason?.trim()
        ? reason.trim()
        : 'Revisa los detalles en tu Dashboard y corrígelos antes de reenviar.'

      const bodyRows = [
        renderParagraph(`Hola${addon.user.name ? `, ${escapeHtml(addon.user.name)}` : ''},`),
        renderParagraph(
          `Tu add-on <strong>${escapeHtml(addon.name)}</strong> fue revisado y no fue aprobado en esta ocasi&oacute;n.`,
        ),
        renderWarningBox(
          `<strong>Motivo:</strong><br />${escapeHtml(reasonText)}`,
        ),
        renderParagraph(
          'Puedes editar tu add-on, corregir los puntos indicados y volver a enviarlo a revisi&oacute;n.',
        ),
        renderPrimaryButton('Editar y reenviar', DASHBOARD_URL),
      ].join('')

      await sendMail({
        to: devEmail,
        subject: `MarketPAQ · Tu add-on "${addon.name}" necesita ajustes`,
        html: renderEmailLayout({
          title: 'Tu add-on necesita ajustes',
          preheader: `Revisamos "${addon.name}" y necesita algunos cambios antes de publicarse.`,
          bodyRows,
        }),
        text: [
          `Hola${addon.user.name ? `, ${addon.user.name}` : ''},`,
          ``,
          `Tu add-on "${addon.name}" fue revisado y no fue aprobado en esta ocasión.`,
          ``,
          `Motivo: ${reasonText}`,
          ``,
          `Puedes editarlo y reenviarlo desde tu Dashboard:`,
          DASHBOARD_URL,
          ``,
          `— El equipo de MarketPAQ`,
        ].join('\n'),
      })
    }
  } catch (err) {
    console.error('[notifications] notifyAddonStatusChanged error — addonId=%s err=%s', addonId, err)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// C2 — Partner Líder: solicitud recibida
// ─────────────────────────────────────────────────────────────────────────────

export async function notifyPartnerLeaderRequested(
  prisma: PrismaClient,
  userId: string,
): Promise<void> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, name: true, company: true },
    })
    if (!user) return

    const displayName = user.name ?? user.email
    const company = user.company ? ` (${user.company})` : ''

    // — To admins —
    const admins = await adminEmails(prisma)
    for (const admin of admins) {
      const bodyRows = [
        renderParagraph('Se ha recibido una nueva solicitud de Partner L&iacute;der.'),
        renderParagraph(
          `<strong>Usuario:</strong> ${escapeHtml(displayName)}${escapeHtml(company)}<br />` +
          `<strong>Email:</strong> ${escapeHtml(user.email)}`,
        ),
        renderPrimaryButton('Revisar solicitudes', ADMIN_DEVELOPERS_URL),
      ].join('')

      await sendMail({
        to: admin.email,
        subject: `[MarketPAQ] Nueva solicitud de Partner Líder: ${displayName}`,
        html: renderEmailLayout({
          title: 'Nueva solicitud de Partner Líder',
          preheader: `${displayName} solicita convertirse en Partner Líder.`,
          bodyRows,
        }),
        text: [
          `Nueva solicitud de Partner Líder.`,
          `Usuario: ${displayName}${company}`,
          `Email: ${user.email}`,
          ``,
          `Revisar: ${ADMIN_DEVELOPERS_URL}`,
          ``,
          `— MarketPAQ`,
        ].join('\n'),
      })
    }

    // — To requesting user —
    const bodyRows = [
      renderParagraph(`Hola${user.name ? `, ${escapeHtml(user.name)}` : ''},`),
      renderParagraph(
        'Recibimos tu solicitud para convertirte en <strong>Partner L&iacute;der</strong> de MarketPAQ.',
      ),
      renderNoteBox(
        '<strong>&iquest;Qu&eacute; sigue?</strong><br />' +
        'Nuestro equipo revisar&aacute; tu perfil en los pr&oacute;ximos d&iacute;as h&aacute;biles. ' +
        'Te notificaremos por correo con la decisi&oacute;n. ' +
        'Mientras tanto, sigue usando la plataforma con normalidad.',
      ),
      renderSecondaryButton('Ver mi Dashboard', DASHBOARD_URL),
    ].join('')

    await sendMail({
      to: user.email,
      subject: 'MarketPAQ · Solicitud de Partner Líder recibida',
      html: renderEmailLayout({
        title: 'Solicitud recibida',
        preheader: 'Recibimos tu solicitud de Partner Líder. Te avisamos cuando haya una decisión.',
        bodyRows,
      }),
      text: [
        `Hola${user.name ? `, ${user.name}` : ''},`,
        ``,
        `Recibimos tu solicitud para convertirte en Partner Líder de MarketPAQ.`,
        ``,
        `¿Qué sigue? Nuestro equipo revisará tu perfil en los próximos días hábiles `,
        `y te notificaremos por correo con la decisión.`,
        ``,
        `Dashboard: ${DASHBOARD_URL}`,
        ``,
        `— El equipo de MarketPAQ`,
      ].join('\n'),
    })
  } catch (err) {
    console.error('[notifications] notifyPartnerLeaderRequested error — userId=%s err=%s', userId, err)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// C2 — Partner Líder: aprobado
// ─────────────────────────────────────────────────────────────────────────────

export async function notifyPartnerLeaderApproved(
  prisma: PrismaClient,
  userId: string,
): Promise<void> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, name: true, partnerLeaderCode: true },
    })
    if (!user || !user.partnerLeaderCode) return

    const code = user.partnerLeaderCode
    const joinLink = `${BASE_URL}/join/${encodeURIComponent(code)}`

    // Channel stats
    const now = new Date()
    const day7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const day30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

    const [total, last7, last30] = await Promise.all([
      prisma.user.count({ where: { uplinePartnerLeaderId: userId } }),
      prisma.user.count({ where: { uplinePartnerLeaderId: userId, createdAt: { gte: day7 } } }),
      prisma.user.count({ where: { uplinePartnerLeaderId: userId, createdAt: { gte: day30 } } }),
    ])

    const statsBlock = total > 0
      ? renderNoteBox(
          `<strong>Tu canal al d&iacute;a de hoy:</strong><br />` +
          `Partners totales: ${total}<br />` +
          `&Uacute;ltimos 7 d&iacute;as: ${last7}<br />` +
          `&Uacute;ltimos 30 d&iacute;as: ${last30}`,
        )
      : ''

    const bodyRows = [
      renderParagraph(`Hola${user.name ? `, ${escapeHtml(user.name)}` : ''},`),
      renderParagraph(
        '&iexcl;Felicidades! Tu solicitud fue aprobada. Ahora eres <strong>Partner L&iacute;der</strong> en MarketPAQ.',
      ),
      renderNoteBox(
        `<strong>Tu clave de invitaci&oacute;n:</strong><br />` +
        `<span style="font-family:'Courier New',monospace;font-size:18px;font-weight:bold;letter-spacing:4px;">${escapeHtml(code)}</span><br /><br />` +
        `<strong>Tu link de invitaci&oacute;n:</strong><br />` +
        `<a href="${escapeHtml(joinLink)}" style="color:#2563eb;word-break:break-all;">${escapeHtml(joinLink)}</a>`,
      ),
      statsBlock,
      renderParagraph(
        'Comparte tu link o clave para que nuevos distribuidores se unan a tu canal. ' +
        'El c&oacute;digo QR y las m&eacute;tricas completas est&aacute;n disponibles en tu Dashboard.',
      ),
      renderPrimaryButton('Ver mi canal (QR + métricas)', DASHBOARD_URL),
    ].join('')

    await sendMail({
      to: user.email,
      subject: 'MarketPAQ · ¡Ya eres Partner Líder!',
      html: renderEmailLayout({
        title: '¡Aprobado como Partner Líder!',
        preheader: '¡Felicidades! Ya eres Partner Líder. Aquí está tu clave y link de invitación.',
        bodyRows,
      }),
      text: [
        `Hola${user.name ? `, ${user.name}` : ''},`,
        ``,
        `¡Felicidades! Ahora eres Partner Líder en MarketPAQ.`,
        ``,
        `Tu clave de invitación: ${code}`,
        `Tu link de invitación: ${joinLink}`,
        ``,
        ...(total > 0 ? [
          `Tu canal:`,
          `  Partners totales: ${total}`,
          `  Últimos 7 días: ${last7}`,
          `  Últimos 30 días: ${last30}`,
          ``,
        ] : []),
        `El código QR y métricas completas están en tu Dashboard:`,
        DASHBOARD_URL,
        ``,
        `— El equipo de MarketPAQ`,
      ].join('\n'),
    })
  } catch (err) {
    console.error('[notifications] notifyPartnerLeaderApproved error — userId=%s err=%s', userId, err)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// C2 — Partner Líder: rechazado
// ─────────────────────────────────────────────────────────────────────────────

export async function notifyPartnerLeaderRejected(
  prisma: PrismaClient,
  userId: string,
  reason?: string,
): Promise<void> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, name: true },
    })
    if (!user) return

    const reasonText = reason?.trim() ?? ''

    const bodyRows = [
      renderParagraph(`Hola${user.name ? `, ${escapeHtml(user.name)}` : ''},`),
      renderParagraph(
        'Revisamos tu solicitud de Partner L&iacute;der y, por el momento, no podemos aprobarla.',
      ),
      reasonText
        ? renderWarningBox(`<strong>Motivo:</strong><br />${escapeHtml(reasonText)}`)
        : renderNoteBox('Si tienes dudas sobre la decisi&oacute;n, cont&aacute;ctanos.'),
      renderSecondaryButton('Ver mi Dashboard', DASHBOARD_URL),
    ].join('')

    await sendMail({
      to: user.email,
      subject: 'MarketPAQ · Actualización sobre tu solicitud de Partner Líder',
      html: renderEmailLayout({
        title: 'Solicitud de Partner Líder',
        preheader: 'Revisamos tu solicitud de Partner Líder. Contactanos si tienes preguntas.',
        bodyRows,
      }),
      text: [
        `Hola${user.name ? `, ${user.name}` : ''},`,
        ``,
        `Revisamos tu solicitud de Partner Líder y, por el momento, no podemos aprobarla.`,
        ...(reasonText ? [``, `Motivo: ${reasonText}`] : []),
        ``,
        `Si tienes dudas, contáctanos.`,
        ``,
        `Dashboard: ${DASHBOARD_URL}`,
        ``,
        `— El equipo de MarketPAQ`,
      ].join('\n'),
    })
  } catch (err) {
    console.error('[notifications] notifyPartnerLeaderRejected error — userId=%s err=%s', userId, err)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// C3 — Tags truncated by platform normalization
// ─────────────────────────────────────────────────────────────────────────────

export interface AffectedAddon {
  name: string
  slug: string
  removedTags: string[]
  remainingTags: string[]
}

export async function notifyTagsUpdated(
  to: string,
  developerName: string,
  affectedAddons: AffectedAddon[],
): Promise<void> {
  try {
    if (affectedAddons.length === 0) return

    const addonRows = affectedAddons.map(a => {
      const removed = a.removedTags.map(t => escapeHtml(t)).join(', ')
      const remaining = a.remainingTags.length > 0
        ? a.remainingTags.map(t => escapeHtml(t)).join(', ')
        : '<em>Sin clasificaciones</em>'
      const url = addonUrl(a.slug)
      return (
        `<tr>` +
        `<td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-weight:600;">${escapeHtml(a.name)}</td>` +
        `<td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;color:#dc2626;">${removed}</td>` +
        `<td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;">${remaining}</td>` +
        `<td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;"><a href="${url}" style="color:#4f46e5;">Editar</a></td>` +
        `</tr>`
      )
    }).join('')

    const tableHtml =
      `<table style="width:100%;border-collapse:collapse;font-size:14px;margin-top:8px;">` +
      `<thead><tr style="background:#f8fafc;">` +
      `<th style="padding:8px 12px;text-align:left;font-weight:600;color:#475569;border-bottom:2px solid #e2e8f0;">Add-on</th>` +
      `<th style="padding:8px 12px;text-align:left;font-weight:600;color:#dc2626;border-bottom:2px solid #e2e8f0;">Eliminadas</th>` +
      `<th style="padding:8px 12px;text-align:left;font-weight:600;color:#475569;border-bottom:2px solid #e2e8f0;">Quedan</th>` +
      `<th style="padding:8px 12px;text-align:left;font-weight:600;color:#475569;border-bottom:2px solid #e2e8f0;"></th>` +
      `</tr></thead><tbody>${addonRows}</tbody></table>`

    const bodyRows = [
      renderParagraph(`Hola${developerName ? `, ${escapeHtml(developerName)}` : ''},`),
      renderParagraph(
        `Actualizamos la pol&iacute;tica de clasificaciones en <strong>MarketPAQ</strong>: ` +
        `a partir de ahora cada add-on puede tener un m&aacute;ximo de <strong>3 clasificaciones</strong>.`,
      ),
      renderWarningBox(
        `<strong>Algunos de tus add-ons ten&iacute;an m&aacute;s de 3 clasificaciones.</strong><br />` +
        `Conservamos las primeras 3 y eliminamos el resto autom&aacute;ticamente.`,
      ),
      renderParagraph(tableHtml),
      renderNoteBox(
        'Puedes editar las clasificaciones de tus add-ons desde tu Dashboard en cualquier momento. ' +
        'Solo aseg&uacute;rate de no exceder el nuevo l&iacute;mite de 3.',
      ),
      renderPrimaryButton('Ir a mi Dashboard', DASHBOARD_URL),
    ].join('')

    const textLines: string[] = [
      `Hola${developerName ? `, ${developerName}` : ''},`,
      ``,
      `Actualizamos la política de clasificaciones en MarketPAQ: a partir de ahora cada add-on puede tener un máximo de 3 clasificaciones.`,
      ``,
      `Algunos de tus add-ons tenían más de 3 clasificaciones. Conservamos las primeras 3 y eliminamos el resto automáticamente.`,
      ``,
    ]
    for (const a of affectedAddons) {
      textLines.push(`Add-on: ${a.name}`)
      textLines.push(`  Eliminadas: ${a.removedTags.join(', ')}`)
      textLines.push(`  Quedan: ${a.remainingTags.join(', ') || 'Sin clasificaciones'}`)
      textLines.push(`  Editar: ${addonUrl(a.slug)}`)
      textLines.push(``)
    }
    textLines.push(`Dashboard: ${DASHBOARD_URL}`, ``, `— El equipo de MarketPAQ`)

    await sendMail({
      to,
      subject: 'MarketPAQ · Actualización de clasificaciones en tus add-ons',
      html: renderEmailLayout({
        title: 'Actualización de clasificaciones',
        preheader: 'Actualizamos el límite de clasificaciones a 3 por add-on. Revisa los cambios en tus add-ons.',
        bodyRows,
      }),
      text: textLines.join('\n'),
    })
  } catch (err) {
    console.error('[notifications] notifyTagsUpdated error — to=%s err=%s', to, err)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// E1 — Welcome email (post email verification)
// ─────────────────────────────────────────────────────────────────────────────

export async function notifyWelcome(
  prisma: PrismaClient,
  userId: string,
): Promise<void> {
  try {
    // Anti-spam: only send once
    const existing = await prisma.emailSendLog.findUnique({
      where: { kind_userId: { kind: 'welcome', userId } },
    })
    if (existing) return

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, name: true, userType: true },
    })
    if (!user) return

    const userType = user.userType

    let ctaLabel: string
    let ctaUrl: string
    let bodyExtra: string

    if (userType === 'developer') {
      ctaLabel = 'Completar mi perfil de developer'
      ctaUrl = DASHBOARD_URL
      bodyExtra = 'Como developer, puedes publicar tus add-ons y llegar a distribuidores en toda la red.'
    } else if (userType === 'partner') {
      ctaLabel = 'Explorar el catálogo'
      ctaUrl = CATALOG_URL
      bodyExtra = 'Como distribuidor, puedes explorar el catálogo de add-ons y contactar a los developers.'
    } else {
      ctaLabel = 'Ir a MarketPAQ'
      ctaUrl = BASE_URL
      bodyExtra = 'Completa tu perfil para aprovechar todas las funciones de la plataforma.'
    }

    const bodyRows = [
      renderParagraph(`Hola${user.name ? `, ${escapeHtml(user.name)}` : ''},`),
      renderParagraph(
        `Bienvenido a <strong>MarketPAQ</strong> &mdash; la plataforma que conecta a developers y distribuidores de software.`,
      ),
      renderParagraph(escapeHtml(bodyExtra)),
      renderPrimaryButton(ctaLabel, ctaUrl),
    ].join('')

    await sendMail({
      to: user.email,
      subject: '¡Bienvenido a MarketPAQ!',
      html: renderEmailLayout({
        title: '¡Bienvenido a MarketPAQ!',
        preheader: 'Tu cuenta está lista. Empieza a explorar la plataforma.',
        bodyRows,
      }),
      text: [
        `Hola${user.name ? `, ${user.name}` : ''},`,
        ``,
        `Bienvenido a MarketPAQ — la plataforma que conecta developers y distribuidores de software.`,
        ``,
        bodyExtra,
        ``,
        ctaUrl,
        ``,
        `— El equipo de MarketPAQ`,
      ].join('\n'),
    })

    // Log to prevent duplicates
    await prisma.emailSendLog.create({
      data: { kind: 'welcome', userId },
    })
  } catch (err) {
    console.error('[notifications] notifyWelcome error — userId=%s err=%s', userId, err)
  }
}
