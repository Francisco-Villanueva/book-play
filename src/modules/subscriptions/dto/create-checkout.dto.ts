import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class CreateCheckoutDto {
  @ApiProperty({ example: 'a3f1c2e4-...' })
  @IsString()
  @IsNotEmpty()
  planId: string;
}
