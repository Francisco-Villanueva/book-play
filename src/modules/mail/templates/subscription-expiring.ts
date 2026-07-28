import {
  BaseEmailProps,
  COLORS,
  RenderedEmail,
  button,
  calloutBox,
  esc,
  heading,
  paragraph,
  renderLayout,
} from './layout';
import { formatDateAr } from './format';

export type ExpiryReason = 'trial' | 'subscription';

export interface SubscriptionExpiringProps extends BaseEmailProps {
  recipientName: string;
  businessName: string;
  expiresAt: Date;
  daysLeft: number;
  reason: ExpiryReason;
  upgradeUrl: string;
}

function isoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// El tono escala con la cercanía: a 10 días es un dato, a 1 día es una alarma.
function tone(daysLeft: number): { bg: string; fg: string; cta: string } {
  if (daysLeft <= 1) {
    return { bg: COLORS.dangerSoft, fg: COLORS.dangerDark, cta: COLORS.danger };
  }
  if (daysLeft <= 5) {
    return {
      bg: COLORS.warningSoft,
      fg: COLORS.warningDark,
      cta: COLORS.brand,
    };
  }
  return { bg: COLORS.brandSoft, fg: COLORS.ink900, cta: COLORS.brand };
}

export function subscriptionExpiringEmail(
  props: SubscriptionExpiringProps,
): RenderedEmail {
  const { daysLeft, reason } = props;
  const what = reason === 'trial' ? 'Tu prueba gratis' : 'Tu suscripción';
  const daysText =
    daysLeft <= 0 ? 'hoy' : daysLeft === 1 ? 'mañana' : `en ${daysLeft} días`;
  const colors = tone(daysLeft);

  const subject =
    daysLeft <= 1
      ? `${what} de ${props.businessName} vence ${daysText}`
      : `${what} vence ${daysText}`;

  const body =
    heading(
      daysLeft <= 1 ? `${what} vence ${daysText}` : `${what} está por vencer`,
    ) +
    paragraph(
      `Hola ${esc(props.recipientName)}, ${what.toLowerCase()} de <strong>${esc(props.businessName)}</strong> finaliza ${daysText}, el <strong>${esc(formatDateAr(isoDate(props.expiresAt)))}</strong>.`,
    ) +
    calloutBox(
      'Cuando venza, tu complejo pasa a <strong>modo solo lectura</strong>: vas a poder ver y cancelar las reservas que ya tenés, ' +
        'pero no vas a poder cargar nuevas reservas, ni editar canchas ni horarios. Tus datos quedan intactos.',
      colors.bg,
      colors.fg,
    ) +
    button(props.upgradeUrl, 'Elegir un plan', colors.cta) +
    paragraph(
      'Activá un plan antes de esa fecha y tu complejo sigue operando sin interrupciones.',
    );

  return {
    subject,
    html: renderLayout({
      title: subject,
      preheader: `${what} vence ${daysText}. Activá un plan para seguir operando.`,
      bodyHtml: body,
      logoUrl: props.logoUrl,
    }),
  };
}
