import { Test, TestingModule } from '@nestjs/testing';
import { RecurringBookingsGenerator } from './recurring-bookings.generator';
import { BOOKING_REPOSITORY } from '../database/constants/repositories.constants';
import { BookingsService } from '../bookings/bookings.service';
import { Court } from '../courts/entities/court.model';
import { RecurringBooking } from './entities/recurring-booking.model';
import { addDaysToISODate, todayLocalISO } from '../../common/utils/time.util';

const BUSINESS_ID = 'b1';
const COURT_ID = 'c1';

function makeCourt(slotDuration = 90, pricePerSlot = 48000) {
  return { id: COURT_ID, slotDuration, pricePerSlot } as unknown as Court;
}

function makeSeries(over: Partial<RecurringBooking> = {}) {
  const update = jest.fn().mockImplementation((fields: Record<string, string>) => {
    Object.assign(series, fields);
    return Promise.resolve();
  });
  const series = {
    id: 's1',
    businessId: BUSINESS_ID,
    courtId: COURT_ID,
    userId: null,
    guestName: 'Juan',
    guestPhone: '+5493511234567',
    guestEmail: null,
    dayOfWeek: 2,
    startTime: '20:00',
    startDate: '2026-08-04',
    endDate: null,
    generatedUntil: '2026-08-03',
    notes: null,
    update,
    ...over,
  } as unknown as RecurringBooking & { update: jest.Mock };
  return series;
}

describe('RecurringBookingsGenerator', () => {
  let generator: RecurringBookingsGenerator;
  let create: jest.Mock;
  let findSlotConflict: jest.Mock;
  let transaction: jest.Mock;
  let commit: jest.Mock;
  let rollback: jest.Mock;

  beforeEach(async () => {
    create = jest.fn().mockResolvedValue({ id: 'bk1' });
    findSlotConflict = jest.fn().mockResolvedValue(null);
    commit = jest.fn().mockResolvedValue(undefined);
    rollback = jest.fn().mockResolvedValue(undefined);
    transaction = jest.fn().mockResolvedValue({ commit, rollback });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RecurringBookingsGenerator,
        { provide: BOOKING_REPOSITORY, useValue: { create } },
        { provide: 'SEQUELIZE', useValue: { transaction } },
        { provide: BookingsService, useValue: { findSlotConflict } },
      ],
    }).compile();

    generator = module.get(RecurringBookingsGenerator);
  });

  describe('occurrenceDates', () => {
    it('devuelve sólo el día de la semana de la serie, cada 7 días', () => {
      const dates = generator.occurrenceDates(
        {
          dayOfWeek: 2,
          startTime: '20:00',
          startDate: '2026-08-04',
          endDate: null,
        },
        '2026-08-04',
        '2026-08-25',
      );

      expect(dates).toEqual([
        '2026-08-04',
        '2026-08-11',
        '2026-08-18',
        '2026-08-25',
      ]);
    });

    it('corta en endDate aunque la ventana llegue más lejos', () => {
      const dates = generator.occurrenceDates(
        {
          dayOfWeek: 2,
          startTime: '20:00',
          startDate: '2026-08-04',
          endDate: '2026-08-12',
        },
        '2026-08-04',
        '2026-09-30',
      );

      expect(dates).toEqual(['2026-08-04', '2026-08-11']);
    });

    it('nunca arranca antes de startDate aunque se pida desde más atrás', () => {
      const dates = generator.occurrenceDates(
        {
          dayOfWeek: 2,
          startTime: '20:00',
          startDate: '2026-08-18',
          endDate: null,
        },
        '2026-08-01',
        '2026-08-25',
      );

      expect(dates).toEqual(['2026-08-18', '2026-08-25']);
    });
  });

  describe('generateUpTo', () => {
    it('crea una instancia por fecha con el precio vigente de la cancha', async () => {
      const series = makeSeries();

      const report = await generator.generateUpTo(
        series,
        makeCourt(),
        '2026-08-18',
      );

      expect(report.created).toBe(3);
      expect(report.skipped).toBe(0);
      expect(create).toHaveBeenCalledTimes(3);
      expect(create.mock.calls[0][0]).toMatchObject({
        courtId: COURT_ID,
        businessId: BUSINESS_ID,
        date: '2026-08-04',
        startTime: '20:00',
        endTime: '21:30',
        totalPrice: 48000,
        recurringBookingId: 's1',
      });
    });

    it('saltea la fecha ocupada y sigue con el resto (no es todo o nada)', async () => {
      findSlotConflict
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce('BOOKED')
        .mockResolvedValueOnce(null);

      const report = await generator.generateUpTo(
        makeSeries(),
        makeCourt(),
        '2026-08-18',
      );

      expect(report.created).toBe(2);
      expect(report.skipped).toBe(1);
      expect(report.occurrences[1]).toMatchObject({
        date: '2026-08-11',
        status: 'SKIPPED',
        reason: 'BOOKED',
      });
    });

    it('trata una carrera perdida como slot ocupado, no como error', async () => {
      create.mockRejectedValueOnce(
        Object.assign(new Error('conflict'), { parent: { code: '40001' } }),
      );

      const report = await generator.generateUpTo(
        makeSeries(),
        makeCourt(),
        '2026-08-11',
      );

      expect(report.occurrences[0]).toMatchObject({
        status: 'SKIPPED',
        reason: 'BOOKED',
      });
      expect(rollback).toHaveBeenCalled();
    });

    it('avanza generatedUntil para que la próxima corrida no repita trabajo', async () => {
      const series = makeSeries();

      await generator.generateUpTo(series, makeCourt(), '2026-08-18');

      expect(series.update).toHaveBeenCalledWith({
        generatedUntil: '2026-08-18',
      });
    });

    it('no rellena hacia atrás fechas ya pasadas', async () => {
      const series = makeSeries({
        startDate: '2020-01-07',
        generatedUntil: '2020-01-06',
        dayOfWeek: new Date('2020-01-07T12:00:00').getDay(),
      });

      const report = await generator.generateUpTo(
        series,
        makeCourt(),
        addDaysToISODate(todayLocalISO(), -1),
      );

      expect(report.created).toBe(0);
      expect(create).not.toHaveBeenCalled();
    });
  });
});
