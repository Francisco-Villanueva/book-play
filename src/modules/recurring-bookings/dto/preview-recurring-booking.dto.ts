import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsMilitaryTime,
  IsNotEmpty,
  IsOptional,
  IsUUID,
} from 'class-validator';

// El día de la semana no se pide: se deriva de `startDate`. Con los dos campos
// separados se podrían contradecir ("todos los martes, desde un jueves").
export class PreviewRecurringBookingDto {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  @IsUUID()
  @IsNotEmpty()
  courtId: string;

  @ApiProperty({
    example: '2026-08-04',
    description: 'Primera fecha de la serie; define el día de la semana',
  })
  @IsDateString()
  @IsNotEmpty()
  startDate: string;

  @ApiProperty({ example: '20:00' })
  @IsMilitaryTime()
  @IsNotEmpty()
  startTime: string;

  @ApiPropertyOptional({
    example: '2026-12-31',
    description: 'Sin esto la serie no tiene fin y se extiende sola',
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}
