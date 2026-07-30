import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional } from 'class-validator';

export class ResendGuestLinkDto {
  @ApiPropertyOptional({
    example: 'juan@example.com',
    description:
      'Sin esto se usa el correo ya cargado. Enviarlo también lo actualiza — ' +
      'sirve para el turno fijo que se dio de alta sin correo.',
  })
  @IsOptional()
  @IsEmail()
  email?: string;
}
