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
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CourtsService } from './courts.service';
import { CreateCourtDto } from './dto/create-court.dto';
import { UpdateCourtDto } from './dto/update-court.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BusinessRolesGuard } from '../../common/guards/business-roles.guard';
import { BusinessRoles } from '../../common/decorators/business-roles.decorator';
import { BusinessRole } from '../../common/enums';

@ApiTags('courts')
@ApiBearerAuth()
@Controller('businesses/:businessId/courts')
@UseGuards(JwtAuthGuard, BusinessRolesGuard)
export class CourtsController {
  constructor(private readonly courtsService: CourtsService) {}

  @Post()
  @BusinessRoles(BusinessRole.OWNER, BusinessRole.ADMIN)
  @ApiOperation({ summary: 'Create a court in a business' })
  @ApiResponse({ status: 201, description: 'Court created' })
  @ApiResponse({ status: 403, description: 'Insufficient role' })
  async create(
    @Param('businessId') businessId: string,
    @Body() dto: CreateCourtDto,
  ) {
    const court = await this.courtsService.create(businessId, dto);
    return { id: court.id, name: court.name, createdAt: court.createdAt };
  }

  @Get()
  @BusinessRoles(BusinessRole.OWNER, BusinessRole.ADMIN, BusinessRole.STAFF)
  @ApiOperation({ summary: 'List all courts in a business' })
  @ApiResponse({ status: 200, description: 'List of courts' })
  async findAll(@Param('businessId') businessId: string) {
    const courts = await this.courtsService.findAllByBusiness(businessId);
    return courts;
  }

  @Get(':courtId')
  @BusinessRoles(BusinessRole.OWNER, BusinessRole.ADMIN, BusinessRole.STAFF)
  @ApiOperation({ summary: 'Get a court by ID' })
  @ApiResponse({ status: 200, description: 'Court details' })
  @ApiResponse({ status: 404, description: 'Court not found' })
  async findOne(
    @Param('businessId') businessId: string,
    @Param('courtId') courtId: string,
  ) {
    const court = await this.courtsService.findOne(courtId, businessId);
    return court;
  }

  @Patch(':courtId')
  @BusinessRoles(BusinessRole.OWNER, BusinessRole.ADMIN)
  @ApiOperation({ summary: 'Update a court' })
  @ApiResponse({ status: 200, description: 'Court updated' })
  @ApiResponse({ status: 404, description: 'Court not found' })
  async update(
    @Param('businessId') businessId: string,
    @Param('courtId') courtId: string,
    @Body() dto: UpdateCourtDto,
  ) {
    const court = await this.courtsService.update(courtId, businessId, dto);
    return {
      id: court.id,
      name: court.name,
      updatedAt: court.updatedAt,
    };
  }

  @Delete(':courtId')
  @BusinessRoles(BusinessRole.OWNER, BusinessRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a court' })
  @ApiResponse({ status: 204, description: 'Court deleted' })
  @ApiResponse({ status: 404, description: 'Court not found' })
  async remove(
    @Param('businessId') businessId: string,
    @Param('courtId') courtId: string,
  ) {
    await this.courtsService.remove(courtId, businessId);
  }
}
