import { SequelizeModuleOptions } from '@nestjs/sequelize';

export const databaseConfig = (): SequelizeModuleOptions => ({
  dialect: 'postgres',
  uri: process.env.DATABASE_URL,
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false,
    },
  },
  autoLoadModels: true,
  synchronize: true,
  sync: { alter: true },
  logging: false,
});
