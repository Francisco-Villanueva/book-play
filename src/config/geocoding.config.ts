import { registerAs } from '@nestjs/config';

export default registerAs('geocoding', () => ({
  url: process.env.NOMINATIM_URL || 'https://nominatim.openstreetmap.org',
  // Nominatim exige un User-Agent que identifique la aplicación y un contacto.
  // Sin esto la política de uso permite que bloqueen la IP sin aviso.
  userAgent:
    process.env.NOMINATIM_USER_AGENT ||
    'BookAndPlay/1.0 (+https://bookandplay.app)',
  // Cuando es false (dev/test) se loguea y no se sale a la red.
  enabled: process.env.NOMINATIM_ENABLED !== 'false',
  timeoutMs: process.env.NOMINATIM_TIMEOUT_MS
    ? Number(process.env.NOMINATIM_TIMEOUT_MS)
    : 5000,
  // El país al que se acota la búsqueda. Hoy el producto es sólo Argentina.
  countryCodes: process.env.NOMINATIM_COUNTRY_CODES || 'ar',
}));
