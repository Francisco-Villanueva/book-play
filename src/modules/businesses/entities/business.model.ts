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

  @Default(60)
  @Column({ type: DataType.INTEGER, allowNull: false, field: 'slot_duration' })
  declare slotDuration: number;

  declare businessUsers: BusinessUser[];
  declare courts: Court[];
  declare availabilityRules: AvailabilityRule[];
  declare exceptionRules: ExceptionRule[];
  declare bookings: Booking[];
}
