import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Max,
  Min,
} from 'class-validator';
import { BookingPaymentStatus, BookingStatus } from '../../../common/enums';

export const BOOKINGS_PAGE_SIZE_DEFAULT = 50;
export const BOOKINGS_PAGE_SIZE_MAX = 200;

// El modelo guarda `date` como DATEONLY: comparar contra un ISO con hora
// ('2026-03-15T00:00:00Z') no matchea, así que se exige YYYY-MM-DD estricto.
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_DATE_MESSAGE = 'must be a date in YYYY-MM-DD format';

export class ListBookingsQueryDto {
  @ApiPropertyOptional({
    example: '2026-03-15',
    description: 'Single day; shorthand for dateFrom = dateTo = date',
  })
  @IsOptional()
  @Matches(ISO_DATE, { message: `date ${ISO_DATE_MESSAGE}` })
  date?: string;

  @ApiPropertyOptional({ example: '2026-03-01' })
  @IsOptional()
  @Matches(ISO_DATE, { message: `dateFrom ${ISO_DATE_MESSAGE}` })
  dateFrom?: string;

  @ApiPropertyOptional({ example: '2026-03-31' })
  @IsOptional()
  @Matches(ISO_DATE, { message: `dateTo ${ISO_DATE_MESSAGE}` })
  dateTo?: string;

  @ApiPropertyOptional({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  @IsOptional()
  @IsUUID()
  courtId?: string;

  @ApiPropertyOptional({ enum: BookingStatus })
  @IsOptional()
  @IsEnum(BookingStatus)
  status?: BookingStatus;

  @ApiPropertyOptional({
    enum: BookingPaymentStatus,
    isArray: true,
    description: 'Repeated or comma-separated, e.g. UNPAID,PARTIAL',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    Array.isArray(value) ? (value as string[]) : String(value).split(','),
  )
  @IsEnum(BookingPaymentStatus, { each: true })
  paymentStatus?: BookingPaymentStatus[];

  @ApiPropertyOptional({
    example: true,
    description: 'true = sólo instancias de turnos fijos; false = sólo sueltas',
  })
  @IsOptional()
  @Transform(
    ({ value }: { value: unknown }) => value === true || value === 'true',
  )
  @IsBoolean()
  recurring?: boolean;

  @ApiPropertyOptional({
    example: 'Fernández',
    description:
      'Matches guest name/phone/email, account holder and court name',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  @ApiPropertyOptional({ example: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({
    example: BOOKINGS_PAGE_SIZE_DEFAULT,
    default: BOOKINGS_PAGE_SIZE_DEFAULT,
    maximum: BOOKINGS_PAGE_SIZE_MAX,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(BOOKINGS_PAGE_SIZE_MAX)
  limit?: number;

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'asc' })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sort?: 'asc' | 'desc';
}
