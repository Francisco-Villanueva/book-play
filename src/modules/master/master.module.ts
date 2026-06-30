import { Module } from '@nestjs/common';
import { MasterService } from './master.service';
import { MasterController } from './master.controller';
import { DatabaseModule } from '../database/database.module';
import { BusinessesModule } from '../businesses/businesses.module';
import { BusinessUsersModule } from '../business-users/business-users.module';
import { userProvider } from '../users/user.provider';

@Module({
  imports: [DatabaseModule, BusinessesModule, BusinessUsersModule],
  controllers: [MasterController],
  providers: [MasterService, ...userProvider],
})
export class MasterModule {}
