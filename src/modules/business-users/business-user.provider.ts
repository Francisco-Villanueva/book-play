import { BUSINESS_USER_REPOSITORY } from '../database/constants/repositories.constants';
import { BusinessUser } from './entities/business-user.model';

export const businessUserProvider = [
  {
    provide: BUSINESS_USER_REPOSITORY,
    useValue: BusinessUser,
  },
];
