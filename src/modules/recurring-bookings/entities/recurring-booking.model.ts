import {
  Column,
  DataType,
  Default,
  ForeignKey,
  Model,
  PrimaryKey,
  Table,
} from 'sequelize-typescript';
import { RecurringBookingStatus } from '../../../common/enums';
import { Court } from '../../courts/entities/court.model';
import { Business } from '../../businesses/entities/business.model';
import { User } from '../../users/entities/user.model';

// Turno fijo: la regla que describe "todos los martes a las 20:00 en la cancha 2".
// No bloquea disponibilidad por sí misma — lo que la bloquea son las Bookings que
// genera (BR-028). Una serie cubre un solo día de la semana.
@Table({
  tableName: 'recurring_bookings',
  underscored: true,
  indexes: [
    { fields: ['business_id', 'status'] },
    { fields: ['court_id'] },
    { fields: ['status', 'generated_until'] },
  ],
})
export class RecurringBooking extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  declare id: string;

  @ForeignKey(() => Business)
  @Column({ type: DataType.UUID, allowNull: false, field: 'business_id' })
  declare businessId: string;

  @ForeignKey(() => Court)
  @Column({ type: DataType.UUID, allowNull: false, field: 'court_id' })
  declare courtId: string;

  // Hoy el alta es solo del panel y el cliente casi nunca tiene cuenta, pero un
  // turno fijo de un jugador registrado tiene que poder verse en "Mis reservas".
  @ForeignKey(() => User)
  @Column({ type: DataType.UUID, field: 'user_id' })
  declare userId: string | null;

  @Column({ type: DataType.STRING, field: 'guest_name' })
  declare guestName: string | null;

  @Column({ type: DataType.STRING, field: 'guest_phone' })
  declare guestPhone: string | null;

  @Column({ type: DataType.STRING, field: 'guest_email' })
  declare guestEmail: string | null;

  // 0 = domingo, igual que Date.getDay() y que AvailabilityRule.dayOfWeek.
  @Column({ type: DataType.INTEGER, allowNull: false, field: 'day_of_week' })
  declare dayOfWeek: number;

  @Column({ type: DataType.TIME, allowNull: false, field: 'start_time' })
  declare startTime: string;

  @Column({ type: DataType.DATEONLY, allowNull: false, field: 'start_date' })
  declare startDate: string;

  // null = sin fin. La serie vive hasta que el complejo la termina; el cron
  // mantiene siempre una ventana de instancias generadas hacia adelante.
  @Column({ type: DataType.DATEONLY, field: 'end_date' })
  declare endDate: string | null;

  // Hasta qué fecha ya se materializaron instancias. Es lo que hace idempotente
  // al cron: sin esto habría que re-chequear toda la serie en cada corrida.
  @Column({ type: DataType.DATEONLY, allowNull: false, field: 'generated_until' })
  declare generatedUntil: string;

  @Default(RecurringBookingStatus.ACTIVE)
  @Column({
    type: DataType.ENUM(...Object.values(RecurringBookingStatus)),
    allowNull: false,
  })
  declare status: RecurringBookingStatus;

  @Column(DataType.TEXT)
  declare notes: string | null;

  @Column({ type: DataType.UUID, field: 'created_by' })
  declare createdBy: string | null;

  // Igual que en Booking: se guarda el hash SHA-256 y el token plano viaja sólo
  // en el correo. Habilita al cliente sin cuenta a dar de baja una fecha suelta
  // de su turno fijo (nunca la serie entera — eso lo decide el complejo).
  @Column({ type: DataType.STRING, field: 'cancellation_token_hash' })
  declare cancellationTokenHash: string | null;

  @Column({ type: DataType.DATE, field: 'ended_at' })
  declare endedAt: Date | null;

  declare court: Court;
  declare business: Business;
  declare user: User;
}
