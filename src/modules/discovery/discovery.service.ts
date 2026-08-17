import { Injectable } from '@nestjs/common';
import { toSlug } from '../../common/utils/slug.util';
import { addDaysToISODate, todayLocalISO } from '../../common/utils/time.util';
import {
  courtsOf,
  describeComplejo,
  forEachOpenSlot,
  sortComplejos,
} from './discovery.mappers';
import { DiscoveryRepository } from './discovery.repository';
import {
  DEFAULT_DAYS,
  DEFAULT_PAGE_SIZE,
  DEFAULT_SLOTS,
} from './discovery.constants';
import { DiscoverQueryDto } from './dto/discover-query.dto';
import { DiscoverSlotsQueryDto } from './dto/discover-slots-query.dto';
import type {
  CityResult,
  DiscoveryComplejosResult,
  DiscoverySlot,
  DiscoverySlotsResult,
} from './discovery.types';

// La única lectura deliberadamente cross-tenant del sistema (BR-017 rige todo
// lo demás). Vive en su propio módulo para que esa excepción se audite en un
// solo lugar, en vez de quedar enterrada en un service con scope de complejo.
@Injectable()
export class DiscoveryService {
  constructor(private readonly repository: DiscoveryRepository) {}

  async listCities(): Promise<CityResult[]> {
    const businesses = await this.repository.findBusinesses({});

    const byCity = new Map<string, CityResult>();
    for (const business of businesses) {
      const citySlug = business.citySlug;
      if (!citySlug) continue;

      const found = byCity.get(citySlug);
      if (found) found.businessesCount += 1;
      else
        byCity.set(citySlug, {
          city: business.city,
          citySlug,
          province: business.province ?? null,
          businessesCount: 1,
        });
    }

    return [...byCity.values()].sort((a, b) => a.city.localeCompare(b.city));
  }

  async listComplejos(
    query: DiscoverQueryDto,
  ): Promise<DiscoveryComplejosResult> {
    const { from, days, dates } = this.resolveWindow(query.date, query.days);
    // Sin ciudad la home muestra todo el país: es la primera pantalla de alguien
    // que todavía no eligió dónde jugar.
    const businesses = await this.repository.findBusinesses({
      citySlug: query.city ? toSlug(query.city) : undefined,
      q: query.q,
      sport: query.sport,
    });
    const index = await this.repository.findAvailability(businesses, dates);

    const origin =
      query.lat !== undefined && query.lng !== undefined
        ? { latitude: query.lat, longitude: query.lng }
        : null;

    const complejos = businesses.map((business) =>
      describeComplejo({
        business,
        index,
        dates,
        sport: query.sport,
        origin,
      }),
    );

    sortComplejos(complejos, query.sort);

    const limit = query.limit ?? DEFAULT_PAGE_SIZE;
    const page = query.page ?? 1;
    const start = (page - 1) * limit;

    return {
      city: query.city ?? null,
      from,
      days,
      complejos: complejos.slice(start, start + limit),
      meta: { total: complejos.length, page, limit },
    };
  }

  async listSlots(query: DiscoverSlotsQueryDto): Promise<DiscoverySlotsResult> {
    const { from, days, dates } = this.resolveWindow(query.date, query.days);
    const businesses = await this.repository.findBusinesses({
      citySlug: query.city ? toSlug(query.city) : undefined,
      sport: query.sport,
    });
    const index = await this.repository.findAvailability(businesses, dates);

    const limit = query.limit ?? DEFAULT_SLOTS;
    const collected: DiscoverySlot[] = [];

    for (const business of businesses) {
      const courts = courtsOf(business).filter(
        (c) => !query.sport || c.sportType === query.sport,
      );

      forEachOpenSlot({ business, courts, index, dates }, (court, date, slot) =>
        collected.push({
          date,
          startTime: slot.startTime,
          endTime: slot.endTime,
          businessId: business.id,
          businessName: business.name,
          address: business.address ?? null,
          businessCity: business.city ?? null,
          courtId: court.id,
          courtName: court.name,
          sportType: court.sportType,
          surface: court.surface,
          isIndoor: court.isIndoor,
          hasLighting: court.hasLighting,
          pricePerSlot: court.pricePerSlot,
        }),
      );
    }

    // `courtId` al final es un desempate estable: sin él, dos turnos con la
    // misma fecha/hora/complejo se reordenan entre requests y el rail parpadea.
    collected.sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        a.startTime.localeCompare(b.startTime) ||
        a.businessName.localeCompare(b.businessName) ||
        a.courtName.localeCompare(b.courtName) ||
        a.courtId.localeCompare(b.courtId),
    );

    return {
      city: query.city ?? null,
      from,
      days,
      slots: collected.slice(0, limit),
      meta: { limit, truncated: collected.length > limit },
    };
  }

  // --- Helpers --------------------------------------------------------------

  // El pasado se recorta en vez de rechazarse: un visitante con el reloj
  // corrido un día no tiene por qué ver un 400.
  private resolveWindow(
    date: string | undefined,
    days: number | undefined,
  ): { from: string; days: number; dates: string[] } {
    const today = todayLocalISO();
    const requested = date ? date.slice(0, 10) : today;
    const from = requested < today ? today : requested;
    const total = days ?? DEFAULT_DAYS;

    return {
      from,
      days: total,
      dates: Array.from({ length: total }, (_, i) => addDaysToISODate(from, i)),
    };
  }
}
