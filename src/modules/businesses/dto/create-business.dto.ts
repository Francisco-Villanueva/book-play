import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';

export class CreateBusinessDto {
  @ApiProperty({ example: 'Arena Sport Center', minLength: 3 })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  name: string;

  @ApiPropertyOptional({ example: 'Premier sports complex with 10 courts' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: '123 Main St, City' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ example: '+1234567890' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: 'contact@arena.com' })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiProperty({ example: 'America/New_York' })
  @IsString()
  @IsNotEmpty()
  timezone: string;

  @ApiProperty({
    enum: [30, 60, 90, 120],
    example: 60,
    description: 'Duración por defecto de las canchas nuevas (minutos)',
  })
  @IsNotEmpty()
  @IsIn([30, 60, 90, 120])
  defaultSlotDuration: number;

  @ApiPropertyOptional({
    example: 9000.0,
    minimum: 0,
    description: 'Precio por turno por defecto de las canchas nuevas',
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  defaultPricePerSlot?: number;
}
