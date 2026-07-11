import { Inject, Injectable } from '@nestjs/common';
import { Transaction } from 'sequelize';
import { BUSINESS_FEATURE_REPOSITORY } from '../database/constants/repositories.constants';
import { BusinessFeature } from './entities/business-feature.model';
import { FeatureEnabledBy } from '../../common/enums';
import { Plan } from '../plans/entities/plan.model';

@Injectable()
export class FeatureActivationService {
  constructor(
    @Inject(BUSINESS_FEATURE_REPOSITORY)
    private readonly businessFeatureModel: typeof BusinessFeature,
  ) {}

  async activateFeatureKeys(
    businessId: string,
    featureKeys: string[],
    transaction?: Transaction,
  ): Promise<void> {
    const now = new Date();

    const existingPlanFeatures = await this.businessFeatureModel.findAll({
      where: { businessId, enabledBy: FeatureEnabledBy.PLAN },
      transaction,
    });

    for (const featureKey of featureKeys) {
      const existing = existingPlanFeatures.find((f) => f.featureKey === featureKey);
      if (existing) {
        await existing.update({ isEnabled: true, disabledAt: null }, { transaction });
      } else {
        await this.businessFeatureModel.create(
          {
            businessId,
            featureKey,
            isEnabled: true,
            enabledBy: FeatureEnabledBy.PLAN,
            enabledAt: now,
          },
          { transaction },
        );
      }
    }

    // Disable any PLAN-granted features not in the new set (e.g. downgrade)
    const toDisable = existingPlanFeatures.filter((f) => !featureKeys.includes(f.featureKey));
    for (const feature of toDisable) {
      await feature.update({ isEnabled: false, disabledAt: now }, { transaction });
    }
  }

  async activateForPlan(businessId: string, plan: Plan, transaction?: Transaction): Promise<void> {
    await this.activateFeatureKeys(businessId, plan.featureKeys, transaction);
  }

  async deactivatePlanFeatures(businessId: string, transaction?: Transaction): Promise<void> {
    await this.businessFeatureModel.update(
      { isEnabled: false, disabledAt: new Date() },
      { where: { businessId, enabledBy: FeatureEnabledBy.PLAN }, transaction },
    );
  }
}
