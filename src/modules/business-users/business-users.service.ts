import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BusinessUser } from './entities/business-user.model';
import { BUSINESS_USER_REPOSITORY } from '../database/constants/repositories.constants';
import { UsersService } from '../users/users.service';
import { BusinessRole } from '../../common/enums';
import { InviteMemberDto } from './dto/invite-member.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';
import { User } from '../users/entities/user.model';

@Injectable()
export class BusinessUsersService {
  constructor(
    @Inject(BUSINESS_USER_REPOSITORY)
    private readonly businessUserModel: typeof BusinessUser,
    private readonly usersService: UsersService,
  ) {}

  private roleRank(role: BusinessRole): number {
    return { OWNER: 3, ADMIN: 2, STAFF: 1 }[role];
  }

  private assertCanManage(
    requesterRole: BusinessRole,
    targetRole: BusinessRole,
  ): void {
    if (targetRole === BusinessRole.OWNER) {
      throw new ForbiddenException('Cannot modify the business owner');
    }
    if (this.roleRank(requesterRole) <= this.roleRank(targetRole)) {
      throw new ForbiddenException(
        'You cannot manage a member with an equal or higher role',
      );
    }
  }

  private assertCanAssignRole(
    requesterRole: BusinessRole,
    roleToAssign: BusinessRole,
  ): void {
    if (roleToAssign === BusinessRole.OWNER) {
      throw new ForbiddenException('Cannot assign the OWNER role');
    }
    if (this.roleRank(requesterRole) <= this.roleRank(roleToAssign)) {
      throw new ForbiddenException(
        'You cannot assign a role equal to or above your own',
      );
    }
  }

  async invite(
    businessId: string,
    dto: InviteMemberDto,
    requesterRole: BusinessRole,
  ): Promise<BusinessUser> {
    this.assertCanAssignRole(requesterRole, dto.role);

    const user = await this.usersService.findById(dto.userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const existing = await this.businessUserModel.findOne({
      where: { businessId, userId: dto.userId },
    });
    if (existing) {
      throw new ConflictException('User is already a member of this business');
    }

    return this.businessUserModel.create({
      businessId,
      userId: dto.userId,
      role: dto.role,
    });
  }

  async findAllMembers(businessId: string): Promise<BusinessUser[]> {
    return this.businessUserModel.findAll({
      where: { businessId },
      include: [
        {
          model: User,
          attributes: ['id', 'name', 'email', 'userName'],
        },
      ],
    });
  }

  async updateMemberRole(
    businessId: string,
    targetUserId: string,
    dto: UpdateMemberRoleDto,
    requesterRole: BusinessRole,
  ): Promise<BusinessUser> {
    const member = await this.businessUserModel.findOne({
      where: { businessId, userId: targetUserId },
    });
    if (!member) {
      throw new NotFoundException('Member not found');
    }

    this.assertCanManage(requesterRole, member.role);
    this.assertCanAssignRole(requesterRole, dto.role);

    await member.update({ role: dto.role });
    return member;
  }

  async removeMember(
    businessId: string,
    targetUserId: string,
    requesterRole: BusinessRole,
  ): Promise<void> {
    const member = await this.businessUserModel.findOne({
      where: { businessId, userId: targetUserId },
    });
    if (!member) {
      throw new NotFoundException('Member not found');
    }

    this.assertCanManage(requesterRole, member.role);
    await member.destroy();
  }
}
