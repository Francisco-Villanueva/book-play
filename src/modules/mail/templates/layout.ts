// Design-system tokens resueltos a valores literales — los clientes de email no
// cargan CSS externo, así que todo va inline. Fuente: design-system/project/tokens/colors.css
export const COLORS = {
  brand: '#0CA86A',
  brandHover: '#0A8C58',
  brandDark: '#097046',
  brandSoft: '#E7FAF0',
  ink900: '#131A1F',
  ink700: '#38424A',
  ink500: '#677580',
  ink100: '#E6EBEE',
  ink25: '#F8FAFB',
  white: '#FFFFFF',
  link: '#1F66D6',
  danger: '#E5484D',
  dangerDark: '#A52A2D',
  dangerSoft: '#FDECEC',
  warning: '#F59E0B',
  warningDark: '#B26905',
  warningSoft: '#FFF4E0',
} as const;

const FONT_BODY =
  "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const FONT_DISPLAY =
  "'Space Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

export interface RenderedEmail {
  subject: string;
  html: string;
}

// El logo se inyecta desde MailService (config MAIL_LOGO_URL); cada template lo recibe.
export interface BaseEmailProps {
  logoUrl?: string;
}

// Escapa valores dinámicos para que un nombre/nota no rompa el HTML del correo.
export function esc(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function heading(text: string): string {
  return `<h1 style="margin:0 0 16px;font-family:${FONT_DISPLAY};font-size:22px;line-height:1.3;font-weight:700;color:${COLORS.ink900};">${text}</h1>`;
}

export function paragraph(html: string): string {
  return `<p style="margin:0 0 16px;font-family:${FONT_BODY};font-size:15px;line-height:1.6;color:${COLORS.ink700};">${html}</p>`;
}

export function button(
  href: string,
  label: string,
  color: string = COLORS.brand,
): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 20px;">
    <tr><td style="border-radius:10px;background:${color};">
      <a href="${esc(href)}" style="display:inline-block;padding:13px 26px;font-family:${FONT_DISPLAY};font-size:15px;font-weight:600;color:${COLORS.white};text-decoration:none;border-radius:10px;">${label}</a>
    </td></tr>
  </table>`;
}

// Tabla de datos clave/valor (fecha, cancha, monto, etc.).
export function infoTable(rows: { label: string; value: string }[]): string {
  const body = rows
    .map(
      (r) => `<tr>
        <td style="padding:8px 0;font-family:${FONT_BODY};font-size:13px;color:${COLORS.ink500};vertical-align:top;">${esc(r.label)}</td>
        <td style="padding:8px 0;font-family:${FONT_BODY};font-size:14px;font-weight:600;color:${COLORS.ink900};text-align:right;vertical-align:top;">${r.value}</td>
      </tr>`,
    )
    .join('');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;border-top:1px solid ${COLORS.ink100};border-bottom:1px solid ${COLORS.ink100};">${body}</table>`;
}

// Panel destacado (por ejemplo, un aviso o un monto grande).
export function calloutBox(
  html: string,
  bg: string = COLORS.brandSoft,
  fg: string = COLORS.ink900,
): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;border-radius:10px;background:${bg};">
    <tr><td style="padding:16px 18px;font-family:${FONT_BODY};font-size:15px;line-height:1.5;color:${fg};">${html}</td></tr>
  </table>`;
}

function header(logoUrl?: string): string {
  const brandmark = logoUrl
    ? `<img src="${esc(logoUrl)}" alt="Book &amp; Play" height="28" style="height:28px;display:block;border:0;" />`
    : `<span style="font-family:${FONT_DISPLAY};font-size:20px;font-weight:700;color:${COLORS.brand};letter-spacing:-0.3px;">Book<span style="color:${COLORS.ink900};"> &amp; </span>Play</span>`;
  return `<tr><td style="padding:28px 32px 8px;">${brandmark}</td></tr>`;
}

function footer(): string {
  return `<tr><td style="padding:8px 32px 28px;">
    <hr style="border:0;border-top:1px solid ${COLORS.ink100};margin:0 0 16px;" />
    <p style="margin:0;font-family:${FONT_BODY};font-size:12px;line-height:1.5;color:${COLORS.ink500};">
      Este es un correo automático de Book &amp; Play. Por favor, no respondas a este mensaje.
    </p>
  </td></tr>`;
}

export function renderLayout(params: {
  title: string;
  preheader?: string;
  bodyHtml: string;
  logoUrl?: string;
}): string {
  const { title, preheader, bodyHtml, logoUrl } = params;
  const preheaderHtml = preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(preheader)}</div>`
    : '';
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="light" />
  <title>${esc(title)}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap');
    body { margin:0; padding:0; background:${COLORS.ink25}; }
  </style>
</head>
<body style="margin:0;padding:0;background:${COLORS.ink25};">
  ${preheaderHtml}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COLORS.ink25};padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:${COLORS.white};border-radius:16px;border:1px solid ${COLORS.ink100};overflow:hidden;">
        ${header(logoUrl)}
        <tr><td style="padding:16px 32px 8px;">${bodyHtml}</td></tr>
        ${footer()}
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
