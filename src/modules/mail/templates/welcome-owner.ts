import {
  BaseEmailProps,
  RenderedEmail,
  button,
  calloutBox,
  esc,
  heading,
  paragraph,
  renderLayout,
} from './layout';

export interface WelcomeOwnerProps extends BaseEmailProps {
  name: string;
  businessName: string;
  trialDays: number;
  adminUrl: string;
}

export function welcomeOwnerEmail(props: WelcomeOwnerProps): RenderedEmail {
  const subject = `Tu complejo "${props.businessName}" ya está en Book & Play`;
  const body =
    heading('¡Tu complejo está listo!') +
    paragraph(
      `Hola ${esc(props.name)}, creaste <strong>${esc(props.businessName)}</strong> en Book & Play. Ya podés cargar tus canchas, definir horarios y empezar a recibir reservas.`,
    ) +
    calloutBox(
      `🎉 Tenés <strong>${props.trialDays} días de prueba gratis</strong> con todas las funciones activadas.`,
    ) +
    button(props.adminUrl, 'Ir al panel de administración') +
    paragraph(
      'Cualquier duda para configurar tu complejo, estamos para ayudarte.',
    );
  return {
    subject,
    html: renderLayout({
      title: subject,
      preheader: `${props.trialDays} días de prueba gratis para configurar tu complejo.`,
      bodyHtml: body,
      logoUrl: props.logoUrl,
    }),
  };
}
