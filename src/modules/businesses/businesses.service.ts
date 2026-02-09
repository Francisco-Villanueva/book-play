import { Inject, Injectable } from '@nestjs/common';
import { Sequelize } from 'sequelize-typescript';
import { Business } from './entities/business.model';
import { BusinessUser } from '../business-users/entities/business-user.model';
import {
  BUSINESS_REPOSITORY,
  BUSINESS_USER_REPOSITORY,
} from '../database/constants/repositories.constants';
import { BusinessRole } from '../../common/enums';
import { CreateBusinessDto } from './dto/create-business.dto';

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
    return this.businessModel.findAll();
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
}
