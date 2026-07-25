import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BOOKING_REPOSITORY } from '../database/constants/repositories.constants';
import { Booking } from './entities/booking.model';
import { Court } from '../courts/entities/court.model';
import { BookingPaymentStatus } from '../../common/enums';
import { UpdateBookingPaymentDto } from './dto/update-booking-payment.dto';

// Registro del cobro presencial de un turno (BR-025). Vive aparte de
// BookingsService porque no comparte nada con el cálculo de disponibilidad.
@Injectable()
export class BookingPaymentsService {
  constructor(
    @Inject(BOOKING_REPOSITORY)
    private readonly bookingModel: typeof Booking,
  ) {}

  async updatePayment(
    bookingId: string,
    businessId: string,
    dto: UpdateBookingPaymentDto,
    recordedBy: string,
  ): Promise<Booking> {
    const booking = await this.bookingModel.findOne({
      where: { id: bookingId, businessId },
      include: [{ model: Court, as: 'court' }],
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    if (dto.playersPaid > dto.totalPlayers) {
      throw new BadRequestException('playersPaid cannot exceed totalPlayers');
    }

    await booking.update({
      paymentStatus: this.deriveStatus(dto.playersPaid, dto.totalPlayers),
      totalPlayers: dto.totalPlayers,
      playersPaid: dto.playersPaid,
      amountPaid: this.resolveAmount(dto, booking),
      paymentNotes: dto.paymentNotes?.trim() || null,
      paymentRecordedBy: recordedBy,
      paymentRecordedAt: new Date(),
    });

    return booking;
  }

  private deriveStatus(
    playersPaid: number,
    totalPlayers: number,
  ): BookingPaymentStatus {
    if (playersPaid === 0) return BookingPaymentStatus.UNPAID;
    if (playersPaid >= totalPlayers) return BookingPaymentStatus.PAID;
    return BookingPaymentStatus.PARTIAL;
  }

  // Sin monto explícito se prorratea el precio de lista entre los jugadores, que
  // es como se cobra en la cancha. El caso "pagaron todos" se resuelve aparte
  // para que el total cierre exacto y no arrastre el redondeo del prorrateo.
  private resolveAmount(
    dto: UpdateBookingPaymentDto,
    booking: Booking,
  ): number | null {
    if (dto.amountPaid != null) return dto.amountPaid;
    if (booking.totalPrice == null) return null;

    const totalPrice = Number(booking.totalPrice);
    if (dto.playersPaid === 0) return 0;
    if (dto.playersPaid >= dto.totalPlayers) return totalPrice;

    return (
      Math.round(((totalPrice * dto.playersPaid) / dto.totalPlayers) * 100) /
      100
    );
  }
}
