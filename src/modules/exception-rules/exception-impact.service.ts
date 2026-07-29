import { Inject, Injectable, Logger } from '@nestjs/common';
import { Op } from 'sequelize';
import {
  BOOKING_REPOSITORY,
  BUSINESS_REPOSITORY,
  COURT_REPOSITORY,
} from '../database/constants/repositories.constants';
import { Booking } from '../bookings/entities/booking.model';
import { Business } from '../businesses/entities/business.model';
import { Court } from '../courts/entities/court.model';
import { User } from '../users/entities/user.model';
import { BookingStatus } from '../../common/enums';
import { MailService } from '../mail/mail.service';
import { normalizeTime, rangesOverlap } from '../../common/utils/time.util';

export interface ImpactQuery {
  date: string;
  startTime?: string;
  endTime?: string;
  isAvailable: boolean;
  courtIds?: string[];
}

export interface AffectedBooking {
  id: string;
  courtName: string;
  date: string;
  startTime: string;
  endTime: string;
  clientName: string;
  isRecurring: boolean;
}

// Un bloqueo que deja reservas vivas produce turnos fantasma: el complejo cerró
// pero el cliente sigue viendo su reserva en pie y se presenta igual. Este
// servicio es el que las da de baja y avisa (BR-029).
@Injectable()
export class ExceptionImpactService {
  private readonly logger = new Logger(ExceptionImpactService.name);

  constructor(
    @Inject(BOOKING_REPOSITORY)
    private readonly bookingModel: typeof Booking,
    @Inject(COURT_REPOSITORY)
    private readonly courtModel: typeof Court,
    @Inject(BUSINESS_REPOSITORY)
    private readonly businessModel: typeof Business,
    private readonly mailService: MailService,
  ) {}

  // Qué reservas se van a caer si se aplica esta excepción. Es lo que la UI
  // muestra ANTES de confirmar — el encargado tiene que poder arrepentirse.
  async findAffected(
    businessId: string,
    query: ImpactQuery,
  ): Promise<AffectedBooking[]> {
    const where: Record<string, unknown> = {
      businessId,
      date: query.date,
      status: BookingStatus.ACTIVE,
    };
    if (query.courtIds?.length) where.courtId = { [Op.in]: query.courtIds };

    const bookings = await this.bookingModel.findAll({
      where,
      include: [
        { model: Court, as: 'court' },
        { model: User, as: 'user', attributes: ['id', 'name', 'email'] },
      ],
      order: [['startTime', 'ASC']],
    });

    return bookings
      .filter((b) => this.isAffected(b, query))
      .map((b) => ({
        id: b.id,
        courtName: b.court?.name ?? '',
        date: b.date,
        startTime: normalizeTime(b.startTime),
        endTime: normalizeTime(b.endTime),
        clientName: b.user?.name ?? b.guestName ?? 'Sin nombre',
        isRecurring: b.recurringBookingId !== null,
      }));
  }

  // Se llama después de commitear la excepción: si la escritura se revierte, no
  // puede quedar una tanda de reservas canceladas ni correos ya enviados.
  async cancelAffected(
    businessId: string,
    query: ImpactQuery,
    reason?: string,
  ): Promise<number> {
    const affected = await this.findAffected(businessId, query);
    if (affected.length === 0) return 0;

    const ids = affected.map((a) => a.id);
    const [cancelled] = await this.bookingModel.update(
      { status: BookingStatus.CANCELLED, cancelledAt: new Date() },
      { where: { id: { [Op.in]: ids } } },
    );

    void this.notifyAll(businessId, ids, reason);

    this.logger.log(
      `Excepción del ${query.date}: ${cancelled} reservas canceladas en el negocio ${businessId}`,
    );
    return cancelled;
  }

  private isAffected(booking: Booking, query: ImpactQuery): boolean {
    const bStart = normalizeTime(booking.startTime);
    const bEnd = normalizeTime(booking.endTime);
    const qStart = query.startTime ? normalizeTime(query.startTime) : null;
    const qEnd = query.endTime ? normalizeTime(query.endTime) : null;

    if (!query.isAvailable) {
      // Cierre: sin franja, cae el día entero.
      if (!qStart || !qEnd) return true;
      return rangesOverlap(bStart, bEnd, qStart, qEnd);
    }

    // Apertura especial: ese día SÓLO vale esa franja, así que lo que queda
    // afuera deja de ser válido aunque nadie lo haya bloqueado explícitamente.
    if (!qStart || !qEnd) return false;
    return bStart < qStart || bEnd > qEnd;
  }

  private async notifyAll(
    businessId: string,
    bookingIds: string[],
    reason?: string,
  ): Promise<void> {
    const business = await this.businessModel.findByPk(businessId);
    const bookings = await this.bookingModel.findAll({
      where: { id: { [Op.in]: bookingIds } },
      include: [
        { model: Court, as: 'court' },
        { model: User, as: 'user', attributes: ['id', 'name', 'email'] },
      ],
    });

    for (const booking of bookings) {
      const to = booking.user?.email ?? booking.guestEmail;
      if (!to) continue;
      // A diferencia de los avisos de reserva, este no respeta
      // `users.notify_bookings`: el cliente no pidió esta baja y es la única
      // forma de enterarse de que el complejo cerró.
      await this.mailService.sendBookingSuspended({
        to,
        recipientName: booking.user?.name ?? booking.guestName ?? 'jugador',
        businessName: business?.name ?? 'el complejo',
        courtName: booking.court?.name ?? 'la cancha',
        date: booking.date,
        startTime: normalizeTime(booking.startTime),
        endTime: normalizeTime(booking.endTime),
        reason,
        isRecurring: booking.recurringBookingId !== null,
        businessId,
      });
    }
  }
}
