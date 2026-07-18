import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  BUSINESS_REPOSITORY,
  BUSINESS_USER_REPOSITORY,
  USER_REPOSITORY,
} from '../database/constants/repositories.constants';
import { Business } from '../businesses/entities/business.model';
import { BusinessUser } from '../business-users/entities/business-user.model';
import { User } from '../users/entities/user.model';
import { Court } from '../courts/entities/court.model';

@Injectable()
export class MasterService {
  constructor(
    @Inject(BUSINESS_REPOSITORY)
    private readonly businessModel: typeof Business,
    @Inject(BUSINESS_USER_REPOSITORY)
    private readonly businessUserModel: typeof BusinessUser,
    @Inject(USER_REPOSITORY)
    private readonly userModel: typeof User,
  ) {}

  async findAllBusinesses(): Promise<object[]> {
    const businesses = await this.businessModel.findAll({
      include: [
        { model: Court, as: 'courts', attributes: ['id'] },
        { model: BusinessUser, as: 'businessUsers', attributes: ['id'] },
      ],
      order: [['createdAt', 'DESC']],
    });

    return businesses.map((b) => {
      const raw = b.toJSON();
      return {
        id: raw.id,
        name: raw.name,
        address: raw.address ?? null,
        phone: raw.phone ?? null,
        email: raw.email ?? null,
        timezone: raw.timezone,
        slotDuration: raw.slotDuration,
        courtsCount: (raw.courts as unknown[]).length,
        membersCount: (raw.businessUsers as unknown[]).length,
        createdAt: raw.createdAt,
      };
    });
  }

  async findBusinessById(businessId: string): Promise<object> {
    const business = await this.businessModel.findByPk(businessId, {
      include: [
        {
          model: Court,
          as: 'courts',
          attributes: [
            'id',
            'name',
            'sportType',
            'surface',
            'isIndoor',
            'hasLighting',
            'pricePerHour',
          ],
        },
        {
          model: BusinessUser,
          as: 'businessUsers',
          include: [
            {
              model: User,
              as: 'user',
              attributes: ['id', 'name', 'email'],
            },
          ],
        },
      ],
    });

    if (!business) throw new NotFoundException('Business not found');

    const raw = business.toJSON();

    return {
      id: raw.id,
      name: raw.name,
      description: raw.description ?? null,
      address: raw.address ?? null,
      phone: raw.phone ?? null,
      email: raw.email ?? null,
      timezone: raw.timezone,
      slotDuration: raw.slotDuration,
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt,
      courts: (raw.courts as any[]).map((c) => ({
        id: c.id,
        name: c.name,
        sportType: c.sportType ?? null,
        surface: c.surface ?? null,
        isIndoor: c.isIndoor,
        hasLighting: c.hasLighting,
        pricePerHour: c.pricePerHour ?? null,
      })),
      members: (raw.businessUsers as any[]).map((bu) => ({
        id: bu.user?.id ?? null,
        name: bu.user?.name ?? null,
        email: bu.user?.email ?? null,
        role: bu.role,
      })),
    };
  }

  async findAllUsers(): Promise<object[]> {
    const users = await this.userModel.findAll({
      include: [
        {
          model: BusinessUser,
          as: 'businessUsers',
          attributes: ['id', 'role'],
          include: [
            {
              model: Business,
              as: 'business',
              attributes: ['id', 'name'],
            },
          ],
        },
      ],
      order: [['createdAt', 'DESC']],
    });

    return users.map((u) => {
      const raw = u.toJSON();
      return {
        id: raw.id,
        name: raw.name,
        email: raw.email,
        phone: raw.phone ?? null,
        globalRole: raw.globalRole,
        createdAt: raw.createdAt,
        businessesCount: (raw.businessUsers as unknown[]).length,
        businesses: (raw.businessUsers as any[]).map((bu) => ({
          id: bu.business?.id ?? null,
          name: bu.business?.name ?? null,
          role: bu.role,
        })),
      };
    });
  }
}
