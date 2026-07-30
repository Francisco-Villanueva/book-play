import {
  Column,
  DataType,
  Default,
  Model,
  PrimaryKey,
  Table,
} from 'sequelize-typescript';
import { BusinessUser } from '../../business-users/entities/business-user.model';
import { Court } from '../../courts/entities/court.model';
import { AvailabilityRule } from '../../availability-rules/entities/availability-rule.model';
import { ExceptionRule } from '../../exception-rules/entities/exception-rule.model';
import { Booking } from '../../bookings/entities/booking.model';
import { Subscription } from '../../subscriptions/entities/subscription.model';
import { BusinessFeature } from '../../subscriptions/entities/business-feature.model';
import { Payment } from '../../subscriptions/entities/payment.model';

@Table({ tableName: 'businesses', underscored: true })
export class Business extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  declare id: string;

  @Column({ type: DataType.STRING, allowNull: false })
  declare name: string;

  @Column(DataType.TEXT)
  declare description: string;

  @Column(DataType.STRING)
  declare address: string;

  @Column(DataType.STRING)
  declare phone: string;

  @Column(DataType.STRING)
  declare email: string;

  @Default('America/Argentina/Buenos_Aires')
  @Column({ type: DataType.STRING, allowNull: false })
  declare timezone: string;

  // Templates for new courts only — the operative values live on each Court.
  // The DB column keeps its original name to avoid a data-losing rename under
  // sequelize.sync({ alter: true }), which has no migration/backfill step.
  @Default(60)
  @Column({ type: DataType.INTEGER, allowNull: false, field: 'slot_duration' })
  declare defaultSlotDuration: number;

  @Column({ type: DataType.DECIMAL(10, 2), field: 'default_price_per_slot' })
  declare defaultPricePerSlot: number;

  // Antelación mínima con la que el CLIENTE puede cancelar (BR-019). 0 = sin
  // restricción. El staff del complejo nunca queda limitado por esto: la cancha
  // es suya y tiene que poder liberarla en cualquier momento.
  @Default(24)
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    field: 'cancellation_deadline_hours',
  })
  declare cancellationDeadlineHours: number;

  declare businessUsers: BusinessUser[];
  declare courts: Court[];
  declare availabilityRules: AvailabilityRule[];
  declare exceptionRules: ExceptionRule[];
  declare bookings: Booking[];
  declare subscription: Subscription;
  declare features: BusinessFeature[];
  declare payments: Payment[];
}
