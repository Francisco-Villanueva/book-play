import {
  Column,
  DataType,
  Default,
  ForeignKey,
  Model,
  PrimaryKey,
  Table,
} from 'sequelize-typescript';
import { FeatureEnabledBy } from '../../../common/enums';
import { Business } from '../../businesses/entities/business.model';

@Table({
  tableName: 'business_features',
  underscored: true,
  indexes: [{ unique: true, fields: ['business_id', 'feature_key'] }],
})
export class BusinessFeature extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  declare id: string;

  @ForeignKey(() => Business)
  @Column({ type: DataType.UUID, allowNull: false, field: 'business_id' })
  declare businessId: string;

  @Column({ type: DataType.STRING, allowNull: false, field: 'feature_key' })
  declare featureKey: string;

  @Default(true)
  @Column({ type: DataType.BOOLEAN, allowNull: false, field: 'is_enabled' })
  declare isEnabled: boolean;

  @Default(FeatureEnabledBy.PLAN)
  @Column({
    type: DataType.ENUM(...Object.values(FeatureEnabledBy)),
    allowNull: false,
    field: 'enabled_by',
  })
  declare enabledBy: FeatureEnabledBy;

  @Column({ type: DataType.DATE, allowNull: false, field: 'enabled_at' })
  declare enabledAt: Date;

  @Column({ type: DataType.DATE, field: 'disabled_at' })
  declare disabledAt: Date | null;

  @Column(DataType.TEXT)
  declare notes: string | null;

  declare business: Business;
}
