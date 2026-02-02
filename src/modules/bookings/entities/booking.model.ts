import {
  BelongsTo,
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
  courtId: string;

  @ForeignKey(() => Business)
  @Column({ type: DataType.UUID, allowNull: false, field: 'business_id' })
  businessId: string;

  @ForeignKey(() => User)
  @Column({ type: DataType.UUID, field: 'user_id' })
  userId: string;

  @Column({ type: DataType.STRING, field: 'guest_name' })
  guestName: string;

  @Column({ type: DataType.STRING, field: 'guest_phone' })
  guestPhone: string;

  @Column({ type: DataType.STRING, field: 'guest_email' })
  guestEmail: string;

  @Column({ type: DataType.DATEONLY, allowNull: false })
  date: string;

  @Column({ type: DataType.TIME, allowNull: false, field: 'start_time' })
  startTime: string;

  @Column({ type: DataType.TIME, allowNull: false, field: 'end_time' })
  endTime: string;

  @Default(BookingStatus.ACTIVE)
  @Column({
    type: DataType.ENUM(...Object.values(BookingStatus)),
    allowNull: false,
  })
  status: BookingStatus;

  @Column({ type: DataType.DECIMAL(10, 2), field: 'total_price' })
  totalPrice: number;

  @Column(DataType.TEXT)
  notes: string;

  @Column({ type: DataType.DATE, field: 'cancelled_at' })
  cancelledAt: Date;

  @BelongsTo(() => Court)
  court: Court;

  @BelongsTo(() => Business)
  business: Business;

  @BelongsTo(() => User)
  user: User;
}
