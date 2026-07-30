import {
  BaseEmailProps,
  COLORS,
  RenderedEmail,
  button,
  calloutBox,
  esc,
  heading,
  infoTable,
  paragraph,
  renderLayout,
} from './layout';
import { formatDateAr, formatTime } from './format';

// Aviso al complejo de que un cliente liberó un turno. Va sólo a OWNER y ADMIN,
// y sólo cuando canceló el cliente: si canceló el propio staff, ya lo sabe.
export interface BookingCancelledByClientProps extends BaseEmailProps {
  recipientName: string;
  businessName: string;
  clientName: string;
  courtName: string;
  date: string;
  startTime: string;
  endTime: string;
  isRecurringInstance: boolean;
  agendaUrl?: string;
}

export function bookingCancelledByClientEmail(
  props: BookingCancelledByClientProps,
): RenderedEmail {
  const subject = `Turno liberado — ${props.courtName}, ${formatDateAr(props.date)}`;

  const body =
    heading('Un cliente canceló su turno') +
    paragraph(
      `Hola ${esc(props.recipientName)}, <strong>${esc(props.clientName)}</strong> canceló su turno en ${esc(props.businessName)}. La cancha quedó libre en ese horario.`,
    ) +
    infoTable([
      { label: 'Cliente', value: esc(props.clientName) },
      { label: 'Cancha', value: esc(props.courtName) },
      { label: 'Fecha', value: esc(formatDateAr(props.date)) },
      {
        label: 'Horario',
        value: `${esc(formatTime(props.startTime))} a ${esc(formatTime(props.endTime))}`,
      },
    ]) +
    (props.isRecurringInstance
      ? calloutBox(
          'Es una fecha suelta de un <strong>turno fijo</strong>. La serie sigue vigente para las demás semanas.',
        )
      : '') +
    (props.agendaUrl
      ? button(props.agendaUrl, 'Ver la agenda', COLORS.brand)
      : '');

  return {
    subject,
    html: renderLayout({
      title: subject,
      preheader: `${props.clientName} · ${formatDateAr(props.date)} ${formatTime(props.startTime)}`,
      bodyHtml: body,
      logoUrl: props.logoUrl,
    }),
  };
}
