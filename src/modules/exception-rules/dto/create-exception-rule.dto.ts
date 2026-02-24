import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsMilitaryTime,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class CreateExceptionRuleDto {
  @ApiProperty({ example: '2026-12-25' })
  @IsDateString()
  @IsNotEmpty()
  date: string;

  @ApiPropertyOptional({ example: '08:00', description: 'If omitted, exception applies all day' })
  @IsOptional()
  @IsMilitaryTime()
  startTime?: string;

  @ApiPropertyOptional({ example: '22:00' })
  @IsOptional()
  @IsMilitaryTime()
  endTime?: string;

  @ApiProperty({ example: false, description: 'false = closed, true = open' })
  @IsBoolean()
  isAvailable: boolean;

  @ApiPropertyOptional({ example: 'Christmas holiday' })
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiPropertyOptional({ type: [String], example: ['a1b2c3d4-e5f6-7890-abcd-ef1234567890'] })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  courtIds?: string[];
}
