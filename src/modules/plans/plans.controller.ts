import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { PlansService } from './plans.service';

@ApiTags('plans')
@Controller('plans')
export class PlansController {
  constructor(private readonly plansService: PlansService) {}

  @Get()
  @ApiOperation({ summary: 'List publicly visible, active plans' })
  @ApiResponse({ status: 200, description: 'List of plans' })
  async findAll() {
    return this.plansService.findPublic();
  }
}
