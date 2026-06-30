import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { MasterService } from './master.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MasterGuard } from '../../common/guards/master.guard';

@ApiTags('master')
@Controller('master')
@UseGuards(JwtAuthGuard, MasterGuard)
@ApiBearerAuth()
export class MasterController {
  constructor(private readonly masterService: MasterService) {}

  @Get('businesses')
  @ApiOperation({ summary: 'List all businesses on the platform (MASTER only)' })
  @ApiResponse({ status: 200, description: 'All businesses with courts and members count' })
  @ApiResponse({ status: 403, description: 'Access restricted to MASTER administrators' })
  async findAllBusinesses() {
    return this.masterService.findAllBusinesses();
  }

  @Get('businesses/:businessId')
  @ApiOperation({ summary: 'Get full detail of any business (MASTER only)' })
  @ApiResponse({ status: 200, description: 'Business detail with courts and members' })
  @ApiResponse({ status: 404, description: 'Business not found' })
  async findBusinessById(@Param('businessId') businessId: string) {
    return this.masterService.findBusinessById(businessId);
  }

  @Get('users')
  @ApiOperation({ summary: 'List all platform users (MASTER only)' })
  @ApiResponse({ status: 200, description: 'All users with their business memberships' })
  async findAllUsers() {
    return this.masterService.findAllUsers();
  }
}
