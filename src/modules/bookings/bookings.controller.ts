import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../../common/guards/optional-jwt-auth.guard';
import { BusinessRolesGuard } from '../../common/guards/business-roles.guard';
import { BusinessRoles } from '../../common/decorators/business-roles.decorator';
import { BusinessRole } from '../../common/enums';

@Controller('businesses/:businessId/bookings')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Post()
  @UseGuards(OptionalJwtAuthGuard)
  async create(
    @Param('businessId') businessId: string,
    @Body() dto: CreateBookingDto,
    @Req() req: any,
  ) {
    const userId = req.user?.id;
    const booking = await this.bookingsService.create(businessId, dto, userId);
    return { booking };
  }

  @Get()
  @UseGuards(JwtAuthGuard, BusinessRolesGuard)
  @BusinessRoles(BusinessRole.OWNER, BusinessRole.ADMIN, BusinessRole.STAFF)
  async findAll(@Param('businessId') businessId: string) {
    const bookings = await this.bookingsService.findAllByBusiness(businessId);
    return { bookings };
  }

  @Get(':bookingId')
  @UseGuards(JwtAuthGuard, BusinessRolesGuard)
  @BusinessRoles(BusinessRole.OWNER, BusinessRole.ADMIN, BusinessRole.STAFF)
  async findOne(
    @Param('businessId') businessId: string,
    @Param('bookingId') bookingId: string,
  ) {
    const booking = await this.bookingsService.findOne(bookingId, businessId);
    return { booking };
  }

  @Patch(':bookingId/cancel')
  @UseGuards(JwtAuthGuard, BusinessRolesGuard)
  @BusinessRoles(BusinessRole.OWNER, BusinessRole.ADMIN, BusinessRole.STAFF)
  async cancel(
    @Param('businessId') businessId: string,
    @Param('bookingId') bookingId: string,
  ) {
    const booking = await this.bookingsService.cancel(bookingId, businessId);
    return { booking };
  }
}
