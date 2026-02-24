import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Op } from 'sequelize';
import { Sequelize } from 'sequelize-typescript';
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
import { CourtAvailability } from '../availability-rules/entities/court-availability.model';
import { CourtException } from '../exception-rules/entities/court-exception.model';
import { BookingStatus } from '../../common/enums';
import { CreateBookingDto } from './dto/create-booking.dto';

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

    await this.checkAvailability(dto.courtId, dto.date, dto.startTime, endTime);
    await this.checkNoOverlap(dto.courtId, dto.date, dto.startTime, endTime);

    const totalPrice =
      Number(court.pricePerHour) * (business.slotDuration / 60);

    return this.bookingModel.create({
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
    });
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

    return booking;
  }

  private validateBooker(userId: string | undefined, dto: CreateBookingDto) {
    if (userId) return;

    const hasContact = dto.guestPhone || dto.guestEmail;
    if (!dto.guestName || !hasContact) {
      throw new BadRequestException(
        'Guest bookings require guestName and at least guestPhone or guestEmail',
      );
    }
  }

  private validateNotInPast(date: string) {
    const today = new Date().toISOString().split('T')[0];
    if (date < today) {
      throw new BadRequestException('Cannot book a date in the past');
    }
  }

  private validateNoMidnightCrossing(startTime: string, endTime: string) {
    if (endTime <= startTime) {
      throw new BadRequestException(
        'Booking slot cannot cross midnight (BR-023)',
      );
    }
  }

  private async checkAvailability(
    courtId: string,
    date: string,
    startTime: string,
    endTime: string,
  ) {
    const dayOfWeek = new Date(date + 'T12:00:00').getDay();

    // Check exception rules first (highest priority)
    const exceptions = await this.exceptionRuleModel.findAll({
      where: { date },
      include: [
        {
          model: Court,
          as: 'courts',
          where: { id: courtId },
          through: { attributes: [] },
        },
      ],
    });

    if (exceptions.length > 0) {
      return this.checkExceptionAvailability(
        exceptions,
        startTime,
        endTime,
        dayOfWeek,
        courtId,
      );
    }

    // No exceptions — fall back to availability rules
    await this.checkAvailabilityRules(courtId, dayOfWeek, startTime, endTime);
  }

  private async checkExceptionAvailability(
    exceptions: ExceptionRule[],
    startTime: string,
    endTime: string,
    dayOfWeek: number,
    courtId: string,
  ) {
    for (const exception of exceptions) {
      const exStart = exception.startTime
        ? this.normalizeTime(exception.startTime)
        : null;
      const exEnd = exception.endTime
        ? this.normalizeTime(exception.endTime)
        : null;

      if (!exception.isAvailable) {
        // Block exception
        if (!exStart || !exEnd) {
          // Full day block — no time range means entire day is closed
          throw new BadRequestException(
            `Court is closed on this date: ${exception.reason || 'no reason given'}`,
          );
        }
        // Partial block — check if requested slot overlaps with blocked range
        if (startTime < exEnd && endTime > exStart) {
          throw new BadRequestException(
            `Requested slot overlaps with a blocked period (${exStart}-${exEnd}): ${exception.reason || 'no reason given'}`,
          );
        }
      } else {
        // Enable exception — ONLY this range is available
        if (exStart && exEnd) {
          if (startTime < exStart || endTime > exEnd) {
            throw new BadRequestException(
              `Court is only available ${exStart}-${exEnd} on this date`,
            );
          }
          return; // Slot fits within the enabled exception range
        }
      }
    }

    // If we only had partial block exceptions, still need to check availability rules
    // for the non-blocked times
    await this.checkAvailabilityRules(courtId, dayOfWeek, startTime, endTime);
  }

  private async checkAvailabilityRules(
    courtId: string,
    dayOfWeek: number,
    startTime: string,
    endTime: string,
  ) {
    const rules = await this.availabilityRuleModel.findAll({
      where: { dayOfWeek, isActive: true },
      include: [
        {
          model: Court,
          as: 'courts',
          where: { id: courtId },
          through: { attributes: [] },
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
  ) {
    const overlapping = await this.bookingModel.findOne({
      where: {
        courtId,
        date,
        status: BookingStatus.ACTIVE,
        startTime: { [Op.lt]: endTime },
        endTime: { [Op.gt]: startTime },
      },
    });

    if (overlapping) {
      throw new ConflictException(
        'This time slot overlaps with an existing booking',
      );
    }
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
    const today = new Date().toISOString().split('T')[0];
    if (date < today) {
      throw new BadRequestException('Cannot check availability for a past date');
    }

    const business = await this.businessModel.findByPk(businessId);
    if (!business) throw new NotFoundException('Business not found');

    const court = await this.courtModel.findOne({ where: { id: courtId, businessId } });
    if (!court) throw new NotFoundException('Court not found in this business');

    const dayOfWeek = new Date(date + 'T12:00:00').getDay();
    const { slotDuration } = business;

    const exceptions = await this.exceptionRuleModel.findAll({
      where: { businessId, date },
      include: [{
        model: Court,
        as: 'courts',
        where: { id: courtId },
        through: { attributes: [] },
        required: true,
      }],
    });

    let openWindows: { start: string; end: string }[] = [];
    const blockedRanges: { start: string; end: string }[] = [];
    let hasEnablingException = false;

    for (const exc of exceptions) {
      const exStart = exc.startTime ? this.normalizeTime(exc.startTime) : null;
      const exEnd = exc.endTime ? this.normalizeTime(exc.endTime) : null;

      if (!exc.isAvailable) {
        if (!exStart || !exEnd) {
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
        include: [{
          model: Court,
          as: 'courts',
          where: { id: courtId },
          through: { attributes: [] },
          required: true,
        }],
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
}
