/**
 * mail.ts
 *
 * Zoho SMTP helper for transactional emails.
 *
 * Required env vars:
 *   ZOHO_SMTP_HOST        – e.g. smtp.zoho.com
 *   ZOHO_SMTP_PORT        – e.g. 465 (SSL) or 587 (STARTTLS)
 *   ZOHO_SMTP_USER        – Zoho account email
 *   ZOHO_SMTP_PASS        – Zoho app password
 *   ZOHO_SMTP_FROM        – Sender string, e.g. "MarketPAQ <noreply@fixitcomputacion.com>"
 *   MARKETPAQ_PUBLIC_URL  – Base URL for logo and links (default: https://marketpaq.com)
 *
 * Optional env vars:
 *   MAIL_MODE             – "smtp" (default) sends the email; "log" only writes
 *                           it to the server log. Used for local development so
 *                           no SMTP account is needed.
 *
 * When MAIL_MODE is "smtp" but the SMTP credentials are missing, the email is
 * not sent and the send returns { ok: false, reason: 'SMTP_NOT_CONFIGURED' }
 * (the backend never crashes because of a missing mail setup). Production
 * behaviour is unchanged as long as the SMTP variables are set.
 *
 * All send functions return { ok: true } on success or { ok: false, reason: string }
 * on failure — they never throw. Callers decide how to surface errors to the user.
 */
import nodemailer from 'nodemailer'
import {
  renderEmailLayout,
  renderParagraph,
  renderPrimaryButton,
  renderCodeBlock,
  renderFallbackLink,
  renderNoteBox,
  renderWarningBox,
} from '../email/theme.js'

export type MailResult = { ok: true } | { ok: false; reason: string }

export interface SendMailOptions {
  to: string
  subject: string
  html: string
  text: string
}

/**
 * "smtp" (default) sends the email through the configured SMTP server.
 * "log" only writes the email to the server log — used for local development.
 */
function isLogOnlyMode(): boolean {
  const mode = (process.env.MAIL_MODE ?? 'smtp').trim().toLowerCase()
  return mode === 'log' || mode === 'log-only' || mode === 'log_only'
}

/** True when both SMTP credentials are present. */
function hasSmtpCredentials(): boolean {
  return Boolean(process.env.ZOHO_SMTP_USER && process.env.ZOHO_SMTP_PASS)
}

/**
 * Writes the email to the server log instead of sending it.
 * Keeps local development usable without an SMTP account.
 */
function logEmail(label: string, opts: SendMailOptions & { from: string }, reason: string): void {
  console.info(
    '[mail] %s — email not sent (%s) to=%s subject=%s\n%s',
    label, reason, opts.to, opts.subject, opts.text,
  )
}

/**
 * Shared delivery path for every outgoing email.
 * Sends through SMTP when it is configured, otherwise logs the email.
 * Never throws — returns MailResult.
 */
async function deliver(
  label: string,
  opts: SendMailOptions & { from: string },
): Promise<MailResult> {
  if (isLogOnlyMode()) {
    logEmail(label, opts, 'MAIL_MODE=log')
    return { ok: true }
  }
  if (!hasSmtpCredentials()) {
    // Fail loudly: never report success for an email that was not sent, and
    // never log the body (it may contain reset or verification links).
    console.error(
      '[mail] %s not sent — SMTP not configured (set ZOHO_SMTP_USER and ZOHO_SMTP_PASS, or MAIL_MODE=log for local development) to=%s subject=%s',
      label, opts.to, opts.subject,
    )
    return { ok: false, reason: 'SMTP_NOT_CONFIGURED' }
  }
  try {
    const transport = createTransport()
    await transport.sendMail(opts)
    return { ok: true }
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err)
    console.error('[mail] %s failed — to=%s subject=%s reason=%s', label, opts.to, opts.subject, reason)
    return { ok: false, reason: 'SMTP_FAIL' }
  }
}

/**
 * Generic low-level send helper used by notifications.ts and job handlers.
 * Never throws — returns MailResult.
 */
export async function sendMail(opts: SendMailOptions): Promise<MailResult> {
  const from = process.env.ZOHO_SMTP_FROM ?? 'MarketPAQ <noreply@marketpaq.com>'
  return deliver('sendMail', { from, ...opts })
}

