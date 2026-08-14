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
import {
  formatCurrency,
  formatDateAr,
  formatDayOfWeekAr,
  formatTime,
} from './format';

export interface RecurringBookingConfirmationProps extends BaseEmailProps {
  recipientName: string;
  businessName: string;
  courtName: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  price: number;
  dates: string[];
  manageUrl?: string;
}

export function recurringBookingConfirmationEmail(
  props: RecurringBookingConfirmationProps,
): RenderedEmail {
  const day = formatDayOfWeekAr(props.dayOfWeek);
  const subject = `Turno fijo confirmado — ${day} ${formatTime(props.startTime)}`;

  const dateList = props.dates
    .map((d) => `<li style="margin:0 0 6px;">${esc(formatDateAr(d))}</li>`)
    .join('');

  const body =
    heading('Tu turno fijo quedó confirmado') +
    paragraph(
      `Hola ${esc(props.recipientName)}, reservamos tu turno fijo en <strong>${esc(props.businessName)}</strong>. Todas las semanas te esperamos en el mismo horario.`,
    ) +
    infoTable([
      { label: 'Complejo', value: esc(props.businessName) },
      { label: 'Cancha', value: esc(props.courtName) },
      { label: 'Día', value: `Todos los ${esc(day)}` },
      {
        label: 'Horario',
        value: `${esc(formatTime(props.startTime))} a ${esc(formatTime(props.endTime))}`,
      },
      { label: 'Precio por turno', value: esc(formatCurrency(props.price)) },
    ]) +
    calloutBox(
      `<strong>Próximas fechas</strong><ul style="margin:10px 0 0;padding-left:20px;">${dateList}</ul>`,
    ) +
    (props.manageUrl
      ? button(props.manageUrl, 'Ver mis fechas', COLORS.brand) +
        paragraph(
          'Desde ese link podés dar de baja una fecha puntual si alguna semana no podés venir. El turno fijo sigue vigente para las demás.',
        )
      : paragraph(
          'Si alguna semana no podés venir, avisale al complejo para liberar esa fecha.',
        ));

  return {
    subject,
    html: renderLayout({
      title: subject,
      preheader: `Todos los ${day} a las ${formatTime(props.startTime)}`,
      bodyHtml: body,
      logoUrl: props.logoUrl,
    }),
  };
}
