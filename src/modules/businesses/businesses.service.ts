import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Op } from 'sequelize';
import { Sequelize } from 'sequelize-typescript';
import { Business } from './entities/business.model';
import { BusinessUser } from '../business-users/entities/business-user.model';
import { Court } from '../courts/entities/court.model';
import { Booking } from '../bookings/entities/booking.model';
import { AvailabilityRule } from '../availability-rules/entities/availability-rule.model';
import { CourtAvailability } from '../availability-rules/entities/court-availability.model';
import { ExceptionRule } from '../exception-rules/entities/exception-rule.model';
import { CourtException } from '../exception-rules/entities/court-exception.model';
import {
  BUSINESS_REPOSITORY,
  BUSINESS_USER_REPOSITORY,
} from '../database/constants/repositories.constants';
import { BusinessRole } from '../../common/enums';
import { CreateBusinessDto } from './dto/create-business.dto';
import { UpdateBusinessDto } from './dto/update-business.dto';

@Injectable()
export class BusinessesService {
  constructor(
    @Inject(BUSINESS_REPOSITORY)
    private readonly businessModel: typeof Business,
    @Inject(BUSINESS_USER_REPOSITORY)
    private readonly businessUserModel: typeof BusinessUser,
    @Inject('SEQUELIZE')
    private readonly sequelize: Sequelize,
  ) {}

  async findAllBusinesses(userId: string): Promise<Business[]> {
    return this.businessModel.findAll({
      include: [
        {
          model: BusinessUser,
          as: 'businessUsers',
          where: { userId },
        },
      ],
    });
  }

  async findBusinessById(businessId: string): Promise<Business | null> {
    return await this.businessModel.findByPk(businessId);
  }

  async createBusiness(
    dto: CreateBusinessDto,
    userId: string,
  ): Promise<Business> {
    const transaction = await this.sequelize.transaction();

    try {
      const business = await this.businessModel.create(
        { ...dto },
        { transaction },
      );

      await this.businessUserModel.create(
        {
          businessId: business.id,
          userId,
          role: BusinessRole.OWNER,
        },
        { transaction },
      );

      await transaction.commit();
      return business;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async updateBusiness(
    businessId: string,
    dto: UpdateBusinessDto,
  ): Promise<Business> {
    if (Object.keys(dto).length === 0) {
      throw new BadRequestException('At least one field is required for update');
    }

    const business = await this.businessModel.findByPk(businessId);
    if (!business) throw new NotFoundException('Business not found');

    await business.update(dto);
    return business;
  }

  async deleteBusiness(businessId: string): Promise<void> {
    const business = await this.businessModel.findByPk(businessId);
    if (!business) throw new NotFoundException('Business not found');

    const transaction = await this.sequelize.transaction();

    try {
      // Collect court IDs to clean up junction tables before deleting courts
      const courts = await Court.findAll({
        where: { businessId },
        attributes: ['id'],
        transaction,
      });
      const courtIds = courts.map((c) => c.id);

      if (courtIds.length > 0) {
        await Booking.destroy({
          where: { courtId: { [Op.in]: courtIds } },
          transaction,
        });
        await CourtAvailability.destroy({
          where: { courtId: { [Op.in]: courtIds } },
          transaction,
        });
        await CourtException.destroy({
          where: { courtId: { [Op.in]: courtIds } },
          transaction,
        });
        await Court.destroy({ where: { businessId }, transaction });
      }

      await AvailabilityRule.destroy({ where: { businessId }, transaction });
      await ExceptionRule.destroy({ where: { businessId }, transaction });
      await this.businessUserModel.destroy({ where: { businessId }, transaction });
      await business.destroy({ transaction });

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
}
