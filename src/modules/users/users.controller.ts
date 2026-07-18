import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Patch,
  Request,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { UsersService } from './users.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BusinessUser } from '../business-users/entities/business-user.model';
import { Business } from '../businesses/entities/business.model';

@ApiTags('users')
@Controller('users')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @ApiOperation({
    summary: 'Get authenticated user profile with their businesses',
  })
  @ApiResponse({ status: 200, description: 'User profile' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getMe(@Request() req: any) {
    const user = await this.usersService.findByIdWithBusinesses(req.user.id);
    if (!user) throw new NotFoundException('User not found');

    const raw = user.toJSON();

    return {
      user: {
        id: raw.id,
        name: raw.name,
        email: raw.email,
        phone: raw.phone ?? null,
        globalRole: raw.globalRole,
        businesses: (
          (raw.businessUsers as (BusinessUser & { business: Business })[]) ?? []
        ).map((bu) => ({
          id: bu.business?.id ?? null,
          name: bu.business?.name ?? null,
          role: bu.role,
        })),
      },
    };
  }

  @Patch('me')
  @ApiOperation({
    summary: 'Update authenticated user profile (name and/or phone)',
  })
  @ApiResponse({ status: 200, description: 'Profile updated' })
  @ApiResponse({
    status: 400,
    description: 'No fields provided or validation error',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async updateMe(@Request() req: any, @Body() dto: UpdateUserDto) {
    const user = await this.usersService.update(req.user.id, dto);
    const raw = user.toJSON();

    return {
      user: {
        id: raw.id,
        name: raw.name,
        email: raw.email,
        phone: raw.phone ?? null,
        globalRole: raw.globalRole,
        updatedAt: user.updatedAt,
      },
    };
  }
}
