import {
  Body,
  Controller,
  Get,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { BusinessesService } from './businesses.service';
import { CreateBusinessDto } from './dto/create-business.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('businesses')
export class BusinessesController {
  constructor(private readonly businessesService: BusinessesService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  async findAll(@Request() req) {
    const businesses = await this.businessesService.findAllBusinesses(
      req.user.id,
    );
    return { businesses };
  }
  @UseGuards(JwtAuthGuard)
  @Post()
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
