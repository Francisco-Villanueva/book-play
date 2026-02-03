import {
  Column,
  DataType,
  Default,
  ForeignKey,
  Model,
  PrimaryKey,
  Table,
} from 'sequelize-typescript';
import { BookingStatus } from '../../../common/enums';
import { Court } from '../../courts/entities/court.model';
import { Business } from '../../businesses/entities/business.model';
import { User } from '../../users/entities/user.model';

@Table({
  tableName: 'bookings',
  underscored: true,
  indexes: [
    { fields: ['court_id', 'date', 'status'] },
    { fields: ['business_id'] },
    { fields: ['user_id'] },
    {
      unique: true,
      fields: ['court_id', 'date', 'start_time'],
      where: { status: 'ACTIVE' },
    },
  ],
})
export class Booking extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  declare id: string;

  @ForeignKey(() => Court)
  @Column({ type: DataType.UUID, allowNull: false, field: 'court_id' })
  declare courtId: string;

  @ForeignKey(() => Business)
  @Column({ type: DataType.UUID, allowNull: false, field: 'business_id' })
  declare businessId: string;

  @ForeignKey(() => User)
  @Column({ type: DataType.UUID, field: 'user_id' })
  declare userId: string;

  @Column({ type: DataType.STRING, field: 'guest_name' })
  declare guestName: string;

  @Column({ type: DataType.STRING, field: 'guest_phone' })
  declare guestPhone: string;

  @Column({ type: DataType.STRING, field: 'guest_email' })
  declare guestEmail: string;

  @Column({ type: DataType.DATEONLY, allowNull: false })
  declare date: string;

  @Column({ type: DataType.TIME, allowNull: false, field: 'start_time' })
  declare startTime: string;

  @Column({ type: DataType.TIME, allowNull: false, field: 'end_time' })
  declare endTime: string;

  @Default(BookingStatus.ACTIVE)
  @Column({
    type: DataType.ENUM(...Object.values(BookingStatus)),
    allowNull: false,
  })
  declare status: BookingStatus;

  @Column({ type: DataType.DECIMAL(10, 2), field: 'total_price' })
  declare totalPrice: number;

  @Column(DataType.TEXT)
  declare notes: string;

  @Column({ type: DataType.DATE, field: 'cancelled_at' })
  declare cancelledAt: Date;

  declare court: Court;
  declare business: Business;
  declare user: User;
}
