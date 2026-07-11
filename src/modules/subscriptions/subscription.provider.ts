import {
  SUBSCRIPTION_REPOSITORY,
  BUSINESS_FEATURE_REPOSITORY,
  PAYMENT_REPOSITORY,
} from '../database/constants/repositories.constants';
import { Subscription } from './entities/subscription.model';
import { BusinessFeature } from './entities/business-feature.model';
import { Payment } from './entities/payment.model';

export const subscriptionProvider = [
  {
    provide: SUBSCRIPTION_REPOSITORY,
    useValue: Subscription,
  },
];

export const businessFeatureProvider = [
  {
    provide: BUSINESS_FEATURE_REPOSITORY,
    useValue: BusinessFeature,
  },
];

export const paymentProvider = [
  {
    provide: PAYMENT_REPOSITORY,
    useValue: Payment,
  },
];
