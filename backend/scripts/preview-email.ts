/**
 * scripts/preview-email.ts
 *
 * Generates HTML for all email templates to stdout — no SMTP, no env required.
 *
 * Usage (from repo root):
 *   cd backend
 *   npx tsx scripts/preview-email.ts                    # prints both emails
 *   npx tsx scripts/preview-email.ts reset > /tmp/reset.html && xdg-open /tmp/reset.html
 *   npx tsx scripts/preview-email.ts verify > /tmp/verify.html && xdg-open /tmp/verify.html
 *
 * Or paste the output directly into https://htmlpreview.github.io
 * or any browser (File → Open).
 *
 * This script is intentionally NOT imported anywhere — dev-only helper.
 */

// Minimal env stubs so theme.ts doesn't explode
process.env.MARKETPAQ_PUBLIC_URL ??= 'https://marketpaq.com'

import {
  renderEmailLayout,
  renderParagraph,
  renderPrimaryButton,
  renderCodeBlock,
  renderFallbackLink,
  renderNoteBox,
  renderWarningBox,
} from '../src/email/theme.js'

// ── Dummy data ────────────────────────────────────────────────────────────────

const DUMMY_RESET_LINK =
  'https://marketpaq.com/reset-password?token=eyJhbGciOiJIUzI1NiJ9.dummytoken'

const DUMMY_OTP = '847 291'

// ── Templates ─────────────────────────────────────────────────────────────────

function buildResetHtml(): string {
  const bodyRows = [
    renderParagraph('Hola,'),
    renderParagraph(
      'Recibimos una solicitud para restablecer la contrase&ntilde;a de tu cuenta en MarketPAQ. ' +
      'Haz clic en el bot&oacute;n de abajo para elegir una nueva contrase&ntilde;a.',
    ),
    renderPrimaryButton('Restablecer contrase\u00f1a', DUMMY_RESET_LINK),
    renderFallbackLink(DUMMY_RESET_LINK),
    renderNoteBox(
      '<strong>Este enlace expira en 1 hora.</strong><br />' +
      'Si t&uacute; no solicitaste este cambio, puedes ignorar este mensaje ' +
      'con tranquilidad &mdash; tu cuenta no ser&aacute; afectada.',
    ),
  ].join('')

  return renderEmailLayout({
    title: 'Restablecer tu contrase\u00f1a',
    preheader: 'Solicitud de restablecimiento de contraseña en MarketPAQ. El enlace expira en 1 hora.',
    bodyRows,
  })
}

function buildVerifyHtml(): string {
  const bodyRows = [
    renderParagraph('Hola,'),
    renderParagraph(
      'Usa el siguiente c&oacute;digo para verificar tu correo electr&oacute;nico en MarketPAQ. ' +
      'Ing&oacute;resalo en la pantalla de verificaci&oacute;n.',
    ),
    renderCodeBlock(DUMMY_OTP),
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

  return renderEmailLayout({
    title: 'Verifica tu correo electr\u00f3nico',
    preheader: 'Tu código de verificación de MarketPAQ está listo. Expira en 15 minutos.',
    bodyRows,
  })
}

// ── CLI dispatch ──────────────────────────────────────────────────────────────

const arg = process.argv[2]

if (arg === 'reset') {
  process.stdout.write(buildResetHtml())
} else if (arg === 'verify') {
  process.stdout.write(buildVerifyHtml())
} else {
  // Default: print both with a separator comment
  process.stdout.write('<!-- ═══════════════ RESET PASSWORD ═══════════════ -->\n')
  process.stdout.write(buildResetHtml())
  process.stdout.write('\n\n<!-- ═══════════════ VERIFY EMAIL ════════════════ -->\n')
  process.stdout.write(buildVerifyHtml())
  process.stdout.write('\n')
}
