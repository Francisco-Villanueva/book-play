import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface GeocodeQuery {
  address?: string | null;
  city?: string | null;
  province?: string | null;
}

interface NominatimResult {
  lat?: string;
  lon?: string;
}

// Nominatim (OpenStreetMap): gratis y sin API key, a cambio de un límite duro de
// 1 request por segundo. Alcanza de sobra porque geocodificamos sólo al dar de
// alta o mudar un complejo — no es un camino caliente.
const MIN_INTERVAL_MS = 1100;

@Injectable()
export class GeocodingService {
  private readonly logger = new Logger(GeocodingService.name);
  private readonly url: string;
  private readonly userAgent: string;
  private readonly enabled: boolean;
  private readonly timeoutMs: number;
  private readonly countryCodes: string;

  // Serializa los pedidos concurrentes en una sola cola: dos altas simultáneas
  // no pueden saltarse el límite de 1 req/s.
  private queue: Promise<unknown> = Promise.resolve();

  constructor(private readonly configService: ConfigService) {
    this.url =
      this.configService.get<string>('geocoding.url') ??
      'https://nominatim.openstreetmap.org';
    this.userAgent =
      this.configService.get<string>('geocoding.userAgent') ??
      'BookAndPlay/1.0';
    this.enabled = this.configService.get<boolean>('geocoding.enabled') ?? true;
    this.timeoutMs =
      this.configService.get<number>('geocoding.timeoutMs') ?? 5000;
    this.countryCodes =
      this.configService.get<string>('geocoding.countryCodes') ?? 'ar';
  }

  // Devuelve null y nunca lanza: un complejo sin coordenadas sigue apareciendo
  // por ciudad, así que un fallo del geocoder no puede romper el alta.
  async geocode(query: GeocodeQuery): Promise<Coordinates | null> {
    const q = [query.address, query.city, query.province, 'Argentina']
      .map((part) => part?.trim())
      .filter((part): part is string => Boolean(part))
      .join(', ');

    if (!query.city?.trim() && !query.address?.trim()) return null;

    if (!this.enabled) {
      this.logger.log(`Geocoding disabled — skipped "${q}"`);
      return null;
    }

    const run = this.queue.then(() => this.request(q));
    // La cola avanza aunque este pedido falle; si no, un rechazo la deja trabada.
    this.queue = run.catch(() => undefined).then(() => this.wait());
    return run;
  }

  private wait(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, MIN_INTERVAL_MS));
  }

  private async request(q: string): Promise<Coordinates | null> {
    const url = new URL('/search', this.url);
    url.searchParams.set('q', q);
    url.searchParams.set('format', 'jsonv2');
    url.searchParams.set('limit', '1');
    url.searchParams.set('countrycodes', this.countryCodes);

    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': this.userAgent, 'Accept-Language': 'es' },
        signal: AbortSignal.timeout(this.timeoutMs),
      });

      if (!response.ok) {
        this.logger.warn(`Geocoding "${q}" failed — HTTP ${response.status}`);
        return null;
      }

      const results = (await response.json()) as NominatimResult[];
      const first = results[0];
      if (!first?.lat || !first?.lon) {
        this.logger.warn(`Geocoding "${q}" returned no match`);
        return null;
      }

      const latitude = Number(first.lat);
      const longitude = Number(first.lon);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        this.logger.warn(`Geocoding "${q}" returned invalid coordinates`);
        return null;
      }

      this.logger.log(`Geocoded "${q}" to ${latitude},${longitude}`);
      return { latitude, longitude };
    } catch (err) {
      this.logger.error(
        `Geocoding "${q}" failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return null;
    }
  }
}
