import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { COURT_REPOSITORY } from '../database/constants/repositories.constants';
import { Court } from './entities/court.model';
import { CreateCourtDto } from './dto/create-court.dto';
import { UpdateCourtDto } from './dto/update-court.dto';

@Injectable()
export class CourtsService {
  constructor(
    @Inject(COURT_REPOSITORY)
    private readonly courtModel: typeof Court,
  ) {}

  async create(businessId: string, dto: CreateCourtDto): Promise<Court> {
    return this.courtModel.create({ ...dto, businessId });
  }

  async findAllByBusiness(businessId: string): Promise<Court[]> {
    return this.courtModel.findAll({ where: { businessId } });
  }

  async findOne(id: string, businessId: string): Promise<Court> {
    const court = await this.courtModel.findOne({
      where: { id, businessId },
    });

    if (!court) {
      throw new NotFoundException('Court not found');
    }

    return court;
  }

  async update(
    id: string,
    businessId: string,
    dto: UpdateCourtDto,
  ): Promise<Court> {
    const court = await this.findOne(id, businessId);
    await court.update(dto);
    return court;
  }

  async remove(id: string, businessId: string): Promise<void> {
    const court = await this.findOne(id, businessId);
    await court.destroy();
  }
}
