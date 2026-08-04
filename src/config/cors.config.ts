import { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';

// Orígenes propios. Se pueden sobreescribir con CORS_ORIGINS (lista separada por
// comas) para no tener que tocar código al mover un dominio.
const DEFAULT_ORIGINS = [
  'https://platform.book-and-play.com.ar',
  'https://book-play-front.vercel.app',
  'http://localhost:5173',
  'http://localhost:4173',
];

// Los deploys de preview de Vercel estrenan subdominio en cada push, así que no
// se pueden enumerar; se aceptan por patrón, acotado a los proyectos propios.
const VERCEL_PREVIEW =
  /^https:\/\/book-play-(front|landing)-[a-z0-9-]+\.vercel\.app$/;

const configured = process.env.CORS_ORIGINS?.split(',')
  .map((o) => o.trim())
  .filter(Boolean);

const allowed = configured?.length ? configured : DEFAULT_ORIGINS;

export const CORS: CorsOptions = {
  // Sin `origin` no hay navegador del otro lado (curl, health checks, el webhook
  // de Mercado Pago): no es una petición cross-site y no hay nada que bloquear.
  origin: (origin, callback) => {
    if (!origin || allowed.includes(origin) || VERCEL_PREVIEW.test(origin)) {
      return callback(null, true);
    }
    return callback(null, false);
  },
  methods: 'GET, POST, DELETE, HEAD, PUT, PATCH, OPTIONS',
  credentials: true,
};
