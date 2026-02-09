import { Module } from '@nestjs/common';
import { courtProvider } from './court.provider';
import { DatabaseModule } from '../database/database.module';
import { CourtsController } from './courts.controller';
import { CourtsService } from './courts.service';
import { BusinessUsersModule } from '../business-users/business-users.module';

@Module({
  imports: [BusinessUsersModule, DatabaseModule],
  controllers: [CourtsController],
  providers: [CourtsService, ...courtProvider],
  exports: [CourtsService, ...courtProvider],
})
export class CourtsModule {}
