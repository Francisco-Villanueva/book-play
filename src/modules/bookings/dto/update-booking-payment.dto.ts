import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

// `paymentStatus` no se acepta: lo deriva el servidor de playersPaid/totalPlayers
// (BR-025), así no puede quedar en un estado que contradiga a los jugadores.
export class UpdateBookingPaymentDto {
  @ApiProperty({ example: 6, description: 'Cuántos jugadores eran en total' })
  @IsInt()
  @Min(1)
  totalPlayers: number;

  @ApiProperty({ example: 4, description: 'Cuántos de ellos ya pagaron' })
  @IsInt()
  @Min(0)
  playersPaid: number;

  @ApiPropertyOptional({
    example: 15000,
    description:
      'Monto realmente cobrado. Si se omite se prorratea sobre totalPrice.',
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  amountPaid?: number;

  @ApiPropertyOptional({ example: 'Faltan 2, pagan el sábado' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  paymentNotes?: string;
}
