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
import { Court } from '../../courts/entities/court.model';

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
  declare businessId: string;

  @Column({ type: DataType.DATEONLY, allowNull: false })
  declare date: string;

  @Column({ type: DataType.TIME, field: 'start_time' })
  declare startTime: string;

  @Column({ type: DataType.TIME, field: 'end_time' })
  declare endTime: string;

  @Default(false)
  @Column({ type: DataType.BOOLEAN, allowNull: false, field: 'is_available' })
  declare isAvailable: boolean;

  @Column(DataType.STRING)
  declare reason: string;

  declare business: Business;
  declare courts: Court[];
}
