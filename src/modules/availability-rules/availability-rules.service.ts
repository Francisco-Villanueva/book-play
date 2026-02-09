import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Sequelize } from 'sequelize-typescript';
import {
  AVAILABILITY_RULE_REPOSITORY,
  COURT_AVAILABILITY_REPOSITORY,
  COURT_REPOSITORY,
} from '../database/constants/repositories.constants';
import { AvailabilityRule } from './entities/availability-rule.model';
import { CourtAvailability } from './entities/court-availability.model';
import { Court } from '../courts/entities/court.model';
import { CreateAvailabilityRuleDto } from './dto/create-availability-rule.dto';
import { UpdateAvailabilityRuleDto } from './dto/update-availability-rule.dto';

@Injectable()
export class AvailabilityRulesService {
  constructor(
    @Inject(AVAILABILITY_RULE_REPOSITORY)
    private readonly availabilityRuleModel: typeof AvailabilityRule,
    @Inject(COURT_AVAILABILITY_REPOSITORY)
    private readonly courtAvailabilityModel: typeof CourtAvailability,
    @Inject(COURT_REPOSITORY)
    private readonly courtModel: typeof Court,
    @Inject('SEQUELIZE')
    private readonly sequelize: Sequelize,
  ) {}

  async create(
    businessId: string,
    dto: CreateAvailabilityRuleDto,
  ): Promise<AvailabilityRule> {
    const { courtIds, ...ruleData } = dto;
    const transaction = await this.sequelize.transaction();

    try {
      const rule = await this.availabilityRuleModel.create(
        { ...ruleData, businessId },
        { transaction },
      );

      if (courtIds && courtIds.length > 0) {
        await this.validateCourts(courtIds, businessId);
        const courtAvailabilities = courtIds.map((courtId) => ({
          courtId,
          availabilityRuleId: rule.id,
        }));
        await this.courtAvailabilityModel.bulkCreate(courtAvailabilities, {
          transaction,
        });
      }

      await transaction.commit();

      return this.findOne(rule.id, businessId);
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async findAllByBusiness(businessId: string): Promise<AvailabilityRule[]> {
    return this.availabilityRuleModel.findAll({
      where: { businessId },
      include: [{ model: this.courtModel, as: 'courts' }],
    });
  }

  async findOne(id: string, businessId: string): Promise<AvailabilityRule> {
    const rule = await this.availabilityRuleModel.findOne({
      where: { id, businessId },
      include: [{ model: this.courtModel, as: 'courts' }],
    });

    if (!rule) {
      throw new NotFoundException('Availability rule not found');
    }

    return rule;
  }

  async update(
    id: string,
    businessId: string,
    dto: UpdateAvailabilityRuleDto,
  ): Promise<AvailabilityRule> {
    const { courtIds, ...ruleData } = dto;
    const transaction = await this.sequelize.transaction();

    try {
      const rule = await this.availabilityRuleModel.findOne({
        where: { id, businessId },
      });

      if (!rule) {
        throw new NotFoundException('Availability rule not found');
      }

      if (Object.keys(ruleData).length > 0) {
        await rule.update(ruleData, { transaction });
      }

      if (courtIds !== undefined) {
        if (courtIds.length > 0) {
          await this.validateCourts(courtIds, businessId);
        }
        await this.courtAvailabilityModel.destroy({
          where: { availabilityRuleId: id },
          transaction,
        });
        if (courtIds.length > 0) {
          const courtAvailabilities = courtIds.map((courtId) => ({
            courtId,
            availabilityRuleId: id,
          }));
          await this.courtAvailabilityModel.bulkCreate(courtAvailabilities, {
            transaction,
          });
        }
      }

      await transaction.commit();

      return this.findOne(id, businessId);
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async remove(id: string, businessId: string): Promise<void> {
    const rule = await this.availabilityRuleModel.findOne({
      where: { id, businessId },
    });

    if (!rule) {
      throw new NotFoundException('Availability rule not found');
    }

    const transaction = await this.sequelize.transaction();

    try {
      await this.courtAvailabilityModel.destroy({
        where: { availabilityRuleId: id },
        transaction,
      });
      await rule.destroy({ transaction });
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  private async validateCourts(
    courtIds: string[],
    businessId: string,
  ): Promise<void> {
    const courts = await this.courtModel.findAll({
      where: { id: courtIds, businessId },
    });

    if (courts.length !== courtIds.length) {
      throw new NotFoundException(
        'One or more courts not found in this business',
      );
    }
  }
}
