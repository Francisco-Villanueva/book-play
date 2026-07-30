import { Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BusinessRolesGuard } from '../../common/guards/business-roles.guard';
import { BusinessRoles } from '../../common/decorators/business-roles.decorator';
import { AllowWhenReadOnly } from '../../common/decorators/allow-read-only.decorator';
import { BusinessRole } from '../../common/enums';

// Todo el equipo las ve, incluido STAFF: la notificación es operativa (se liberó
// un turno), no administrativa. Sigue disponible en solo lectura — un complejo
// vencido tiene que poder enterarse igual de que le cancelaron.
@ApiTags('notifications')
@ApiBearerAuth()
@Controller('businesses/:businessId/notifications')
@UseGuards(JwtAuthGuard, BusinessRolesGuard)
@BusinessRoles(BusinessRole.OWNER, BusinessRole.ADMIN, BusinessRole.STAFF)
@AllowWhenReadOnly()
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'Notificaciones del complejo + no leídas' })
  @ApiResponse({ status: 200, description: 'Listado y contador' })
  async findAll(@Param('businessId') businessId: string) {
    return this.notificationsService.findAllByBusiness(businessId);
  }

  @Patch('read-all')
  @ApiOperation({ summary: 'Marcar todas como leídas' })
  async markAllRead(@Param('businessId') businessId: string) {
    return this.notificationsService.markAllRead(businessId);
  }

  @Patch(':notificationId/read')
  @ApiOperation({ summary: 'Marcar una notificación como leída' })
  @ApiResponse({ status: 404, description: 'No existe' })
  async markRead(
    @Param('businessId') businessId: string,
    @Param('notificationId') notificationId: string,
  ) {
    return this.notificationsService.markRead(notificationId, businessId);
  }
}
