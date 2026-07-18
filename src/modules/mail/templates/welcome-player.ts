import {
  BaseEmailProps,
  RenderedEmail,
  button,
  esc,
  heading,
  paragraph,
  renderLayout,
} from './layout';

export interface WelcomePlayerProps extends BaseEmailProps {
  name: string;
  appUrl: string;
}

export function welcomePlayerEmail(props: WelcomePlayerProps): RenderedEmail {
  const subject = '¡Bienvenido/a a Book & Play!';
  const body =
    heading('¡Te damos la bienvenida!') +
    paragraph(`Hola ${esc(props.name)}, tu cuenta ya está lista. 🎾`) +
    paragraph(
      'Desde ahora podés reservar canchas en los complejos disponibles de forma rápida y sin vueltas.',
    ) +
    button(props.appUrl, 'Empezar a reservar') +
    paragraph('¡Nos vemos en la cancha!');
  return {
    subject,
    html: renderLayout({
      title: subject,
      preheader: 'Tu cuenta de Book & Play ya está activa.',
      bodyHtml: body,
      logoUrl: props.logoUrl,
    }),
  };
}
