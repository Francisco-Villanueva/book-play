import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { BusinessesService } from './businesses.service';
import { CreateBusinessDto } from './dto/create-business.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('businesses')
@ApiBearerAuth()
@Controller('businesses')
export class BusinessesController {
  constructor(private readonly businessesService: BusinessesService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  @ApiOperation({ summary: 'List all businesses the current user belongs to' })
  @ApiResponse({ status: 200, description: 'List of businesses' })
  async findAll(@Request() req) {
    const businesses = await this.businessesService.findAllBusinesses(
      req.user.id,
    );
    return businesses;
  }
  @UseGuards(JwtAuthGuard)
  @Get(':businessId')
  @ApiOperation({ summary: 'Get a business by ID' })
  @ApiResponse({ status: 200, description: 'Business details' })
  @ApiResponse({ status: 404, description: 'Business not found' })
  async findById(@Request() req, @Param('businessId') businessId: string) {
    const business = await this.businessesService.findBusinessById(businessId);
    return business;
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  @ApiOperation({ summary: 'Create a new business' })
  @ApiResponse({ status: 201, description: 'Business created' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  async create(@Body() dto: CreateBusinessDto, @Request() req) {
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
}
