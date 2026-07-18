import {
  Column,
  DataType,
  Default,
  ForeignKey,
  Model,
  PrimaryKey,
  Table,
} from 'sequelize-typescript';
import { User } from '../../users/entities/user.model';

@Table({
  tableName: 'password_reset_tokens',
  underscored: true,
  indexes: [{ fields: ['token_hash'] }, { fields: ['user_id'] }],
})
export class PasswordResetToken extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  declare id: string;

  @ForeignKey(() => User)
  @Column({ type: DataType.UUID, allowNull: false, field: 'user_id' })
  declare userId: string;

  // Sólo se guarda el hash SHA-256 del token; el token plano viaja en el link del email.
  @Column({ type: DataType.STRING, allowNull: false, field: 'token_hash' })
  declare tokenHash: string;

  @Column({ type: DataType.DATE, allowNull: false, field: 'expires_at' })
  declare expiresAt: Date;

  @Column({ type: DataType.DATE, field: 'used_at' })
  declare usedAt: Date | null;
}
