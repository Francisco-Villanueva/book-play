import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class CancelGuestBookingDto {
  @ApiProperty({ description: 'Token from the booking confirmation email' })
  @IsString()
  @IsNotEmpty()
  token: string;
}
