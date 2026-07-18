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

export interface TrialEndingProps extends BaseEmailProps {
  recipientName: string;
  businessName: string;
  trialEndsAt: Date;
  daysLeft: number;
  upgradeUrl: string;
}

function isoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function trialEndingEmail(props: TrialEndingProps): RenderedEmail {
  const daysText = props.daysLeft <= 1 ? 'mañana' : `en ${props.daysLeft} días`;
  const subject = `Tu prueba gratis termina ${daysText}`;
  const body =
    heading('Tu período de prueba está por terminar') +
    paragraph(
      `Hola ${esc(props.recipientName)}, la prueba gratis de <strong>${esc(props.businessName)}</strong> finaliza ${daysText}.`,
    ) +
    calloutBox(
      `Vence el <strong>${esc(formatDateAr(isoDate(props.trialEndsAt)))}</strong>. Suscribite ahora para que tus canchas sigan recibiendo reservas sin interrupciones.`,
      COLORS.warningSoft,
      COLORS.warningDark,
    ) +
    button(props.upgradeUrl, 'Elegir un plan') +
    paragraph(
      'Si no te suscribís, el complejo quedará suspendido hasta que actives un plan.',
    );
  return {
    subject,
    html: renderLayout({
      title: subject,
      preheader: `Tu prueba termina ${daysText}. Elegí un plan para continuar.`,
      bodyHtml: body,
      logoUrl: props.logoUrl,
    }),
  };
}
