import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  PLAN_REPOSITORY,
  SUBSCRIPTION_REPOSITORY,
} from '../database/constants/repositories.constants';
import { Plan } from './entities/plan.model';
import { Subscription } from '../subscriptions/entities/subscription.model';
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';
import { MercadoPagoService } from '../mercadopago/mercadopago.service';

@Injectable()
export class PlansService {
  constructor(
    @Inject(PLAN_REPOSITORY)
    private readonly planModel: typeof Plan,
    @Inject(SUBSCRIPTION_REPOSITORY)
    private readonly subscriptionModel: typeof Subscription,
    private readonly mercadoPagoService: MercadoPagoService,
  ) {}

  async findPublic(): Promise<Plan[]> {
    return this.planModel.findAll({
      where: { isArchived: false, isPubliclyVisible: true },
      order: [['sortOrder', 'ASC']],
    });
  }

  async findAllForMaster(): Promise<Array<Plan & { subscribersCount: number }>> {
    const plans = await this.planModel.findAll({ order: [['sortOrder', 'ASC']] });
    const counts = await this.subscriptionModel.findAll({
      attributes: ['planId'],
      where: { planId: plans.map((p) => p.id) },
      raw: true,
    });

    return plans.map((plan) => {
      const subscribersCount = counts.filter((c) => c.planId === plan.id).length;
      return Object.assign(plan.toJSON(), { subscribersCount }) as Plan & {
        subscribersCount: number;
      };
    });
  }

  async findByIdForMaster(id: string): Promise<Plan> {
    return this.findOne(id);
  }

  private async findOne(id: string): Promise<Plan> {
    const plan = await this.planModel.findByPk(id);
    if (!plan) {
      throw new NotFoundException('Plan not found');
    }
    return plan;
  }

  async create(dto: CreatePlanDto): Promise<Plan> {
    return this.planModel.create({ ...dto });
  }

  async update(id: string, dto: UpdatePlanDto): Promise<Plan> {
    const plan = await this.findOne(id);

    if (
      dto.priceArs !== undefined &&
      dto.priceArs !== plan.priceArs &&
      plan.mpPreapprovalPlanId
    ) {
      throw new BadRequestException(
        'No se puede cambiar el precio de un plan ya sincronizado con Mercado Pago. Archivalo y creá uno nuevo.',
      );
    }

    await plan.update(dto);
    return plan;
  }

  async archive(id: string): Promise<Plan> {
    const plan = await this.findOne(id);
    await plan.update({ isArchived: true, isPubliclyVisible: false });
    return plan;
  }

  async restore(id: string): Promise<Plan> {
    const plan = await this.findOne(id);
    await plan.update({ isArchived: false });
    return plan;
  }

  async syncWithMercadoPago(id: string): Promise<Plan> {
    const plan = await this.findOne(id);
    if (plan.mpPreapprovalPlanId) {
      return plan;
    }
    const mpPlan = await this.mercadoPagoService.createPreApprovalPlan(plan);
    await plan.update({ mpPreapprovalPlanId: mpPlan.id });
    return plan;
  }

  async remove(id: string): Promise<void> {
    const plan = await this.findOne(id);
    const subscribersCount = await this.subscriptionModel.count({
      where: { planId: id },
    });
    if (subscribersCount > 0) {
      throw new BadRequestException(
        `No se puede eliminar un plan con ${subscribersCount} suscriptor${subscribersCount === 1 ? '' : 'es'}. Archivalo en su lugar.`,
      );
    }
    await plan.destroy();
  }
}
