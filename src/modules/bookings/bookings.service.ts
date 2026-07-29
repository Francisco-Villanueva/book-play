import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Op, Transaction, WhereOptions } from 'sequelize';
import { Sequelize } from 'sequelize-typescript';
import * as crypto from 'crypto';
import {
  BOOKING_REPOSITORY,
  COURT_REPOSITORY,
  BUSINESS_REPOSITORY,
  AVAILABILITY_RULE_REPOSITORY,
  EXCEPTION_RULE_REPOSITORY,
  SUBSCRIPTION_REPOSITORY,
} from '../database/constants/repositories.constants';
import { Subscription } from '../subscriptions/entities/subscription.model';
import { isReadOnly } from '../subscriptions/subscription-access';
import { Booking } from './entities/booking.model';
import { Court } from '../courts/entities/court.model';
import { Business } from '../businesses/entities/business.model';
import { AvailabilityRule } from '../availability-rules/entities/availability-rule.model';
import { ExceptionRule } from '../exception-rules/entities/exception-rule.model';
import { BookingStatus } from '../../common/enums';
import { CreateBookingDto } from './dto/create-booking.dto';
import {
  BOOKINGS_PAGE_SIZE_DEFAULT,
  BOOKINGS_PAGE_SIZE_MAX,
  ListBookingsQueryDto,
} from './dto/list-bookings-query.dto';
import { User } from '../users/entities/user.model';
import { UsersService } from '../users/users.service';
import { MailService } from '../mail/mail.service';
import {
  addMinutesToTime,
  normalizeTime,
  todayLocalISO,
} from '../../common/utils/time.util';

// Por qué un slot no se puede reservar. `CLOSED` cubre tanto el cierre por
// ExceptionRule como el estar fuera de las AvailabilityRule del día: para quien
// mira la previsualización de un turno fijo son el mismo problema.
export type SlotConflictReason = 'CLOSED' | 'BOOKED';

