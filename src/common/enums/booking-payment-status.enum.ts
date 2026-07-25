// Cobro presencial del turno (BR-025). Distinto de PaymentStatus, que modela
// los pagos online de la suscripción SaaS vía Mercado Pago.
export enum BookingPaymentStatus {
  UNPAID = 'UNPAID',
  PARTIAL = 'PARTIAL',
  PAID = 'PAID',
}
