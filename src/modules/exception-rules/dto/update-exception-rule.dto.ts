import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsMilitaryTime,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class UpdateExceptionRuleDto {
  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsMilitaryTime()
  startTime?: string;

  @IsOptional()
  @IsMilitaryTime()
  endTime?: string;

  @IsOptional()
  @IsBoolean()
  isAvailable?: boolean;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  courtIds?: string[];
}
