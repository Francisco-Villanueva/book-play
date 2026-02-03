import {
  Column,
  DataType,
  Default,
  ForeignKey,
  Model,
  PrimaryKey,
  Table,
} from 'sequelize-typescript';
import { Court } from '../../courts/entities/court.model';
import { AvailabilityRule } from './availability-rule.model';

@Table({
  tableName: 'court_availability',
  underscored: true,
  updatedAt: false,
  indexes: [
    { unique: true, fields: ['court_id', 'availability_rule_id'] },
    { fields: ['court_id'] },
  ],
})
export class CourtAvailability extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  declare id: string;

  @ForeignKey(() => Court)
  @Column({ type: DataType.UUID, allowNull: false, field: 'court_id' })
  declare courtId: string;

  @ForeignKey(() => AvailabilityRule)
  @Column({
    type: DataType.UUID,
    allowNull: false,
    field: 'availability_rule_id',
  })
  declare availabilityRuleId: string;
}
