import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { GlobalRole } from '../enums';

@Injectable()
export class MasterGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new UnauthorizedException('Authentication required');
    }

    if (user.globalRole !== GlobalRole.MASTER) {
      throw new ForbiddenException(
        'Access restricted to MASTER administrators',
      );
    }

    return true;
  }
}
