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
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { BusinessUsersService } from './business-users.service';
import { InviteMemberDto } from './dto/invite-member.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BusinessRolesGuard } from '../../common/guards/business-roles.guard';
import { BusinessRoles } from '../../common/decorators/business-roles.decorator';
import { BusinessRole } from '../../common/enums';

@ApiTags('members')
@ApiBearerAuth()
@Controller('businesses/:businessId/members')
@UseGuards(JwtAuthGuard, BusinessRolesGuard)
export class BusinessUsersController {
  constructor(private readonly businessUsersService: BusinessUsersService) {}

  @Post()
  @BusinessRoles(BusinessRole.OWNER, BusinessRole.ADMIN)
  @ApiOperation({ summary: 'Invite a user to the business' })
  @ApiResponse({ status: 201, description: 'Member invited' })
  @ApiResponse({ status: 409, description: 'User is already a member' })
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
  @ApiOperation({ summary: 'List all members of a business' })
  @ApiResponse({ status: 200, description: 'List of members' })
  async findAll(@Param('businessId') businessId: string) {
    const members = await this.businessUsersService.findAllMembers(businessId);
    return members;
  }

  @Patch(':userId')
  @BusinessRoles(BusinessRole.OWNER, BusinessRole.ADMIN)
  @ApiOperation({ summary: "Update a member's role" })
  @ApiResponse({ status: 200, description: 'Role updated' })
  @ApiResponse({ status: 404, description: 'Member not found' })
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
  @ApiOperation({ summary: 'Remove a member from the business' })
  @ApiResponse({ status: 204, description: 'Member removed' })
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
