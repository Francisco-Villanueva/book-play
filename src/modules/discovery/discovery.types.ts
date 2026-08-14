export interface CityResult {
  city: string;
  citySlug: string;
  province: string | null;
  businessesCount: number;
}

export interface NextSlot {
  date: string;
  startTime: string;
  endTime: string;
  courtId: string;
  courtName: string;
  sportType: string | null;
  pricePerSlot: number | null;
}

export interface DiscoveryComplejo {
  id: string;
  name: string;
  description: string | null;
  address: string | null;
  city: string | null;
  province: string | null;
  latitude: number | null;
  longitude: number | null;
  distanceKm: number | null;
  courtsCount: number;
  sports: string[];
  priceFrom: number | null;
  // false = el complejo todavía no publicó su agenda semanal (BR-009). Es
  // distinto de "no le quedan turnos", y la pantalla dice otra cosa en cada caso.
  hasSchedule: boolean;
  availableToday: number;
  availableCount: number;
  nextAvailable: NextSlot | null;
}

export interface DiscoveryComplejosResult {
  city: string;
  from: string;
  days: number;
  complejos: DiscoveryComplejo[];
  meta: { total: number; page: number; limit: number };
}

export interface DiscoverySlot {
  date: string;
  startTime: string;
  endTime: string;
  businessId: string;
  businessName: string;
  address: string | null;
  courtId: string;
  courtName: string;
  sportType: string | null;
  surface: string | null;
  isIndoor: boolean;
  hasLighting: boolean;
  pricePerSlot: number | null;
}

export interface DiscoverySlotsResult {
  city: string;
  from: string;
  days: number;
  slots: DiscoverySlot[];
  meta: { limit: number; truncated: boolean };
}
