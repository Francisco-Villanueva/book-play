import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

interface TrackedRequest {
  headers?: Record<string, string | string[] | undefined>;
  ip?: string;
}

// La cuota se agrupa por cliente, y delante de Render hay un Cloudflare. Contar
// saltos de proxy (`trust proxy`) devuelve la IP de un nodo intermedio que ROTA
// entre requests, así que cada intento caía en un contador distinto y el límite
// no frenaba: verificado en producción, 14 intentos de login antes del primer
// 429 y 401 de nuevo después.
//
// `CF-Connecting-IP` es la IP real del cliente y Cloudflare la SOBREESCRIBE en
// cada request, así que no se puede inyectar desde afuera — a diferencia de
// X-Forwarded-For, donde el cliente sí puede plantar la primera entrada. Esto
// vale mientras el origen sólo sea alcanzable a través de Cloudflare, que es
// como Render publica el servicio.
@Injectable()
export class ProxyAwareThrottlerGuard extends ThrottlerGuard {
  protected getTracker(req: TrackedRequest): Promise<string> {
    const cf = req.headers?.['cf-connecting-ip'];
    if (typeof cf === 'string' && cf.length > 0) return Promise.resolve(cf);

    // Sin Cloudflare adelante (desarrollo local) `req.ip` ya es el cliente.
    return Promise.resolve(req.ip ?? 'unknown');
  }
}
