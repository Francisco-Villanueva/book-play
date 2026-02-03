import { Module } from '@nestjs/common';
import { exceptionRuleProvider } from './exception-rule.provider';

@Module({
  providers: [...exceptionRuleProvider],
  exports: [...exceptionRuleProvider],
})
export class ExceptionRulesModule {}
