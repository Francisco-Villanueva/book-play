import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional } from 'class-validator';

export class EndRecurringBookingDto {
  @ApiPropertyOptional({
    example: '2026-09-01',
    description:
      'Cancela las instancias desde esta fecha inclusive. Por defecto, hoy — ' +
      'los turnos ya jugados nunca se tocan.',
  })
  @IsOptional()
  @IsDateString()
  from?: string;
}
