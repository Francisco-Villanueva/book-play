import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsInt,
  IsMilitaryTime,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class CreateAvailabilityRuleDto {
  @ApiProperty({ example: 'Weekday morning' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 1, minimum: 0, maximum: 6, description: '0=Sunday, 6=Saturday' })
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek: number;

  @ApiProperty({ example: '08:00' })
  @IsMilitaryTime()
  startTime: string;

  @ApiProperty({ example: '22:00' })
  @IsMilitaryTime()
  endTime: string;

  @ApiPropertyOptional({ type: [String], example: ['a1b2c3d4-e5f6-7890-abcd-ef1234567890'] })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  courtIds?: string[];
}
