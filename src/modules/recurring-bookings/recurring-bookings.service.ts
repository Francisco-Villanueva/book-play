import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Op } from 'sequelize';
import * as crypto from 'crypto';
import {
  BOOKING_REPOSITORY,
  BUSINESS_REPOSITORY,
  COURT_REPOSITORY,
  RECURRING_BOOKING_REPOSITORY,
} from '../database/constants/repositories.constants';
import { Booking } from '../bookings/entities/booking.model';
import { Business } from '../businesses/entities/business.model';
import { Court } from '../courts/entities/court.model';
import { BookingStatus, RecurringBookingStatus } from '../../common/enums';
import { MailService } from '../mail/mail.service';
import { RecurringBooking } from './entities/recurring-booking.model';
import {
  RecurringBookingsGenerator,
  type GenerationReport,
  type SeriesShape,
} from './recurring-bookings.generator';
import { CreateRecurringBookingDto } from './dto/create-recurring-booking.dto';
import { PreviewRecurringBookingDto } from './dto/preview-recurring-booking.dto';
import { EndRecurringBookingDto } from './dto/end-recurring-booking.dto';
import {
  addDaysToISODate,
  addMinutesToTime,
  dayOfWeekOfISODate,
  hoursUntil,
  todayLocalISO,
} from '../../common/utils/time.util';
import { NotificationsService } from '../notifications/notifications.service';

// Cuántas fechas próximas se listan en el correo de alta. Más que esto convierte
// el correo en una parrilla ilegible.
const EMAIL_PREVIEW_DATES = 6;

