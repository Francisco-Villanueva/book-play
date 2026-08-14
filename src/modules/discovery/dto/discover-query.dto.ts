import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  DEFAULT_DAYS,
  DEFAULT_PAGE_SIZE,
  MAX_BUSINESSES,
  MAX_DAYS,
} from '../discovery.constants';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export const DISCOVERY_SORTS = ['availability', 'name', 'distance'] as const;
export type DiscoverySort = (typeof DISCOVERY_SORTS)[number];

export class DiscoverQueryDto {
  @ApiPropertyOptional({
    example: 'la-plata',
    description: 'Slug de la ciudad (de GET /discovery/cities)',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  @Transform(trim)
  city: string;

  @ApiPropertyOptional({
    example: 'padel',
    description:
      'Slug del deporte. Filtra qué complejos entran, no qué muestran',
  })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  @Transform(trim)
  sport?: string;

  @ApiPropertyOptional({
    example: 'los pinos',
    description: 'Busca por nombre',
  })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  @Transform(trim)
  q?: string;

  @ApiPropertyOptional({
    example: '2026-08-13',
    description: 'Primer día de la ventana. Se recorta a hoy si es pasado',
  })
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

  @ApiPropertyOptional({ enum: DISCOVERY_SORTS, example: 'availability' })
  @IsOptional()
  @IsIn(DISCOVERY_SORTS)
  sort?: DiscoverySort;

  @ApiPropertyOptional({
    example: -34.9215,
    description:
      'Posición del usuario. Obligatoria junto a lng si sort=distance',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat?: number;

  @ApiPropertyOptional({ example: -57.9545 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng?: number;

  @ApiPropertyOptional({ example: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({
    example: DEFAULT_PAGE_SIZE,
    minimum: 1,
    maximum: MAX_BUSINESSES,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_BUSINESSES)
  limit?: number;
}
