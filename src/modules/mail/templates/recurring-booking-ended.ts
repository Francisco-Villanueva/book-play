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
import { formatDateAr, formatDayOfWeekAr, formatTime } from './format';

export interface RecurringBookingEndedProps extends BaseEmailProps {
  recipientName: string;
  businessName: string;
  courtName: string;
  dayOfWeek: number;
  startTime: string;
  cancelledCount: number;
  from: string;
  rebookUrl?: string;
}

export function recurringBookingEndedEmail(
  props: RecurringBookingEndedProps,
): RenderedEmail {
  const day = formatDayOfWeekAr(props.dayOfWeek);
  const subject = `Tu turno fijo de los ${day} finalizó`;
  const turnos =
    props.cancelledCount === 1 ? '1 turno' : `${props.cancelledCount} turnos`;

  const body =
    heading('Tu turno fijo finalizó') +
    paragraph(
      `Hola ${esc(props.recipientName)}, te avisamos que tu turno fijo en <strong>${esc(props.businessName)}</strong> ya no sigue vigente.`,
    ) +
    infoTable([
      { label: 'Complejo', value: esc(props.businessName) },
      { label: 'Cancha', value: esc(props.courtName) },
      { label: 'Día', value: `Todos los ${esc(day)}` },
      { label: 'Horario', value: esc(formatTime(props.startTime)) },
      {
        label: 'Desde',
        value: esc(formatDateAr(props.from)),
      },
      { label: 'Turnos dados de baja', value: esc(turnos) },
    ]) +
    paragraph(
      'Los turnos que ya jugaste no se ven afectados. Si querés retomarlo, hablá con el complejo.',
    ) +
    (props.rebookUrl
      ? button(props.rebookUrl, 'Reservar un turno', COLORS.brand)
      : '');

  return {
    subject,
    html: renderLayout({
      title: subject,
      preheader: `${turnos} dados de baja desde el ${formatDateAr(props.from)}`,
      bodyHtml: body,
      logoUrl: props.logoUrl,
    }),
  };
}
