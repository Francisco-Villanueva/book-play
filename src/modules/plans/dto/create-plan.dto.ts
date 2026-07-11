import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Min,
} from 'class-validator';

export class CreatePlanDto {
  @ApiProperty({ example: 'Pro' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'pro', description: 'Slug único del plan' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-z0-9-]+$/, {
    message: 'code solo puede contener minúsculas, números y guiones',
  })
  code: string;

  @ApiPropertyOptional({ example: 'Para complejos grandes, canchas ilimitadas' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 15000, minimum: 0 })
  @IsInt()
  @Min(0)
  priceArs: number;

  @ApiPropertyOptional({ example: 5, description: 'null = ilimitado' })
  @IsOptional()
  @IsInt()
  @Min(1)
  courtsLimit?: number;

  @ApiPropertyOptional({ example: 3, description: 'null = ilimitado' })
  @IsOptional()
  @IsInt()
  @Min(1)
  staffLimit?: number;

  @ApiPropertyOptional({ example: ['unlimited_courts', 'advanced_reports'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  featureKeys?: string[];

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isPubliclyVisible?: boolean;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsInt()
  sortOrder?: number;
}
