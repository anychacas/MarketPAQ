/**
 * jobs/handlers/remindCompleteProfile.ts
 *
 * Remind users with userType='unset' to complete their registration by
 * choosing their account type (partner | developer | partner_leader).
 *
 * Rules:
 *  - Targets: emailVerified=true AND userType='unset'
 *  - Send only if profileReminderSentAt IS NULL or <= 7 days ago
 *  - Hard cap: stop after MAX_REMINDERS (8) sends per user (~56 days)
 *  - 300ms delay between sends (Zoho rate limit ~200/h)
 *  - dryRun=true     → logs candidates, sends nothing, no DB writes
 *  - emailOverride   → sends only to that address, no DB writes (for testing)
 */
import type { PrismaClient } from '@prisma/client'
import { sendMail } from '../../services/mail'
import {
  renderEmailLayout,
  renderParagraph,
  renderPrimaryButton,
  renderDivider,
  renderNoteBox,
  renderFallbackLink,
  escapeHtml,
} from '../../email/theme'

const BASE_URL = process.env.MARKETPAQ_PUBLIC_URL ?? 'https://marketpaq.com'
const ONBOARDING_URL = `${BASE_URL}/OnboardingRole`

const REMINDER_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000  // 7 days between sends
const MAX_REMINDERS = 8                                  // hard cap per user (~56 days)
const SEND_DELAY_MS = 300                               // anti-throttle for Zoho SMTP

export interface RemindCompleteProfileOptions {
  prisma: PrismaClient
  /** If true, log candidates but skip all sends and DB writes. */
  dryRun?: boolean
  /** If set, send only to this address for testing. Skips 7-day filter and DB writes. */
  emailOverride?: string
}

export interface RemindCompleteProfileResult {
  dryRun?: boolean
  candidates: number
  sent: number
  failed: number
  preview?: { id: string; email: string; name: string | null; reminderCount: number }[]
}

function buildSubject(): string {
  return 'Activa tu cuenta en MarketPAQ'
}

function buildBodyRows(name: string | null): string {
  const greeting = name ? `Hola, ${escapeHtml(name)},` : 'Hola,'

  const card = (title: string, body: string) => `
<tr>
  <td style="padding:5px 40px;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
      <tr>
        <td style="background-color:#f8fafc;border:1px solid #e2e8f0;border-left:4px solid #2563eb;border-radius:6px;padding:15px 20px;font-family:Arial,Helvetica,sans-serif;">
          <strong style="font-size:15px;color:#1f2937;">${title}</strong><br />
          <span style="font-size:14px;color:#4b5563;line-height:1.6;">${body}</span>
        </td>
      </tr>
    </table>
  </td>
</tr>`

  return [
    renderParagraph(greeting),
    renderParagraph(
      'Tu cuenta en MarketPAQ ya est&aacute; activa. Solo falta un paso: ' +
      'decirnos qu&eacute; haces para mostrarte lo que m&aacute;s te sirve.',
    ),
    renderDivider(),
    `
<tr>
  <td style="padding:20px 40px 10px;font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:bold;color:#1f2937;line-height:1.3;">
    &iquest;Para qu&eacute; quieres usar MarketPAQ?
  </td>
</tr>`,
    card(
      'Distribuidor (Partner)',
      'Encuentra soluciones listas para ofrecer a tus clientes ' +
      'y genera nuevas oportunidades de venta.',
    ),
    card(
      'Desarrollador (Developer)',
      'Publica tus soluciones y con&eacute;ctate con distribuidores ' +
      'que pueden llevarlas a m&aacute;s clientes.',
    ),
    card(
      'Partner L&iacute;der',
      'Organiza tu red de distribuidores y escala tu operaci&oacute;n ' +
      'desde un solo lugar.',
    ),
    `<tr><td style="height:10px;font-size:0;line-height:0;">&nbsp;</td></tr>`,
    renderPrimaryButton('Elegir mi tipo de cuenta \u2192', ONBOARDING_URL),
    renderFallbackLink(ONBOARDING_URL),
    renderDivider(),
    renderNoteBox('Si ya hiciste este paso, puedes ignorar este correo.'),
  ].join('')
}

