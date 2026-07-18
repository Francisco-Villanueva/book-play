import { Module } from '@nestjs/common';
import { businessUserProvider } from './business-user.provider';
import { businessInvitationProvider } from './business-invitation.provider';
import { businessProvider } from '../businesses/business.provider';
import { BusinessUsersService } from './business-users.service';
import { BusinessUsersController } from './business-users.controller';
import { InvitationsController } from './invitations.controller';
import { DatabaseModule } from '../database/database.module';
import { UsersModule } from '../users/users.module';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [DatabaseModule, UsersModule, MailModule],
  controllers: [BusinessUsersController, InvitationsController],
  providers: [
    BusinessUsersService,
    ...businessUserProvider,
    ...businessInvitationProvider,
    ...businessProvider,
  ],
  exports: [BusinessUsersService, ...businessUserProvider],
})
export class BusinessUsersModule {}
