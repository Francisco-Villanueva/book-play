import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Op, Transaction } from 'sequelize';
import { Sequelize } from 'sequelize-typescript';
import * as crypto from 'crypto';
import {
  BOOKING_REPOSITORY,
  COURT_REPOSITORY,
  BUSINESS_REPOSITORY,
  AVAILABILITY_RULE_REPOSITORY,
  EXCEPTION_RULE_REPOSITORY,
} from '../database/constants/repositories.constants';
import { Booking } from './entities/booking.model';
import { Court } from '../courts/entities/court.model';
import { Business } from '../businesses/entities/business.model';
import { AvailabilityRule } from '../availability-rules/entities/availability-rule.model';
import { ExceptionRule } from '../exception-rules/entities/exception-rule.model';
import { BookingStatus } from '../../common/enums';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UsersService } from '../users/users.service';
import { MailService } from '../mail/mail.service';

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

    const endTime = this.addMinutesToTime(dto.startTime, business.slotDuration);

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

      const totalPrice =
        Number(court.pricePerHour) * (business.slotDuration / 60);

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

  async findAllByBusiness(businessId: string): Promise<Booking[]> {
    return this.bookingModel.findAll({
      where: { businessId },
      include: [{ model: Court, as: 'court' }],
      order: [
        ['date', 'ASC'],
        ['startTime', 'ASC'],
      ],
    });
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
    availableSlots: { startTime: string; endTime: string }[];
  }> {
    const today = this.todayLocalISO();
    if (date < today) {
      throw new BadRequestException(
        'Cannot check availability for a past date',
      );
    }

    const business = await this.businessModel.findByPk(businessId);
    if (!business) throw new NotFoundException('Business not found');

    const court = await this.courtModel.findOne({
      where: { id: courtId, businessId },
    });
    if (!court) throw new NotFoundException('Court not found in this business');

    const dayOfWeek = new Date(date + 'T12:00:00').getDay();
    const { slotDuration } = business;

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
      const exStart = exc.startTime ? this.normalizeTime(exc.startTime) : null;
      const exEnd = exc.endTime ? this.normalizeTime(exc.endTime) : null;

      if (!exc.isAvailable) {
        if (!exStart || !exEnd) {
          // Full-day block — entire day is closed for this court
          return { date, courtId, slotDuration, availableSlots: [] };
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
        return { date, courtId, slotDuration, availableSlots: [] };
      }
      openWindows = rules.map((r) => ({
        start: this.normalizeTime(r.startTime),
        end: this.normalizeTime(r.endTime),
      }));
    }

    const existingBookings = await this.bookingModel.findAll({
      where: { courtId, date, status: BookingStatus.ACTIVE },
    });

    const availableSlots: { startTime: string; endTime: string }[] = [];

    for (const window of openWindows) {
      let slotStart = window.start;
      while (true) {
        const slotEnd = this.addMinutesToTime(slotStart, slotDuration);
        if (slotEnd > window.end) break;

        const isBlocked = blockedRanges.some(
          (b) => slotStart < b.end && slotEnd > b.start,
        );
        const isBooked = existingBookings.some(
          (bk) =>
            slotStart < this.normalizeTime(bk.endTime) &&
            slotEnd > this.normalizeTime(bk.startTime),
        );

        if (!isBlocked && !isBooked) {
          availableSlots.push({ startTime: slotStart, endTime: slotEnd });
        }
        slotStart = slotEnd;
      }
    }

    return { date, courtId, slotDuration, availableSlots };
  }

  // Business-wide availability for a date: one call returning every active
  // court's open slots plus a summarised next-free/full flag. Powers the public
  // court-list screen without the client having to fan out one request per court.
  async getBusinessAvailability(
    businessId: string,
    date: string,
  ): Promise<{
    date: string;
    slotDuration: number;
    courts: {
      courtId: string;
      name: string;
      sportType: string | null;
      surface: string | null;
      pricePerHour: number | null;
      availableSlots: { startTime: string; endTime: string }[];
      nextAvailable: string | null;
      isFull: boolean;
    }[];
  }> {
    const today = this.todayLocalISO();
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
          pricePerHour:
            court.pricePerHour != null ? Number(court.pricePerHour) : null,
          availableSlots,
          nextAvailable: availableSlots[0]?.startTime ?? null,
          isFull: availableSlots.length === 0,
        };
      }),
    );

    return { date, slotDuration: business.slotDuration, courts: results };
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
        ? this.normalizeTime(exception.startTime)
        : null;
      const exEnd = exception.endTime
        ? this.normalizeTime(exception.endTime)
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
      const ruleStart = this.normalizeTime(rule.startTime);
      const ruleEnd = this.normalizeTime(rule.endTime);
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
    const today = this.todayLocalISO();
    if (date < today) {
      throw new BadRequestException('Cannot book a date in the past');
    }
  }

  // Uses the server's local calendar date rather than UTC — date + 'T12:00:00'
  // elsewhere in this service is parsed as local time too, and comparing a
  // UTC "today" against that (BR-023/EC date checks) rejects the current day
  // as "past" for part of the evening in UTC-negative timezones (e.g. ART).
  private todayLocalISO(): string {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  private validateNoMidnightCrossing(startTime: string, endTime: string): void {
    if (endTime <= startTime) {
      throw new BadRequestException(
        'Booking slot cannot cross midnight (BR-023)',
      );
    }
  }

  private addMinutesToTime(time: string, minutes: number): string {
    const [h, m] = time.split(':').map(Number);
    const totalMinutes = h * 60 + m + minutes;
    const newH = Math.floor(totalMinutes / 60);
    const newM = totalMinutes % 60;
    return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
  }

  private normalizeTime(time: string): string {
    // Strip seconds from DB TIME values (e.g., "09:00:00" → "09:00")
    return time.substring(0, 5);
  }

  private async resolveBookingRecipient(
    booking: Booking,
    userId?: string,
  ): Promise<{ email: string; name: string } | null> {
    if (userId) {
      const user = await this.usersService.findById(userId);
      return user ? { email: user.email, name: user.name } : null;
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
