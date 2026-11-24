/**
 * email/theme.ts — MarketPAQ Email Theme v2
 *
 * Renders branded, production-quality HTML emails.
 *
 * Rules:
 *  - All CSS is 100% inline (Gmail/Outlook/Apple Mail compatible).
 *  - Layout is table-based at 600 px max width.
 *  - No Tailwind, no external stylesheets, no web fonts.
 *  - Logo URL comes from MARKETPAQ_PUBLIC_URL env (fallback: https://marketpaq.com).
 *  - No logic about tokens / links — only presentation.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Design tokens
// ─────────────────────────────────────────────────────────────────────────────

const T = {
  brand:         '#2563eb',  // primary blue
  bg:            '#f1f5f9',  // page background
  cardBg:        '#ffffff',  // email card
  text:          '#1f2937',  // primary text
  muted:         '#4b5563',  // secondary text (high enough contrast for a11y)
  lightMuted:    '#6b7280',  // footer / hints
  border:        '#e2e8f0',  // card & divider border
  noteBg:        '#f8fafc',  // info box background
  noteBorder:    '#94a3b8',  // info box left accent
  noteText:      '#374151',
  warningBg:     '#fffbeb',  // warning box background
  warningBorder: '#f59e0b',  // warning box left accent
  warningText:   '#92400e',
  codeBg:        '#f1f5f9',  // OTP code block
  codeBorder:    '#cbd5e1',
  maxWidth:      '600',
  font:          'Arial, Helvetica, sans-serif',
} as const

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** HTML-escape dynamic content to prevent injection. */
export function escapeHtml(str: string): string {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** Safely escape a URL for use in an href or src attribute. */
export function safeUrl(url: string): string {
  return escapeHtml(String(url))
}

// ─────────────────────────────────────────────────────────────────────────────
// Block components (each returns one or more <tr> rows)
// ─────────────────────────────────────────────────────────────────────────────

/** Hidden preheader — shows up in inbox snippet, not in rendered email body. */
export function renderPreheader(text: string): string {
  // &zwnj;&nbsp; filler pushes out the preview so body text doesn't bleed in.
  const filler = '&zwnj;&nbsp;'.repeat(40)
  return `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:${T.bg};">${escapeHtml(text)} ${filler}</div>`
}

/** A body paragraph row. Accepts safe HTML strings for inline formatting. */
export function renderParagraph(text: string): string {
  return `
<tr>
  <td style="padding:14px 40px 0;font-family:${T.font};font-size:16px;color:${T.muted};line-height:1.6;">
    ${text}
  </td>
</tr>`
}

/** Full-width horizontal rule divider. */
export function renderDivider(): string {
  return `
<tr>
  <td style="padding:0 40px;">
    <div style="border-top:1px solid ${T.border};font-size:0;line-height:0;">&nbsp;</div>
  </td>
</tr>`
}

/**
 * Primary CTA button — table-based for Outlook compatibility.
 * Renders as a centered button row.
 */
export function renderPrimaryButton(label: string, url: string): string {
  return `
<tr>
  <td align="center" style="padding:28px 40px 8px;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td style="border-radius:8px;background-color:${T.brand};">
          <a href="${safeUrl(url)}"
             target="_blank"
             aria-label="${escapeHtml(label)}"
             style="display:inline-block;padding:14px 36px;font-family:${T.font};font-size:16px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:8px;background-color:${T.brand};mso-padding-alt:0;">
            ${escapeHtml(label)}
          </a>
        </td>
      </tr>
    </table>
  </td>
</tr>`
}

/**
 * Secondary (outline) CTA button.
 * Border on <td> renders correctly in Outlook.
 */
export function renderSecondaryButton(label: string, url: string): string {
  return `
<tr>
  <td align="center" style="padding:12px 40px 8px;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td style="border-radius:8px;border:2px solid ${T.brand};">
          <a href="${safeUrl(url)}"
             target="_blank"
             aria-label="${escapeHtml(label)}"
             style="display:inline-block;padding:12px 32px;font-family:${T.font};font-size:15px;font-weight:bold;color:${T.brand};text-decoration:none;border-radius:8px;mso-padding-alt:0;">
            ${escapeHtml(label)}
          </a>
        </td>
      </tr>
    </table>
  </td>
</tr>`
}

/**
 * Fallback link row — raw URL displayed below the primary button.
 * Helps users in strict corporate Outlook where buttons are blocked.
 */
export function renderFallbackLink(url: string): string {
  return `
<tr>
  <td style="padding:6px 40px 4px;font-family:${T.font};font-size:13px;color:${T.lightMuted};text-align:center;word-break:break-all;line-height:1.5;">
    Si el bot&oacute;n no funciona, copia este enlace en tu navegador:<br />
    <a href="${safeUrl(url)}" target="_blank"
       style="color:${T.brand};text-decoration:underline;word-break:break-all;">${escapeHtml(url)}</a>
  </td>
</tr>`
}

/**
 * Info note box — gray background with left accent border.
 * Use for "si no solicitaste esto..." messages.
 */
export function renderNoteBox(text: string): string {
  return `
<tr>
  <td style="padding:20px 40px 4px;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
      <tr>
        <td style="background-color:${T.noteBg};border:1px solid ${T.border};border-left:3px solid ${T.noteBorder};border-radius:6px;padding:14px 18px;font-family:${T.font};font-size:14px;color:${T.noteText};line-height:1.6;">
          ${text}
        </td>
      </tr>
    </table>
  </td>
</tr>`
}

/**
 * Warning box — amber background with left accent border.
 * Use for security warnings ("no compartas este código").
 * No external icons — text-only for maximum compatibility.
 */
export function renderWarningBox(text: string): string {
  return `
<tr>
  <td style="padding:20px 40px 4px;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
      <tr>
        <td style="background-color:${T.warningBg};border:1px solid #fde68a;border-left:3px solid ${T.warningBorder};border-radius:6px;padding:14px 18px;font-family:${T.font};font-size:14px;color:${T.warningText};line-height:1.6;">
          ${text}
        </td>
      </tr>
    </table>
  </td>
</tr>`
}

/**
 * Monospace OTP / code block — large, centered, easy to read on mobile.
 */
export function renderCodeBlock(code: string): string {
  return `
<tr>
  <td align="center" style="padding:24px 40px 8px;">
    <div style="display:inline-block;font-family:'Courier New',Courier,monospace;font-size:34px;font-weight:bold;letter-spacing:10px;color:${T.text};background-color:${T.codeBg};border:1px solid ${T.codeBorder};border-radius:8px;padding:18px 36px;line-height:1;">
      ${escapeHtml(code)}
    </div>
  </td>
</tr>`
}

/** Footer rows — product name, auto-message notice, copyright. */
export function renderFooter({ productName = 'MarketPAQ' }: { productName?: string } = {}): string {
  return `
<tr>
  <td style="padding:20px 40px 32px;font-family:${T.font};font-size:12px;color:${T.lightMuted};text-align:center;line-height:1.7;">
    <strong style="color:${T.muted};">${escapeHtml(productName)}</strong><br />
    Este es un mensaje autom&aacute;tico &mdash; por favor no respondas a este correo.<br />
    &copy; ${new Date().getFullYear()} ${escapeHtml(productName)}. Todos los derechos reservados.
  </td>
</tr>`
}

// ─────────────────────────────────────────────────────────────────────────────
// Layout
// ─────────────────────────────────────────────────────────────────────────────

export interface EmailLayoutOptions {
  /** <title> tag value and visible H1 inside the card. */
  title: string
  /** Short inbox preview text (hidden in body). Keep under 90 chars. */
  preheader: string
  /**
   * Body rows — valid <tr>...</tr> strings from the component helpers above.
   * Rendered between the H1 heading and the footer divider.
   */
  bodyRows: string
}

/**
 * Renders a complete, standalone HTML email document.
 *
 * Example:
 *   renderEmailLayout({
 *     title: 'Verifica tu correo',
 *     preheader: 'Tu código de verificación está listo.',
 *     bodyRows: [
 *       renderParagraph('Hola, usa el código a continuación:'),
 *       renderCodeBlock('123456'),
 *       renderWarningBox('No compartas este código con nadie.'),
 *     ].join(''),
 *   })
 */
export function renderEmailLayout({ title, preheader, bodyRows }: EmailLayoutOptions): string {
  const publicUrl = process.env.MARKETPAQ_PUBLIC_URL ?? 'https://marketpaq.com'
  const logoUrl   = `${publicUrl}/marketpaq-logo.png`

  return `<!DOCTYPE html>
<html lang="es" xmlns="http://www.w3.org/1999/xhtml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <meta name="color-scheme" content="light" />
  <meta name="supported-color-schemes" content="light" />
  <title>${escapeHtml(title)}</title>
  <!--[if mso]>
  <noscript><xml><o:OfficeDocumentSettings>
    <o:PixelsPerInch>96</o:PixelsPerInch>
  </o:OfficeDocumentSettings></xml></noscript>
  <![endif]-->
</head>
<body style="margin:0;padding:0;background-color:${T.bg};-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">

${renderPreheader(preheader)}

<!--[if mso | IE]><table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%"><tr><td><![endif]-->

<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
       style="background-color:${T.bg};padding:40px 16px;">
  <tr>
    <td align="center" valign="top">

      <!-- Card: max 600px wide -->
      <table role="presentation" cellpadding="0" cellspacing="0" border="0"
             width="${T.maxWidth}" style="max-width:${T.maxWidth}px;width:100%;background-color:${T.cardBg};border-radius:12px;border:1px solid ${T.border};">

        <!-- Logo header -->
        <tr>
          <td align="center" style="padding:36px 40px 28px;">
            <a href="${safeUrl(publicUrl)}" target="_blank" style="text-decoration:none;display:inline-block;">
              <img src="${safeUrl(logoUrl)}"
                   alt="MarketPAQ"
                   width="148"
                   height="auto"
                   style="display:block;border:0;max-width:148px;height:auto;" />
            </a>
          </td>
        </tr>

        ${renderDivider()}

        <!-- H1 heading -->
        <tr>
          <td style="padding:28px 40px 4px;">
            <h1 style="margin:0;font-family:${T.font};font-size:22px;font-weight:bold;color:${T.text};line-height:1.3;">
              ${escapeHtml(title)}
            </h1>
          </td>
        </tr>

        <!-- Body rows -->
        ${bodyRows}

        <!-- Spacer -->
        <tr><td style="height:24px;font-size:0;line-height:0;">&nbsp;</td></tr>

        ${renderDivider()}
        ${renderFooter()}

      </table>

    </td>
  </tr>
</table>

<!--[if mso | IE]></td></tr></table><![endif]-->

</body>
</html>`
}

// ─────────────────────────────────────────────────────────────────────────────
// Back-compat aliases — keeps any existing import in mail.ts working
// ─────────────────────────────────────────────────────────────────────────────
/** @deprecated Use renderParagraph */
export const paragraphHtml    = renderParagraph
/** @deprecated Use renderPrimaryButton */
export const buttonHtml       = renderPrimaryButton
/** @deprecated Use renderCodeBlock */
export const codeBlockHtml    = renderCodeBlock
/** @deprecated Use renderDivider */
export const dividerHtml      = renderDivider
/** @deprecated Use renderFallbackLink */
export const fallbackLinkHtml = renderFallbackLink
