import { Module } from '@nestjs/common';
import { businessUserProvider } from './business-user.provider';
import { BusinessUsersService } from './business-users.service';
import { BusinessUsersController } from './business-users.controller';
import { DatabaseModule } from '../database/database.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [DatabaseModule, UsersModule],
  controllers: [BusinessUsersController],
  providers: [BusinessUsersService, ...businessUserProvider],
  exports: [BusinessUsersService, ...businessUserProvider],
})
export class BusinessUsersModule {}
