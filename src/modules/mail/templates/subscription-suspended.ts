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

export interface SubscriptionSuspendedProps extends BaseEmailProps {
  recipientName: string;
  businessName: string;
  // Días transcurridos desde la suspensión: 0 es el aviso inmediato, el resto
  // son los recordatorios de reconversión.
  daysSuspended: number;
  upgradeUrl: string;
}

export function subscriptionSuspendedEmail(
  props: SubscriptionSuspendedProps,
): RenderedEmail {
  const { daysSuspended } = props;
  const business = esc(props.businessName);

  const subject =
    daysSuspended === 0
      ? `${props.businessName} quedó en modo solo lectura`
      : daysSuspended >= 330
        ? `Últimos 30 días para recuperar los datos de ${props.businessName}`
        : `${props.businessName} sigue en modo solo lectura`;

  const intro =
    daysSuspended === 0
      ? `Hola ${esc(props.recipientName)}, la suscripción de <strong>${business}</strong> venció y el complejo pasó a modo solo lectura.`
      : `Hola ${esc(props.recipientName)}, <strong>${business}</strong> lleva ${daysSuspended} días en modo solo lectura.`;

  // A los 11 meses avisamos la anonimización con 30 días de anticipación: es el
  // deber de informar y, de paso, el último gancho de reconversión.
  const warning =
    daysSuspended >= 330
      ? calloutBox(
          'En 30 días vamos a <strong>anonimizar los datos de contacto</strong> de los jugadores invitados (nombre, teléfono y email) ' +
            'de las reservas de tu complejo. Tus canchas, horarios y el historial de reservas se conservan. ' +
            'Si activás un plan antes, no se borra nada.',
          COLORS.dangerSoft,
          COLORS.dangerDark,
        )
      : calloutBox(
          'Podés seguir viendo tus reservas, canchas y horarios, y cancelar las reservas que quedaron pendientes. ' +
            'Para volver a recibir reservas y editar tu complejo, activá un plan.',
          COLORS.warningSoft,
          COLORS.warningDark,
        );

  const body =
    heading(
      daysSuspended >= 330
        ? 'Tus datos se van a anonimizar en 30 días'
        : 'Tu complejo está en modo solo lectura',
    ) +
    paragraph(intro) +
    warning +
    button(
      props.upgradeUrl,
      'Reactivar mi complejo',
      daysSuspended >= 330 ? COLORS.danger : COLORS.brand,
    ) +
    paragraph(
      'Cuando actives un plan, todo vuelve a funcionar al instante y sin pérdida de información.',
    );

  return {
    subject,
    html: renderLayout({
      title: subject,
      preheader:
        daysSuspended >= 330
          ? 'Últimos 30 días antes de anonimizar los datos de contacto.'
          : 'Activá un plan para volver a operar. Tus datos están intactos.',
      bodyHtml: body,
      logoUrl: props.logoUrl,
    }),
  };
}
