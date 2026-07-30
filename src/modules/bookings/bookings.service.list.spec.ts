import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { Op } from 'sequelize';
import { BookingsService } from './bookings.service';
import {
  BOOKING_REPOSITORY,
  COURT_REPOSITORY,
  BUSINESS_REPOSITORY,
  AVAILABILITY_RULE_REPOSITORY,
  EXCEPTION_RULE_REPOSITORY,
  SUBSCRIPTION_REPOSITORY,
} from '../database/constants/repositories.constants';
import { BookingPaymentStatus, BookingStatus } from '../../common/enums';
import { ListBookingsQueryDto } from './dto/list-bookings-query.dto';
import { UsersService } from '../users/users.service';
import { MailService } from '../mail/mail.service';
import { NotificationsService } from '../notifications/notifications.service';

const BUSINESS_ID = 'b1';

type FindArgs = {
  where: Record<string | symbol, unknown>;
  limit: number;
  offset: number;
  order: [string, string][];
};

describe('BookingsService.findAllByBusiness', () => {
  let service: BookingsService;
  let findAndCountAll: jest.Mock;

  beforeEach(async () => {
    findAndCountAll = jest.fn().mockResolvedValue({ rows: [], count: 0 });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingsService,
        { provide: BOOKING_REPOSITORY, useValue: { findAndCountAll } },
        { provide: COURT_REPOSITORY, useValue: {} },
        { provide: BUSINESS_REPOSITORY, useValue: {} },
        { provide: AVAILABILITY_RULE_REPOSITORY, useValue: {} },
        { provide: EXCEPTION_RULE_REPOSITORY, useValue: {} },
        { provide: SUBSCRIPTION_REPOSITORY, useValue: {} },
        { provide: 'SEQUELIZE', useValue: {} },
        { provide: UsersService, useValue: {} },
        { provide: MailService, useValue: {} },
        { provide: NotificationsService, useValue: {} },
      ],
    }).compile();

    service = module.get(BookingsService);
  });

  const run = (query: ListBookingsQueryDto = {}) =>
    service.findAllByBusiness(BUSINESS_ID, query);

  const lastCall = (): FindArgs => {
    const calls = findAndCountAll.mock.calls as [FindArgs][];
    return calls[0][0];
  };

  it('always scopes the query to the business (BR-017)', async () => {
    await run();

    expect(lastCall().where.businessId).toBe(BUSINESS_ID);
  });

  it('paginates with a bounded default page size', async () => {
    await run();

    expect(lastCall().limit).toBe(50);
    expect(lastCall().offset).toBe(0);
  });

  it('caps the page size at the maximum even if a bigger one is asked for', async () => {
    await run({ limit: 5000 });

    expect(lastCall().limit).toBe(200);
  });

  it('computes the offset from the requested page', async () => {
    await run({ page: 3, limit: 20 });

    expect(lastCall().offset).toBe(40);
  });

  it('reports total pages in meta', async () => {
    findAndCountAll.mockResolvedValue({ rows: [], count: 105 });

    const result = await run({ limit: 50 });

    expect(result.meta).toEqual({
      total: 105,
      page: 1,
      limit: 50,
      totalPages: 3,
    });
  });

  it('turns `date` into a single-day range', async () => {
    await run({ date: '2026-03-15' });

    expect(lastCall().where.date).toEqual({
      [Op.between]: ['2026-03-15', '2026-03-15'],
    });
  });

  it('supports an open-ended range', async () => {
    await run({ dateFrom: '2026-03-01' });

    expect(lastCall().where.date).toEqual({ [Op.gte]: '2026-03-01' });
  });

  it('rejects an inverted date range', async () => {
    await expect(
      run({ dateFrom: '2026-03-31', dateTo: '2026-03-01' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('filters by court and status', async () => {
    await run({ courtId: 'c1', status: BookingStatus.CANCELLED });

    const { where } = lastCall();
    expect(where.courtId).toBe('c1');
    expect(where.status).toBe(BookingStatus.CANCELLED);
  });

  it('accepts several payment statuses at once (the "sin cobrar" filter)', async () => {
    await run({
      paymentStatus: [
        BookingPaymentStatus.UNPAID,
        BookingPaymentStatus.PARTIAL,
      ],
    });

    expect(lastCall().where.paymentStatus).toEqual({
      [Op.in]: [BookingPaymentStatus.UNPAID, BookingPaymentStatus.PARTIAL],
    });
  });

  it('ignores an empty payment status list', async () => {
    await run({ paymentStatus: [] });

    expect(lastCall().where.paymentStatus).toBeUndefined();
  });

  it('searches across guest, account holder and court', async () => {
    await run({ q: 'Fernández' });

    const or = lastCall().where[Op.or] as Record<string, unknown>[];
    expect(or.map((clause) => Object.keys(clause)[0])).toEqual([
      'guestName',
      'guestPhone',
      'guestEmail',
      '$user.name$',
      '$user.email$',
      '$court.name$',
    ]);
  });

  it('escapes LIKE wildcards so the search stays literal', async () => {
    await run({ q: '100%_off' });

    const or = lastCall().where[Op.or] as Record<
      string,
      Record<symbol, string>
    >[];
    expect(or[0].guestName[Op.iLike]).toBe('%100\\%\\_off%');
  });

  it('ignores a blank search term', async () => {
    await run({ q: '   ' });

    expect(lastCall().where[Op.or]).toBeUndefined();
  });

  it('orders ascending by default and descending on request', async () => {
    await run();
    expect(lastCall().order).toEqual([
      ['date', 'ASC'],
      ['startTime', 'ASC'],
      ['id', 'ASC'],
    ]);

    findAndCountAll.mockClear();
    await run({ sort: 'desc' });
    expect(lastCall().order).toEqual([
      ['date', 'DESC'],
      ['startTime', 'DESC'],
      ['id', 'DESC'],
    ]);
  });
});
