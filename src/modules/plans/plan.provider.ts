import { PLAN_REPOSITORY } from '../database/constants/repositories.constants';
import { Plan } from './entities/plan.model';

export const planProvider = [
  {
    provide: PLAN_REPOSITORY,
    useValue: Plan,
  },
];
