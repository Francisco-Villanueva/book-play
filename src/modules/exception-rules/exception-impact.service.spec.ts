import { Test, TestingModule } from '@nestjs/testing';
import { ExceptionImpactService } from './exception-impact.service';
import {
  BOOKING_REPOSITORY,
  BUSINESS_REPOSITORY,
  COURT_REPOSITORY,
} from '../database/constants/repositories.constants';
import { MailService } from '../mail/mail.service';
import { Booking } from '../bookings/entities/booking.model';

const BUSINESS_ID = 'b1';

function makeBooking(over: Partial<Booking> = {}) {
  return {
    id: 'bk1',
    startTime: '20:00:00',
    endTime: '21:30:00',
    date: '2026-08-04',
    guestName: 'Juan',
    guestEmail: 'juan@example.com',
    recurringBookingId: null,
    court: { name: 'Cancha 1' },
    user: null,
    ...over,
  } as unknown as Booking;
}

describe('ExceptionImpactService', () => {
  let service: ExceptionImpactService;
  let findAll: jest.Mock;
  let update: jest.Mock;
  let sendBookingSuspended: jest.Mock;

  beforeEach(async () => {
    findAll = jest.fn().mockResolvedValue([]);
    update = jest.fn().mockResolvedValue([0]);
    sendBookingSuspended = jest.fn().mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExceptionImpactService,
        { provide: BOOKING_REPOSITORY, useValue: { findAll, update } },
        { provide: COURT_REPOSITORY, useValue: {} },
        {
          provide: BUSINESS_REPOSITORY,
          useValue: {
            findByPk: jest.fn().mockResolvedValue({ name: 'Padel House' }),
          },
        },
        { provide: MailService, useValue: { sendBookingSuspended } },
      ],
    }).compile();

    service = module.get(ExceptionImpactService);
  });

  describe('cierre (isAvailable: false)', () => {
    it('alcanza todas las reservas del día cuando no hay franja', async () => {
      findAll.mockResolvedValue([
        makeBooking({ id: 'a', startTime: '09:00:00', endTime: '10:00:00' }),
        makeBooking({ id: 'b', startTime: '22:00:00', endTime: '23:00:00' }),
      ]);

      const affected = await service.findAffected(BUSINESS_ID, {
        date: '2026-08-04',
        isAvailable: false,
      });

      expect(affected.map((a) => a.id)).toEqual(['a', 'b']);
    });

    it('sólo alcanza las que se solapan con la franja bloqueada', async () => {
      findAll.mockResolvedValue([
        makeBooking({
          id: 'antes',
          startTime: '17:00:00',
          endTime: '18:00:00',
        }),
        makeBooking({
          id: 'dentro',
          startTime: '20:00:00',
          endTime: '21:30:00',
        }),
        makeBooking({
          id: 'despues',
          startTime: '23:00:00',
          endTime: '23:59:00',
        }),
      ]);

      const affected = await service.findAffected(BUSINESS_ID, {
        date: '2026-08-04',
        startTime: '19:00',
        endTime: '22:00',
        isAvailable: false,
      });

      expect(affected.map((a) => a.id)).toEqual(['dentro']);
    });

    it('no cuenta una reserva que termina justo cuando empieza el bloqueo', async () => {
      findAll.mockResolvedValue([
        makeBooking({
          id: 'pegada',
          startTime: '18:00:00',
          endTime: '19:00:00',
        }),
      ]);

      const affected = await service.findAffected(BUSINESS_ID, {
        date: '2026-08-04',
        startTime: '19:00',
        endTime: '22:00',
        isAvailable: false,
      });

      expect(affected).toHaveLength(0);
    });
  });

  describe('apertura especial (isAvailable: true)', () => {
    // Una excepción habilitante deja SÓLO esa franja disponible: lo que queda
    // afuera ya no es horario válido, así que también se cae.
    it('alcanza las reservas que quedan fuera de la ventana habilitada', async () => {
      findAll.mockResolvedValue([
        makeBooking({
          id: 'dentro',
          startTime: '10:00:00',
          endTime: '11:00:00',
        }),
        makeBooking({
          id: 'fuera',
          startTime: '08:00:00',
          endTime: '09:00:00',
        }),
      ]);

      const affected = await service.findAffected(BUSINESS_ID, {
        date: '2026-08-04',
        startTime: '09:00',
        endTime: '14:00',
        isAvailable: true,
      });

      expect(affected.map((a) => a.id)).toEqual(['fuera']);
    });
  });

  it('marca las instancias de turno fijo para que el correo lo aclare', async () => {
    findAll.mockResolvedValue([makeBooking({ recurringBookingId: 's1' })]);

    const affected = await service.findAffected(BUSINESS_ID, {
      date: '2026-08-04',
      isAvailable: false,
    });

    expect(affected[0].isRecurring).toBe(true);
  });

  describe('cancelAffected', () => {
    it('no escribe ni notifica si no hay reservas alcanzadas', async () => {
      const cancelled = await service.cancelAffected(BUSINESS_ID, {
        date: '2026-08-04',
        isAvailable: false,
      });

      expect(cancelled).toBe(0);
      expect(update).not.toHaveBeenCalled();
      expect(sendBookingSuspended).not.toHaveBeenCalled();
    });

    it('cancela las alcanzadas y avisa con el motivo del bloqueo', async () => {
      findAll.mockResolvedValue([makeBooking()]);
      update.mockResolvedValue([1]);

      const cancelled = await service.cancelAffected(
        BUSINESS_ID,
        { date: '2026-08-04', isAvailable: false },
        'Torneo interno',
      );

      expect(cancelled).toBe(1);
      expect(update).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'CANCELLED' }),
        expect.anything(),
      );
      await new Promise(process.nextTick);
      expect(sendBookingSuspended).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'juan@example.com',
          reason: 'Torneo interno',
          courtName: 'Cancha 1',
        }),
      );
    });
  });
});
