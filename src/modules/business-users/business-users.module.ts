import { Module } from '@nestjs/common';
import { businessUserProvider } from './business-user.provider';

@Module({
  providers: [...businessUserProvider],
  exports: [...businessUserProvider],
})
export class BusinessUsersModule {}
