import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
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

  @ApiPropertyOptional({ example: 'Av. 44 1250' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({
    example: 'La Plata',
    description: 'Ciudad del complejo. Es el eje de la búsqueda pública',
  })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  city?: string;

  @ApiPropertyOptional({ example: 'Buenos Aires' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  province?: string;

  @ApiPropertyOptional({
    example: -34.921,
    description:
      'Coordenada del complejo. La completa el geocoder; se manda a mano sólo para corregirla',
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 6 })
  @Min(-90)
  @Max(90)
  latitude?: number;

  @ApiPropertyOptional({ example: -57.9545 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 6 })
  @Min(-180)
  @Max(180)
  longitude?: number;

  @ApiPropertyOptional({
    example: true,
    description:
      'Si el complejo aparece en el buscador público. Su link directo sigue funcionando igual',
  })
  @IsOptional()
  @IsBoolean()
  isListed?: boolean;

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

  @ApiPropertyOptional({
    example: 24,
    minimum: 0,
    maximum: 168,
    description:
      'Antelación mínima en horas con la que el cliente puede cancelar. 0 = sin restricción',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(168)
  cancellationDeadlineHours?: number;
}
