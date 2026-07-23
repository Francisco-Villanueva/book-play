import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class GuestCancellationQueryDto {
  @ApiProperty({ description: 'Token from the booking confirmation email' })
  @IsString()
  @IsNotEmpty()
  token: string;
}
