import { BUSINESS_REPOSITORY } from '../database/constants/repositories.constants';
import { Business } from './entities/business.model';

export const businessProvider = [
  {
    provide: BUSINESS_REPOSITORY,
    useValue: Business,
  },
];
