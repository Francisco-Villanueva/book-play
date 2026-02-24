# Guia de Configuracion de Base de Datos con Sequelize + NestJS

Esta guia documenta el patron de configuracion de base de datos utilizado en este proyecto. Puede servir como referencia para configurar nuevos proyectos con la misma arquitectura.

Aclaracion: Este documento muestra algunas Tablas como EJEMPLO o casos de uso. No están directmante relacionadas al proyecto de Book And Play API.

## Stack Tecnologico

- **ORM:** Sequelize con TypeScript (`sequelize-typescript`)
- **Framework:** NestJS
- **Base de datos:** PostgreSQL
- **Patron:** Repository Pattern simplificado con Dependency Injection

### Dependencias necesarias

```bash
pnpm install sequelize sequelize-typescript pg @nestjs/sequelize
pnpm install -D @types/sequelize
```

---

## 1. Configuracion de la Conexion

### 1.1 Estructura de archivos

```
src/
└── modules/
    └── database/
        ├── database.module.ts
        └── database.provider.ts
```

### 1.2 Variables de entorno

```env
# .env
DATABASE_URL=postgres://usuario:password@host:puerto/nombre_db
```

### 1.3 Provider de base de datos

El provider es el unico punto de configuracion de la conexion. Lee `DATABASE_URL` directamente del entorno, registra todos los modelos, define las asociaciones y ejecuta la sincronizacion del schema.

```typescript
// src/modules/database/database.provider.ts
import { Sequelize } from 'sequelize-typescript';
import { User } from '../users/entities/user.model';
// ... importar todos los modelos

function defineAssociations() {
  // Definir relaciones entre modelos aqui
  User.hasMany(/* ... */);
  // ...
}

export const databaseProviders = [
  {
    provide: 'SEQUELIZE',
    useFactory: async () => {
      const sequelize = new Sequelize(process.env.DATABASE_URL, {
        dialect: 'postgres',
        logging: false,
      });

      sequelize.addModels([
        User,
        // ... todos los modelos
      ]);

      defineAssociations();

      // alter: true modifica el schema sin perder datos existentes
      await sequelize.sync({ alter: true });

      return sequelize;
    },
  },
];
```

### 1.4 Modulo de base de datos

```typescript
// src/core/database/database.module.ts
import { Module } from '@nestjs/common';
import { databaseProviders } from './database.provider';

@Module({
  providers: [...databaseProviders],
  exports: [...databaseProviders],
})
export class DatabaseModule {}
```

---

## 2. Definicion de Modelos (Tablas)

### 2.1 Modelo base

Es recomendable crear un modelo base del cual hereden todos los demas. Esto garantiza campos comunes como `id`, timestamps, o campos de tenant para multi-tenancy.

```typescript
// src/core/database/schema/base.model.ts
import {
  Table,
  Column,
  Model,
  PrimaryKey,
  DataType,
  BeforeCreate,
} from 'sequelize-typescript';
import { v4 as uuidv4 } from 'uuid';

@Table
export class BaseModel<T> extends Model<T> {
  @PrimaryKey
  @Column({
    type: DataType.UUID,
  })
  id: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  tenantName?: string;

  @BeforeCreate
  static generateId(instance: BaseModel<any>) {
    if (!instance.id) {
      instance.id = uuidv4();
    }
  }
}
```

### 2.2 Definicion de un modelo

```typescript
// src/user/schema/user.model.ts
import { Table, Column, DataType } from 'sequelize-typescript';
import { BaseModel } from '../../core/database/schema/base.model';

@Table
export class User extends BaseModel<User> {
  @Column
  name: string;

  @Column
  email: string;

  @Column({
    type: DataType.ENUM('ADMIN', 'USER', 'GUEST'),
    allowNull: true,
  })
  role: string;

  @Column({
    type: DataType.BOOLEAN,
    defaultValue: true,
  })
  isActive: boolean;

  @Column({
    type: DataType.ARRAY(DataType.JSON),
    defaultValue: [],
  })
  metadata: object[];

  @Column({
    type: DataType.UUID,
  })
  CompanyId: string;
}
```

### 2.3 Tipos de datos comunes

```typescript
// Strings
@Column
name: string

@Column({ type: DataType.TEXT })
description: string

// Numeros
@Column({ type: DataType.INTEGER })
count: number

@Column({ type: DataType.FLOAT })
price: number

// Booleanos
@Column({ type: DataType.BOOLEAN, defaultValue: false })
isActive: boolean

// Fechas
@Column({ type: DataType.DATE })
createdAt: Date

@Column({ type: DataType.DATEONLY })
birthDate: string

// Enums
@Column({
  type: DataType.ENUM('PENDING', 'ACTIVE', 'INACTIVE'),
  defaultValue: 'PENDING',
})
status: string

// Arrays
@Column({ type: DataType.ARRAY(DataType.STRING) })
tags: string[]

@Column({ type: DataType.ARRAY(DataType.JSON) })
items: object[]

// JSON
@Column({ type: DataType.JSON })
settings: object

// UUID (para foreign keys)
@Column({ type: DataType.UUID })
ParentId: string
```

