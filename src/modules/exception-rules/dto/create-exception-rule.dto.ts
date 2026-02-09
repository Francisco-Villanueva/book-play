import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsMilitaryTime,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class CreateExceptionRuleDto {
  @IsDateString()
  @IsNotEmpty()
  date: string;

  @IsOptional()
  @IsMilitaryTime()
  startTime?: string;

  @IsOptional()
  @IsMilitaryTime()
  endTime?: string;

  @IsBoolean()
  isAvailable: boolean;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  courtIds?: string[];
}
