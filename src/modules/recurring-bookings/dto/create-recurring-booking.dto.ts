import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { PreviewRecurringBookingDto } from './preview-recurring-booking.dto';

export class CreateRecurringBookingDto extends PreviewRecurringBookingDto {
  @ApiPropertyOptional({ example: 'Juan Pérez' })
  @IsOptional()
  @IsString()
  guestName?: string;

  @ApiPropertyOptional({ example: '+5493511234567' })
  @IsOptional()
  @IsString()
  guestPhone?: string;

  @ApiPropertyOptional({ example: 'juan@example.com' })
  @IsOptional()
  @IsString()
  guestEmail?: string;

  @ApiPropertyOptional({ example: 'Grupo de los martes' })
  @IsOptional()
  @IsString()
  notes?: string;
}
