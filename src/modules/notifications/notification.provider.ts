import { NOTIFICATION_REPOSITORY } from '../database/constants/repositories.constants';
import { Notification } from './entities/notification.model';

export const notificationProvider = [
  {
    provide: NOTIFICATION_REPOSITORY,
    useValue: Notification,
  },
];
