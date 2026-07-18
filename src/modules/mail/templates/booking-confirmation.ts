import {
  BaseEmailProps,
  RenderedEmail,
  button,
  esc,
  heading,
  infoTable,
  paragraph,
  renderLayout,
} from './layout';
import { formatCurrency, formatDateAr, formatTime } from './format';

export interface BookingConfirmationProps extends BaseEmailProps {
  recipientName: string;
  businessName: string;
  courtName: string;
  date: string;
  startTime: string;
  endTime: string;
  price: number;
  bookingUrl?: string;
}

export function bookingConfirmationEmail(
  props: BookingConfirmationProps,
): RenderedEmail {
  const subject = `Reserva confirmada — ${props.courtName}`;
  const body =
    heading('¡Tu reserva está confirmada!') +
    paragraph(
      `Hola ${esc(props.recipientName)}, tu reserva en <strong>${esc(props.businessName)}</strong> quedó confirmada.`,
    ) +
    infoTable([
      { label: 'Complejo', value: esc(props.businessName) },
      { label: 'Cancha', value: esc(props.courtName) },
      { label: 'Fecha', value: esc(formatDateAr(props.date)) },
      {
        label: 'Horario',
        value: `${esc(formatTime(props.startTime))} a ${esc(formatTime(props.endTime))}`,
      },
      { label: 'Precio', value: esc(formatCurrency(props.price)) },
    ]) +
    (props.bookingUrl ? button(props.bookingUrl, 'Ver mi reserva') : '') +
    paragraph('¡Que la disfrutes! 🎾');
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
