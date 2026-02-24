import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { BusinessRole } from '../../../common/enums';

export class UpdateMemberRoleDto {
  @ApiProperty({ enum: BusinessRole, example: BusinessRole.ADMIN })
  @IsEnum(BusinessRole)
  role: BusinessRole;
}
