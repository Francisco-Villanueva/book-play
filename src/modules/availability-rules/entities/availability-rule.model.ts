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
  tableName: 'availability_rules',
  underscored: true,
  indexes: [{ fields: ['business_id'] }],
})
export class AvailabilityRule extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  declare id: string;

  @ForeignKey(() => Business)
  @Column({ type: DataType.UUID, allowNull: false, field: 'business_id' })
  declare businessId: string;

  @Column({ type: DataType.STRING, allowNull: false })
  declare name: string;

  @Column({ type: DataType.INTEGER, allowNull: false, field: 'day_of_week' })
  declare dayOfWeek: number;

  @Column({ type: DataType.TIME, allowNull: false, field: 'start_time' })
  declare startTime: string;

  @Column({ type: DataType.TIME, allowNull: false, field: 'end_time' })
  declare endTime: string;

  @Default(true)
  @Column({ type: DataType.BOOLEAN, allowNull: false, field: 'is_active' })
  declare isActive: boolean;

  declare business: Business;
  declare courts: Court[];
}
