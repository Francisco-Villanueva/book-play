import { Module } from '@nestjs/common';
import { notificationProvider } from './notification.provider';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { BusinessUsersModule } from '../business-users/business-users.module';
import { DatabaseModule } from '../database/database.module';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [BusinessUsersModule, DatabaseModule, MailModule],
  controllers: [NotificationsController],
  providers: [NotificationsService, ...notificationProvider],
  exports: [NotificationsService, ...notificationProvider],
})
export class NotificationsModule {}
