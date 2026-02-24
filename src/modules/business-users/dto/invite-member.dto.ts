import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsUUID } from 'class-validator';
import { BusinessRole } from '../../../common/enums';

export class InviteMemberDto {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  @IsUUID()
  userId: string;

  @ApiProperty({ enum: BusinessRole, example: BusinessRole.STAFF })
  @IsEnum(BusinessRole)
  role: BusinessRole;
}
