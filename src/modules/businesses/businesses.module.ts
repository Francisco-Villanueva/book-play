import { Module } from '@nestjs/common';
import { businessProvider } from './business.provider';

@Module({
  providers: [...businessProvider],
  exports: [...businessProvider],
})
export class BusinessesModule {}
