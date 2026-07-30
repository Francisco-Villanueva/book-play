import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { RecurringBookingsService } from './recurring-bookings.service';
import { CreateRecurringBookingDto } from './dto/create-recurring-booking.dto';
import { PreviewRecurringBookingDto } from './dto/preview-recurring-booking.dto';
import { EndRecurringBookingDto } from './dto/end-recurring-booking.dto';
import { ResendGuestLinkDto } from './dto/resend-guest-link.dto';
import {
  CancelSeriesInstanceDto,
  GuestSeriesQueryDto,
} from './dto/guest-series.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BusinessRolesGuard } from '../../common/guards/business-roles.guard';
import { BusinessRoles } from '../../common/decorators/business-roles.decorator';
import { AllowWhenReadOnly } from '../../common/decorators/allow-read-only.decorator';
import { BusinessRole } from '../../common/enums';

@ApiTags('recurring-bookings')
@Controller('businesses/:businessId/recurring-bookings')
export class RecurringBookingsController {
  constructor(private readonly service: RecurringBookingsService) {}

  // Dry-run: sin esto el encargado confirma a ciegas y se entera de los choques
  // cuando ya creó la serie.
  @Post('preview')
  @UseGuards(JwtAuthGuard, BusinessRolesGuard)
  @BusinessRoles(BusinessRole.OWNER, BusinessRole.ADMIN, BusinessRole.STAFF)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Previsualizar las fechas de un turno fijo, sin crear nada',
  })
  @ApiResponse({ status: 200, description: 'Fechas con su disponibilidad' })
  async preview(
    @Param('businessId') businessId: string,
    @Body() dto: PreviewRecurringBookingDto,
  ) {
    return this.service.preview(businessId, dto);
  }

  @Post()
  @UseGuards(JwtAuthGuard, BusinessRolesGuard)
  @BusinessRoles(BusinessRole.OWNER, BusinessRole.ADMIN, BusinessRole.STAFF)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Crear un turno fijo y generar sus instancias' })
  @ApiResponse({ status: 201, description: 'Turno fijo creado' })
  @ApiResponse({ status: 400, description: 'Datos incompletos o fecha pasada' })
  async create(
    @Param('businessId') businessId: string,
    @Body() dto: CreateRecurringBookingDto,
    @Req() req: { user: { id: string } },
  ) {
    const { series, report } = await this.service.create(
      businessId,
      dto,
      req.user.id,
    );
    return { series, report };
  }

  @Get()
  @UseGuards(JwtAuthGuard, BusinessRolesGuard)
  @BusinessRoles(BusinessRole.OWNER, BusinessRole.ADMIN, BusinessRole.STAFF)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Listar los turnos fijos del complejo' })
  async findAll(@Param('businessId') businessId: string) {
    return this.service.findAllByBusiness(businessId);
  }

  @Get(':seriesId')
  @UseGuards(JwtAuthGuard, BusinessRolesGuard)
  @BusinessRoles(BusinessRole.OWNER, BusinessRole.ADMIN, BusinessRole.STAFF)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Detalle de un turno fijo' })
  @ApiResponse({ status: 404, description: 'Turno fijo inexistente' })
  async findOne(
    @Param('businessId') businessId: string,
    @Param('seriesId') seriesId: string,
  ) {
    return this.service.findOne(seriesId, businessId);
  }

  @Get(':seriesId/instances')
  @UseGuards(JwtAuthGuard, BusinessRolesGuard)
  @BusinessRoles(BusinessRole.OWNER, BusinessRole.ADMIN, BusinessRole.STAFF)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Próximas fechas generadas del turno fijo' })
  async findInstances(
    @Param('businessId') businessId: string,
    @Param('seriesId') seriesId: string,
  ) {
    return this.service.findInstances(seriesId, businessId);
  }

  @Patch(':seriesId/resend-link')
  @UseGuards(JwtAuthGuard, BusinessRolesGuard)
  @BusinessRoles(BusinessRole.OWNER, BusinessRole.ADMIN, BusinessRole.STAFF)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Reenviar al cliente el link para ver y gestionar sus fechas',
  })
  @ApiResponse({ status: 200, description: 'Link reenviado' })
  @ApiResponse({ status: 400, description: 'El turno fijo no tiene correo' })
  async resendLink(
    @Param('businessId') businessId: string,
    @Param('seriesId') seriesId: string,
    @Body() dto: ResendGuestLinkDto,
  ) {
    return this.service.resendGuestLink(seriesId, businessId, dto.email);
  }

  // Igual que cancelar una reserva: sigue disponible en solo lectura para que un
  // complejo vencido pueda liberar turnos que no va a honrar.
  @Patch(':seriesId/end')
  @AllowWhenReadOnly()
  @UseGuards(JwtAuthGuard, BusinessRolesGuard)
  @BusinessRoles(BusinessRole.OWNER, BusinessRole.ADMIN, BusinessRole.STAFF)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Terminar un turno fijo y cancelar sus fechas futuras',
  })
  async end(
    @Param('businessId') businessId: string,
    @Param('seriesId') seriesId: string,
    @Body() dto: EndRecurringBookingDto,
  ) {
    return this.service.end(seriesId, businessId, dto);
  }

  // --- Público, validado por el token del correo (sin sesión) ---

  @Get(':seriesId/guest')
  @ApiOperation({
    summary: 'Ver las fechas del turno fijo desde el link del correo',
  })
  @ApiResponse({ status: 404, description: 'Turno fijo o token inválido' })
  async findForGuest(
    @Param('businessId') businessId: string,
    @Param('seriesId') seriesId: string,
    @Query() query: GuestSeriesQueryDto,
  ) {
    return this.service.findForGuest(seriesId, businessId, query.token);
  }

  @Patch(':seriesId/guest/cancel-instance')
  @AllowWhenReadOnly()
  @ApiOperation({
    summary: 'Dar de baja una fecha puntual del turno fijo (nunca la serie)',
  })
  @ApiResponse({ status: 404, description: 'Turno fijo o token inválido' })
  async cancelInstance(
    @Param('businessId') businessId: string,
    @Param('seriesId') seriesId: string,
    @Body() dto: CancelSeriesInstanceDto,
  ) {
    return this.service.cancelInstanceByGuestToken(
      seriesId,
      businessId,
      dto.token,
      dto.bookingId,
    );
  }
}
