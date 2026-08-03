import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { BookingsService } from './bookings.service';
import {
  AVAILABILITY_RULE_REPOSITORY,
  BOOKING_REPOSITORY,
  BUSINESS_REPOSITORY,
  COURT_REPOSITORY,
  EXCEPTION_RULE_REPOSITORY,
  SUBSCRIPTION_REPOSITORY,
} from '../database/constants/repositories.constants';
import { UsersService } from '../users/users.service';
import { MailService } from '../mail/mail.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  addDaysToISODate,
  dayOfWeekOfISODate,
  todayLocalISO,
} from '../../common/utils/time.util';

// Se congela el reloj para que la grilla de hoy no dependa de la hora a la que
// corran los tests: sin esto, el mismo caso pasa a la mañana y falla a la noche.
const FROZEN_NOW = new Date('2026-08-03T18:00:00-03:00'); // lunes, 18:00 ART

describe('BookingsService — disponibilidad', () => {
  let service: BookingsService;
  let courtFindOne: jest.Mock;
  let bookingFindAll: jest.Mock;
  let ruleFindAll: jest.Mock;
  let exceptionFindAll: jest.Mock;

  const TODAY = () => todayLocalISO();
  const TOMORROW = () => addDaysToISODate(todayLocalISO(), 1);

  // Una regla abierta de 08:00 a 22:00 para el día de la fecha pedida.
  const openAllDay = (date: string) =>
    ruleFindAll.mockResolvedValue([
      {
        dayOfWeek: dayOfWeekOfISODate(date),
        startTime: '08:00:00',
        endTime: '22:00:00',
        isActive: true,
      },
    ]);

  beforeAll(() => {
    jest.useFakeTimers({ doNotFake: ['nextTick'] });
    jest.setSystemTime(FROZEN_NOW);
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  beforeEach(async () => {
    courtFindOne = jest.fn().mockResolvedValue({
      id: 'c1',
      businessId: 'b1',
      slotDuration: 60,
      pricePerSlot: 18000,
    });
    bookingFindAll = jest.fn().mockResolvedValue([]);
    ruleFindAll = jest.fn().mockResolvedValue([]);
    exceptionFindAll = jest.fn().mockResolvedValue([]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingsService,
        {
          provide: BOOKING_REPOSITORY,
          useValue: { findAll: bookingFindAll },
        },
        { provide: COURT_REPOSITORY, useValue: { findOne: courtFindOne } },
        { provide: BUSINESS_REPOSITORY, useValue: { findByPk: jest.fn() } },
        {
          provide: AVAILABILITY_RULE_REPOSITORY,
          useValue: { findAll: ruleFindAll },
        },
        {
          provide: EXCEPTION_RULE_REPOSITORY,
          useValue: { findAll: exceptionFindAll },
        },
        {
          provide: SUBSCRIPTION_REPOSITORY,
          useValue: { findOne: jest.fn().mockResolvedValue(null) },
        },
        { provide: 'SEQUELIZE', useValue: {} },
        { provide: UsersService, useValue: {} },
        { provide: MailService, useValue: {} },
        { provide: NotificationsService, useValue: {} },
      ],
    }).compile();

    service = module.get(BookingsService);
  });

  const slots = async (date: string) =>
    (await service.getAvailableSlots('b1', 'c1', date)).availableSlots;

  it('no ofrece turnos de hoy que ya terminaron', async () => {
    openAllDay(TODAY());

    const result = await slots(TODAY());

    expect(result.some((s) => s.startTime === '09:00')).toBe(false);
    expect(result.some((s) => s.startTime === '17:00')).toBe(false);
  });

  it('sigue ofreciendo el turno en curso, para que el mostrador pueda cargarlo', async () => {
    openAllDay(TODAY());

    // Son las 18:00: el de 18:00-19:00 recién arranca y el de 19:00 es futuro.
    const result = await slots(TODAY());

    expect(result[0]?.startTime).toBe('18:00');
    expect(result.some((s) => s.startTime === '19:00')).toBe(true);
  });

  it('en un día futuro no recorta nada', async () => {
    openAllDay(TOMORROW());

    const result = await slots(TOMORROW());

    expect(result[0]?.startTime).toBe('08:00');
    expect(result).toHaveLength(14);
  });

  it('rechaza una fecha pasada', async () => {
    await expect(
      service.getAvailableSlots('b1', 'c1', addDaysToISODate(TODAY(), -1)),
    ).rejects.toThrow(BadRequestException);
  });

  it('una cancha sin AvailabilityRule no es reservable (BR-009)', async () => {
    ruleFindAll.mockResolvedValue([]);

    expect(await slots(TOMORROW())).toEqual([]);
  });

  it('descuenta los turnos ya reservados', async () => {
    openAllDay(TOMORROW());
    bookingFindAll.mockResolvedValue([
      { startTime: '10:00:00', endTime: '11:00:00' },
    ]);

    const result = await slots(TOMORROW());

    expect(result.some((s) => s.startTime === '10:00')).toBe(false);
    expect(result.some((s) => s.startTime === '11:00')).toBe(true);
  });

  it('un cierre de día completo por ExceptionRule deja la grilla vacía (BR-007)', async () => {
    openAllDay(TOMORROW());
    exceptionFindAll.mockResolvedValue([
      { isAvailable: false, startTime: null, endTime: null, courts: [] },
    ]);

    expect(await slots(TOMORROW())).toEqual([]);
  });

  it('una apertura especial pisa la regla semanal (BR-007)', async () => {
    openAllDay(TOMORROW());
    exceptionFindAll.mockResolvedValue([
      {
        isAvailable: true,
        startTime: '20:00:00',
        endTime: '22:00:00',
        courts: [],
      },
    ]);

    const result = await slots(TOMORROW());

    expect(result).toEqual([
      { startTime: '20:00', endTime: '21:00' },
      { startTime: '21:00', endTime: '22:00' },
    ]);
  });
});
