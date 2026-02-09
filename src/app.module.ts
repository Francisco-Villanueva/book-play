import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { BusinessesModule } from './modules/businesses/businesses.module';
import { CourtsModule } from './modules/courts/courts.module';
import { BookingsModule } from './modules/bookings/bookings.module';
import { AvailabilityRulesModule } from './modules/availability-rules/availability-rules.module';
import { ExceptionRulesModule } from './modules/exception-rules/exception-rules.module';
import { BusinessUsersModule } from './modules/business-users/business-users.module';
import { DatabaseModule } from './modules/database/database.module';

@Module({
  imports: [
    DatabaseModule,
    ConfigModule.forRoot({ isGlobal: true }),
    AuthModule,
    UsersModule,
    BusinessesModule,
    BusinessUsersModule,
    CourtsModule,
    BookingsModule,
    AvailabilityRulesModule,
    ExceptionRulesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