### 2.4 Modelo con timestamps automaticos

```typescript
@Table({ timestamps: true })
export class Product extends BaseModel<Product> {
  // createdAt y updatedAt se agregan automaticamente
}
```

---

## 3. Patron Repository e Inyeccion de Dependencias

### 3.1 Constantes

```typescript
export const SEQUELIZE = 'SEQUELIZE';
export const DEVELOPMENT = 'development';
export const TEST = 'test';
export const PRODUCTION = 'production';

// Repositorios
export const USER_REPOSITORY = 'USER_REPOSITORY';
export const COMPANY_REPOSITORY = 'COMPANY_REPOSITORY';
export const PRODUCT_REPOSITORY = 'PRODUCT_REPOSITORY';
// ... agregar uno por cada modelo
```

### 3.2 Provider del modelo

```typescript
// src/modules/user/user.provider.ts
import { USER_REPOSITORY } from '../core/constants';
import { User } from './schema/user.model';

export const userProvider = [
  {
    provide: USER_REPOSITORY,
    useValue: User,
  },
];
```

### 3.3 Servicio con inyeccion

```typescript
// src/modules/user/user.service.ts
import { Inject, Injectable } from '@nestjs/common';
import { USER_REPOSITORY } from '../core/constants';
import { User } from './schema/user.model';

@Injectable()
export class UserService {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userModel: typeof User,
  ) {}

  // Metodos del servicio...
}
```

### 3.4 Modulo

```typescript
// src/modules/user/user.module.ts
import { Module } from '@nestjs/common';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { userProvider } from './user.provider';

@Module({
  controllers: [UserController],
  providers: [UserService, ...userProvider],
  exports: [UserService],
})
export class UserModule {}
```

---

## 4. Definicion de Relaciones

Las relaciones se definen en el `database.provider.ts` despues de registrar los modelos.

### 4.1 One-to-Many (Uno a muchos)

```typescript
// Una Company tiene muchos Users
Company.hasMany(User);
User.belongsTo(Company, { targetKey: 'id', foreignKey: 'CompanyId' });
```

### 4.2 One-to-One (Uno a uno)

```typescript
// Un User tiene un Profile
User.hasOne(Profile);
Profile.belongsTo(User, { targetKey: 'id', foreignKey: 'UserId' });
```

### 4.3 Many-to-Many (Muchos a muchos)

```typescript
// Users pueden tener muchos Services y viceversa
User.belongsToMany(Service, { through: 'UserService' });
Service.belongsToMany(User, { through: 'UserService' });
```

---

## 5. Consultas Comunes

### 5.1 CRUD Basico

```typescript
@Injectable()
export class UserService {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userModel: typeof User,
  ) {}

  // Obtener todos
  async findAll(): Promise<User[]> {
    return this.userModel.findAll();
  }

  // Obtener por ID
  async findById(id: string): Promise<User> {
    return this.userModel.findOne({ where: { id } });
  }

  // Crear
  async create(data: Partial<User>): Promise<User> {
    return this.userModel.create(data);
  }

  // Actualizar
  async update(id: string, data: Partial<User>) {
    return this.userModel.update(data, { where: { id } });
  }

  // Eliminar
  async delete(id: string) {
    return this.userModel.destroy({ where: { id } });
  }
}
```

### 5.2 Consultas con filtros

```typescript
import { Op } from 'sequelize'

// Buscar por campo especifico
async findByEmail(email: string): Promise<User> {
  return this.userModel.findOne({ where: { email } })
}

// Buscar con multiples condiciones
async findActiveAdmins(): Promise<User[]> {
  return this.userModel.findAll({
    where: {
      role: 'ADMIN',
      isActive: true,
    },
  })
}

// Busqueda con LIKE (case insensitive)
async search(query: string): Promise<User[]> {
  return this.userModel.findAll({
    where: {
      [Op.or]: [
        { name: { [Op.iLike]: `%${query}%` } },
        { email: { [Op.iLike]: `%${query}%` } },
      ],
    },
  })
}

// Busqueda generica por clave-valor
async findBy({ key, value }: { key: keyof User; value: any }): Promise<User> {
  return this.userModel.findOne({
    where: { [key]: value },
  })
}
```

### 5.3 Consultas con relaciones (include)

```typescript
// Incluir relaciones al consultar
async findWithCompany(id: string): Promise<User> {
  return this.userModel.findOne({
    where: { id },
    include: [Company],
  })
}

// Incluir multiples relaciones
async findWithDetails(id: string): Promise<User> {
  return this.userModel.findOne({
    where: { id },
    include: [Company, Service, Appointment],
  })
}

// Filtrar por relacion
async findByCompanyId(companyId: string): Promise<User[]> {
  return this.userModel.findAll({
    include: [
      {
        model: Company,
        where: { id: companyId },
      },
    ],
  })
}
```

### 5.4 Paginacion

