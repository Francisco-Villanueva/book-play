import {
  BelongsTo,
  BelongsToMany,
  Column,
  DataType,
  Default,
  ForeignKey,
  HasMany,
  Model,
  PrimaryKey,
  Table,
} from 'sequelize-typescript';
import { Business } from '../../businesses/entities/business.model';
import { Booking } from '../../bookings/entities/booking.model';
import { AvailabilityRule } from '../../availability-rules/entities/availability-rule.model';
import { CourtAvailability } from '../../availability-rules/entities/court-availability.model';
import { ExceptionRule } from '../../exception-rules/entities/exception-rule.model';
import { CourtException } from '../../exception-rules/entities/court-exception.model';

@Table({ tableName: 'courts', underscored: true })
export class Court extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  declare id: string;

  @ForeignKey(() => Business)
  @Column({ type: DataType.UUID, allowNull: false, field: 'business_id' })
  businessId: string;

  @Column({ type: DataType.STRING, allowNull: false })
  name: string;

  @Column({ type: DataType.STRING, field: 'sport_type' })
  sportType: string;

  @Column(DataType.STRING)
  surface: string;

  @Column(DataType.INTEGER)
  capacity: number;

  @Default(false)
  @Column({ type: DataType.BOOLEAN, allowNull: false, field: 'is_indoor' })
  isIndoor: boolean;

  @Default(false)
  @Column({ type: DataType.BOOLEAN, allowNull: false, field: 'has_lighting' })
  hasLighting: boolean;

  @Column({ type: DataType.DECIMAL(10, 2), field: 'price_per_hour' })
  pricePerHour: number;

  @Column(DataType.TEXT)
  description: string;

  @BelongsTo(() => Business)
  business: Business;

  @HasMany(() => Booking)
  bookings: Booking[];

  @BelongsToMany(() => AvailabilityRule, () => CourtAvailability)
  availabilityRules: AvailabilityRule[];

  @BelongsToMany(() => ExceptionRule, () => CourtException)
  exceptionRules: ExceptionRule[];
}
