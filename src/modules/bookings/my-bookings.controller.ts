import { Controller, Get, Param, Patch, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { BookingsService } from './bookings.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('bookings')
@ApiBearerAuth()
@Controller('users/me/bookings')
@UseGuards(JwtAuthGuard)
export class MyBookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Get()
  @ApiOperation({ summary: "List the authenticated user's bookings across all businesses" })
  @ApiResponse({ status: 200, description: "List of the user's bookings" })
  async findMine(@Request() req: any) {
    return this.bookingsService.findAllByUser(req.user.id);
  }

  @Get(':bookingId')
  @ApiOperation({ summary: "Get one of the authenticated user's bookings by ID" })
  @ApiResponse({ status: 200, description: 'Booking details' })
  @ApiResponse({ status: 404, description: 'Booking not found' })
  async findOneMine(@Request() req: any, @Param('bookingId') bookingId: string) {
    return this.bookingsService.findOneForUser(bookingId, req.user.id);
  }

  @Patch(':bookingId/cancel')
  @ApiOperation({ summary: "Cancel one of the authenticated user's bookings" })
  @ApiResponse({ status: 200, description: 'Booking cancelled' })
  @ApiResponse({ status: 404, description: 'Booking not found' })
  async cancelMine(@Request() req: any, @Param('bookingId') bookingId: string) {
    return this.bookingsService.cancelForUser(bookingId, req.user.id);
  }
}
