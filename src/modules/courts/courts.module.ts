import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { Court } from './entities/court.model';

@Module({
  imports: [SequelizeModule.forFeature([Court])],
  exports: [SequelizeModule],
})
export class CourtsModule {}
