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
import { Business } from '../../businesses/entities/business.model';
import { User } from '../../users/entities/user.model';

@Table({
  tableName: 'business_invitations',
  underscored: true,
  indexes: [
    { fields: ['token_hash'] },
    { fields: ['business_id'] },
    { fields: ['email'] },
  ],
})
export class BusinessInvitation extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  declare id: string;

  @ForeignKey(() => Business)
  @Column({ type: DataType.UUID, allowNull: false, field: 'business_id' })
  declare businessId: string;

  @Column({ type: DataType.STRING, allowNull: false })
  declare email: string;

  @Column({
    type: DataType.ENUM(...Object.values(BusinessRole)),
    allowNull: false,
  })
  declare role: BusinessRole;

  // Sólo el hash SHA-256; el token plano viaja en el link del email.
  @Column({ type: DataType.STRING, allowNull: false, field: 'token_hash' })
  declare tokenHash: string;

  @Column({ type: DataType.DATE, allowNull: false, field: 'expires_at' })
  declare expiresAt: Date;

  @Column({ type: DataType.DATE, field: 'accepted_at' })
  declare acceptedAt: Date | null;

  @ForeignKey(() => User)
  @Column({ type: DataType.UUID, field: 'invited_by_user_id' })
  declare invitedByUserId: string | null;
}
