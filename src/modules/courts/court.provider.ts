import { COURT_REPOSITORY } from '../database/constants/repositories.constants';
import { Court } from './entities/court.model';

export const courtProvider = [
  {
    provide: COURT_REPOSITORY,
    useValue: Court,
  },
];
