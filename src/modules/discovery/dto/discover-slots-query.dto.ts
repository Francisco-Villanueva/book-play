import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  DEFAULT_DAYS,
  DEFAULT_SLOTS,
  MAX_DAYS,
  MAX_SLOTS,
} from '../discovery.constants';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class DiscoverSlotsQueryDto {
  @ApiPropertyOptional({ example: 'la-plata' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  @Transform(trim)
  city: string;

  @ApiPropertyOptional({ example: 'padel' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  @Transform(trim)
  sport?: string;

  @ApiPropertyOptional({ example: '2026-08-13' })
  @IsOptional()
  @IsDateString()
  date?: string;

  @ApiPropertyOptional({ example: DEFAULT_DAYS, minimum: 1, maximum: MAX_DAYS })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_DAYS)
  days?: number;

  @ApiPropertyOptional({
    example: DEFAULT_SLOTS,
    minimum: 1,
    maximum: MAX_SLOTS,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_SLOTS)
  limit?: number;
}
