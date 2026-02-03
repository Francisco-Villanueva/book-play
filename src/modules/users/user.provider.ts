import { USER_REPOSITORY } from '../database/constants/repositories.constants';
import { User } from './entities/user.model';

export const userProvider = [
  {
    provide: USER_REPOSITORY,
    useValue: User,
  },
];
