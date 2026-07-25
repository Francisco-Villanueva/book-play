import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';

export class UpdateBusinessDto {
  @ApiPropertyOptional({ example: 'Arena Sport Center', minLength: 3 })
  @IsOptional()
  @IsString()
  @MinLength(3)
  name?: string;

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
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: 'America/Argentina/Buenos_Aires' })
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiPropertyOptional({
    enum: [30, 60, 90, 120],
    example: 60,
    description: 'Duración por defecto de las canchas nuevas (minutos)',
  })
  @IsOptional()
  @IsIn([30, 60, 90, 120])
  defaultSlotDuration?: number;

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
