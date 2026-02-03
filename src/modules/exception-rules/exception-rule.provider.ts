import {
  EXCEPTION_RULE_REPOSITORY,
  COURT_EXCEPTION_REPOSITORY,
} from '../database/constants/repositories.constants';
import { ExceptionRule } from './entities/exception-rule.model';
import { CourtException } from './entities/court-exception.model';

export const exceptionRuleProvider = [
  {
    provide: EXCEPTION_RULE_REPOSITORY,
    useValue: ExceptionRule,
  },
  {
    provide: COURT_EXCEPTION_REPOSITORY,
    useValue: CourtException,
  },
];
