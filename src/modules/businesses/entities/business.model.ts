import {
  Column,
  DataType,
  Default,
  HasMany,
  Model,
  PrimaryKey,
  Table,
} from 'sequelize-typescript';
import { User } from '../../users/entities/user.model';
import { Court } from '../../courts/entities/court.model';
import { AvailabilityRule } from '../../availability-rules/entities/availability-rule.model';
import { ExceptionRule } from '../../exception-rules/entities/exception-rule.model';

@Table({ tableName: 'businesses', underscored: true })
export class Business extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  declare id: string;

  @Column({ type: DataType.STRING, allowNull: false })
  name: string;

  @Column(DataType.TEXT)
  description: string;

  @Column(DataType.STRING)
  address: string;

  @Column(DataType.STRING)
  phone: string;

  @Column(DataType.STRING)
  email: string;

  @Default('America/Argentina/Buenos_Aires')
  @Column({ type: DataType.STRING, allowNull: false })
  timezone: string;

  @Default(60)
  @Column({ type: DataType.INTEGER, allowNull: false, field: 'slot_duration' })
  slotDuration: number;

  @HasMany(() => User)
  users: User[];

  @HasMany(() => Court)
  courts: Court[];

  @HasMany(() => AvailabilityRule)
  availabilityRules: AvailabilityRule[];

  @HasMany(() => ExceptionRule)
  exceptionRules: ExceptionRule[];
}
