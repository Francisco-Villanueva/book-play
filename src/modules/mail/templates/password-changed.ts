import {
  BaseEmailProps,
  COLORS,
  RenderedEmail,
  calloutBox,
  esc,
  heading,
  paragraph,
  renderLayout,
} from './layout';

export interface PasswordChangedProps extends BaseEmailProps {
  name: string;
  supportUrl?: string;
}

export function passwordChangedEmail(
  props: PasswordChangedProps,
): RenderedEmail {
  const subject = 'Tu contraseña fue cambiada';
  const support = props.supportUrl
    ? ` <a href="${esc(props.supportUrl)}" style="color:${COLORS.link};">Contactanos de inmediato</a>.`
    : ' Contactanos de inmediato.';
  const body =
    heading('Tu contraseña fue actualizada') +
    paragraph(
      `Hola ${esc(props.name)}, te confirmamos que la contraseña de tu cuenta se cambió correctamente.`,
    ) +
    calloutBox(
      `Si no fuiste vos quien realizó este cambio, tu cuenta podría estar en riesgo.${support}`,
      COLORS.dangerSoft,
      COLORS.dangerDark,
    );
  return {
    subject,
    html: renderLayout({
      title: subject,
      preheader: 'Confirmación de cambio de contraseña.',
      bodyHtml: body,
      logoUrl: props.logoUrl,
    }),
  };
}
