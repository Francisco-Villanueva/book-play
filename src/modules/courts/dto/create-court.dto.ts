import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateCourtDto {
  @ApiProperty({ example: 'Court A' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ example: 'padel' })
  @IsOptional()
  @IsString()
  sportType?: string;

  @ApiPropertyOptional({ example: 'synthetic grass' })
  @IsOptional()
  @IsString()
  surface?: string;

  @ApiPropertyOptional({ example: 4, minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  capacity?: number;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  isIndoor?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  hasLighting?: boolean;

  @ApiPropertyOptional({
    enum: [30, 60, 90, 120],
    example: 60,
    description:
      'Duración del turno en minutos. Si se omite, se toma la del negocio',
  })
  @IsOptional()
  @IsIn([30, 60, 90, 120])
  slotDuration?: number;

  @ApiPropertyOptional({
    example: 9000.0,
    minimum: 0,
    description: 'Precio por turno (no por hora)',
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  pricePerSlot?: number;

  @ApiPropertyOptional({ example: 'Standard padel court with glass walls' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
