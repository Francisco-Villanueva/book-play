import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { BusinessRole } from '../enums';
import { BUSINESS_ROLES_KEY } from '../decorators/business-roles.decorator';
import { BUSINESS_USER_REPOSITORY } from '../../modules/database/constants/repositories.constants';
import { BusinessUser } from '../../modules/business-users/entities/business-user.model';

@Injectable()
export class BusinessRolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(BUSINESS_USER_REPOSITORY)
    private readonly businessUserModel: typeof BusinessUser,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<BusinessRole[]>(
      BUSINESS_ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const businessId = request.params.businessId;

    if (!user) {
      throw new ForbiddenException('Authentication required');
    }

    if (!businessId) {
      throw new NotFoundException('Business ID is required');
    }

    const businessUser = await this.businessUserModel.findOne({
      where: { businessId, userId: user.id },
    });

    if (!businessUser) {
      throw new ForbiddenException(
        'You do not have access to this business',
      );
    }

    if (!requiredRoles.includes(businessUser.role as BusinessRole)) {
      throw new ForbiddenException(
        'Insufficient permissions for this action',
      );
    }

    request.businessUser = businessUser;
    return true;
  }
}
