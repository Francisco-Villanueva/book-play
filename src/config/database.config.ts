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
  sync: { force: true },
  logging: false,
  define: {
    timestamps: true,
    underscored: true, // Ya lo estás usando en tus modelos
  },
  query: {
    raw: false, // Esto asegura que se usen los getters de Sequelize
  },
});
