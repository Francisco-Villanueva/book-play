import {
  BelongsTo,
  Column,
  DataType,
  Default,
  ForeignKey,
  HasMany,
  Model,
  PrimaryKey,
  Table,
  Unique,
} from 'sequelize-typescript';
import { GlobalRole, BusinessRole } from '../../../common/enums';
import { Business } from '../../businesses/entities/business.model';
import { Booking } from '../../bookings/entities/booking.model';

@Table({ tableName: 'users', underscored: true })
export class User extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  declare id: string;

  @Column({ type: DataType.STRING, allowNull: false })
  name: string;

  @Unique
  @Column({ type: DataType.STRING, allowNull: false })
  userName: string;

  @Unique
  @Column({ type: DataType.STRING, allowNull: false })
  email: string;

  @Column({ type: DataType.STRING, allowNull: false })
  password: string;

  @Column(DataType.STRING)
  phone: string;

  @Default(GlobalRole.PLAYER)
  @Column({
    type: DataType.ENUM(...Object.values(GlobalRole)),
    allowNull: false,
    field: 'global_role',
  })
  globalRole: GlobalRole;

  @ForeignKey(() => Business)
  @Column({ type: DataType.UUID, allowNull: true, field: 'business_id' })
  businessId: string;

  @Column({
    type: DataType.ENUM(...Object.values(BusinessRole)),
    allowNull: true,
    field: 'business_role',
  })
  businessRole: BusinessRole;

  @BelongsTo(() => Business)
  business: Business;

  @HasMany(() => Booking)
  bookings: Booking[];

  toJSON() {
    const values = { ...this.get() };
    delete values.password;
    return values;
  }
}
