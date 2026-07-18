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
import { formatCurrency } from './format';

export interface PaymentRejectedProps extends BaseEmailProps {
  recipientName: string;
  businessName: string;
  amount?: number;
  retryUrl?: string;
}

export function paymentRejectedEmail(
  props: PaymentRejectedProps,
): RenderedEmail {
  const subject = 'No pudimos procesar tu pago';
  const amountText = props.amount
    ? ` de <strong>${esc(formatCurrency(props.amount))}</strong>`
    : '';
  const body =
    heading('Tu pago fue rechazado') +
    paragraph(
      `Hola ${esc(props.recipientName)}, el pago${amountText} para <strong>${esc(props.businessName)}</strong> no pudo procesarse.`,
    ) +
    calloutBox(
      'Esto suele deberse a fondos insuficientes, un límite de la tarjeta o datos incorrectos. Podés intentarlo nuevamente con otro medio de pago.',
      COLORS.warningSoft,
      COLORS.warningDark,
    ) +
    (props.retryUrl
      ? button(props.retryUrl, 'Reintentar el pago', COLORS.brand)
      : '') +
    paragraph(
      'Si el problema persiste, contactá a tu banco o probá con otra tarjeta.',
    );
  return {
    subject,
    html: renderLayout({
      title: subject,
      preheader: 'Tu pago no pudo procesarse. Podés reintentarlo.',
      bodyHtml: body,
      logoUrl: props.logoUrl,
    }),
  };
}
