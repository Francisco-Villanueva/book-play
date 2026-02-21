import { Module } from '@nestjs/common';
import { exceptionRuleProvider } from './exception-rule.provider';
import { ExceptionRulesController } from './exception-rules.controller';
import { ExceptionRulesService } from './exception-rules.service';
import { BusinessUsersModule } from '../business-users/business-users.module';
import { DatabaseModule } from '../database/database.module';
import { CourtsModule } from '../courts/courts.module';

@Module({
  imports: [BusinessUsersModule, DatabaseModule, CourtsModule],
  controllers: [ExceptionRulesController],
  providers: [ExceptionRulesService, ...exceptionRuleProvider],
  exports: [ExceptionRulesService, ...exceptionRuleProvider],
})
export class ExceptionRulesModule {}
