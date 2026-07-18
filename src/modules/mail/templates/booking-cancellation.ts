import {
  BaseEmailProps,
  COLORS,
  RenderedEmail,
  button,
  esc,
  heading,
  infoTable,
  paragraph,
  renderLayout,
} from './layout';
import { formatDateAr, formatTime } from './format';

export interface BookingCancellationProps extends BaseEmailProps {
  recipientName: string;
  businessName: string;
  courtName: string;
  date: string;
  startTime: string;
  endTime: string;
  rebookUrl?: string;
}

export function bookingCancellationEmail(
  props: BookingCancellationProps,
): RenderedEmail {
  const subject = `Reserva cancelada — ${props.courtName}`;
  const body =
    heading('Tu reserva fue cancelada') +
    paragraph(
      `Hola ${esc(props.recipientName)}, te confirmamos que la siguiente reserva en <strong>${esc(props.businessName)}</strong> fue cancelada.`,
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
    (props.rebookUrl
      ? button(props.rebookUrl, 'Reservar otro turno', COLORS.brand)
      : '') +
    paragraph(
      'Si esto fue un error, podés generar una nueva reserva cuando quieras.',
    );
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
