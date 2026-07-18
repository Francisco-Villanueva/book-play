import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { BusinessUser } from './entities/business-user.model';
import { BusinessInvitation } from './entities/business-invitation.model';
import { Business } from '../businesses/entities/business.model';
import {
  BUSINESS_USER_REPOSITORY,
  BUSINESS_INVITATION_REPOSITORY,
  BUSINESS_REPOSITORY,
} from '../database/constants/repositories.constants';
import { UsersService } from '../users/users.service';
import { MailService } from '../mail/mail.service';
import { BusinessRole } from '../../common/enums';
import { InviteMemberDto } from './dto/invite-member.dto';
import { InviteByEmailDto } from './dto/invite-by-email.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';
import { User } from '../users/entities/user.model';

const INVITATION_TTL_DAYS = 7;

@Injectable()
export class BusinessUsersService {
  constructor(
    @Inject(BUSINESS_USER_REPOSITORY)
    private readonly businessUserModel: typeof BusinessUser,
    @Inject(BUSINESS_INVITATION_REPOSITORY)
    private readonly businessInvitationModel: typeof BusinessInvitation,
    @Inject(BUSINESS_REPOSITORY)
    private readonly businessModel: typeof Business,
    private readonly usersService: UsersService,
    private readonly mailService: MailService,
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

  async inviteByEmail(
    businessId: string,
    dto: InviteByEmailDto,
    requesterRole: BusinessRole,
    inviter: { id: string; name: string },
  ): Promise<{ email: string; role: BusinessRole; expiresAt: Date }> {
    this.assertCanAssignRole(requesterRole, dto.role);

    const email = dto.email.toLowerCase();
    const existingUser = await this.usersService.findByEmail(email);
    if (existingUser) {
      const member = await this.businessUserModel.findOne({
        where: { businessId, userId: existingUser.id },
      });
      if (member) {
        throw new ConflictException('Este usuario ya es miembro del complejo');
      }
    }

    // Reemplaza cualquier invitación pendiente previa para el mismo email/complejo.
    await this.businessInvitationModel.destroy({
      where: { businessId, email, acceptedAt: null },
    });

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(
      Date.now() + INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000,
    );
    await this.businessInvitationModel.create({
      businessId,
      email,
      role: dto.role,
      tokenHash: this.hashToken(token),
      expiresAt,
      invitedByUserId: inviter.id,
    });

    const business = await this.businessModel.findByPk(businessId);
    void this.mailService.sendBusinessInvitation({
      to: email,
      businessName: business?.name ?? 'un complejo',
      inviterName: inviter.name,
      role: dto.role,
      token,
      expiresInDays: INVITATION_TTL_DAYS,
    });

    return { email, role: dto.role, expiresAt };
  }

  async getInvitationByToken(token: string): Promise<{
    email: string;
    role: BusinessRole;
    businessName: string | null;
    status: 'PENDING' | 'ACCEPTED' | 'EXPIRED';
  }> {
    const invitation = await this.businessInvitationModel.findOne({
      where: { tokenHash: this.hashToken(token) },
    });
    if (!invitation) {
      throw new NotFoundException('Invitación no encontrada');
    }
    const business = await this.businessModel.findByPk(invitation.businessId);
    const status = invitation.acceptedAt
      ? 'ACCEPTED'
      : invitation.expiresAt.getTime() < Date.now()
        ? 'EXPIRED'
        : 'PENDING';
    return {
      email: invitation.email,
      role: invitation.role,
      businessName: business?.name ?? null,
      status,
    };
  }

  async acceptInvitation(token: string, user: User): Promise<BusinessUser> {
    const invitation = await this.businessInvitationModel.findOne({
      where: { tokenHash: this.hashToken(token), acceptedAt: null },
    });
    if (!invitation) {
      throw new BadRequestException(
        'La invitación no es válida o ya fue utilizada',
      );
    }
    if (invitation.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException('La invitación expiró');
    }
    if (user.email.toLowerCase() !== invitation.email.toLowerCase()) {
      throw new ForbiddenException(
        'Esta invitación no corresponde a tu cuenta',
      );
    }

    const existing = await this.businessUserModel.findOne({
      where: { businessId: invitation.businessId, userId: user.id },
    });
    if (existing) {
      await invitation.update({ acceptedAt: new Date() });
      throw new ConflictException('Ya sos miembro de este complejo');
    }

    const member = await this.businessUserModel.create({
      businessId: invitation.businessId,
      userId: user.id,
      role: invitation.role,
    });
    await invitation.update({ acceptedAt: new Date() });
    return member;
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
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
