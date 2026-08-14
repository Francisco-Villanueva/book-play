import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BUSINESS_REPOSITORY,
  COURT_REPOSITORY,
} from '../database/constants/repositories.constants';
import { Court } from './entities/court.model';
import { Business } from '../businesses/entities/business.model';
import { Booking } from '../bookings/entities/booking.model';
import { BookingStatus, normalizeSport } from '../../common/enums';
import { CreateCourtDto } from './dto/create-court.dto';
import { UpdateCourtDto } from './dto/update-court.dto';

@Injectable()
export class CourtsService {
  constructor(
    @Inject(COURT_REPOSITORY)
    private readonly courtModel: typeof Court,
    @Inject(BUSINESS_REPOSITORY)
    private readonly businessModel: typeof Business,
  ) {}

  async create(businessId: string, dto: CreateCourtDto): Promise<Court> {
    const business = await this.businessModel.findByPk(businessId);
    if (!business) {
      throw new NotFoundException('Business not found');
    }

    return this.courtModel.create({
      ...dto,
      businessId,
      // Se guarda normalizado para que el filtro por deporte de la búsqueda
      // pública pueda comparar por igualdad. El label lo arma el front.
      sportType: normalizeSport(dto.sportType),
      slotDuration: dto.slotDuration ?? business.defaultSlotDuration,
      pricePerSlot: dto.pricePerSlot ?? business.defaultPricePerSlot,
    });
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
    await court.update({
      ...dto,
      ...(dto.sportType !== undefined
        ? { sportType: normalizeSport(dto.sportType) }
        : {}),
    });
    return court;
  }

  async remove(id: string, businessId: string): Promise<void> {
    const court = await this.findOne(id, businessId);

    const activeBookings = await Booking.count({
      where: { courtId: id, status: BookingStatus.ACTIVE },
    });

    if (activeBookings > 0) {
      throw new BadRequestException(
        `Cannot delete court with ${activeBookings} active booking${activeBookings === 1 ? '' : 's'} (EC-013)`,
      );
    }

    await court.destroy();
  }
}