function buildText(name: string | null): string {
  const greeting = name ? `Hola, ${name},` : 'Hola,'
  return [
    greeting,
    '',
    'Tu cuenta en MarketPAQ ya está activa. Solo falta un paso:',
    'decirnos qué haces para mostrarte lo que más te sirve.',
    '',
    '¿Para qué quieres usar MarketPAQ?',
    '',
    'Distribuidor (Partner)',
    'Encuentra soluciones listas para ofrecer a tus clientes',
    'y genera nuevas oportunidades de venta.',
    '',
    'Desarrollador (Developer)',
    'Publica tus soluciones y conéctate con distribuidores',
    'que pueden llevarlas a más clientes.',
    '',
    'Partner Líder',
    'Organiza tu red de distribuidores y escala tu operación',
    'desde un solo lugar.',
    '',
    `Elegir mi tipo de cuenta: ${ONBOARDING_URL}`,
    '',
    'Si ya hiciste este paso, puedes ignorar este correo.',
    '',
    '— El equipo de MarketPAQ',
  ].join('\n')
}

export async function runRemindCompleteProfile(
  opts: RemindCompleteProfileOptions,
): Promise<RemindCompleteProfileResult> {
  const { prisma, dryRun = false, emailOverride } = opts

  const cutoff = new Date(Date.now() - REMINDER_INTERVAL_MS)

  // Fetch candidates:
  //  - first reminder: profileReminderSentAt IS NULL AND createdAt <= 7 days ago
  //  - subsequent:     profileReminderSentAt <= 7 days ago
  const candidates = await prisma.user.findMany({
    where: {
      userType: 'unset',
      profileReminderCount: { lt: MAX_REMINDERS },
      OR: [
        { profileReminderSentAt: null,        createdAt: { lte: cutoff } },
        { profileReminderSentAt: { lte: cutoff } },
      ],
    },
    select: { id: true, email: true, name: true, profileReminderCount: true },
    orderBy: { createdAt: 'asc' },
  })

  console.info(
    '[remindCompleteProfile] candidates=%d dryRun=%s emailOverride=%s',
    candidates.length,
    dryRun,
    emailOverride ?? 'none',
  )

  if (dryRun) {
    return {
      dryRun: true,
      candidates: candidates.length,
      sent: 0,
      failed: 0,
      preview: candidates.map(u => ({
        id: u.id,
        email: u.email,
        name: u.name,
        reminderCount: u.profileReminderCount,
      })),
    }
  }

  // emailOverride: send to a single test address only (stub, no DB writes)
  const recipients = emailOverride
    ? [{ id: 'override', email: emailOverride, name: null as string | null, profileReminderCount: 0 }]
    : candidates

  let sent = 0
  let failed = 0

  const subject = buildSubject()

  for (const user of recipients) {
    try {
      const html = renderEmailLayout({
        title: 'Activa tu cuenta en MarketPAQ',
        preheader: 'Elige tu tipo de perfil y accede a todo lo que MarketPAQ tiene para ti.',
        bodyRows: buildBodyRows(user.name),
      })

      const result = await sendMail({
        to: user.email,
        subject,
        html,
        text: buildText(user.name),
      })

      if (result.ok) {
        // Only write to DB for real runs (not emailOverride stub)
        if (!emailOverride) {
          await prisma.user.update({
            where: { id: user.id },
            data: {
              profileReminderSentAt: new Date(),
              profileReminderCount: { increment: 1 },
            },
          })
        }
        sent++
        console.info(
          '[remindCompleteProfile] sent to=%s reminderCount=%d',
          user.email,
          user.profileReminderCount + 1,
        )
      } else {
        failed++
        console.error('[remindCompleteProfile] smtp_fail to=%s', user.email)
      }
    } catch (err) {
      failed++
      console.error('[remindCompleteProfile] error to=%s err=%s', user.email, err)
    }

    // Rate-limit delay (skip on last item or single recipient)
    if (recipients.length > 1) {
      await new Promise(resolve => setTimeout(resolve, SEND_DELAY_MS))
    }
  }

  console.info(
    '[remindCompleteProfile] done candidates=%d sent=%d failed=%d',
    candidates.length,
    sent,
    failed,
  )

  return { candidates: candidates.length, sent, failed }
}
