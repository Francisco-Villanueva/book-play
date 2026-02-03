import { Module } from '@nestjs/common';
import { courtProvider } from './court.provider';

@Module({
  providers: [...courtProvider],
  exports: [...courtProvider],
})
export class CourtsModule {}
