import {
  Column,
  DataType,
  Default,
  ForeignKey,
  Model,
  PrimaryKey,
  Table,
} from 'sequelize-typescript';
import { BusinessRole } from '../../../common/enums';
import { User } from '../../users/entities/user.model';
import { Business } from '../../businesses/entities/business.model';

@Table({
  tableName: 'business_users',
  underscored: true,
  indexes: [
    { unique: true, fields: ['business_id', 'user_id'] },
    { fields: ['user_id'] },
    { fields: ['business_id'] },
  ],
})
export class BusinessUser extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  declare id: string;

  @ForeignKey(() => Business)
  @Column({ type: DataType.UUID, allowNull: false, field: 'business_id' })
  declare businessId: string;

  @ForeignKey(() => User)
  @Column({ type: DataType.UUID, allowNull: false, field: 'user_id' })
  declare userId: string;

  @Column({
    type: DataType.ENUM(...Object.values(BusinessRole)),
    allowNull: false,
  })
  declare role: BusinessRole;

  declare user: User;
  declare business: Business;
}
