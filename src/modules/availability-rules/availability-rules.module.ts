import { Module } from '@nestjs/common';
import { availabilityRuleProvider } from './availability-rule.provider';
import { AvailabilityRulesController } from './availability-rules.controller';
import { CourtAvailabilityRulesController } from './court-availability-rules.controller';
import { AvailabilityRulesService } from './availability-rules.service';
import { BusinessUsersModule } from '../business-users/business-users.module';
import { DatabaseModule } from '../database/database.module';
import { CourtsModule } from '../courts/courts.module';

@Module({
  imports: [BusinessUsersModule, DatabaseModule, CourtsModule],
  controllers: [AvailabilityRulesController, CourtAvailabilityRulesController],
  providers: [AvailabilityRulesService, ...availabilityRuleProvider],
  exports: [AvailabilityRulesService, ...availabilityRuleProvider],
})
export class AvailabilityRulesModule {}