```typescript
async findPaginated(
  page: number = 1,
  limit: number = 10,
  filters?: Partial<User>
): Promise<{ data: User[]; total: number; page: number; limit: number }> {
  const offset = (page - 1) * limit

  const [data, total] = await Promise.all([
    this.userModel.findAll({
      where: filters || {},
      limit,
      offset,
      order: [['createdAt', 'DESC']],
    }),
    this.userModel.count({
      where: filters || {},
    }),
  ])

  return { data, total, page, limit }
}
```

### 5.5 Operaciones Many-to-Many

```typescript
// Agregar relacion
async addServiceToUser(userId: string, serviceId: string): Promise<void> {
  const user = await this.userModel.findByPk(userId)
  const service = await Service.findByPk(serviceId)
  await user.$add('services', service)
}

// Remover relacion
async removeServiceFromUser(userId: string, serviceId: string): Promise<void> {
  const user = await this.userModel.findByPk(userId)
  const service = await Service.findByPk(serviceId)
  await user.$remove('services', service)
}

// Obtener relaciones
async getUserServices(userId: string): Promise<Service[]> {
  const user = await this.userModel.findByPk(userId)
  return user.$get('services')
}
```

### 5.6 Guardar cambios en instancia

```typescript
async updateStatus(id: string, newStatus: string): Promise<void> {
  const user = await this.userModel.findByPk(id)
  user.status = newStatus
  await user.save()
}
```

---

## 6. Estructura de Carpetas Recomendada

```
src/
├── modules/
│   ├── database/
│   │   ├── database.module.ts     ← registra y exporta el provider
│   │   └── database.provider.ts  ← conexion, modelos, asociaciones y sync
│   │
├── user/                          # Cada entidad en su propia carpeta
│   ├── user.module.ts
│   ├── user.controller.ts
│   ├── user.service.ts
│   ├── user.provider.ts
│   ├── dto/
│   │   ├── create-user.dto.ts
│   │   └── update-user.dto.ts
│   └── schema/
│       └── user.model.ts
│
├── company/
│   ├── company.module.ts
│   ├── company.controller.ts
│   ├── company.service.ts
│   ├── company.provider.ts
│   ├── dto/
│   └── schema/
│       └── company.model.ts
│
└── app.module.ts
```

---

## 7. Checklist para Nueva Entidad

1. [ ] Crear carpeta del modulo: `src/nombre-entidad/`
2. [ ] Crear modelo en `schema/nombre.model.ts` (heredando de BaseModel)
3. [ ] Agregar constante en `core/constants/index.ts`
4. [ ] Crear provider en `nombre.provider.ts`
5. [ ] Crear service en `nombre.service.ts`
6. [ ] Crear controller en `nombre.controller.ts`
7. [ ] Crear modulo en `nombre.module.ts`
8. [ ] Registrar modelo en `database.provider.ts` (addModels)
9. [ ] Definir relaciones en `database.provider.ts`
10. [ ] Importar modulo en `app.module.ts`

---

## 8. Tips y Buenas Practicas

### Sincronizacion de BD

La sincronizacion se realiza en `src/modules/database/database.provider.ts` al iniciar la aplicacion.

```typescript
// alter: true modifica columnas existentes sin perder datos
// Se ejecuta en todos los entornos actualmente
await sequelize.sync({ alter: true });

// NUNCA usar force: true en produccion — borra todas las tablas y datos
// await sequelize.sync({ force: true }); // ← PELIGROSO
```

### Validaciones en modelo

```typescript
@Column({
  type: DataType.STRING,
  allowNull: false,
  validate: {
    notEmpty: true,
    len: [2, 100],
  },
})
name: string

@Column({
  type: DataType.STRING,
  allowNull: false,
  unique: true,
  validate: {
    isEmail: true,
  },
})
email: string
```

### Hooks del modelo

```typescript
@Table
export class User extends BaseModel<User> {
  @BeforeCreate
  static async hashPassword(instance: User) {
    if (instance.password) {
      instance.password = await bcrypt.hash(instance.password, 10);
    }
  }

  @BeforeUpdate
  static async rehashPassword(instance: User) {
    if (instance.changed('password')) {
      instance.password = await bcrypt.hash(instance.password, 10);
    }
  }
}
```

### Transacciones

```typescript
import { Sequelize } from 'sequelize-typescript'

async createWithRelations(userData: any, companyData: any) {
  const transaction = await this.sequelize.transaction()

  try {
    const company = await this.companyModel.create(companyData, { transaction })
    const user = await this.userModel.create(
      { ...userData, CompanyId: company.id },
      { transaction }
    )

    await transaction.commit()
    return user
  } catch (error) {
    await transaction.rollback()
    throw error
  }
}
```

---

## Referencias

- [Sequelize TypeScript Docs](https://sequelize.org/docs/v6/other-topics/typescript/)
- [sequelize-typescript GitHub](https://github.com/sequelize/sequelize-typescript)
- [NestJS Sequelize Integration](https://docs.nestjs.com/techniques/database#sequelize-integration)
