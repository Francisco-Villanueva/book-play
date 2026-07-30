import {
  Column,
  DataType,
  Default,
  ForeignKey,
  Model,
  PrimaryKey,
  Table,
} from 'sequelize-typescript';
import { NotificationType } from '../../../common/enums';
import { Business } from '../../businesses/entities/business.model';

// Notificación del panel del complejo. Es por negocio, no por usuario: la ve
// todo el equipo con acceso y se marca como leída para todos. Un estado de
// lectura por persona duplicaría filas por cada empleado sin aportar nada al
// caso real (un mostrador donde el primero que la ve la resuelve).
@Table({
  tableName: 'notifications',
  underscored: true,
  indexes: [
    { fields: ['business_id', 'read_at'] },
    { fields: ['business_id', 'created_at'] },
  ],
})
export class Notification extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  declare id: string;

  @ForeignKey(() => Business)
  @Column({ type: DataType.UUID, allowNull: false, field: 'business_id' })
  declare businessId: string;

  @Column({
    type: DataType.ENUM(...Object.values(NotificationType)),
    allowNull: false,
  })
  declare type: NotificationType;

  @Column({ type: DataType.STRING, allowNull: false })
  declare title: string;

  @Column({ type: DataType.TEXT, allowNull: false })
  declare body: string;

  // Sin FK: si la reserva se borra alguna vez, la notificación sigue siendo un
  // hecho histórico válido. El front la usa para linkear al detalle.
  @Column({ type: DataType.UUID, field: 'booking_id' })
  declare bookingId: string | null;

  @Column({ type: DataType.DATE, field: 'read_at' })
  declare readAt: Date | null;

  declare business: Business;
}
