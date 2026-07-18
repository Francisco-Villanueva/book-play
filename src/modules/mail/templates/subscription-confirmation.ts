import {
  BaseEmailProps,
  RenderedEmail,
  button,
  calloutBox,
  esc,
  heading,
  infoTable,
  paragraph,
  renderLayout,
} from './layout';
import { formatDateAr } from './format';

export interface SubscriptionConfirmationProps extends BaseEmailProps {
  recipientName: string;
  businessName: string;
  planName: string;
  periodEnd: Date;
  adminUrl?: string;
}

function isoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function subscriptionConfirmationEmail(
  props: SubscriptionConfirmationProps,
): RenderedEmail {
  const subject = `Suscripción activada — ${props.planName}`;
  const body =
    heading('¡Tu suscripción está activa!') +
    paragraph(
      `Hola ${esc(props.recipientName)}, la suscripción de <strong>${esc(props.businessName)}</strong> quedó activada. ¡Gracias por sumarte!`,
    ) +
    calloutBox(
      `Plan <strong>${esc(props.planName)}</strong> activo con todas sus funciones habilitadas.`,
    ) +
    infoTable([
      { label: 'Plan', value: esc(props.planName) },
      {
        label: 'Válido hasta',
        value: esc(formatDateAr(isoDate(props.periodEnd))),
      },
    ]) +
    (props.adminUrl ? button(props.adminUrl, 'Ir al panel') : '');
  return {
    subject,
    html: renderLayout({
      title: subject,
      preheader: `Plan ${props.planName} activo hasta ${formatDateAr(isoDate(props.periodEnd))}.`,
      bodyHtml: body,
      logoUrl: props.logoUrl,
    }),
  };
}
