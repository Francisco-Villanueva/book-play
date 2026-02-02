import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SequelizeModule } from '@nestjs/sequelize';
import { databaseConfig } from './config/database.config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { BusinessesModule } from './modules/businesses/businesses.module';
import { CourtsModule } from './modules/courts/courts.module';
import { BookingsModule } from './modules/bookings/bookings.module';
import { AvailabilityRulesModule } from './modules/availability-rules/availability-rules.module';
import { ExceptionRulesModule } from './modules/exception-rules/exception-rules.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    SequelizeModule.forRoot(databaseConfig()),
    AuthModule,
    UsersModule,
    BusinessesModule,
    CourtsModule,
    BookingsModule,
    AvailabilityRulesModule,
    ExceptionRulesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
