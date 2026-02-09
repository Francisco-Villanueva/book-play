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
import { ExceptionRulesService } from './exception-rules.service';
import { CreateExceptionRuleDto } from './dto/create-exception-rule.dto';
import { UpdateExceptionRuleDto } from './dto/update-exception-rule.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BusinessRolesGuard } from '../../common/guards/business-roles.guard';
import { BusinessRoles } from '../../common/decorators/business-roles.decorator';
import { BusinessRole } from '../../common/enums';

@Controller('businesses/:businessId/exception-rules')
@UseGuards(JwtAuthGuard, BusinessRolesGuard)
export class ExceptionRulesController {
  constructor(
    private readonly exceptionRulesService: ExceptionRulesService,
  ) {}

  @Post()
  @BusinessRoles(BusinessRole.OWNER, BusinessRole.ADMIN)
  async create(
    @Param('businessId') businessId: string,
    @Body() dto: CreateExceptionRuleDto,
  ) {
    const rule = await this.exceptionRulesService.create(businessId, dto);
    return {
      exceptionRule: {
        id: rule.id,
        date: rule.date,
        startTime: rule.startTime,
        endTime: rule.endTime,
        isAvailable: rule.isAvailable,
        reason: rule.reason,
        courts: rule.courts?.map((c) => ({ id: c.id, name: c.name })),
      },
    };
  }

  @Get()
  @BusinessRoles(BusinessRole.OWNER, BusinessRole.ADMIN, BusinessRole.STAFF)
  async findAll(@Param('businessId') businessId: string) {
    const rules =
      await this.exceptionRulesService.findAllByBusiness(businessId);
    return {
      exceptionRules: rules.map((rule) => ({
        id: rule.id,
        date: rule.date,
        startTime: rule.startTime,
        endTime: rule.endTime,
        isAvailable: rule.isAvailable,
        reason: rule.reason,
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
    const rule = await this.exceptionRulesService.findOne(ruleId, businessId);
    return {
      exceptionRule: {
        id: rule.id,
        date: rule.date,
        startTime: rule.startTime,
        endTime: rule.endTime,
        isAvailable: rule.isAvailable,
        reason: rule.reason,
        courts: rule.courts?.map((c) => ({ id: c.id, name: c.name })),
      },
    };
  }

  @Put(':ruleId')
  @BusinessRoles(BusinessRole.OWNER, BusinessRole.ADMIN)
  async update(
    @Param('businessId') businessId: string,
    @Param('ruleId') ruleId: string,
    @Body() dto: UpdateExceptionRuleDto,
  ) {
    const rule = await this.exceptionRulesService.update(
      ruleId,
      businessId,
      dto,
    );
    return {
      exceptionRule: {
        id: rule.id,
        date: rule.date,
        startTime: rule.startTime,
        endTime: rule.endTime,
        isAvailable: rule.isAvailable,
        reason: rule.reason,
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
    await this.exceptionRulesService.remove(ruleId, businessId);
  }
}
