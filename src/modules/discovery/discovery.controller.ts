import { Controller, Get, Header, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { PUBLIC_DISCOVERY_THROTTLE } from '../../config/throttler.config';
import { DiscoveryService } from './discovery.service';
import { DiscoverQueryDto } from './dto/discover-query.dto';
import { DiscoverSlotsQueryDto } from './dto/discover-slots-query.dto';

// Todas públicas y sin guard: es la puerta de entrada de un jugador que todavía
// no tiene cuenta. `SubscriptionAccessGuard` no interviene (son GET, y además
// se apoya en params.businessId, que acá no existe), así que excluir a los
// complejos en solo lectura es responsabilidad explícita del service.
@ApiTags('discovery')
@Controller('discovery')
export class DiscoveryController {
  constructor(private readonly discoveryService: DiscoveryService) {}

  @Get('cities')
  @Throttle(PUBLIC_DISCOVERY_THROTTLE)
  // El padrón de ciudades cambia cuando se da de alta un complejo: minutos de
  // staleness no le hacen daño a nadie.
  @Header('Cache-Control', 'public, max-age=300')
  @ApiOperation({
    summary: 'Ciudades con complejos reservables (sin auth)',
  })
  @ApiResponse({ status: 200, description: 'Ciudades con su cantidad' })
  async cities() {
    return { cities: await this.discoveryService.listCities() };
  }

  @Get('complejos')
  @Throttle(PUBLIC_DISCOVERY_THROTTLE)
  // Media hora sería mentirle al jugador sobre la disponibilidad; 30 segundos
  // absorbe la ráfaga del buscador. Es seguro porque esto no es el camino de la
  // reserva: `bookings.create()` revalida y falla limpio si el turno se tomó.
  @Header('Cache-Control', 'public, max-age=30')
  @ApiOperation({
    summary: 'Complejos de una ciudad con su próximo turno libre (sin auth)',
  })
  @ApiResponse({ status: 200, description: 'Complejos paginados' })
  async complejos(@Query() query: DiscoverQueryDto) {
    return this.discoveryService.listComplejos(query);
  }

  @Get('slots')
  @Throttle(PUBLIC_DISCOVERY_THROTTLE)
  @Header('Cache-Control', 'public, max-age=30')
  @ApiOperation({
    summary: 'Próximos turnos libres de toda la ciudad (sin auth)',
  })
  @ApiResponse({ status: 200, description: 'Turnos ordenados por cercanía' })
  async slots(@Query() query: DiscoverSlotsQueryDto) {
    return this.discoveryService.listSlots(query);
  }
}
