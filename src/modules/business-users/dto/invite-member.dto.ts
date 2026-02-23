import { IsEnum, IsUUID } from 'class-validator';
import { BusinessRole } from '../../../common/enums';

export class InviteMemberDto {
  @IsUUID()
  userId: string;

  @IsEnum(BusinessRole)
  role: BusinessRole;
}
