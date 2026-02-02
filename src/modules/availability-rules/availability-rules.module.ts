import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { AvailabilityRule } from './entities/availability-rule.model';
import { CourtAvailability } from './entities/court-availability.model';

@Module({
  imports: [SequelizeModule.forFeature([AvailabilityRule, CourtAvailability])],
  exports: [SequelizeModule],
})
export class AvailabilityRulesModule {}
