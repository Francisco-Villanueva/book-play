import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import {
  BUSINESS_USER_REPOSITORY,
  NOTIFICATION_REPOSITORY,
} from '../database/constants/repositories.constants';
import { MailService } from '../mail/mail.service';
import { BusinessRole } from '../../common/enums';
import type { Booking } from '../bookings/entities/booking.model';
import type { Business } from '../businesses/entities/business.model';

const BUSINESS_ID = 'b1';

const business = { id: BUSINESS_ID, name: 'Padel House' } as Business;

function makeBooking(over: Partial<Booking> = {}) {
  return {
    id: 'bk1',
    date: '2026-08-04',
    startTime: '20:00:00',
    endTime: '21:30:00',
    guestName: 'Juan',
    user: null,
    recurringBookingId: null,
    ...over,
  } as unknown as Booking;
}

// Un vínculo BusinessUser tal como lo devuelve Sequelize (el user va en .get()).
function link(role: BusinessRole, email: string, name: string) {
  return { role, get: () => ({ email, name }) };
}

describe('NotificationsService', () => {
  let service: NotificationsService;
  let create: jest.Mock;
  let update: jest.Mock;
  let findOne: jest.Mock;
  let buFindAll: jest.Mock;
  let sendBookingCancelledByClient: jest.Mock;

  beforeEach(async () => {
    create = jest.fn().mockResolvedValue({ id: 'n1' });
    update = jest.fn().mockResolvedValue([2]);
    findOne = jest.fn();
    buFindAll = jest.fn().mockResolvedValue([]);
    sendBookingCancelledByClient = jest.fn().mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        {
          provide: NOTIFICATION_REPOSITORY,
          useValue: {
            create,
            update,
            findOne,
            findAll: jest.fn(),
            count: jest.fn(),
          },
        },
        { provide: BUSINESS_USER_REPOSITORY, useValue: { findAll: buFindAll } },
        { provide: MailService, useValue: { sendBookingCancelledByClient } },
      ],
    }).compile();

    service = module.get(NotificationsService);
  });

  const notify = (over: Partial<Booking> = {}, isRecurringInstance = false) =>
    service.notifyClientCancellation({
      booking: makeBooking(over),
      business,
      courtName: 'Cancha 1',
      isRecurringInstance,
    });

  it('deja la notificación en el panel del complejo', async () => {
    await notify();

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        businessId: BUSINESS_ID,
        type: 'BOOKING_CANCELLED_BY_CLIENT',
        bookingId: 'bk1',
      }),
    );
  });

  it('distingue la baja de una fecha de turno fijo', async () => {
    await notify({ recurringBookingId: 's1' }, true);

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'RECURRING_INSTANCE_CANCELLED_BY_CLIENT',
      }),
    );
  });

  it('le manda el correo al OWNER y al ADMIN, no al STAFF', async () => {
    buFindAll.mockResolvedValue([
      link(BusinessRole.OWNER, 'owner@x.com', 'Ana'),
      link(BusinessRole.ADMIN, 'admin@x.com', 'Beto'),
    ]);

    await notify();

    expect(sendBookingCancelledByClient).toHaveBeenCalledTimes(2);
    expect(sendBookingCancelledByClient.mock.calls.map((c) => c[0].to)).toEqual(
      ['owner@x.com', 'admin@x.com'],
    );

    // El STAFF queda afuera en el WHERE, no filtrando después: nunca sale de la DB.
    const { where } = buFindAll.mock.calls[0][0];
    const roleFilter = Object.getOwnPropertySymbols(where.role).map(
      (s) => where.role[s],
    );
    expect(roleFilter).toEqual([[BusinessRole.OWNER, BusinessRole.ADMIN]]);
  });

  it('no repite el correo si la misma persona tiene dos vínculos', async () => {
    buFindAll.mockResolvedValue([
      link(BusinessRole.OWNER, 'ana@x.com', 'Ana'),
      link(BusinessRole.ADMIN, 'ana@x.com', 'Ana'),
    ]);

    await notify();

    expect(sendBookingCancelledByClient).toHaveBeenCalledTimes(1);
  });

  it('usa el nombre de la cuenta cuando el que canceló tiene usuario', async () => {
    buFindAll.mockResolvedValue([link(BusinessRole.OWNER, 'o@x.com', 'Ana')]);

    await notify({ user: { name: 'Martín Gómez' } as never });

    expect(sendBookingCancelledByClient).toHaveBeenCalledWith(
      expect.objectContaining({ clientName: 'Martín Gómez' }),
    );
  });

  describe('markRead', () => {
    it('rechaza una notificación de otro complejo (BR-017)', async () => {
      findOne.mockResolvedValue(null);

      await expect(service.markRead('n1', BUSINESS_ID)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('no vuelve a escribir una ya leída', async () => {
      const notifUpdate = jest.fn();
      findOne.mockResolvedValue({ readAt: new Date(), update: notifUpdate });

      await service.markRead('n1', BUSINESS_ID);

      expect(notifUpdate).not.toHaveBeenCalled();
    });
  });
});
