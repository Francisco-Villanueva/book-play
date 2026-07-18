import {
  BaseEmailProps,
  RenderedEmail,
  esc,
  heading,
  infoTable,
  paragraph,
  renderLayout,
} from './layout';
import { formatCurrency, formatDateAr } from './format';

export interface PaymentReceiptProps extends BaseEmailProps {
  recipientName: string;
  businessName: string;
  planName?: string;
  amount: number;
  paidAt: Date;
  paymentId: string;
}

function isoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function paymentReceiptEmail(props: PaymentReceiptProps): RenderedEmail {
  const subject = 'Comprobante de pago — Book & Play';
  const rows = [
    { label: 'Complejo', value: esc(props.businessName) },
    ...(props.planName ? [{ label: 'Plan', value: esc(props.planName) }] : []),
    { label: 'Fecha', value: esc(formatDateAr(isoDate(props.paidAt))) },
    { label: 'Importe', value: esc(formatCurrency(props.amount)) },
    { label: 'ID de pago', value: esc(props.paymentId) },
  ];
  const body =
    heading('Comprobante de pago') +
    paragraph(
      `Hola ${esc(props.recipientName)}, recibimos tu pago correctamente. Este es el comprobante para tus registros.`,
    ) +
    infoTable(rows) +
    paragraph('¡Gracias por confiar en Book & Play!');
  return {
    subject,
    html: renderLayout({
      title: subject,
      preheader: `Pago recibido: ${formatCurrency(props.amount)}`,
      bodyHtml: body,
      logoUrl: props.logoUrl,
    }),
  };
}
