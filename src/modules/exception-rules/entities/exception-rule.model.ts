import {
  BelongsTo,
  BelongsToMany,
  Column,
  DataType,
  Default,
  ForeignKey,
  Model,
  PrimaryKey,
  Table,
} from 'sequelize-typescript';
import { Business } from '../../businesses/entities/business.model';
import { Court } from '../../courts/entities/court.model';
import { CourtException } from './court-exception.model';

@Table({
  tableName: 'exception_rules',
  underscored: true,
  indexes: [{ fields: ['business_id', 'date'] }],
})
export class ExceptionRule extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  declare id: string;

  @ForeignKey(() => Business)
  @Column({ type: DataType.UUID, allowNull: false, field: 'business_id' })
  businessId: string;

  @Column({ type: DataType.DATEONLY, allowNull: false })
  date: string;

  @Column({ type: DataType.TIME, field: 'start_time' })
  startTime: string;

  @Column({ type: DataType.TIME, field: 'end_time' })
  endTime: string;

  @Default(false)
  @Column({ type: DataType.BOOLEAN, allowNull: false, field: 'is_available' })
  isAvailable: boolean;

  @Column(DataType.STRING)
  reason: string;

  @BelongsTo(() => Business)
  business: Business;

  @BelongsToMany(() => Court, () => CourtException)
  courts: Court[];
}
