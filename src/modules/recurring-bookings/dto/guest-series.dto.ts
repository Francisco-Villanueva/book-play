import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class GuestSeriesQueryDto {
  @ApiProperty({ description: 'Token que viaja en el correo de alta' })
  @IsString()
  @IsNotEmpty()
  token: string;
}

export class CancelSeriesInstanceDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  token: string;

  @ApiProperty({ description: 'La fecha puntual que se da de baja' })
  @IsUUID()
  @IsNotEmpty()
  bookingId: string;
}
