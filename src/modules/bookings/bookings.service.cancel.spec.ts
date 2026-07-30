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
import { BookingStatus } from '../../common/enums';
import type { Booking } from './entities/booking.model';

const USER_ID = 'u1';

// Un turno dentro de N horas a partir de ahora, en el formato del dominio.
function bookingIn(hours: number, over: Partial<Booking> = {}) {
  const at = new Date(Date.now() + hours * 3_600_000);
  const date = `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, '0')}-${String(at.getDate()).padStart(2, '0')}`;
  const startTime = `${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}:00`;

  return {
    id: 'bk1',
    businessId: 'b1',
    date,
    startTime,
    endTime: startTime,
    status: BookingStatus.ACTIVE,
    guestName: 'Juan',
    recurringBookingId: null,
    update: jest.fn().mockResolvedValue(undefined),
    ...over,
  } as unknown as Booking & { update: jest.Mock };
}

describe('BookingsService — plazo de cancelación (BR-019)', () => {
  let service: BookingsService;
  let bookingFindOne: jest.Mock;
  let businessFindByPk: jest.Mock;
  let notifyClientCancellation: jest.Mock;

  const setDeadline = (hours: number) =>
    businessFindByPk.mockResolvedValue({
      id: 'b1',
      name: 'Padel House',
      cancellationDeadlineHours: hours,
    });

  beforeEach(async () => {
    bookingFindOne = jest.fn();
    businessFindByPk = jest.fn();
    notifyClientCancellation = jest.fn().mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingsService,
        { provide: BOOKING_REPOSITORY, useValue: { findOne: bookingFindOne } },
        { provide: COURT_REPOSITORY, useValue: {} },
        { provide: BUSINESS_REPOSITORY, useValue: { findByPk: businessFindByPk } },
        { provide: AVAILABILITY_RULE_REPOSITORY, useValue: {} },
        { provide: EXCEPTION_RULE_REPOSITORY, useValue: {} },
        { provide: SUBSCRIPTION_REPOSITORY, useValue: {} },
        { provide: 'SEQUELIZE', useValue: {} },
        { provide: UsersService, useValue: { findById: jest.fn() } },
        { provide: MailService, useValue: { sendBookingCancellation: jest.fn() } },
        { provide: NotificationsService, useValue: { notifyClientCancellation } },
      ],
    }).compile();

    service = module.get(BookingsService);
  });

  it('rechaza al cliente que cancela dentro del plazo mínimo', async () => {
    const booking = bookingIn(3);
    bookingFindOne.mockResolvedValue(booking);
    setDeadline(24);

    await expect(service.cancelForUser('bk1', USER_ID)).rejects.toThrow(
      BadRequestException,
    );
    expect(booking.update).not.toHaveBeenCalled();
  });

  it('deja cancelar cuando falta más que el plazo', async () => {
    const booking = bookingIn(48);
    bookingFindOne.mockResolvedValue(booking);
    setDeadline(24);

    await service.cancelForUser('bk1', USER_ID);

    expect(booking.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: BookingStatus.CANCELLED }),
    );
  });

  it('con el plazo en 0 no hay restricción', async () => {
    const booking = bookingIn(1);
    bookingFindOne.mockResolvedValue(booking);
    setDeadline(0);

    await service.cancelForUser('bk1', USER_ID);

    expect(booking.update).toHaveBeenCalled();
  });

  it('el mensaje de error dice cuántas horas exige el complejo', async () => {
    bookingFindOne.mockResolvedValue(bookingIn(1));
    setDeadline(48);

    await expect(service.cancelForUser('bk1', USER_ID)).rejects.toThrow(
      /48 horas/,
    );
  });

  it('el staff NO queda limitado por el plazo', async () => {
    const booking = bookingIn(1, { court: { name: 'Cancha 1' } as never });
    bookingFindOne.mockResolvedValue(booking);
    setDeadline(24);

    await service.cancel('bk1', 'b1');

    expect(booking.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: BookingStatus.CANCELLED }),
    );
  });

  it('avisa al complejo cuando cancela el cliente', async () => {
    bookingFindOne.mockResolvedValue(bookingIn(48));
    setDeadline(24);

    await service.cancelForUser('bk1', USER_ID);
    await new Promise(process.nextTick);

    expect(notifyClientCancellation).toHaveBeenCalledWith(
      expect.objectContaining({ isRecurringInstance: false }),
    );
  });

  it('NO avisa cuando cancela el staff — ya lo sabe', async () => {
    bookingFindOne.mockResolvedValue(bookingIn(48));
    setDeadline(24);

    await service.cancel('bk1', 'b1');
    await new Promise(process.nextTick);

    expect(notifyClientCancellation).not.toHaveBeenCalled();
  });

  it('marca la baja de una fecha de turno fijo como tal', async () => {
    bookingFindOne.mockResolvedValue(bookingIn(48, { recurringBookingId: 's1' }));
    setDeadline(24);

    await service.cancelForUser('bk1', USER_ID);
    await new Promise(process.nextTick);

    expect(notifyClientCancellation).toHaveBeenCalledWith(
      expect.objectContaining({ isRecurringInstance: true }),
    );
  });
});