function createTransport() {
  const host = process.env.ZOHO_SMTP_HOST ?? 'smtp.zoho.com'
  const port = parseInt(process.env.ZOHO_SMTP_PORT ?? '465', 10)
  const user = process.env.ZOHO_SMTP_USER
  const pass = process.env.ZOHO_SMTP_PASS

  if (!user || !pass) {
    throw new Error('ZOHO_SMTP_USER and ZOHO_SMTP_PASS must be set')
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Password reset
// ─────────────────────────────────────────────────────────────────────────────

export async function sendPasswordResetEmail(to: string, resetLink: string): Promise<MailResult> {
  const from = process.env.ZOHO_SMTP_FROM ?? 'MarketPAQ <noreply@marketpaq.com>'
  const bodyRows = [
    renderParagraph('Hola,'),
    renderParagraph(
      'Recibimos una solicitud para restablecer la contrase&ntilde;a de tu cuenta en MarketPAQ. ' +
      'Haz clic en el bot&oacute;n de abajo para elegir una nueva contrase&ntilde;a.',
    ),
    renderPrimaryButton('Restablecer contrase\u00f1a', resetLink),
    renderFallbackLink(resetLink),
    renderNoteBox(
      '<strong>Este enlace expira en 1 hora.</strong><br />' +
      'Si t&uacute; no solicitaste este cambio, puedes ignorar este mensaje ' +
      'con tranquilidad &mdash; tu cuenta no ser&aacute; afectada.',
    ),
  ].join('')

  const html = renderEmailLayout({
    title: 'Restablecer tu contrase\u00f1a',
    preheader: 'Solicitud de restablecimiento de contraseña en MarketPAQ. El enlace expira en 1 hora.',
    bodyRows,
  })

  const text = [
    'Hola,',
    '',
    'Recibimos una solicitud para restablecer tu contraseña de MarketPAQ.',
    'Para continuar, abre el siguiente enlace en tu navegador:',
    '',
    resetLink,
    '',
    'Este enlace expira en 1 hora.',
    '',
    'Si tú no solicitaste este cambio, puedes ignorar este mensaje — tu cuenta no será afectada.',
    '',
    '— El equipo de MarketPAQ',
  ].join('\n')

  return deliver('sendPasswordResetEmail', {
    from,
    to,
    subject: 'Restablecer tu contraseña de MarketPAQ',
    text,
    html,
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Email verification (OTP code)
// ─────────────────────────────────────────────────────────────────────────────

export async function sendVerificationEmail(to: string, code: string): Promise<MailResult> {
  const from = process.env.ZOHO_SMTP_FROM ?? 'MarketPAQ <noreply@marketpaq.com>'
  const bodyRows = [
    renderParagraph('Hola,'),
    renderParagraph(
      'Usa el siguiente c&oacute;digo para verificar tu correo electr&oacute;nico en MarketPAQ. ' +
      'Ing&oacute;resalo en la pantalla de verificaci&oacute;n.',
    ),
    renderCodeBlock(code),
    renderParagraph('<strong>Este c&oacute;digo expira en 15 minutos.</strong>'),
    renderWarningBox(
      'Por seguridad, <strong>no compartas este c&oacute;digo</strong> con nadie. ' +
      'MarketPAQ nunca te lo pedir&aacute; por tel&eacute;fono ni por mensaje privado.',
    ),
    renderNoteBox(
      'Si no creaste una cuenta en MarketPAQ, puedes ignorar este correo. ' +
      'Nadie pudo registrarse sin confirmar este c&oacute;digo.',
    ),
  ].join('')

  const html = renderEmailLayout({
    title: 'Verifica tu correo electr\u00f3nico',
    // Preheader deliberately omits the code — avoid exposing OTP in push notifications
    preheader: 'Tu código de verificación de MarketPAQ está listo. Expira en 15 minutos.',
    bodyRows,
  })

  const text = [
    'Hola,',
    '',
    'Usa el siguiente código para verificar tu correo electrónico en MarketPAQ:',
    '',
    `    ${code}`,
    '',
    'Este código expira en 15 minutos.',
    '',
    'Por seguridad, no compartas este código con nadie.',
    'Si no creaste una cuenta en MarketPAQ, puedes ignorar este mensaje.',
    '',
    '— El equipo de MarketPAQ',
  ].join('\n')

  return deliver('sendVerificationEmail', {
    from,
    to,
    subject: 'Tu código de verificación MarketPAQ',
    text,
    html,
  })
}
