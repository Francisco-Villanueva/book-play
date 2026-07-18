import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsInt,
  IsMilitaryTime,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class CreateAvailabilityRulesBatchDto {
  @ApiPropertyOptional({ example: 'Horario de atención' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @ApiProperty({
    example: [1, 2, 3],
    description: 'Days of week to apply the rule to. 0=Sunday, 6=Saturday',
  })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  daysOfWeek: number[];

  @ApiProperty({ example: '08:00' })
  @IsMilitaryTime()
  startTime: string;

  @ApiProperty({ example: '22:00' })
  @IsMilitaryTime()
  endTime: string;

  @ApiPropertyOptional({
    type: [String],
    example: ['a1b2c3d4-e5f6-7890-abcd-ef1234567890'],
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  courtIds?: string[];
}
