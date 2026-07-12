import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, Min } from 'class-validator';

export class ReactivateSuspendedDto {
  @ApiPropertyOptional({
    example: 7,
    description: 'Días a extender el trial si nunca tuvo plan pago',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  extendTrialDays?: number;
}
