import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsEnum } from 'class-validator';
import { BusinessRole } from '../../../common/enums';

export class InviteByEmailDto {
  @ApiProperty({ example: 'nuevo.miembro@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ enum: BusinessRole, example: BusinessRole.STAFF })
  @IsEnum(BusinessRole)
  role: BusinessRole;
}
