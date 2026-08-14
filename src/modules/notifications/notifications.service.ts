import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Op } from 'sequelize';
import {
  BUSINESS_USER_REPOSITORY,
  NOTIFICATION_REPOSITORY,
} from '../database/constants/repositories.constants';
import { BusinessUser } from '../business-users/entities/business-user.model';
import { User } from '../users/entities/user.model';
import { Business } from '../businesses/entities/business.model';
import { Booking } from '../bookings/entities/booking.model';
import { BusinessRole, NotificationType } from '../../common/enums';
import { MailService } from '../mail/mail.service';
import { Notification } from './entities/notification.model';
import { normalizeTime } from '../../common/utils/time.util';

// Cuántas notificaciones devuelve el panel de la campana. Más que esto no se
// lee: lo viejo se consulta en la pantalla de reservas, no acá.
const NOTIFICATIONS_PAGE_SIZE = 30;

// Sólo OWNER y ADMIN reciben el correo. El STAFF ve la notificación en el panel
// pero no se le llena la casilla: suele ser quien está en el mostrador.
const EMAIL_ROLES = [BusinessRole.OWNER, BusinessRole.ADMIN];

@Injectable()
export class NotificationsService {
  constructor(
    @Inject(NOTIFICATION_REPOSITORY)
    private readonly notificationModel: typeof Notification,
    @Inject(BUSINESS_USER_REPOSITORY)
    private readonly businessUserModel: typeof BusinessUser,
    private readonly mailService: MailService,
  ) {}

  async findAllByBusiness(businessId: string): Promise<{
    data: Notification[];
    unreadCount: number;
  }> {
    const [data, unreadCount] = await Promise.all([
      this.notificationModel.findAll({
        where: { businessId },
        order: [['createdAt', 'DESC']],
        limit: NOTIFICATIONS_PAGE_SIZE,
      }),
      this.notificationModel.count({ where: { businessId, readAt: null } }),
    ]);
    return { data, unreadCount };
  }

  async markRead(id: string, businessId: string): Promise<Notification> {
    const notification = await this.notificationModel.findOne({
      where: { id, businessId },
    });
    if (!notification) throw new NotFoundException('La notificación no existe');
    if (!notification.readAt) await notification.update({ readAt: new Date() });
    return notification;
  }

  async markAllRead(businessId: string): Promise<{ updated: number }> {
    const [updated] = await this.notificationModel.update(
      { readAt: new Date() },
      { where: { businessId, readAt: { [Op.is]: null } } },
    );
    return { updated };
  }

  // Se dispara SÓLO cuando cancela el cliente. Si canceló el staff desde el
  // panel ya lo sabe, y avisarle es ruido (decisión de producto, no un olvido).
  async notifyClientCancellation(params: {
    booking: Booking;
    business: Business;
    courtName: string;
    isRecurringInstance: boolean;
  }): Promise<void> {
    const { booking, business, courtName, isRecurringInstance } = params;
    const clientName = booking.user?.name ?? booking.guestName ?? 'Un jugador';
    const time = normalizeTime(booking.startTime);

    const title = isRecurringInstance
      ? 'Turno fijo: el cliente dio de baja una fecha'
      : 'Un cliente canceló su reserva';
    const body = `${clientName} canceló ${courtName} · ${booking.date} a las ${time}. El turno quedó libre.`;

    await this.notificationModel.create({
      businessId: business.id,
      type: isRecurringInstance
        ? NotificationType.RECURRING_INSTANCE_CANCELLED_BY_CLIENT
        : NotificationType.BOOKING_CANCELLED_BY_CLIENT,
      title,
      body,
      bookingId: booking.id,
    });

    const recipients = await this.resolveStaffRecipients(business.id);
    for (const recipient of recipients) {
      await this.mailService.sendBookingCancelledByClient({
        to: recipient.email,
        recipientName: recipient.name,
        businessName: business.name,
        clientName,
        courtName,
        date: booking.date,
        startTime: time,
        endTime: normalizeTime(booking.endTime),
        isRecurringInstance,
        businessId: business.id,
      });
    }
  }

  private async resolveStaffRecipients(
    businessId: string,
  ): Promise<{ email: string; name: string }[]> {
    const links = await this.businessUserModel.findAll({
      where: { businessId, role: { [Op.in]: EMAIL_ROLES } },
      include: [{ model: User, as: 'user', attributes: ['email', 'name'] }],
    });

    const seen = new Map<string, { email: string; name: string }>();
    for (const link of links) {
      const user = link.get('user') as User | undefined;
      // Un mismo usuario puede tener dos vínculos con el negocio; el correo va
      // una sola vez.
      if (user?.email && !seen.has(user.email)) {
        seen.set(user.email, { email: user.email, name: user.name });
      }
    }
    return [...seen.values()];
  }
}
