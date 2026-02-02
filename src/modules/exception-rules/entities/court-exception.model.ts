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
import { ExceptionRule } from './exception-rule.model';

@Table({
  tableName: 'court_exceptions',
  underscored: true,
  updatedAt: false,
  indexes: [{ unique: true, fields: ['court_id', 'exception_rule_id'] }],
})
export class CourtException extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  declare id: string;

  @ForeignKey(() => Court)
  @Column({ type: DataType.UUID, allowNull: false, field: 'court_id' })
  courtId: string;

  @ForeignKey(() => ExceptionRule)
  @Column({
    type: DataType.UUID,
    allowNull: false,
    field: 'exception_rule_id',
  })
  exceptionRuleId: string;
}
