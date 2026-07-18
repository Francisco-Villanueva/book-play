import { Sequelize } from 'sequelize-typescript';
import { User } from '../users/entities/user.model';
import { Business } from '../businesses/entities/business.model';
import { BusinessUser } from '../business-users/entities/business-user.model';
import { Court } from '../courts/entities/court.model';
import { Booking } from '../bookings/entities/booking.model';
import { AvailabilityRule } from '../availability-rules/entities/availability-rule.model';
import { CourtAvailability } from '../availability-rules/entities/court-availability.model';
import { ExceptionRule } from '../exception-rules/entities/exception-rule.model';
import { CourtException } from '../exception-rules/entities/court-exception.model';
import { Plan } from '../plans/entities/plan.model';
import { Subscription } from '../subscriptions/entities/subscription.model';
import { BusinessFeature } from '../subscriptions/entities/business-feature.model';
import { Payment } from '../subscriptions/entities/payment.model';
import { PasswordResetToken } from '../auth/entities/password-reset-token.model';
import { BusinessInvitation } from '../business-users/entities/business-invitation.model';

function defineAssociations() {
  // User
  User.hasMany(BusinessUser, { foreignKey: 'userId', as: 'businessUsers' });
  User.hasMany(Booking, { foreignKey: 'userId', as: 'bookings' });

  // Business
  Business.hasMany(BusinessUser, {
    foreignKey: 'businessId',
    as: 'businessUsers',
  });
  Business.hasMany(Court, { foreignKey: 'businessId', as: 'courts' });
  Business.hasMany(AvailabilityRule, {
    foreignKey: 'businessId',
    as: 'availabilityRules',
  });
  Business.hasMany(ExceptionRule, {
    foreignKey: 'businessId',
    as: 'exceptionRules',
  });
  Business.hasMany(Booking, { foreignKey: 'businessId', as: 'bookings' });

  // BusinessUser
  BusinessUser.belongsTo(User, { foreignKey: 'userId', as: 'user' });
  BusinessUser.belongsTo(Business, {
    foreignKey: 'businessId',
    as: 'business',
  });

  // Court
  Court.belongsTo(Business, { foreignKey: 'businessId', as: 'business' });
  Court.hasMany(Booking, { foreignKey: 'courtId', as: 'bookings' });
  Court.belongsToMany(AvailabilityRule, {
    through: CourtAvailability,
    foreignKey: 'courtId',
    otherKey: 'availabilityRuleId',
    as: 'availabilityRules',
  });
  Court.belongsToMany(ExceptionRule, {
    through: CourtException,
    foreignKey: 'courtId',
    otherKey: 'exceptionRuleId',
    as: 'exceptionRules',
  });

  // Booking
  Booking.belongsTo(Court, { foreignKey: 'courtId', as: 'court' });
  Booking.belongsTo(Business, { foreignKey: 'businessId', as: 'business' });
  Booking.belongsTo(User, { foreignKey: 'userId', as: 'user' });

  // AvailabilityRule
  AvailabilityRule.belongsTo(Business, {
    foreignKey: 'businessId',
    as: 'business',
  });
  AvailabilityRule.belongsToMany(Court, {
    through: CourtAvailability,
    foreignKey: 'availabilityRuleId',
    otherKey: 'courtId',
    as: 'courts',
  });

  // ExceptionRule
  ExceptionRule.belongsTo(Business, {
    foreignKey: 'businessId',
    as: 'business',
  });
  ExceptionRule.belongsToMany(Court, {
    through: CourtException,
    foreignKey: 'exceptionRuleId',
    otherKey: 'courtId',
    as: 'courts',
  });

  // Subscription / Plan / BusinessFeature / Payment
  Business.hasOne(Subscription, {
    foreignKey: 'businessId',
    as: 'subscription',
  });
  Subscription.belongsTo(Business, {
    foreignKey: 'businessId',
    as: 'business',
  });
  Plan.hasMany(Subscription, { foreignKey: 'planId', as: 'subscriptions' });
  Subscription.belongsTo(Plan, { foreignKey: 'planId', as: 'plan' });
  Subscription.hasMany(Payment, {
    foreignKey: 'subscriptionId',
    as: 'payments',
  });
  Payment.belongsTo(Subscription, {
    foreignKey: 'subscriptionId',
    as: 'subscription',
  });
  Business.hasMany(Payment, { foreignKey: 'businessId', as: 'payments' });
  Payment.belongsTo(Business, { foreignKey: 'businessId', as: 'business' });
  Plan.hasMany(Payment, { foreignKey: 'planId', as: 'payments' });
  Payment.belongsTo(Plan, { foreignKey: 'planId', as: 'plan' });
  Business.hasMany(BusinessFeature, {
    foreignKey: 'businessId',
    as: 'features',
  });
  BusinessFeature.belongsTo(Business, {
    foreignKey: 'businessId',
    as: 'business',
  });

  // Password reset
  User.hasMany(PasswordResetToken, {
    foreignKey: 'userId',
    as: 'passwordResetTokens',
  });
  PasswordResetToken.belongsTo(User, { foreignKey: 'userId', as: 'user' });

  // Business invitations
  Business.hasMany(BusinessInvitation, {
    foreignKey: 'businessId',
    as: 'invitations',
  });
  BusinessInvitation.belongsTo(Business, {
    foreignKey: 'businessId',
    as: 'business',
  });
  BusinessInvitation.belongsTo(User, {
    foreignKey: 'invitedByUserId',
    as: 'invitedBy',
  });
}

export const databaseProviders = [
  {
    provide: 'SEQUELIZE',
    useFactory: async () => {
      const url = process.env.DATABASE_URL;
      const sequelize = new Sequelize(url, {
        dialect: 'postgres',
        logging: false,
      });

      sequelize.addModels([
        User,
        Business,
        BusinessUser,
        Court,
        Booking,
        AvailabilityRule,
        CourtAvailability,
        ExceptionRule,
        CourtException,
        Plan,
        Subscription,
        BusinessFeature,
        Payment,
        PasswordResetToken,
        BusinessInvitation,
      ]);

      defineAssociations();

      await sequelize.sync({ alter: true });
      return sequelize;
    },
  },
];
