// Tipos de notificación de la campana del panel. El tipo decide el ícono y el
// destino del click en el front, así que agregar uno obliga a mapearlo allá.
export enum NotificationType {
  BOOKING_CANCELLED_BY_CLIENT = 'BOOKING_CANCELLED_BY_CLIENT',
  RECURRING_INSTANCE_CANCELLED_BY_CLIENT = 'RECURRING_INSTANCE_CANCELLED_BY_CLIENT',
}
