import {
  IsDateString,
  IsMilitaryTime,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class CreateBookingDto {
  @IsUUID()
  @IsNotEmpty()
  courtId: string;

  @IsDateString()
  @IsNotEmpty()
  date: string;

  @IsMilitaryTime()
  @IsNotEmpty()
  startTime: string;

  @IsOptional()
  @IsString()
  guestName?: string;

  @IsOptional()
  @IsString()
  guestPhone?: string;

  @IsOptional()
  @IsString()
  guestEmail?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
