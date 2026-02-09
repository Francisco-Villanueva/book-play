import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { AvailabilityRulesService } from './availability-rules.service';
import { CreateAvailabilityRuleDto } from './dto/create-availability-rule.dto';
import { UpdateAvailabilityRuleDto } from './dto/update-availability-rule.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BusinessRolesGuard } from '../../common/guards/business-roles.guard';
import { BusinessRoles } from '../../common/decorators/business-roles.decorator';
import { BusinessRole } from '../../common/enums';

@Controller('businesses/:businessId/availability-rules')
@UseGuards(JwtAuthGuard, BusinessRolesGuard)
export class AvailabilityRulesController {
  constructor(
    private readonly availabilityRulesService: AvailabilityRulesService,
  ) {}

  @Post()
  @BusinessRoles(BusinessRole.OWNER, BusinessRole.ADMIN)
  async create(
    @Param('businessId') businessId: string,
    @Body() dto: CreateAvailabilityRuleDto,
  ) {
    const rule = await this.availabilityRulesService.create(businessId, dto);
    return {
      availabilityRule: {
        id: rule.id,
        name: rule.name,
        dayOfWeek: rule.dayOfWeek,
        startTime: rule.startTime,
        endTime: rule.endTime,
        isActive: rule.isActive,
        courts: rule.courts?.map((c) => ({ id: c.id, name: c.name })),
      },
    };
  }

  @Get()
  @BusinessRoles(BusinessRole.OWNER, BusinessRole.ADMIN, BusinessRole.STAFF)
  async findAll(@Param('businessId') businessId: string) {
    const rules =
      await this.availabilityRulesService.findAllByBusiness(businessId);
    return {
      availabilityRules: rules.map((rule) => ({
        id: rule.id,
        name: rule.name,
        dayOfWeek: rule.dayOfWeek,
        startTime: rule.startTime,
        endTime: rule.endTime,
        isActive: rule.isActive,
        courts: rule.courts?.map((c) => ({ id: c.id, name: c.name })),
      })),
    };
  }

  @Get(':ruleId')
  @BusinessRoles(BusinessRole.OWNER, BusinessRole.ADMIN, BusinessRole.STAFF)
  async findOne(
    @Param('businessId') businessId: string,
    @Param('ruleId') ruleId: string,
  ) {
    const rule = await this.availabilityRulesService.findOne(
      ruleId,
      businessId,
    );
    return {
      availabilityRule: {
        id: rule.id,
        name: rule.name,
        dayOfWeek: rule.dayOfWeek,
        startTime: rule.startTime,
        endTime: rule.endTime,
        isActive: rule.isActive,
        courts: rule.courts?.map((c) => ({ id: c.id, name: c.name })),
      },
    };
  }

  @Put(':ruleId')
  @BusinessRoles(BusinessRole.OWNER, BusinessRole.ADMIN)
  async update(
    @Param('businessId') businessId: string,
    @Param('ruleId') ruleId: string,
    @Body() dto: UpdateAvailabilityRuleDto,
  ) {
    const rule = await this.availabilityRulesService.update(
      ruleId,
      businessId,
      dto,
    );
    return {
      availabilityRule: {
        id: rule.id,
        name: rule.name,
        dayOfWeek: rule.dayOfWeek,
        startTime: rule.startTime,
        endTime: rule.endTime,
        isActive: rule.isActive,
        courts: rule.courts?.map((c) => ({ id: c.id, name: c.name })),
      },
    };
  }

  @Delete(':ruleId')
  @BusinessRoles(BusinessRole.OWNER, BusinessRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('businessId') businessId: string,
    @Param('ruleId') ruleId: string,
  ) {
    await this.availabilityRulesService.remove(ruleId, businessId);
  }
}
