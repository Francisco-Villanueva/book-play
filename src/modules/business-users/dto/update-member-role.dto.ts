import { IsEnum } from 'class-validator';
import { BusinessRole } from '../../../common/enums';

export class UpdateMemberRoleDto {
  @IsEnum(BusinessRole)
  role: BusinessRole;
}
