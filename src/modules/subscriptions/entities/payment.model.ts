import {
  Column,
  DataType,
  Default,
  ForeignKey,
  Model,
  PrimaryKey,
  Table,
} from 'sequelize-typescript';
import { PaymentStatus } from '../../../common/enums';
import { Business } from '../../businesses/entities/business.model';
import { Subscription } from './subscription.model';
import { Plan } from '../../plans/entities/plan.model';

@Table({ tableName: 'payments', underscored: true })
export class Payment extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  declare id: string;

  @ForeignKey(() => Business)
  @Column({ type: DataType.UUID, allowNull: false, field: 'business_id' })
  declare businessId: string;

  @ForeignKey(() => Subscription)
  @Column({ type: DataType.UUID, allowNull: false, field: 'subscription_id' })
  declare subscriptionId: string;

  @ForeignKey(() => Plan)
  @Column({ type: DataType.UUID, field: 'plan_id' })
  declare planId: string | null;

  @Column({ type: DataType.STRING, field: 'mp_payment_id' })
  declare mpPaymentId: string | null;

  @Column({ type: DataType.INTEGER, allowNull: false })
  declare amount: number;

  @Column({
    type: DataType.ENUM(...Object.values(PaymentStatus)),
    allowNull: false,
  })
  declare status: PaymentStatus;

  @Column({ type: DataType.DATE, field: 'paid_at' })
  declare paidAt: Date | null;

  @Column({ type: DataType.JSONB, field: 'raw_payload' })
  declare rawPayload: Record<string, unknown> | null;

  declare business: Business;
  declare subscription: Subscription;
  declare plan: Plan | null;
}
