import { Inject, Injectable, Logger } from '@nestjs/common';
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
    const mpPreapproval = await this.mercadoPagoService.getPreApproval(preapprovalId);
    const subscription = await this.subscriptionModel.findOne({
      where: { mpPreapprovalId: preapprovalId },
    });

    if (!subscription) {
      this.logger.warn(`No subscription found for preapproval ${preapprovalId}`);
      return;
    }

    if (mpPreapproval.status === 'authorized') {
      // The SDK's PreApprovalResponse type doesn't declare preapproval_plan_id,
      // but the real API includes it on plan-linked subscriptions.
      const mpPlanId = (mpPreapproval as unknown as { preapproval_plan_id?: string })
        .preapproval_plan_id;
      let planId = subscription.planId;
      if (mpPlanId) {
        const plan = await this.planModel.findOne({ where: { mpPreapprovalPlanId: mpPlanId } });
        if (plan) planId = plan.id;
      }

      await subscription.update({
        status: SubscriptionStatus.ACTIVE,
        planId,
        suspendedAt: null,
        pastDueAt: null,
        currentPeriodStart: subscription.currentPeriodStart ?? new Date(),
      });

      if (planId) {
        const plan = await this.planModel.findByPk(planId);
        if (plan) await this.featureActivationService.activateForPlan(subscription.businessId, plan);
      }
    } else if (mpPreapproval.status === 'paused') {
      await subscription.update({
        status: SubscriptionStatus.PAST_DUE,
        pastDueAt: subscription.pastDueAt ?? new Date(),
      });
    } else if (mpPreapproval.status === 'cancelled') {
      await subscription.update({
        status: SubscriptionStatus.CANCELLED,
        cancelledAt: subscription.cancelledAt ?? new Date(),
      });
      await this.featureActivationService.deactivatePlanFeatures(subscription.businessId);
    }
  }

  private async handleAuthorizedPayment(authorizedPaymentId: string): Promise<void> {
    const mpPayment = await this.mercadoPagoService.getAuthorizedPayment(authorizedPaymentId);
    if (!mpPayment.preapproval_id) {
      this.logger.warn(`Authorized payment ${authorizedPaymentId} has no preapproval_id`);
      return;
    }

    const subscription = await this.subscriptionModel.findOne({
      where: { mpPreapprovalId: mpPayment.preapproval_id },
    });
    if (!subscription) {
      this.logger.warn(`No subscription found for preapproval ${mpPayment.preapproval_id}`);
      return;
    }

    const status = MP_PAYMENT_STATUS_MAP[mpPayment.status ?? ''] ?? PaymentStatus.PENDING;

    await this.paymentModel.create({
      businessId: subscription.businessId,
      subscriptionId: subscription.id,
      planId: subscription.planId,
      mpPaymentId: mpPayment.id,
      amount: mpPayment.transaction_amount ?? 0,
      status,
      paidAt: mpPayment.date_created ? new Date(mpPayment.date_created) : new Date(),
      rawPayload: mpPayment as unknown as Record<string, unknown>,
    });

    if (status === PaymentStatus.APPROVED) {
      const mpPreapproval = await this.mercadoPagoService.getPreApproval(
        subscription.mpPreapprovalId as string,
      );
      await subscription.update({
        status: SubscriptionStatus.ACTIVE,
        pastDueAt: null,
        currentPeriodStart: new Date(),
        currentPeriodEnd: mpPreapproval.next_payment_date
          ? new Date(mpPreapproval.next_payment_date)
          : subscription.currentPeriodEnd,
      });
    }
  }
}
