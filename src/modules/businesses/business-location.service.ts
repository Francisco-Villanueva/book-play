import { Inject, Injectable, Logger } from '@nestjs/common';
import { Business } from './entities/business.model';
import { BUSINESS_REPOSITORY } from '../database/constants/repositories.constants';
import { GeocodingService } from './geocoding.service';
import { toSlug } from '../../common/utils/slug.util';

// Los campos cuya edición invalida las coordenadas guardadas.
const LOCATION_FIELDS = ['address', 'city', 'province'] as const;

@Injectable()
export class BusinessLocationService {
  private readonly logger = new Logger(BusinessLocationService.name);

  constructor(
    @Inject(BUSINESS_REPOSITORY)
    private readonly businessModel: typeof Business,
    private readonly geocodingService: GeocodingService,
  ) {}

  // `citySlug` nunca viaja en el DTO: se deriva acá para que "La Plata",
  // "la plata" y "LA PLATA" caigan siempre en la misma ciudad del selector.
  buildSlug(
    city?: string | null,
  ): { citySlug: string } | Record<string, never> {
    if (city === undefined) return {};
    return { citySlug: city ? toSlug(city) : '' };
  }

  shouldGeocode(dto: Record<string, unknown>): boolean {
    // Si el dueño corrigió el pin a mano, su coordenada gana: no la pisamos.
    if (dto['latitude'] !== undefined || dto['longitude'] !== undefined) {
      return false;
    }
    return LOCATION_FIELDS.some((field) => dto[field] !== undefined);
  }

  // Fire-and-forget, como los correos (§13): se llama con `void` después del
  // commit. Si Nominatim falla, el complejo queda sin coordenadas y aparece
  // igual en su ciudad — sólo se pierde el orden por cercanía.
  async refresh(businessId: string): Promise<void> {
    try {
      const business = await this.businessModel.findByPk(businessId, {
        attributes: ['id', 'address', 'city', 'province'],
      });
      if (!business) return;

      const coordinates = await this.geocodingService.geocode({
        address: business.address,
        city: business.city,
        province: business.province,
      });
      if (!coordinates) return;

      await this.businessModel.update(coordinates, {
        where: { id: businessId },
      });
    } catch (err) {
      this.logger.error(
        `Could not refresh coordinates for ${businessId}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }
}
