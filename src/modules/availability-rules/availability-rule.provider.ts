import {
  AVAILABILITY_RULE_REPOSITORY,
  COURT_AVAILABILITY_REPOSITORY,
} from '../database/constants/repositories.constants';
import { AvailabilityRule } from './entities/availability-rule.model';
import { CourtAvailability } from './entities/court-availability.model';

export const availabilityRuleProvider = [
  {
    provide: AVAILABILITY_RULE_REPOSITORY,
    useValue: AvailabilityRule,
  },
  {
    provide: COURT_AVAILABILITY_REPOSITORY,
    useValue: CourtAvailability,
  },
];