export interface PaginatedBookings {
  data: Booking[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

@Injectable()
export class BookingsService {
  constructor(
    @Inject(BOOKING_REPOSITORY)
    private readonly bookingModel: typeof Booking,
    @Inject(COURT_REPOSITORY)
    private readonly courtModel: typeof Court,
    @Inject(BUSINESS_REPOSITORY)
    private readonly businessModel: typeof Business,
    @Inject(AVAILABILITY_RULE_REPOSITORY)
    private readonly availabilityRuleModel: typeof AvailabilityRule,
    @Inject(EXCEPTION_RULE_REPOSITORY)
    private readonly exceptionRuleModel: typeof ExceptionRule,
    @Inject(SUBSCRIPTION_REPOSITORY)
    private readonly subscriptionModel: typeof Subscription,
    @Inject('SEQUELIZE')
    private readonly sequelize: Sequelize,
    private readonly usersService: UsersService,
    private readonly mailService: MailService,
  ) {}

  async create(
    businessId: string,
    dto: CreateBookingDto,
    userId?: string,
  ): Promise<Booking> {
    this.validateBooker(userId, dto);

    const court = await this.courtModel.findOne({
      where: { id: dto.courtId, businessId },
    });
    if (!court) {
      throw new NotFoundException('Court not found in this business');
    }

    const business = await this.businessModel.findByPk(businessId);
    if (!business) {
      throw new NotFoundException('Business not found');
    }

    const endTime = addMinutesToTime(dto.startTime, court.slotDuration);

    this.validateNoMidnightCrossing(dto.startTime, endTime);
    this.validateNotInPast(dto.date);

    await this.checkAvailability(
      businessId,
      dto.courtId,
      dto.date,
      dto.startTime,
      endTime,
    );

    // Serializable transaction serializes concurrent booking attempts on the same slot.
    // PostgreSQL SSI detects the read-then-insert dependency and aborts one of two
    // concurrent transactions that read "no overlap" and then both try to insert,
    // returning error code 40001 (serialization_failure).
    const t = await this.sequelize.transaction({
      isolationLevel: Transaction.ISOLATION_LEVELS.SERIALIZABLE,
    });

    try {
      await this.checkNoOverlap(
        dto.courtId,
        dto.date,
        dto.startTime,
        endTime,
        t,
      );

      const totalPrice = Number(court.pricePerSlot);

      // Guest bookings (no account) get a cancellation token so the confirmation
      // email can offer a working "cancel" link without requiring login.
      let cancellationToken: string | undefined;
      let cancellationTokenHash: string | null = null;
      if (!userId) {
        cancellationToken = crypto.randomBytes(32).toString('hex');
        cancellationTokenHash = this.hashToken(cancellationToken);
      }

      const booking = await this.bookingModel.create(
        {
          courtId: dto.courtId,
          businessId,
          userId: userId || null,
          guestName: dto.guestName || null,
          guestPhone: dto.guestPhone || null,
          guestEmail: dto.guestEmail || null,
          date: dto.date,
          startTime: dto.startTime,
          endTime,
          totalPrice,
          notes: dto.notes || null,
          cancellationTokenHash,
        },
        { transaction: t },
      );

      await t.commit();

      void this.notifyBookingCreated(
        booking,
        court,
        business,
        userId,
        cancellationToken,
      );

      return booking;
    } catch (err) {
      await t.rollback();
      if (this.isSerializationError(err)) {
        throw new ConflictException('This time slot is no longer available');
      }
      throw err;
    }
  }

  async findAllByBusiness(
    businessId: string,
    query: ListBookingsQueryDto = {},
  ): Promise<PaginatedBookings> {
    const page = query.page ?? 1;
    const limit = Math.min(
      query.limit ?? BOOKINGS_PAGE_SIZE_DEFAULT,
      BOOKINGS_PAGE_SIZE_MAX,
    );
    const direction = query.sort === 'desc' ? 'DESC' : 'ASC';

    const { rows, count } = await this.bookingModel.findAndCountAll({
      where: this.buildBookingFilters(businessId, query),
      include: [
        { model: Court, as: 'court' },
        { model: User, as: 'user', attributes: ['id', 'name', 'email'] },
      ],
      order: [
        ['date', direction],
        ['startTime', direction],
        // Desempate estable: dos canchas pueden tener el mismo date+startTime y
        // sin este criterio la misma reserva puede repetirse o saltearse entre páginas.
        ['id', direction],
      ],
      limit,
      offset: (page - 1) * limit,
      // Los `$court.name$` / `$user.name$` del buscador viven en el WHERE externo,
      // que la subquery de paginación de Sequelize no alcanza. Ambos includes son
      // belongsTo (no multiplican filas), así que el count sigue siendo exacto.
      subQuery: false,
      distinct: true,
    });

    return {
      data: rows,
      meta: {
        total: count,
        page,
        limit,
        totalPages: limit > 0 ? Math.ceil(count / limit) : 0,
      },
    };
  }

  private buildBookingFilters(
    businessId: string,
    query: ListBookingsQueryDto,
  ): WhereOptions {
    const where: Record<string | symbol, unknown> = { businessId };

    const from = query.date ?? query.dateFrom;
    const to = query.date ?? query.dateTo;
    if (from && to) {
      if (from > to) {
        throw new BadRequestException('dateFrom cannot be after dateTo');
      }
      where.date = { [Op.between]: [from, to] };
    } else if (from) {
      where.date = { [Op.gte]: from };
    } else if (to) {
      where.date = { [Op.lte]: to };
    }

    if (query.courtId) where.courtId = query.courtId;
    if (query.status) where.status = query.status;
    if (query.recurring !== undefined) {
      where.recurringBookingId = query.recurring
        ? { [Op.ne]: null }
        : { [Op.is]: null };
    }
    if (query.paymentStatus?.length) {
      where.paymentStatus = { [Op.in]: query.paymentStatus };
    }

    const term = query.q?.trim();
    if (term) {
      const pattern = `%${this.escapeLikePattern(term)}%`;
      where[Op.or] = [
        { guestName: { [Op.iLike]: pattern } },
        { guestPhone: { [Op.iLike]: pattern } },
        { guestEmail: { [Op.iLike]: pattern } },
        { '$user.name$': { [Op.iLike]: pattern } },
        { '$user.email$': { [Op.iLike]: pattern } },
        { '$court.name$': { [Op.iLike]: pattern } },
      ];
    }

    return where as WhereOptions;
  }

  // Sin esto, un '%' tipeado en el buscador matchea todo y un '_' matchea
  // cualquier caracter — el usuario espera búsqueda literal, no comodines.
  private escapeLikePattern(value: string): string {
    return value.replace(/[\\%_]/g, (char) => `\\${char}`);
  }

  async findAllByUser(userId: string): Promise<Booking[]> {
    return this.bookingModel.findAll({
      where: { userId },
      include: [
        { model: Court, as: 'court' },
        { model: Business, as: 'business' },
      ],
      order: [
        ['date', 'DESC'],
        ['startTime', 'DESC'],
      ],
    });
  }

  async findOne(id: string, businessId: string): Promise<Booking> {
    const booking = await this.bookingModel.findOne({
      where: { id, businessId },
      include: [{ model: Court, as: 'court' }],
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    return booking;
  }

  async cancel(id: string, businessId: string): Promise<Booking> {
    const booking = await this.findOne(id, businessId);

    if (booking.status === BookingStatus.CANCELLED) {
      throw new BadRequestException('Booking is already cancelled');
    }

    await booking.update({
      status: BookingStatus.CANCELLED,
      cancelledAt: new Date(),
    });

    void this.notifyBookingCancelled(booking);

    return booking;
  }

  // Public — validated by the token from the confirmation email, not by session.
  async findForGuestCancellation(
    bookingId: string,
    businessId: string,
    token: string,
  ): Promise<{
    id: string;
    status: BookingStatus;
    businessName: string;
    courtName: string;
    date: string;
    startTime: string;
    endTime: string;
  }> {
    const booking = await this.getGuestBookingByToken(
      bookingId,
      businessId,
      token,
    );
    return {
      id: booking.id,
      status: booking.status,
      businessName: booking.business?.name ?? '',
      courtName: booking.court?.name ?? '',
      date: booking.date,
      startTime: booking.startTime,
      endTime: booking.endTime,
    };
  }

  // Public — validated by the token from the confirmation email, not by session.
  async cancelByGuestToken(
    bookingId: string,
    businessId: string,
    token: string,
  ): Promise<Booking> {
    const booking = await this.getGuestBookingByToken(
      bookingId,
      businessId,
      token,
    );

    if (booking.status === BookingStatus.CANCELLED) {
      throw new BadRequestException('Booking is already cancelled');
    }

    await booking.update({
      status: BookingStatus.CANCELLED,
      cancelledAt: new Date(),
    });

    void this.notifyBookingCancelled(booking);

    return booking;
  }

  private async getGuestBookingByToken(
    bookingId: string,
    businessId: string,
    token: string,
  ): Promise<Booking> {
    const booking = await this.bookingModel.findOne({
      where: { id: bookingId, businessId },
      include: [
        { model: Court, as: 'court' },
        { model: Business, as: 'business' },
      ],
    });

    const tokenHash = this.hashToken(token);
    if (
      !booking ||
      booking.userId ||
      !booking.cancellationTokenHash ||
      booking.cancellationTokenHash !== tokenHash
    ) {
      throw new NotFoundException('Booking not found');
    }

    return booking;
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  async findOneForUser(id: string, userId: string): Promise<Booking> {
    const booking = await this.bookingModel.findOne({
      where: { id, userId },
      include: [
        { model: Court, as: 'court' },
        { model: Business, as: 'business' },
      ],
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    return booking;
  }

  async cancelForUser(id: string, userId: string): Promise<Booking> {
    const booking = await this.findOneForUser(id, userId);

    if (booking.status === BookingStatus.CANCELLED) {
      throw new BadRequestException('Booking is already cancelled');
    }

    await booking.update({
      status: BookingStatus.CANCELLED,
      cancelledAt: new Date(),
    });

    void this.notifyBookingCancelled(booking);

    return booking;
  }

  async getAvailableSlots(
    businessId: string,
    courtId: string,
    date: string,
  ): Promise<{
    date: string;
    courtId: string;
    slotDuration: number;
    acceptsBookings: boolean;
    availableSlots: { startTime: string; endTime: string }[];
  }> {
    const today = todayLocalISO();
    if (date < today) {
      throw new BadRequestException(
        'Cannot check availability for a past date',
      );
    }

    const court = await this.courtModel.findOne({
      where: { id: courtId, businessId },
    });
    if (!court) throw new NotFoundException('Court not found in this business');

    // Los slots reales se devuelven igual aunque el complejo esté bloqueado: el
    // panel del propio complejo usa este endpoint para leer su agenda. Es la
    // pantalla pública la que, con este flag, los muestra como no disponibles.
    const acceptsBookings = await this.acceptsBookings(businessId);

    const dayOfWeek = new Date(date + 'T12:00:00').getDay();
    const { slotDuration } = court;

    // Fetch exceptions that apply to this court: global ones (no court entries)
    // and court-specific ones that explicitly include this court.
    const exceptions = await this.getApplicableExceptions(
      businessId,
      courtId,
      date,
    );

    let openWindows: { start: string; end: string }[] = [];
    const blockedRanges: { start: string; end: string }[] = [];
    let hasEnablingException = false;

    for (const exc of exceptions) {
      const exStart = exc.startTime ? normalizeTime(exc.startTime) : null;
      const exEnd = exc.endTime ? normalizeTime(exc.endTime) : null;

      if (!exc.isAvailable) {
        if (!exStart || !exEnd) {
          // Full-day block — entire day is closed for this court
          return {
            date,
            courtId,
            slotDuration,
            acceptsBookings,
            availableSlots: [],
          };
        }
        blockedRanges.push({ start: exStart, end: exEnd });
      } else if (exStart && exEnd) {
        openWindows.push({ start: exStart, end: exEnd });
        hasEnablingException = true;
      }
    }

    if (!hasEnablingException) {
      const rules = await this.availabilityRuleModel.findAll({
        where: { businessId, dayOfWeek, isActive: true },
        include: [
          {
            model: Court,
            as: 'courts',
            where: { id: courtId },
            through: { attributes: [] },
            required: true,
          },
        ],
      });
      if (rules.length === 0) {
        return {
          date,
          courtId,
          slotDuration,
          acceptsBookings,
          availableSlots: [],
        };
      }
      openWindows = rules.map((r) => ({
        start: normalizeTime(r.startTime),
        end: normalizeTime(r.endTime),
      }));
    }

    const existingBookings = await this.bookingModel.findAll({
      where: { courtId, date, status: BookingStatus.ACTIVE },
    });

    const availableSlots: { startTime: string; endTime: string }[] = [];

    for (const window of openWindows) {
      let slotStart = window.start;
      while (true) {
        const slotEnd = addMinutesToTime(slotStart, slotDuration);
        if (slotEnd > window.end) break;

        const isBlocked = blockedRanges.some(
          (b) => slotStart < b.end && slotEnd > b.start,
        );
        const isBooked = existingBookings.some(
          (bk) =>
            slotStart < normalizeTime(bk.endTime) &&
            slotEnd > normalizeTime(bk.startTime),
        );

        if (!isBlocked && !isBooked) {
          availableSlots.push({ startTime: slotStart, endTime: slotEnd });
        }
        slotStart = slotEnd;
      }
    }

    return { date, courtId, slotDuration, acceptsBookings, availableSlots };
  }

  private async acceptsBookings(businessId: string): Promise<boolean> {
    const subscription = await this.subscriptionModel.findOne({
      where: { businessId },
      attributes: ['status'],
    });
    return !subscription || !isReadOnly(subscription.status);
  }

  // Business-wide availability for a date: one call returning every active
  // court's open slots plus a summarised next-free/full flag. Powers the public
  // court-list screen without the client having to fan out one request per court.
  async getBusinessAvailability(
    businessId: string,
    date: string,
  ): Promise<{
    date: string;
    acceptsBookings: boolean;
    courts: {
      courtId: string;
      name: string;
      sportType: string | null;
      surface: string | null;
      slotDuration: number;
      pricePerSlot: number | null;
      availableSlots: { startTime: string; endTime: string }[];
      nextAvailable: string | null;
      isFull: boolean;
    }[];
  }> {
    const today = todayLocalISO();
    if (date < today) {
      throw new BadRequestException(
        'Cannot check availability for a past date',
      );
    }

    const business = await this.businessModel.findByPk(businessId);
    if (!business) throw new NotFoundException('Business not found');

    const courts = await this.courtModel.findAll({
      where: { businessId, isActive: true },
      order: [['name', 'ASC']],
    });

    const results = await Promise.all(
      courts.map(async (court) => {
        const { availableSlots } = await this.getAvailableSlots(
          businessId,
          court.id,
          date,
        );
        return {
          courtId: court.id,
          name: court.name,
          sportType: court.sportType ?? null,
          surface: court.surface ?? null,
          slotDuration: court.slotDuration,
          pricePerSlot:
            court.pricePerSlot != null ? Number(court.pricePerSlot) : null,
          availableSlots,
          nextAvailable: availableSlots[0]?.startTime ?? null,
          isFull: availableSlots.length === 0,
        };
      }),
    );

    return {
      date,
      acceptsBookings: await this.acceptsBookings(businessId),
      courts: results,
    };
  }

  // Returns ExceptionRules that apply to a given court on a given date.
  // Includes both global exceptions (no court entries in CourtException — applies
  // to all courts in the business) and court-specific exceptions for this court.
  // Uses LEFT JOIN so global exceptions (with no CourtException rows) are not dropped.
  private async getApplicableExceptions(
    businessId: string,
    courtId: string,
    date: string,
  ): Promise<ExceptionRule[]> {
    const all = await this.exceptionRuleModel.findAll({
      where: { businessId, date },
      include: [
        {
          model: Court,
          as: 'courts',
          attributes: ['id'],
          through: { attributes: [] },
          required: false, // LEFT JOIN — keeps exceptions with zero court entries
        },
      ],
    });

    return all.filter(
      (exc) =>
        exc.courts.length === 0 || // global: applies to all courts
        exc.courts.some((c) => c.id === courtId), // court-specific: targets this court
    );
  }

  // Versión no-lanzadora de los mismos chequeos que hace `create()`, para quien
  // necesita evaluar muchas fechas de una (turnos fijos) sin armar y descartar
  // una excepción por fecha. Devuelve null si el slot se puede reservar.
  async findSlotConflict(
    businessId: string,
    courtId: string,
    date: string,
    startTime: string,
    endTime: string,
    transaction?: Transaction,
  ): Promise<SlotConflictReason | null> {
    try {
      await this.checkAvailability(
        businessId,
        courtId,
        date,
        startTime,
        endTime,
      );
    } catch (err) {
      if (err instanceof BadRequestException) return 'CLOSED';
      throw err;
    }

    try {
      await this.checkNoOverlap(courtId, date, startTime, endTime, transaction);
    } catch (err) {
      if (err instanceof ConflictException) return 'BOOKED';
      throw err;
    }

    return null;
  }

  private async checkAvailability(
    businessId: string,
    courtId: string,
    date: string,
    startTime: string,
    endTime: string,
  ): Promise<void> {
    const dayOfWeek = new Date(date + 'T12:00:00').getDay();

    const exceptions = await this.getApplicableExceptions(
      businessId,
      courtId,
      date,
    );

    if (exceptions.length > 0) {
      return this.checkExceptionAvailability(
        exceptions,
        startTime,
        endTime,
        dayOfWeek,
        businessId,
        courtId,
      );
    }

    await this.checkAvailabilityRules(
      businessId,
      courtId,
      dayOfWeek,
      startTime,
      endTime,
    );
  }

  private async checkExceptionAvailability(
    exceptions: ExceptionRule[],
    startTime: string,
    endTime: string,
    dayOfWeek: number,
    businessId: string,
    courtId: string,
  ): Promise<void> {
    for (const exception of exceptions) {
      const exStart = exception.startTime
        ? normalizeTime(exception.startTime)
        : null;
      const exEnd = exception.endTime
        ? normalizeTime(exception.endTime)
        : null;

      if (!exception.isAvailable) {
        if (!exStart || !exEnd) {
          // Full-day block
          throw new BadRequestException(
            `Court is closed on this date: ${exception.reason ?? 'no reason given'}`,
          );
        }
        if (startTime < exEnd && endTime > exStart) {
          throw new BadRequestException(
            `Requested slot overlaps with a blocked period (${exStart}–${exEnd}): ${exception.reason ?? 'no reason given'}`,
          );
        }
      } else {
        // Enable exception — only this window is available
        if (exStart && exEnd) {
          if (startTime < exStart || endTime > exEnd) {
            throw new BadRequestException(
              `Court is only available ${exStart}–${exEnd} on this date`,
            );
          }
          return;
        }
      }
    }

    // Only partial-block exceptions were found; still validate against availability rules
    await this.checkAvailabilityRules(
      businessId,
      courtId,
      dayOfWeek,
      startTime,
      endTime,
    );
  }

  private async checkAvailabilityRules(
    businessId: string,
    courtId: string,
    dayOfWeek: number,
    startTime: string,
    endTime: string,
  ): Promise<void> {
    const rules = await this.availabilityRuleModel.findAll({
      where: { businessId, dayOfWeek, isActive: true },
      include: [
        {
          model: Court,
          as: 'courts',
          where: { id: courtId },
          through: { attributes: [] },
          required: true,
        },
      ],
    });

    if (rules.length === 0) {
      throw new BadRequestException(
        'No availability rules found for this court on this day',
      );
    }

    const slotFits = rules.some((rule) => {
      const ruleStart = normalizeTime(rule.startTime);
      const ruleEnd = normalizeTime(rule.endTime);
      return startTime >= ruleStart && endTime <= ruleEnd;
    });

    if (!slotFits) {
      throw new BadRequestException(
        'Requested time slot is outside available hours',
      );
    }
  }

  private async checkNoOverlap(
    courtId: string,
    date: string,
    startTime: string,
    endTime: string,
    transaction?: Transaction,
  ): Promise<void> {
    const overlapping = await this.bookingModel.findOne({
      where: {
        courtId,
        date,
        status: BookingStatus.ACTIVE,
        startTime: { [Op.lt]: endTime },
        endTime: { [Op.gt]: startTime },
      },
      transaction,
    });

    if (overlapping) {
      throw new ConflictException(
        'This time slot overlaps with an existing booking',
      );
    }
  }

  private isSerializationError(err: unknown): boolean {
    const e = err as {
      parent?: { code?: string };
      original?: { code?: string };
    };
    return e?.parent?.code === '40001' || e?.original?.code === '40001';
  }

  private validateBooker(
    userId: string | undefined,
    dto: CreateBookingDto,
  ): void {
    if (userId) return;

    const hasContact = dto.guestPhone || dto.guestEmail;
    if (!dto.guestName || !hasContact) {
      throw new BadRequestException(
        'Guest bookings require guestName and at least guestPhone or guestEmail',
      );
    }
  }

  private validateNotInPast(date: string): void {
    const today = todayLocalISO();
    if (date < today) {
      throw new BadRequestException('Cannot book a date in the past');
    }
  }

  private validateNoMidnightCrossing(startTime: string, endTime: string): void {
    if (endTime <= startTime) {
      throw new BadRequestException(
        'Booking slot cannot cross midnight (BR-023)',
      );
    }
  }

  private async resolveBookingRecipient(
    booking: Booking,
    userId?: string,
  ): Promise<{ email: string; name: string } | null> {
    if (userId) {
      const user = await this.usersService.findById(userId);
      // Un usuario con los avisos apagados no recibe nada. Los invitados no tienen
      // cuenta donde configurarlo, así que siguen recibiendo el correo — es su único
      // comprobante y el único lugar donde les llega el link para cancelar.
      if (!user || !user.notifyBookings) return null;
      return { email: user.email, name: user.name };
    }
    return booking.guestEmail
      ? { email: booking.guestEmail, name: booking.guestName || 'jugador' }
      : null;
  }

  private async notifyBookingCreated(
    booking: Booking,
    court: Court,
    business: Business,
    userId?: string,
    cancellationToken?: string,
  ): Promise<void> {
    const recipient = await this.resolveBookingRecipient(booking, userId);
    if (!recipient) return;
    await this.mailService.sendBookingConfirmation({
      to: recipient.email,
      recipientName: recipient.name,
      businessName: business.name,
      courtName: court.name,
      date: booking.date,
      startTime: booking.startTime,
      endTime: booking.endTime,
      price: Number(booking.totalPrice),
      businessId: business.id,
      bookingId: booking.id,
      guestCancellationToken: cancellationToken,
    });
  }

  private async notifyBookingCancelled(booking: Booking): Promise<void> {
    const recipient = await this.resolveBookingRecipient(
      booking,
      booking.userId || undefined,
    );
    if (!recipient) return;
    const businessName =
      booking.business?.name ??
      (await this.businessModel.findByPk(booking.businessId))?.name ??
      'el complejo';
    await this.mailService.sendBookingCancellation({
      to: recipient.email,
      recipientName: recipient.name,
      businessName,
      courtName: booking.court?.name ?? 'la cancha',
      date: booking.date,
      startTime: booking.startTime,
      endTime: booking.endTime,
      businessId: booking.businessId,
    });
  }
}
