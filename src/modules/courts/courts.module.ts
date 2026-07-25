import { Module } from '@nestjs/common';
import { courtProvider } from './court.provider';
import { DatabaseModule } from '../database/database.module';
import { CourtsController } from './courts.controller';
import { CourtsService } from './courts.service';
import { BusinessUsersModule } from '../business-users/business-users.module';
import { BusinessesModule } from '../businesses/businesses.module';

@Module({
  imports: [BusinessUsersModule, DatabaseModule, BusinessesModule],
  controllers: [CourtsController],
  providers: [CourtsService, ...courtProvider],
  exports: [CourtsService, ...courtProvider],
})
export class CourtsModule {}
