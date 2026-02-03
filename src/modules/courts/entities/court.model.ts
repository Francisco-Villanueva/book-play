import {
  Column,
  DataType,
  Default,
  ForeignKey,
  Model,
  PrimaryKey,
  Table,
} from 'sequelize-typescript';
import { Business } from '../../businesses/entities/business.model';
import { Booking } from '../../bookings/entities/booking.model';
import { AvailabilityRule } from '../../availability-rules/entities/availability-rule.model';
import { ExceptionRule } from '../../exception-rules/entities/exception-rule.model';

@Table({ tableName: 'courts', underscored: true })
export class Court extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  declare id: string;

  @ForeignKey(() => Business)
  @Column({ type: DataType.UUID, allowNull: false, field: 'business_id' })
  declare businessId: string;

  @Column({ type: DataType.STRING, allowNull: false })
  declare name: string;

  @Column({ type: DataType.STRING, field: 'sport_type' })
  declare sportType: string;

  @Column(DataType.STRING)
  declare surface: string;

  @Column(DataType.INTEGER)
  declare capacity: number;

  @Default(false)
  @Column({ type: DataType.BOOLEAN, allowNull: false, field: 'is_indoor' })
  declare isIndoor: boolean;

  @Default(false)
  @Column({ type: DataType.BOOLEAN, allowNull: false, field: 'has_lighting' })
  declare hasLighting: boolean;

  @Column({ type: DataType.DECIMAL(10, 2), field: 'price_per_hour' })
  declare pricePerHour: number;

  @Column(DataType.TEXT)
  declare description: string;

  declare business: Business;
  declare bookings: Booking[];
  declare availabilityRules: AvailabilityRule[];
  declare exceptionRules: ExceptionRule[];
}
