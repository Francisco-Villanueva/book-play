import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { ExceptionRule } from './entities/exception-rule.model';
import { CourtException } from './entities/court-exception.model';

@Module({
  imports: [SequelizeModule.forFeature([ExceptionRule, CourtException])],
  exports: [SequelizeModule],
})
export class ExceptionRulesModule {}
