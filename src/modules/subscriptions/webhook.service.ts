import { Inject, Injectable, Logger } from '@nestjs/common';
import { Sequelize } from 'sequelize-typescript';
import { UniqueConstraintError } from 'sequelize';
import type { PreApprovalResponse } from 'mercadopago/dist/clients/preApproval/commonTypes';
import {
  SUBSCRIPTION_REPOSITORY,
  PLAN_REPOSITORY,
  PAYMENT_REPOSITORY,
} from '../database/constants/repositories.constants';
import { Subscription } from './entities/subscription.model';
import { Plan } from '../plans/entities/plan.model';
import { Payment } from './entities/payment.model';
import { PaymentStatus, SubscriptionStatus } from '../../common/enums';
import { MercadoPagoService } from '../mercadopago/mercadopago.service';
import { FeatureActivationService } from './feature-activation.service';

const MP_PAYMENT_STATUS_MAP: Record<string, PaymentStatus> = {
  approved: PaymentStatus.APPROVED,
  accredited: PaymentStatus.APPROVED,
  pending: PaymentStatus.PENDING,
  in_process: PaymentStatus.PENDING,
  rejected: PaymentStatus.REJECTED,
  refunded: PaymentStatus.REFUNDED,
};

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(
    @Inject(SUBSCRIPTION_REPOSITORY)
    private readonly subscriptionModel: typeof Subscription,
    @Inject(PLAN_REPOSITORY)
    private readonly planModel: typeof Plan,
    @Inject(PAYMENT_REPOSITORY)
    private readonly paymentModel: typeof Payment,
    @Inject('SEQUELIZE')
    private readonly sequelize: Sequelize,
    private readonly mercadoPagoService: MercadoPagoService,
    private readonly featureActivationService: FeatureActivationService,
  ) {}

  async process(params: { type: string; dataId: string }): Promise<void> {
    if (params.type === 'subscription_preapproval') {
      await this.handlePreapprovalUpdate(params.dataId);
    } else if (params.type === 'subscription_authorized_payment') {
      await this.handleAuthorizedPayment(params.dataId);
    }
  }

  private async handlePreapprovalUpdate(preapprovalId: string): Promise<void> {
    const mpPreapproval =
      await this.mercadoPagoService.getPreApproval(preapprovalId);

    // Row-locked so a manual MASTER reactivation (master-billing.service.reactivateSuspended)
    // racing against this webhook can't silently overwrite each other's write.
    await this.sequelize.transaction(async (transaction) => {
      const subscription = await this.subscriptionModel.findOne({
        where: { mpPreapprovalId: preapprovalId },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (!subscription) {
        this.logger.warn(
          `No subscription found for preapproval ${preapprovalId}`,
        );
        return;
      }

      if (mpPreapproval.status === 'authorized') {
        // The SDK's PreApprovalResponse type doesn't declare preapproval_plan_id,
        // but the real API includes it on plan-linked subscriptions.
        const mpPlanId = (
          mpPreapproval as unknown as { preapproval_plan_id?: string }
        ).preapproval_plan_id;
        let planId = subscription.planId;
        if (mpPlanId) {
          const plan = await this.planModel.findOne({
            where: { mpPreapprovalPlanId: mpPlanId },
            transaction,
          });
          if (plan) planId = plan.id;
        }

        await subscription.update(
          {
            status: SubscriptionStatus.ACTIVE,
            planId,
            suspendedAt: null,
            pastDueAt: null,
            currentPeriodStart: subscription.currentPeriodStart ?? new Date(),
          },
          { transaction },
        );

        if (planId) {
          const plan = await this.planModel.findByPk(planId, { transaction });
          if (plan) {
            await this.featureActivationService.activateForPlan(
              subscription.businessId,
              plan,
              transaction,
            );
          }
        }
      } else if (mpPreapproval.status === 'paused') {
        await subscription.update(
          {
            status: SubscriptionStatus.PAST_DUE,
            pastDueAt: subscription.pastDueAt ?? new Date(),
          },
          { transaction },
        );
      } else if (mpPreapproval.status === 'cancelled') {
        // MP cancelling the preapproval only stops future charges — access is kept
        // until currentPeriodEnd, same as a manual cancel() (subscriptions.service.ts).
        // trial-expiry.cron finalizes status -> CANCELLED and deactivates features
        // once currentPeriodEnd passes, so we must NOT do either of those here.
        await subscription.update(
          { cancelledAt: subscription.cancelledAt ?? new Date() },
          { transaction },
        );
      }
    });
  }

  private async handleAuthorizedPayment(
    authorizedPaymentId: string,
  ): Promise<void> {
    const mpPayment =
      await this.mercadoPagoService.getAuthorizedPayment(authorizedPaymentId);
    if (!mpPayment.preapproval_id) {
      this.logger.warn(
        `Authorized payment ${authorizedPaymentId} has no preapproval_id`,
      );
      return;
    }

    const subscription = await this.subscriptionModel.findOne({
      where: { mpPreapprovalId: mpPayment.preapproval_id },
    });
    if (!subscription) {
      this.logger.warn(
        `No subscription found for preapproval ${mpPayment.preapproval_id}`,
      );
      return;
    }

    const existingPayment = await this.paymentModel.findOne({
      where: { mpPaymentId: mpPayment.id },
    });
    if (existingPayment) {
      this.logger.log(
        `Payment ${mpPayment.id} already recorded, ignoring duplicate webhook`,
      );
      return;
    }

    const status =
      MP_PAYMENT_STATUS_MAP[mpPayment.status ?? ''] ?? PaymentStatus.PENDING;

    let mpPreapproval: PreApprovalResponse | undefined;
    if (status === PaymentStatus.APPROVED) {
      mpPreapproval = await this.mercadoPagoService.getPreApproval(
        subscription.mpPreapprovalId as string,
      );
    }

    try {
      await this.sequelize.transaction(async (transaction) => {
        await this.paymentModel.create(
          {
            businessId: subscription.businessId,
            subscriptionId: subscription.id,
            planId: subscription.planId,
            mpPaymentId: mpPayment.id,
            amount: mpPayment.transaction_amount ?? 0,
            status,
            paidAt: mpPayment.date_created
              ? new Date(mpPayment.date_created)
              : new Date(),
            rawPayload: mpPayment as unknown as Record<string, unknown>,
          },
          { transaction },
        );

        if (status === PaymentStatus.APPROVED && mpPreapproval) {
          await subscription.update(
            {
              status: SubscriptionStatus.ACTIVE,
              pastDueAt: null,
              currentPeriodStart: new Date(),
              currentPeriodEnd: mpPreapproval.next_payment_date
                ? new Date(mpPreapproval.next_payment_date)
                : subscription.currentPeriodEnd,
            },
            { transaction },
          );
        }
      });
    } catch (error) {
      // A concurrent duplicate delivery can still race past the findOne check above —
      // the unique index on mp_payment_id is the actual idempotency guarantee.
      if (error instanceof UniqueConstraintError) {
        this.logger.log(
          `Payment ${mpPayment.id} already recorded (race), ignoring duplicate webhook`,
        );
        return;
      }
      throw error;
    }
  }
}
