import {
  Column,
  DataType,
  Default,
  Model,
  PrimaryKey,
  Table,
} from 'sequelize-typescript';

@Table({ tableName: 'plans', underscored: true })
export class Plan extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  declare id: string;

  @Column({ type: DataType.STRING, allowNull: false })
  declare name: string;

  @Column({ type: DataType.STRING, allowNull: false, unique: true })
  declare code: string;

  @Column(DataType.TEXT)
  declare description: string;

  @Default(0)
  @Column({ type: DataType.INTEGER, allowNull: false, field: 'price_ars' })
  declare priceArs: number;

  @Column({ type: DataType.INTEGER, field: 'courts_limit' })
  declare courtsLimit: number | null;

  @Column({ type: DataType.INTEGER, field: 'staff_limit' })
  declare staffLimit: number | null;

  @Default([])
  @Column({ type: DataType.JSONB, allowNull: false, field: 'feature_keys' })
  declare featureKeys: string[];

  @Default(true)
  @Column({ type: DataType.BOOLEAN, allowNull: false, field: 'is_publicly_visible' })
  declare isPubliclyVisible: boolean;

  @Default(false)
  @Column({ type: DataType.BOOLEAN, allowNull: false, field: 'is_archived' })
  declare isArchived: boolean;

  @Default(0)
  @Column({ type: DataType.INTEGER, allowNull: false, field: 'sort_order' })
  declare sortOrder: number;

  @Column({ type: DataType.STRING, field: 'mp_preapproval_plan_id' })
  declare mpPreapprovalPlanId: string | null;
}
