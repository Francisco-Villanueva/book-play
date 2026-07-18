import { BUSINESS_INVITATION_REPOSITORY } from '../database/constants/repositories.constants';
import { BusinessInvitation } from './entities/business-invitation.model';

export const businessInvitationProvider = [
  {
    provide: BUSINESS_INVITATION_REPOSITORY,
    useValue: BusinessInvitation,
  },
];
