import {
  Column,
  DataType,
  Default,
  Model,
  PrimaryKey,
  Table,
  Unique,
} from 'sequelize-typescript';
import { GlobalRole } from '../../../common/enums';
import { Booking } from '../../bookings/entities/booking.model';

@Table({ tableName: 'users' })
export class User extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  declare id: string;

  @Column({ type: DataType.STRING, allowNull: false })
  declare name: string;

  @Unique
  @Column({ type: DataType.STRING, allowNull: false })
  declare userName: string;

  @Unique
  @Column({ type: DataType.STRING, allowNull: false })
  declare email: string;

  @Column({ type: DataType.STRING, allowNull: false })
  declare password: string;

  @Column(DataType.STRING)
  declare phone: string;

  @Default(GlobalRole.PLAYER)
  @Column({
    type: DataType.ENUM(...Object.values(GlobalRole)),
    allowNull: false,
    field: 'global_role',
  })
  declare globalRole: GlobalRole;

  declare bookings: Booking[];

  toJSON({ includePassword = false }: { includePassword?: boolean } = {}) {
    const values = { ...this.get() };
    if (!includePassword) {
      delete values.password;
    }
    return values;
  }
}
