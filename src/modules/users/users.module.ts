import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { userProvider } from './user.provider';

@Module({
  controllers: [UsersController],
  providers: [UsersService, ...userProvider],
  exports: [UsersService],
})
export class UsersModule {}
