import { Module } from '@nestjs/common';
import { availabilityRuleProvider } from './availability-rule.provider';

@Module({
  providers: [...availabilityRuleProvider],
  exports: [...availabilityRuleProvider],
})
export class AvailabilityRulesModule {}
