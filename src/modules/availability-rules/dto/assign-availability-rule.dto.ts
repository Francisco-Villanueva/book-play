import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class AssignAvailabilityRuleDto {
  @ApiProperty({
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    description: 'ID of the availability rule to assign to the court',
  })
  @IsUUID('4')
  ruleId: string;
}
