import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { SubscriptionsService } from './subscriptions.service';
import { CreateCheckoutDto } from './dto/create-checkout.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BusinessRolesGuard } from '../../common/guards/business-roles.guard';
import { BusinessRoles } from '../../common/decorators/business-roles.decorator';
import { BusinessRole } from '../../common/enums';

@ApiTags('subscriptions')
@Controller('businesses/:businessId/subscription')
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Get()
  @UseGuards(JwtAuthGuard, BusinessRolesGuard)
  @BusinessRoles(BusinessRole.OWNER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get the current subscription for a business' })
  @ApiResponse({ status: 200, description: 'Subscription with plan' })
  async findOne(@Param('businessId') businessId: string) {
    return this.subscriptionsService.findByBusiness(businessId);
  }

  @Get('payments')
  @UseGuards(JwtAuthGuard, BusinessRolesGuard)
  @BusinessRoles(BusinessRole.OWNER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List payment history for a business' })
  @ApiResponse({ status: 200, description: 'List of payments' })
  async listPayments(@Param('businessId') businessId: string) {
    return this.subscriptionsService.listPayments(businessId);
  }

  @Post('checkout')
  @UseGuards(JwtAuthGuard, BusinessRolesGuard)
  @BusinessRoles(BusinessRole.OWNER)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Create a Mercado Pago checkout session for a paid plan',
  })
  @ApiResponse({ status: 200, description: 'Checkout URL' })
  async createCheckout(
    @Param('businessId') businessId: string,
    @Body() dto: CreateCheckoutDto,
    @Request() req: any,
  ) {
    return this.subscriptionsService.createCheckout(
      businessId,
      dto.planId,
      req.user.email,
    );
  }

  @Post('cancel')
  @UseGuards(JwtAuthGuard, BusinessRolesGuard)
  @BusinessRoles(BusinessRole.OWNER)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Cancel the subscription (access kept until period end)',
  })
  @ApiResponse({ status: 200, description: 'Subscription cancelled' })
  async cancel(@Param('businessId') businessId: string) {
    return this.subscriptionsService.cancel(businessId);
  }

  @Post('reactivate')
  @UseGuards(JwtAuthGuard, BusinessRolesGuard)
  @BusinessRoles(BusinessRole.OWNER)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Undo a pending cancellation before period end',
  })
  @ApiResponse({
    status: 200,
    description: 'Subscription with the cancellation cleared',
  })
  async reactivate(@Param('businessId') businessId: string) {
    return this.subscriptionsService.reactivate(businessId);
  }
}
