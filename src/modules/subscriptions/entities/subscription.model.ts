import {
  Column,
  DataType,
  Default,
  ForeignKey,
  Model,
  PrimaryKey,
  Table,
} from 'sequelize-typescript';
import { SubscriptionStatus } from '../../../common/enums';
import { Business } from '../../businesses/entities/business.model';
import { Plan } from '../../plans/entities/plan.model';

@Table({ tableName: 'subscriptions', underscored: true })
export class Subscription extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  declare id: string;

  @ForeignKey(() => Business)
  @Column({
    type: DataType.UUID,
    allowNull: false,
    unique: true,
    field: 'business_id',
  })
  declare businessId: string;

  @ForeignKey(() => Plan)
  @Column({ type: DataType.UUID, field: 'plan_id' })
  declare planId: string | null;

  @Default(SubscriptionStatus.TRIALING)
  @Column({
    type: DataType.ENUM(...Object.values(SubscriptionStatus)),
    allowNull: false,
  })
  declare status: SubscriptionStatus;

  @Column({ type: DataType.DATE, allowNull: false, field: 'trial_started_at' })
  declare trialStartedAt: Date;

  @Column({ type: DataType.DATE, allowNull: false, field: 'trial_ends_at' })
  declare trialEndsAt: Date;

  @Column({ type: DataType.DATE, field: 'current_period_start' })
  declare currentPeriodStart: Date | null;

  @Column({ type: DataType.DATE, field: 'current_period_end' })
  declare currentPeriodEnd: Date | null;

  @Column({ type: DataType.DATE, field: 'past_due_at' })
  declare pastDueAt: Date | null;

  @Column({ type: DataType.DATE, field: 'suspended_at' })
  declare suspendedAt: Date | null;

  @Column({ type: DataType.DATE, field: 'cancelled_at' })
  declare cancelledAt: Date | null;

  declare business: Business;
  declare plan: Plan | null;
}
