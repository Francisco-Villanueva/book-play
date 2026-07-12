import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { PlansService } from './plans.service';
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MasterGuard } from '../../common/guards/master.guard';

@ApiTags('master')
@Controller('master/plans')
@UseGuards(JwtAuthGuard, MasterGuard)
@ApiBearerAuth()
export class MasterPlansController {
  constructor(private readonly plansService: PlansService) {}

  @Get()
  @ApiOperation({ summary: 'List all plans, including archived (MASTER only)' })
  @ApiResponse({ status: 200, description: 'All plans with subscriber counts' })
  async findAll() {
    return this.plansService.findAllForMaster();
  }

  @Get(':planId')
  @ApiOperation({ summary: 'Get a plan by ID (MASTER only)' })
  @ApiResponse({ status: 200, description: 'Plan detail' })
  @ApiResponse({ status: 404, description: 'Plan not found' })
  async findOne(@Param('planId') planId: string) {
    return this.plansService.findByIdForMaster(planId);
  }

  @Post()
  @ApiOperation({ summary: 'Create a plan (MASTER only)' })
  @ApiResponse({ status: 201, description: 'Plan created' })
  async create(@Body() dto: CreatePlanDto) {
    return this.plansService.create(dto);
  }

  @Patch(':planId')
  @ApiOperation({ summary: 'Update a plan (MASTER only)' })
  @ApiResponse({ status: 200, description: 'Plan updated' })
  @ApiResponse({
    status: 400,
    description: 'Cannot change price of an MP-synced plan',
  })
  async update(@Param('planId') planId: string, @Body() dto: UpdatePlanDto) {
    return this.plansService.update(planId, dto);
  }

  @Post(':planId/archive')
  @ApiOperation({ summary: 'Archive a plan (MASTER only)' })
  @ApiResponse({ status: 200, description: 'Plan archived' })
  async archive(@Param('planId') planId: string) {
    return this.plansService.archive(planId);
  }

  @Post(':planId/restore')
  @ApiOperation({ summary: 'Restore an archived plan (MASTER only)' })
  @ApiResponse({ status: 200, description: 'Plan restored' })
  async restore(@Param('planId') planId: string) {
    return this.plansService.restore(planId);
  }

  @Delete(':planId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a plan with no subscribers (MASTER only)' })
  @ApiResponse({ status: 204, description: 'Plan deleted' })
  @ApiResponse({ status: 400, description: 'Plan has subscribers' })
  async remove(@Param('planId') planId: string) {
    await this.plansService.remove(planId);
  }
}
