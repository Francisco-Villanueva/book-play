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
  Req,
  UseGuards,
} from '@nestjs/common';
import { BusinessUsersService } from './business-users.service';
import { InviteMemberDto } from './dto/invite-member.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BusinessRolesGuard } from '../../common/guards/business-roles.guard';
import { BusinessRoles } from '../../common/decorators/business-roles.decorator';
import { BusinessRole } from '../../common/enums';

@Controller('businesses/:businessId/members')
@UseGuards(JwtAuthGuard, BusinessRolesGuard)
export class BusinessUsersController {
  constructor(private readonly businessUsersService: BusinessUsersService) {}

  @Post()
  @BusinessRoles(BusinessRole.OWNER, BusinessRole.ADMIN)
  async invite(
    @Param('businessId') businessId: string,
    @Body() dto: InviteMemberDto,
    @Req() req: any,
  ) {
    const member = await this.businessUsersService.invite(
      businessId,
      dto,
      req.businessUser.role,
    );
    return member;
  }

  @Get()
  @BusinessRoles(BusinessRole.OWNER, BusinessRole.ADMIN, BusinessRole.STAFF)
  async findAll(@Param('businessId') businessId: string) {
    const members = await this.businessUsersService.findAllMembers(businessId);
    return members;
  }

  @Patch(':userId')
  @BusinessRoles(BusinessRole.OWNER, BusinessRole.ADMIN)
  async updateRole(
    @Param('businessId') businessId: string,
    @Param('userId') userId: string,
    @Body() dto: UpdateMemberRoleDto,
    @Req() req: any,
  ) {
    const member = await this.businessUsersService.updateMemberRole(
      businessId,
      userId,
      dto,
      req.businessUser.role,
    );
    return member;
  }

  @Delete(':userId')
  @BusinessRoles(BusinessRole.OWNER, BusinessRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('businessId') businessId: string,
    @Param('userId') userId: string,
    @Req() req: any,
  ) {
    await this.businessUsersService.removeMember(
      businessId,
      userId,
      req.businessUser.role,
    );
  }
}
