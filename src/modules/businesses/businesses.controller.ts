import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { BusinessesService } from './businesses.service';
import { CreateBusinessDto } from './dto/create-business.dto';
import { UpdateBusinessDto } from './dto/update-business.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BusinessRolesGuard } from '../../common/guards/business-roles.guard';
import { BusinessRoles } from '../../common/decorators/business-roles.decorator';
import { BusinessRole } from '../../common/enums';

@ApiTags('businesses')
@Controller('businesses')
export class BusinessesController {
  constructor(private readonly businessesService: BusinessesService) {}

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get()
  @ApiOperation({ summary: 'List all businesses the current user belongs to' })
  @ApiResponse({ status: 200, description: 'List of businesses' })
  async findAll(@Request() req: any) {
    return this.businessesService.findAllBusinesses(req.user.id);
  }

  @Get('search')
  @ApiOperation({
    summary: 'Public search of businesses to book at (no auth required)',
  })
  @ApiResponse({ status: 200, description: 'Matching businesses' })
  async search(@Query('q') q?: string) {
    return this.businessesService.searchPublicBusinesses(q);
  }

  @Get(':businessId/public')
  @ApiOperation({
    summary: 'Public business details for the booking page (no auth required)',
  })
  @ApiResponse({ status: 200, description: 'Public business details' })
  @ApiResponse({ status: 404, description: 'Business not found' })
  async findPublicById(@Param('businessId') businessId: string) {
    const business =
      await this.businessesService.findPublicBusinessById(businessId);
    if (!business) throw new NotFoundException('Business not found');
    return business;
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get(':businessId')
  @ApiOperation({ summary: 'Get a business by ID' })
  @ApiResponse({ status: 200, description: 'Business details' })
  @ApiResponse({ status: 404, description: 'Business not found' })
  async findById(@Param('businessId') businessId: string) {
    const business = await this.businessesService.findBusinessById(businessId);
    if (!business) throw new NotFoundException('Business not found');
    return business;
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post()
  @ApiOperation({ summary: 'Create a new business (creator becomes OWNER)' })
  @ApiResponse({ status: 201, description: 'Business created' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  async create(@Body() dto: CreateBusinessDto, @Request() req: any) {
    const business = await this.businessesService.createBusiness(
      dto,
      req.user.id,
    );
    return {
      business: {
        id: business.id,
        name: business.name,
        createdAt: business.createdAt,
      },
    };
  }

  @UseGuards(JwtAuthGuard, BusinessRolesGuard)
  @BusinessRoles(BusinessRole.OWNER, BusinessRole.ADMIN)
  @ApiBearerAuth()
  @Patch(':businessId')
  @ApiOperation({ summary: 'Update business details (OWNER or ADMIN)' })
  @ApiResponse({ status: 200, description: 'Business updated' })
  @ApiResponse({
    status: 400,
    description: 'No fields provided or validation error',
  })
  @ApiResponse({ status: 403, description: 'Insufficient role' })
  @ApiResponse({ status: 404, description: 'Business not found' })
  async update(
    @Param('businessId') businessId: string,
    @Body() dto: UpdateBusinessDto,
  ) {
    const business = await this.businessesService.updateBusiness(
      businessId,
      dto,
    );
    return {
      business: {
        id: business.id,
        name: business.name,
        updatedAt: business.updatedAt,
      },
    };
  }

  @UseGuards(JwtAuthGuard, BusinessRolesGuard)
  @BusinessRoles(BusinessRole.OWNER)
  @ApiBearerAuth()
  @Delete(':businessId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a business and all its data (OWNER only)' })
  @ApiResponse({ status: 204, description: 'Business deleted' })
  @ApiResponse({ status: 403, description: 'Only OWNER can delete a business' })
  @ApiResponse({ status: 404, description: 'Business not found' })
  async remove(@Param('businessId') businessId: string) {
    await this.businessesService.deleteBusiness(businessId);
  }
}
