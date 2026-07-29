import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

export class UpdatePreferencesDto {
  @ApiPropertyOptional({
    example: true,
    description: 'Recibir correos de confirmación y cancelación de reserva',
  })
  @IsOptional()
  @IsBoolean()
  notifyBookings?: boolean;
}
