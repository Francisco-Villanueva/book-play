import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { BookingPaymentsService } from './booking-payments.service';
import { BOOKING_REPOSITORY } from '../database/constants/repositories.constants';
import { BookingPaymentStatus } from '../../common/enums';
import { Booking } from './entities/booking.model';

const BUSINESS_ID = 'b1';
const BOOKING_ID = 'bk1';
const STAFF_ID = 'u1';

type UpdatedFields = Record<string, unknown>;

function makeBooking(totalPrice: number | null = 20000) {
  const update = jest.fn().mockResolvedValue(undefined);
  return { totalPrice, update } as unknown as Booking & {
    update: jest.Mock<Promise<void>, [UpdatedFields]>;
  };
}

describe('BookingPaymentsService', () => {
  let service: BookingPaymentsService;
  let findOne: jest.Mock;

  beforeEach(async () => {
    findOne = jest.fn();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingPaymentsService,
        { provide: BOOKING_REPOSITORY, useValue: { findOne } },
      ],
    }).compile();

    service = module.get(BookingPaymentsService);
  });

  const run = (dto: Parameters<BookingPaymentsService['updatePayment']>[2]) =>
    service.updatePayment(BOOKING_ID, BUSINESS_ID, dto, STAFF_ID);

  it('rejects a booking from another business (BR-017)', async () => {
    findOne.mockResolvedValue(null);

    await expect(run({ totalPlayers: 6, playersPaid: 6 })).rejects.toThrow(
      NotFoundException,
    );
  });

  it('rejects more paying players than there were players', async () => {
    findOne.mockResolvedValue(makeBooking());

    await expect(run({ totalPlayers: 4, playersPaid: 6 })).rejects.toThrow(
      BadRequestException,
    );
  });

  it('derives UNPAID when nobody paid', async () => {
    const booking = makeBooking();
    findOne.mockResolvedValue(booking);

    await run({ totalPlayers: 6, playersPaid: 0 });

    expect(booking.update).toHaveBeenCalledWith(
      expect.objectContaining({
        paymentStatus: BookingPaymentStatus.UNPAID,
        amountPaid: 0,
      }),
    );
  });

  it('derives PARTIAL when some players paid', async () => {
    const booking = makeBooking();
    findOne.mockResolvedValue(booking);

    await run({ totalPlayers: 6, playersPaid: 4 });

    expect(booking.update).toHaveBeenCalledWith(
      expect.objectContaining({
        paymentStatus: BookingPaymentStatus.PARTIAL,
        playersPaid: 4,
        totalPlayers: 6,
      }),
    );
  });

  it('derives PAID when every player paid', async () => {
    const booking = makeBooking();
    findOne.mockResolvedValue(booking);

    await run({ totalPlayers: 6, playersPaid: 6 });

    expect(booking.update).toHaveBeenCalledWith(
      expect.objectContaining({
        paymentStatus: BookingPaymentStatus.PAID,
        amountPaid: 20000,
      }),
    );
  });

  it('prorates the price across the players who paid', async () => {
    const booking = makeBooking(20000);
    findOne.mockResolvedValue(booking);

    await run({ totalPlayers: 4, playersPaid: 3 });

    expect(booking.update).toHaveBeenCalledWith(
      expect.objectContaining({ amountPaid: 15000 }),
    );
  });

  it('charges the exact list price when all paid, without prorating drift', async () => {
    const booking = makeBooking(10000);
    findOne.mockResolvedValue(booking);

    await run({ totalPlayers: 3, playersPaid: 3 });

    expect(booking.update).toHaveBeenCalledWith(
      expect.objectContaining({ amountPaid: 10000 }),
    );
  });

  it('keeps an explicit amount instead of prorating (discount, courtesy)', async () => {
    const booking = makeBooking(20000);
    findOne.mockResolvedValue(booking);

    await run({ totalPlayers: 6, playersPaid: 6, amountPaid: 15000 });

    expect(booking.update).toHaveBeenCalledWith(
      expect.objectContaining({
        amountPaid: 15000,
        paymentStatus: BookingPaymentStatus.PAID,
      }),
    );
  });

  it('leaves amountPaid null when the booking has no price', async () => {
    const booking = makeBooking(null);
    findOne.mockResolvedValue(booking);

    await run({ totalPlayers: 4, playersPaid: 2 });

    expect(booking.update).toHaveBeenCalledWith(
      expect.objectContaining({ amountPaid: null }),
    );
  });

  it('records who registered the payment', async () => {
    const booking = makeBooking();
    findOne.mockResolvedValue(booking);

    await run({ totalPlayers: 2, playersPaid: 1 });

    expect(booking.update).toHaveBeenCalledWith(
      expect.objectContaining({ paymentRecordedBy: STAFF_ID }),
    );
  });
});
