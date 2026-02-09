import { SetMetadata } from '@nestjs/common';
import { BusinessRole } from '../enums';

export const BUSINESS_ROLES_KEY = 'businessRoles';
export const BusinessRoles = (...roles: BusinessRole[]) =>
  SetMetadata(BUSINESS_ROLES_KEY, roles);