@Injectable()
export class RecurringBookingsService {
  constructor(
    @Inject(RECURRING_BOOKING_REPOSITORY)
    private readonly recurringModel: typeof RecurringBooking,
    @Inject(BOOKING_REPOSITORY)
    private readonly bookingModel: typeof Booking,
    @Inject(COURT_REPOSITORY)
    private readonly courtModel: typeof Court,
    @Inject(BUSINESS_REPOSITORY)
    private readonly businessModel: typeof Business,
    private readonly generator: RecurringBookingsGenerator,
    private readonly mailService: MailService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async preview(
    businessId: string,
    dto: PreviewRecurringBookingDto,
  ): Promise<{
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    until: string;
    occurrences: { date: string; available: boolean; reason?: string }[];
  }> {
    const court = await this.requireCourt(businessId, dto.courtId);
    this.validateDates(dto);

    const shape = this.toShape(dto);
    const until = this.generator.horizonDate();
    const results = await this.generator.evaluate(
      businessId,
      court,
      shape,
      dto.startDate,
      until,
    );

    return {
      dayOfWeek: shape.dayOfWeek,
      startTime: dto.startTime,
      endTime: addMinutesToTime(dto.startTime, court.slotDuration),
      until,
      occurrences: results.map((r) => ({
        date: r.date,
        available: r.conflict === null,
        ...(r.conflict ? { reason: this.conflictLabel(r.conflict) } : {}),
      })),
    };
  }

  async create(
    businessId: string,
    dto: CreateRecurringBookingDto,
    createdBy: string,
  ): Promise<{ series: RecurringBooking; report: GenerationReport }> {
    const court = await this.requireCourt(businessId, dto.courtId);
    const business = await this.businessModel.findByPk(businessId);
    if (!business) throw new NotFoundException('El complejo no existe');

    this.validateDates(dto);
    if (!dto.guestName?.trim()) {
      throw new BadRequestException(
        'El turno fijo necesita el nombre del cliente',
      );
    }
    if (!dto.guestPhone && !dto.guestEmail) {
      throw new BadRequestException(
        'El turno fijo necesita un teléfono o un correo de contacto',
      );
    }

    // El token sólo sirve si hay dónde mandarlo: sin email quedaría un hash en
    // la base que nadie puede satisfacer nunca.
    const cancellationToken = dto.guestEmail
      ? crypto.randomBytes(32).toString('hex')
      : null;

    const series = await this.recurringModel.create({
      businessId,
      courtId: dto.courtId,
      userId: null,
      guestName: dto.guestName.trim(),
      guestPhone: dto.guestPhone ?? null,
      guestEmail: dto.guestEmail ?? null,
      dayOfWeek: dayOfWeekOfISODate(dto.startDate),
      startTime: dto.startTime,
      startDate: dto.startDate,
      endDate: dto.endDate ?? null,
      // Arranca un día antes del inicio para que el generador tenga que cubrir
      // la serie entera desde la primera fecha.
      generatedUntil: addDaysToISODate(dto.startDate, -1),
      status: RecurringBookingStatus.ACTIVE,
      notes: dto.notes ?? null,
      createdBy,
      cancellationTokenHash: cancellationToken
        ? this.hashToken(cancellationToken)
        : null,
    });

    const report = await this.generator.generateUpTo(
      series,
      court,
      this.generator.horizonDate(),
    );

    // Un solo correo por serie, nunca uno por instancia: dar de alta 12 semanas
    // no puede traducirse en 12 correos al cliente.
    void this.notifySeriesCreated(
      series,
      court,
      business,
      report,
      cancellationToken,
    );

    return { series, report };
  }

  async findAllByBusiness(
    businessId: string,
    status?: RecurringBookingStatus,
  ): Promise<RecurringBooking[]> {
    return this.recurringModel.findAll({
      where: { businessId, ...(status ? { status } : {}) },
      include: [{ model: Court, as: 'court' }],
      order: [
        ['status', 'ASC'],
        ['dayOfWeek', 'ASC'],
        ['startTime', 'ASC'],
      ],
    });
  }

  async findOne(id: string, businessId: string): Promise<RecurringBooking> {
    const series = await this.recurringModel.findOne({
      where: { id, businessId },
      include: [{ model: Court, as: 'court' }],
    });
    if (!series) throw new NotFoundException('El turno fijo no existe');
    return series;
  }

  // Las instancias futuras de la serie, para la pantalla de detalle.
  async findInstances(id: string, businessId: string): Promise<Booking[]> {
    await this.findOne(id, businessId);
    return this.bookingModel.findAll({
      where: { recurringBookingId: id, date: { [Op.gte]: todayLocalISO() } },
      order: [['date', 'ASC']],
    });
  }

  // Terminar un turno fijo no borra historial: cancela las instancias futuras y
  // deja las jugadas intactas (siguen contando para el cobro y las métricas).
  async end(
    id: string,
    businessId: string,
    dto: EndRecurringBookingDto = {},
  ): Promise<{ series: RecurringBooking; cancelled: number }> {
    const series = await this.findOne(id, businessId);
    const today = todayLocalISO();
    const from = dto.from && dto.from > today ? dto.from : today;

    const [cancelled] = await this.bookingModel.update(
      { status: BookingStatus.CANCELLED, cancelledAt: new Date() },
      {
        where: {
          recurringBookingId: id,
          status: BookingStatus.ACTIVE,
          date: { [Op.gte]: from },
        },
      },
    );

    await series.update({
      status: RecurringBookingStatus.ENDED,
      endedAt: new Date(),
      endDate: addDaysToISODate(from, -1),
    });

    void this.notifySeriesEnded(series, cancelled, from);

    return { series, cancelled };
  }

  // El token plano existe sólo dentro del correo de alta: del hash no se puede
  // recuperar. Si el cliente lo perdió (o dejó el email después), la única salida
  // es emitir uno nuevo, que invalida el anterior.
  async resendGuestLink(
    id: string,
    businessId: string,
    email?: string,
  ): Promise<{ sentTo: string }> {
    const series = await this.findOne(id, businessId);
    const target = email?.trim() || series.guestEmail;

    if (!target) {
      throw new BadRequestException(
        'Este turno fijo no tiene un correo cargado. Agregá uno para poder enviarle el link.',
      );
    }

    const business = await this.businessModel.findByPk(businessId);
    const court = await this.requireCourt(businessId, series.courtId);
    const token = crypto.randomBytes(32).toString('hex');

    await series.update({
      guestEmail: target,
      cancellationTokenHash: this.hashToken(token),
    });

    const upcoming = await this.bookingModel.findAll({
      where: {
        recurringBookingId: id,
        status: BookingStatus.ACTIVE,
        date: { [Op.gte]: todayLocalISO() },
      },
      order: [['date', 'ASC']],
      limit: EMAIL_PREVIEW_DATES,
    });

    await this.mailService.sendRecurringBookingConfirmation({
      to: target,
      recipientName: series.guestName ?? 'jugador',
      businessName: business?.name ?? 'el complejo',
      courtName: court.name,
      dayOfWeek: series.dayOfWeek,
      startTime: series.startTime,
      endTime: addMinutesToTime(series.startTime, court.slotDuration),
      price: Number(court.pricePerSlot),
      dates: upcoming.map((b) => b.date),
      businessId,
      seriesId: series.id,
      manageToken: token,
    });

    return { sentTo: target };
  }

  // --- Acceso del cliente sin cuenta, validado por el token del correo ---

  async findForGuest(
    id: string,
    businessId: string,
    token: string,
  ): Promise<{
    id: string;
    status: RecurringBookingStatus;
    businessName: string;
    courtName: string;
    dayOfWeek: number;
    startTime: string;
    cancellationDeadlineHours: number;
    instances: {
      id: string;
      date: string;
      status: BookingStatus;
      canCancel: boolean;
    }[];
  }> {
    const series = await this.getSeriesByToken(id, businessId, token);
    const instances = await this.bookingModel.findAll({
      where: { recurringBookingId: id, date: { [Op.gte]: todayLocalISO() } },
      order: [['date', 'ASC']],
    });
    const business = await this.businessModel.findByPk(businessId);
    const deadline = business?.cancellationDeadlineHours ?? 0;

    return {
      id: series.id,
      status: series.status,
      businessName: business?.name ?? '',
      courtName: series.court?.name ?? '',
      dayOfWeek: series.dayOfWeek,
      startTime: series.startTime,
      cancellationDeadlineHours: deadline,
      instances: instances.map((b) => ({
        id: b.id,
        date: b.date,
        status: b.status,
        // Se resuelve acá y no en el front: la hora de corte la define el
        // servidor, y el reloj del cliente no es confiable.
        canCancel:
          b.status === BookingStatus.ACTIVE &&
          (deadline <= 0 || hoursUntil(b.date, b.startTime) >= deadline),
      })),
    };
  }

  // El link del correo da de baja UNA fecha, nunca la serie: un click de más no
  // puede costarle al complejo un cliente fijo sin que se entere.
  async cancelInstanceByGuestToken(
    id: string,
    businessId: string,
    token: string,
    bookingId: string,
  ): Promise<Booking> {
    const series = await this.getSeriesByToken(id, businessId, token);

    const booking = await this.bookingModel.findOne({
      where: { id: bookingId, recurringBookingId: id, businessId },
    });
    if (!booking) throw new NotFoundException('El turno no existe');
    if (booking.status === BookingStatus.CANCELLED) {
      throw new BadRequestException('El turno ya estaba cancelado');
    }
    if (booking.date < todayLocalISO()) {
      throw new BadRequestException('No se puede cancelar un turno ya jugado');
    }

    const business = await this.businessModel.findByPk(businessId);
    const deadline = business?.cancellationDeadlineHours ?? 0;
    if (
      deadline > 0 &&
      hoursUntil(booking.date, booking.startTime) < deadline
    ) {
      throw new BadRequestException(
        `Este complejo permite dar de baja una fecha hasta ${deadline} ${deadline === 1 ? 'hora' : 'horas'} antes. Comunicate con el complejo.`,
      );
    }

    await booking.update({
      status: BookingStatus.CANCELLED,
      cancelledAt: new Date(),
    });

    if (business) {
      void this.notificationsService.notifyClientCancellation({
        booking,
        business,
        courtName: series.court?.name ?? 'la cancha',
        isRecurringInstance: true,
      });
    }

    return booking;
  }

  private async getSeriesByToken(
    id: string,
    businessId: string,
    token: string,
  ): Promise<RecurringBooking> {
    const series = await this.recurringModel.findOne({
      where: { id, businessId },
      include: [{ model: Court, as: 'court' }],
    });

    const tokenHash = this.hashToken(token);
    if (
      !series ||
      !series.cancellationTokenHash ||
      series.cancellationTokenHash !== tokenHash
    ) {
      throw new NotFoundException('El turno fijo no existe');
    }

    return series;
  }

  // --- Helpers ---

  private async requireCourt(businessId: string, courtId: string) {
    const court = await this.courtModel.findOne({
      where: { id: courtId, businessId },
    });
    if (!court)
      throw new NotFoundException('La cancha no existe en este complejo');
    return court;
  }

  private validateDates(dto: PreviewRecurringBookingDto): void {
    if (dto.startDate < todayLocalISO()) {
      throw new BadRequestException(
        'El turno fijo no puede empezar en una fecha pasada',
      );
    }
    if (dto.endDate && dto.endDate < dto.startDate) {
      throw new BadRequestException(
        'La fecha de fin no puede ser anterior a la de inicio',
      );
    }
  }

  private toShape(dto: PreviewRecurringBookingDto): SeriesShape {
    return {
      dayOfWeek: dayOfWeekOfISODate(dto.startDate),
      startTime: dto.startTime,
      startDate: dto.startDate,
      endDate: dto.endDate ?? null,
    };
  }

  private conflictLabel(reason: 'CLOSED' | 'BOOKED'): string {
    return reason === 'BOOKED'
      ? 'Ya hay una reserva en ese horario'
      : 'La cancha está cerrada en ese horario';
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private async notifySeriesCreated(
    series: RecurringBooking,
    court: Court,
    business: Business,
    report: GenerationReport,
    cancellationToken: string | null,
  ): Promise<void> {
    if (!series.guestEmail || !cancellationToken) return;
    const dates = report.occurrences
      .filter((o) => o.status === 'CREATED')
      .slice(0, EMAIL_PREVIEW_DATES)
      .map((o) => o.date);
    if (dates.length === 0) return;

    await this.mailService.sendRecurringBookingConfirmation({
      to: series.guestEmail,
      recipientName: series.guestName ?? 'jugador',
      businessName: business.name,
      courtName: court.name,
      dayOfWeek: series.dayOfWeek,
      startTime: series.startTime,
      endTime: addMinutesToTime(series.startTime, court.slotDuration),
      price: Number(court.pricePerSlot),
      dates,
      businessId: business.id,
      seriesId: series.id,
      manageToken: cancellationToken,
    });
  }

  private async notifySeriesEnded(
    series: RecurringBooking,
    cancelled: number,
    from: string,
  ): Promise<void> {
    if (!series.guestEmail || cancelled === 0) return;
    const business = await this.businessModel.findByPk(series.businessId);

    await this.mailService.sendRecurringBookingEnded({
      to: series.guestEmail,
      recipientName: series.guestName ?? 'jugador',
      businessName: business?.name ?? 'el complejo',
      courtName: series.court?.name ?? 'la cancha',
      dayOfWeek: series.dayOfWeek,
      startTime: series.startTime,
      cancelledCount: cancelled,
      from,
      businessId: series.businessId,
    });
  }
}
