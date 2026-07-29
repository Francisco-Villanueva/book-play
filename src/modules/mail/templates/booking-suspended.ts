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

// Cancelación forzada por el complejo al bloquear un horario (ExceptionRule).
// Se diferencia de `booking-cancellation` en que el jugador no pidió esta baja:
// el motivo es obligatorio en el cuerpo, porque es la única explicación que recibe.
export interface BookingSuspendedProps extends BaseEmailProps {
  recipientName: string;
  businessName: string;
  courtName: string;
  date: string;
  startTime: string;
  endTime: string;
  reason?: string;
  isRecurring: boolean;
  rebookUrl?: string;
}

export function bookingSuspendedEmail(
  props: BookingSuspendedProps,
): RenderedEmail {
  const subject = `Tu turno del ${formatDateAr(props.date)} fue suspendido`;

  const body =
    heading('El complejo suspendió tu turno') +
    paragraph(
      `Hola ${esc(props.recipientName)}, <strong>${esc(props.businessName)}</strong> cerró la cancha en ese horario, así que tu turno quedó cancelado. Lamentamos el inconveniente.`,
    ) +
    calloutBox(
      `<strong>Motivo:</strong> ${esc(props.reason ?? 'el complejo no indicó un motivo')}`,
      COLORS.warningSoft,
      COLORS.ink900,
    ) +
    infoTable([
      { label: 'Complejo', value: esc(props.businessName) },
      { label: 'Cancha', value: esc(props.courtName) },
      { label: 'Fecha', value: esc(formatDateAr(props.date)) },
      {
        label: 'Horario',
        value: `${esc(formatTime(props.startTime))} a ${esc(formatTime(props.endTime))}`,
      },
    ]) +
    paragraph(
      props.isRecurring
        ? 'Es una fecha suelta: tu turno fijo sigue vigente para las demás semanas.'
        : 'Si ya habías pagado, coordiná la devolución directamente con el complejo.',
    ) +
    (props.rebookUrl
      ? button(props.rebookUrl, 'Buscar otro horario', COLORS.brand)
      : '');

  return {
    subject,
    html: renderLayout({
      title: subject,
      preheader: `${formatDateAr(props.date)} · ${formatTime(props.startTime)}`,
      bodyHtml: body,
      logoUrl: props.logoUrl,
    }),
  };
}
