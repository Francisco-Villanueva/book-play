import {
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { BusinessUsersService } from './business-users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('invitations')
@Controller('invitations')
export class InvitationsController {
  constructor(private readonly businessUsersService: BusinessUsersService) {}

  @Get(':token')
  @ApiOperation({ summary: 'Preview an invitation by token' })
  @ApiResponse({ status: 200, description: 'Invitation details' })
  @ApiResponse({ status: 404, description: 'Invitation not found' })
  async preview(@Param('token') token: string) {
    return this.businessUsersService.getInvitationByToken(token);
  }

  @Post(':token/accept')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Accept an invitation' })
  @ApiResponse({ status: 200, description: 'Invitation accepted' })
  @ApiResponse({ status: 400, description: 'Invalid or expired invitation' })
  @ApiResponse({
    status: 403,
    description: 'Invitation does not match your account',
  })
  @ApiResponse({ status: 409, description: 'Already a member' })
  async accept(@Param('token') token: string, @Req() req: any) {
    return this.businessUsersService.acceptInvitation(token, req.user);
  }
}
