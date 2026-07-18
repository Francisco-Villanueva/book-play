import {
  BaseEmailProps,
  RenderedEmail,
  button,
  esc,
  heading,
  paragraph,
  renderLayout,
} from './layout';

const ROLE_LABELS: Record<string, string> = {
  OWNER: 'Dueño',
  ADMIN: 'Administrador',
  STAFF: 'Staff',
};

export interface BusinessInvitationProps extends BaseEmailProps {
  businessName: string;
  inviterName?: string;
  role: string;
  acceptUrl: string;
  expiresInDays: number;
}

export function businessInvitationEmail(
  props: BusinessInvitationProps,
): RenderedEmail {
  const roleLabel = ROLE_LABELS[props.role] ?? props.role;
  const subject = `Te invitaron a gestionar "${props.businessName}"`;
  const inviter = props.inviterName
    ? `${esc(props.inviterName)} te invitó`
    : 'Te invitaron';
  const body =
    heading('Tenés una invitación') +
    paragraph(
      `${inviter} a formar parte del equipo de <strong>${esc(props.businessName)}</strong> en Book & Play con el rol de <strong>${esc(roleLabel)}</strong>.`,
    ) +
    button(props.acceptUrl, 'Aceptar invitación') +
    paragraph(
      `Esta invitación vence en ${props.expiresInDays} días. Si no esperabas este correo, podés ignorarlo.`,
    );
  return {
    subject,
    html: renderLayout({
      title: subject,
      preheader: `Te sumaron como ${roleLabel} en ${props.businessName}.`,
      bodyHtml: body,
      logoUrl: props.logoUrl,
    }),
  };
}
