import {
  BaseEmailProps,
  RenderedEmail,
  button,
  esc,
  heading,
  paragraph,
  renderLayout,
} from './layout';

export interface PasswordResetProps extends BaseEmailProps {
  name: string;
  resetUrl: string;
  expiresInMinutes: number;
}

export function passwordResetEmail(props: PasswordResetProps): RenderedEmail {
  const subject = 'Recuperá tu contraseña de Book & Play';
  const body =
    heading('Recuperación de contraseña') +
    paragraph(
      `Hola ${esc(props.name)}, recibimos un pedido para restablecer tu contraseña. Hacé clic en el botón para elegir una nueva.`,
    ) +
    button(props.resetUrl, 'Restablecer contraseña') +
    paragraph(
      `Este enlace vence en ${props.expiresInMinutes} minutos. Si no pediste este cambio, ignorá este correo: tu contraseña seguirá siendo la misma.`,
    );
  return {
    subject,
    html: renderLayout({
      title: subject,
      preheader: 'Restablecé tu contraseña con este enlace.',
      bodyHtml: body,
      logoUrl: props.logoUrl,
    }),
  };
}
