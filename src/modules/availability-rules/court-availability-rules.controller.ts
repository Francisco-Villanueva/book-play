import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AvailabilityRulesService } from './availability-rules.service';
import { AssignAvailabilityRuleDto } from './dto/assign-availability-rule.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BusinessRolesGuard } from '../../common/guards/business-roles.guard';
import { BusinessRoles } from '../../common/decorators/business-roles.decorator';
import { BusinessRole } from '../../common/enums';

@ApiTags('courts')
@ApiBearerAuth()
@Controller('businesses/:businessId/courts/:courtId/availability-rules')
@UseGuards(JwtAuthGuard, BusinessRolesGuard)
export class CourtAvailabilityRulesController {
  constructor(
    private readonly availabilityRulesService: AvailabilityRulesService,
  ) {}

  @Get()
  @BusinessRoles(BusinessRole.OWNER, BusinessRole.ADMIN, BusinessRole.STAFF)
  @ApiOperation({ summary: 'List availability rules assigned to a court' })
  @ApiResponse({ status: 200, description: 'List of availability rules' })
  @ApiResponse({ status: 404, description: 'Court not found' })
  async findAll(
    @Param('businessId') businessId: string,
    @Param('courtId') courtId: string,
  ) {
    const rules = await this.availabilityRulesService.findAllByCourt(
      courtId,
      businessId,
    );
    return rules.map((r) => ({
      id: r.id,
      name: r.name,
      dayOfWeek: r.dayOfWeek,
      startTime: r.startTime,
      endTime: r.endTime,
      isActive: r.isActive,
    }));
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @BusinessRoles(BusinessRole.OWNER, BusinessRole.ADMIN)
  @ApiOperation({ summary: 'Assign an availability rule to a court' })
  @ApiResponse({ status: 201, description: 'Rule assigned to court' })
  @ApiResponse({ status: 404, description: 'Court or rule not found' })
  @ApiResponse({ status: 409, description: 'Rule already assigned to this court' })
  async assign(
    @Param('businessId') businessId: string,
    @Param('courtId') courtId: string,
    @Body() dto: AssignAvailabilityRuleDto,
  ) {
    const rule = await this.availabilityRulesService.assignRuleToCourt(
      courtId,
      dto.ruleId,
      businessId,
    );
    return {
      id: rule.id,
      name: rule.name,
      dayOfWeek: rule.dayOfWeek,
      startTime: rule.startTime,
      endTime: rule.endTime,
      isActive: rule.isActive,
    };
  }
}
