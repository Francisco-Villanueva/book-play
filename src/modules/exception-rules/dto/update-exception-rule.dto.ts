import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsMilitaryTime,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class UpdateExceptionRuleDto {
  @ApiPropertyOptional({ example: '2026-12-25' })
  @IsOptional()
  @IsDateString()
  date?: string;

  @ApiPropertyOptional({ example: '08:00' })
  @IsOptional()
  @IsMilitaryTime()
  startTime?: string;

  @ApiPropertyOptional({ example: '22:00' })
  @IsOptional()
  @IsMilitaryTime()
  endTime?: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  isAvailable?: boolean;

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
