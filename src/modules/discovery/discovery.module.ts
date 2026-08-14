import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { DiscoveryController } from './discovery.controller';
import { DiscoveryService } from './discovery.service';
import { DiscoveryRepository } from './discovery.repository';
import { businessProvider } from '../businesses/business.provider';
import { courtProvider } from '../courts/court.provider';
import { bookingProvider } from '../bookings/booking.provider';
import { availabilityRuleProvider } from '../availability-rules/availability-rule.provider';
import { exceptionRuleProvider } from '../exception-rules/exception-rule.provider';
import { subscriptionProvider } from '../subscriptions/subscription.provider';

// Se hace spread de los repositorios sueltos en vez de importar los feature
// modules: traer BookingsModule arrastraría MailModule, NotificationsModule y
// UsersModule a un camino público de sólo lectura. Es el mismo criterio que usa
// ExceptionRulesModule con bookingProvider.
//
// Tampoco se inyecta BookingsService: discovery habla con el calculador puro y
// con repositorios. Tenerlo a mano sería una invitación a reintroducir el
// abanico de una consulta por cancha que este módulo existe para evitar.
@Module({
  imports: [DatabaseModule],
  controllers: [DiscoveryController],
  providers: [
    DiscoveryService,
    DiscoveryRepository,
    ...businessProvider,
    ...courtProvider,
    ...bookingProvider,
    ...availabilityRuleProvider,
    ...exceptionRuleProvider,
    ...subscriptionProvider,
  ],
})
export class DiscoveryModule {}
