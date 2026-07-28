import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { MasterBillingService } from './master-billing.service';
import { ReactivateSuspendedDto } from './dto/reactivate-suspended.dto';
import { ListTransactionsQueryDto } from './dto/list-transactions-query.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MasterGuard } from '../../common/guards/master.guard';
import { AllowWhenReadOnly } from '../../common/decorators/allow-read-only.decorator';

@ApiTags('master')
// MasterGuard runs after the global read-only guard, which cannot see the role
// yet — the SaaS admin has to exempt itself here or it could not lift a suspension.
@AllowWhenReadOnly()
@Controller('master')
@UseGuards(JwtAuthGuard, MasterGuard)
@ApiBearerAuth()
export class MasterBillingController {
  constructor(private readonly masterBillingService: MasterBillingService) {}

  @Get('metrics/mrr')
  @ApiOperation({ summary: 'Monthly recurring revenue trend (MASTER only)' })
  @ApiResponse({ status: 200, description: 'MRR per month' })
  async getMrr(@Query('months') months?: string) {
    return this.masterBillingService.getMrr(months ? parseInt(months, 10) : 6);
  }

  @Get('transactions')
  @ApiOperation({ summary: 'Platform-wide payment transactions (MASTER only)' })
  @ApiResponse({
    status: 200,
    description: 'List of payments across all businesses',
  })
  async listTransactions(@Query() query: ListTransactionsQueryDto) {
    return this.masterBillingService.listTransactions(query);
  }

  @Post('businesses/:businessId/subscription/reactivate')
  @ApiOperation({
    summary: 'Manually reactivate a suspended account (MASTER only)',
  })
  @ApiResponse({ status: 200, description: 'Subscription reactivated' })
  async reactivateSuspended(
    @Param('businessId') businessId: string,
    @Body() dto: ReactivateSuspendedDto,
  ) {
    return this.masterBillingService.reactivateSuspended(
      businessId,
      dto.extendTrialDays,
    );
  }
}
