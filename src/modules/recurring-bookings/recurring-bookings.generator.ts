import { Inject, Injectable, Logger } from '@nestjs/common';
import { Transaction } from 'sequelize';
import { Sequelize } from 'sequelize-typescript';
import { BOOKING_REPOSITORY } from '../database/constants/repositories.constants';
import { Booking } from '../bookings/entities/booking.model';
import { BookingsService } from '../bookings/bookings.service';
import type { SlotConflictReason } from '../bookings/bookings.service';
import { Court } from '../courts/entities/court.model';
import { RecurringBooking } from './entities/recurring-booking.model';
import {
  addDaysToISODate,
  addMinutesToTime,
  firstDateOnOrAfter,
  todayLocalISO,
} from '../../common/utils/time.util';

// Cuánto hacia adelante se materializan las instancias de una serie sin fin.
// 12 semanas es lo que un complejo mira en la agenda; más que eso sólo infla la
// tabla `bookings` y congela precios que todavía pueden cambiar.
export const GENERATION_HORIZON_DAYS = 84;

// Lo mínimo que define las fechas de una serie. Con esto la previsualización
// trabaja sobre un DTO sin tener que instanciar el modelo.
export interface SeriesShape {
  dayOfWeek: number;
  startTime: string;
  startDate: string;
  endDate: string | null;
}

export interface OccurrenceResult {
  date: string;
  status: 'CREATED' | 'SKIPPED';
  reason?: SlotConflictReason;
  bookingId?: string;
}

export interface GenerationReport {
  created: number;
  skipped: number;
  occurrences: OccurrenceResult[];
  generatedUntil: string;
}

@Injectable()
export class RecurringBookingsGenerator {
  private readonly logger = new Logger(RecurringBookingsGenerator.name);

  constructor(
    @Inject(BOOKING_REPOSITORY)
    private readonly bookingModel: typeof Booking,
    @Inject('SEQUELIZE')
    private readonly sequelize: Sequelize,
    private readonly bookingsService: BookingsService,
  ) {}

  horizonDate(from: string = todayLocalISO()): string {
    return addDaysToISODate(from, GENERATION_HORIZON_DAYS);
  }

  // Las fechas que le tocan a la serie entre `from` y `until`, ambas inclusive.
  // No consulta la base: sirve igual para la previsualización y para generar.
  occurrenceDates(series: SeriesShape, from: string, until: string): string[] {
    const limit =
      series.endDate && series.endDate < until ? series.endDate : until;
    const floor = from > series.startDate ? from : series.startDate;

    const dates: string[] = [];
    let cursor = firstDateOnOrAfter(floor, series.dayOfWeek);
    while (cursor <= limit) {
      dates.push(cursor);
      cursor = addDaysToISODate(cursor, 7);
    }
    return dates;
  }

  // Evalúa fechas sin escribir nada. Es lo que le muestra al encargado qué
  // fechas van a quedar afuera ANTES de confirmar el turno fijo.
  async evaluate(
    businessId: string,
    court: Court,
    series: SeriesShape,
    from: string,
    until: string,
  ): Promise<{ date: string; conflict: SlotConflictReason | null }[]> {
    const endTime = addMinutesToTime(series.startTime, court.slotDuration);
    const dates = this.occurrenceDates(series, from, until);

    const results: { date: string; conflict: SlotConflictReason | null }[] = [];
    for (const date of dates) {
      results.push({
        date,
        conflict: await this.bookingsService.findSlotConflict(
          businessId,
          court.id,
          date,
          series.startTime,
          endTime,
        ),
      });
    }
    return results;
  }

  // Materializa las instancias que faltan hasta `until` y mueve `generatedUntil`.
  // Tolera conflictos a propósito: que la semana 7 esté ocupada no puede tumbar
  // el alta entera — el complejo ve el hueco en el reporte y lo resuelve aparte.
  async generateUpTo(
    series: RecurringBooking,
    court: Court,
    until: string,
  ): Promise<GenerationReport> {
    const today = todayLocalISO();
    const from = addDaysToISODate(series.generatedUntil, 1);
    // Nunca se crean instancias en el pasado: una serie que estuvo pausada no
    // debe rellenar hacia atrás fechas que ya no se pueden jugar.
    const floor = from > today ? from : today;

    const endTime = addMinutesToTime(series.startTime, court.slotDuration);
    const dates = this.occurrenceDates(series, floor, until);
    const occurrences: OccurrenceResult[] = [];

    for (const date of dates) {
      const result = await this.createInstance(series, court, date, endTime);
      occurrences.push(result);
    }

    const limit =
      series.endDate && series.endDate < until ? series.endDate : until;
    if (limit > series.generatedUntil) {
      await series.update({ generatedUntil: limit });
    }

    return {
      created: occurrences.filter((o) => o.status === 'CREATED').length,
      skipped: occurrences.filter((o) => o.status === 'SKIPPED').length,
      occurrences,
      generatedUntil: series.generatedUntil,
    };
  }

  private async createInstance(
    series: RecurringBooking,
    court: Court,
    date: string,
    endTime: string,
  ): Promise<OccurrenceResult> {
    // Misma protección que una reserva suelta: SERIALIZABLE hace que dos altas
    // simultáneas sobre el mismo slot no puedan pasar ambas el chequeo (BR-001).
    const t = await this.sequelize.transaction({
      isolationLevel: Transaction.ISOLATION_LEVELS.SERIALIZABLE,
    });

    try {
      const conflict = await this.bookingsService.findSlotConflict(
        series.businessId,
        court.id,
        date,
        series.startTime,
        endTime,
        t,
      );

      if (conflict) {
        await t.rollback();
        return { date, status: 'SKIPPED', reason: conflict };
      }

      const booking = await this.bookingModel.create(
        {
          courtId: court.id,
          businessId: series.businessId,
          userId: series.userId,
          guestName: series.guestName,
          guestPhone: series.guestPhone,
          guestEmail: series.guestEmail,
          date,
          startTime: series.startTime,
          endTime,
          // Precio vigente al generarse, no el del alta de la serie: un aumento
          // impacta en los turnos futuros, como pasa en el mostrador.
          totalPrice: Number(court.pricePerSlot),
          notes: series.notes,
          recurringBookingId: series.id,
        },
        { transaction: t },
      );

      await t.commit();
      return { date, status: 'CREATED', bookingId: booking.id };
    } catch (err) {
      await t.rollback();
      // Una carrera perdida contra otra alta es un slot ocupado, no un error:
      // el índice único parcial y SSI son las dos formas de enterarse.
      if (this.isRaceLost(err)) {
        return { date, status: 'SKIPPED', reason: 'BOOKED' };
      }
      this.logger.error(
        `Error generando la instancia ${date} de la serie ${series.id}: ${(err as Error).message}`,
      );
      return { date, status: 'SKIPPED', reason: 'BOOKED' };
    }
  }

  private isRaceLost(err: unknown): boolean {
    const e = err as {
      name?: string;
      parent?: { code?: string };
      original?: { code?: string };
    };
    const code = e?.parent?.code ?? e?.original?.code;
    return (
      code === '40001' || // serialization_failure
      code === '23505' || // unique_violation (índice parcial de BR-001)
      e?.name === 'SequelizeUniqueConstraintError'
    );
  }
}
