import { Module } from '@nestjs/common';
import { exceptionRuleProvider } from './exception-rule.provider';
import { ExceptionRulesController } from './exception-rules.controller';
import { ExceptionRulesService } from './exception-rules.service';
import { ExceptionImpactService } from './exception-impact.service';
import { BusinessUsersModule } from '../business-users/business-users.module';
import { DatabaseModule } from '../database/database.module';
import { CourtsModule } from '../courts/courts.module';
import { BusinessesModule } from '../businesses/businesses.module';
import { MailModule } from '../mail/mail.module';
import { bookingProvider } from '../bookings/booking.provider';

@Module({
  imports: [
    BusinessUsersModule,
    DatabaseModule,
    CourtsModule,
    BusinessesModule,
    MailModule,
  ],
  controllers: [ExceptionRulesController],
  providers: [
    ExceptionRulesService,
    ExceptionImpactService,
    ...exceptionRuleProvider,
    // El repositorio suelto, no BookingsModule: ése ya importa a éste y cerraría
    // el ciclo de dependencias.
    ...bookingProvider,
  ],
  exports: [ExceptionRulesService, ...exceptionRuleProvider],
})
export class ExceptionRulesModule {}
