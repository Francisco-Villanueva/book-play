import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  SUBSCRIPTION_REPOSITORY,
  PLAN_REPOSITORY,
  PAYMENT_REPOSITORY,
} from '../database/constants/repositories.constants';
import { Subscription } from './entities/subscription.model';
import { Plan } from '../plans/entities/plan.model';
import { Payment } from './entities/payment.model';
import { MercadoPagoService } from '../mercadopago/mercadopago.service';

@Injectable()
export class SubscriptionsService {
  constructor(
    @Inject(SUBSCRIPTION_REPOSITORY)
    private readonly subscriptionModel: typeof Subscription,
    @Inject(PLAN_REPOSITORY)
    private readonly planModel: typeof Plan,
    @Inject(PAYMENT_REPOSITORY)
    private readonly paymentModel: typeof Payment,
    private readonly mercadoPagoService: MercadoPagoService,
  ) {}

  async findByBusiness(businessId: string): Promise<Subscription> {
    const subscription = await this.subscriptionModel.findOne({
      where: { businessId },
      include: [{ model: Plan, as: 'plan' }],
    });
    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }
    return subscription;
  }

  async listPayments(businessId: string): Promise<Payment[]> {
    return this.paymentModel.findAll({
      where: { businessId },
      order: [['paidAt', 'DESC']],
    });
  }

  async createCheckout(
    businessId: string,
    planId: string,
    payerEmail: string,
  ): Promise<{ checkoutUrl: string }> {
    const [subscription, plan] = await Promise.all([
      this.findByBusiness(businessId),
      this.planModel.findByPk(planId),
    ]);

    if (!plan || plan.isArchived) {
      throw new NotFoundException('Plan not found');
    }

    let mpPreapprovalPlanId = plan.mpPreapprovalPlanId;
    if (!mpPreapprovalPlanId) {
      const mpPlan = await this.mercadoPagoService.createPreApprovalPlan(plan);
      mpPreapprovalPlanId = mpPlan.id ?? null;
      await plan.update({ mpPreapprovalPlanId });
    }

    const preapproval = await this.mercadoPagoService.createPreApproval({
      preapprovalPlanId: mpPreapprovalPlanId as string,
      payerEmail,
      externalReference: subscription.id,
      backUrl: this.mercadoPagoService.buildBackUrl(`/admin/${businessId}/upgrade/confirm`),
    });

    if (!preapproval.init_point) {
      throw new BadRequestException('Mercado Pago no devolvió una URL de checkout');
    }

    await subscription.update({
      mpPreapprovalId: preapproval.id,
      mpPayerEmail: payerEmail,
    });

    return { checkoutUrl: preapproval.init_point };
  }

  async cancel(businessId: string): Promise<Subscription> {
    const subscription = await this.findByBusiness(businessId);

    if (subscription.mpPreapprovalId) {
      // MP's `cancelled` status is terminal (cannot be un-cancelled) — cancelling
      // here stops future charges immediately, but the business keeps access
      // (status stays as-is) until currentPeriodEnd, enforced by trial-expiry.cron.
      await this.mercadoPagoService.cancelPreApproval(subscription.mpPreapprovalId);
    }

    await subscription.update({ cancelledAt: new Date() });
    return subscription;
  }

  async reactivate(businessId: string): Promise<{ checkoutUrl: string }> {
    const subscription = await this.findByBusiness(businessId);

    if (!subscription.cancelledAt) {
      throw new BadRequestException('La suscripción no está cancelada');
    }
    if (subscription.currentPeriodEnd && subscription.currentPeriodEnd <= new Date()) {
      throw new BadRequestException('El período pago ya venció, iniciá un nuevo checkout');
    }
    if (!subscription.planId || !subscription.mpPayerEmail) {
      throw new BadRequestException('No hay datos suficientes para reactivar automáticamente');
    }

    const plan = await this.planModel.findByPk(subscription.planId);
    if (!plan?.mpPreapprovalPlanId) {
      throw new NotFoundException('Plan not found');
    }

    // MP's `cancelled` status is terminal — resuming billing means authorizing
    // a brand new preapproval (another redirect), not reviving the old one.
    const preapproval = await this.mercadoPagoService.createPreApproval({
      preapprovalPlanId: plan.mpPreapprovalPlanId,
      payerEmail: subscription.mpPayerEmail,
      externalReference: subscription.id,
      backUrl: this.mercadoPagoService.buildBackUrl(`/admin/${businessId}/upgrade/confirm`),
    });

    if (!preapproval.init_point) {
      throw new BadRequestException('Mercado Pago no devolvió una URL de checkout');
    }

    await subscription.update({
      mpPreapprovalId: preapproval.id,
      cancelledAt: null,
    });
    return { checkoutUrl: preapproval.init_point };
  }
}
