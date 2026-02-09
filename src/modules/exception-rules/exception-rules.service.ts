import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Sequelize } from 'sequelize-typescript';
import {
  EXCEPTION_RULE_REPOSITORY,
  COURT_EXCEPTION_REPOSITORY,
  COURT_REPOSITORY,
} from '../database/constants/repositories.constants';
import { ExceptionRule } from './entities/exception-rule.model';
import { CourtException } from './entities/court-exception.model';
import { Court } from '../courts/entities/court.model';
import { CreateExceptionRuleDto } from './dto/create-exception-rule.dto';
import { UpdateExceptionRuleDto } from './dto/update-exception-rule.dto';

@Injectable()
export class ExceptionRulesService {
  constructor(
    @Inject(EXCEPTION_RULE_REPOSITORY)
    private readonly exceptionRuleModel: typeof ExceptionRule,
    @Inject(COURT_EXCEPTION_REPOSITORY)
    private readonly courtExceptionModel: typeof CourtException,
    @Inject(COURT_REPOSITORY)
    private readonly courtModel: typeof Court,
    @Inject('SEQUELIZE')
    private readonly sequelize: Sequelize,
  ) {}

  async create(
    businessId: string,
    dto: CreateExceptionRuleDto,
  ): Promise<ExceptionRule> {
    const { courtIds, ...ruleData } = dto;
    const transaction = await this.sequelize.transaction();

    try {
      const rule = await this.exceptionRuleModel.create(
        { ...ruleData, businessId },
        { transaction },
      );

      if (courtIds && courtIds.length > 0) {
        await this.validateCourts(courtIds, businessId);
        const courtExceptions = courtIds.map((courtId) => ({
          courtId,
          exceptionRuleId: rule.id,
        }));
        await this.courtExceptionModel.bulkCreate(courtExceptions, {
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

  async findAllByBusiness(businessId: string): Promise<ExceptionRule[]> {
    return this.exceptionRuleModel.findAll({
      where: { businessId },
      include: [{ model: this.courtModel, as: 'courts' }],
    });
  }

  async findOne(id: string, businessId: string): Promise<ExceptionRule> {
    const rule = await this.exceptionRuleModel.findOne({
      where: { id, businessId },
      include: [{ model: this.courtModel, as: 'courts' }],
    });

    if (!rule) {
      throw new NotFoundException('Exception rule not found');
    }

    return rule;
  }

  async update(
    id: string,
    businessId: string,
    dto: UpdateExceptionRuleDto,
  ): Promise<ExceptionRule> {
    const { courtIds, ...ruleData } = dto;
    const transaction = await this.sequelize.transaction();

    try {
      const rule = await this.exceptionRuleModel.findOne({
        where: { id, businessId },
      });

      if (!rule) {
        throw new NotFoundException('Exception rule not found');
      }

      if (Object.keys(ruleData).length > 0) {
        await rule.update(ruleData, { transaction });
      }

      if (courtIds !== undefined) {
        if (courtIds.length > 0) {
          await this.validateCourts(courtIds, businessId);
        }
        await this.courtExceptionModel.destroy({
          where: { exceptionRuleId: id },
          transaction,
        });
        if (courtIds.length > 0) {
          const courtExceptions = courtIds.map((courtId) => ({
            courtId,
            exceptionRuleId: id,
          }));
          await this.courtExceptionModel.bulkCreate(courtExceptions, {
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
    const rule = await this.exceptionRuleModel.findOne({
      where: { id, businessId },
    });

    if (!rule) {
      throw new NotFoundException('Exception rule not found');
    }

    const transaction = await this.sequelize.transaction();

    try {
      await this.courtExceptionModel.destroy({
        where: { exceptionRuleId: id },
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
