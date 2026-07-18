import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsNotEmpty } from 'class-validator';

export class BusinessAvailabilityQueryDto {
  @ApiProperty({ example: '2026-03-15' })
  @IsDateString()
  @IsNotEmpty()
  date: string;
}
