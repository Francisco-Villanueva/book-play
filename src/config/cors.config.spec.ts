import type { CustomOrigin } from '@nestjs/common/interfaces/external/cors-options.interface';
import { CORS } from './cors.config';

// El callback de CORS se invoca con (error, allow). Acá sólo interesa el allow.
const allows = (origin: string | undefined): boolean => {
  let result = false;
  (CORS.origin as CustomOrigin)(origin as string, (_err, allow) => {
    result = allow === true;
  });
  return result;
};

describe('CORS', () => {
  it('acepta el dominio propio del panel', () => {
    expect(allows('https://platform.book-and-play.com.ar')).toBe(true);
  });

  it('acepta el .vercel.app de producción y el localhost de desarrollo', () => {
    expect(allows('https://book-play-front.vercel.app')).toBe(true);
    expect(allows('http://localhost:5173')).toBe(true);
  });

  it('acepta los previews de Vercel de los proyectos propios', () => {
    expect(
      allows(
        'https://book-play-front-e1w4mhfr1-franciscovillanuevas-projects.vercel.app',
      ),
    ).toBe(true);
  });

  it('rechaza cualquier otro origen', () => {
    expect(allows('https://book-and-play.com.ar.evil.com')).toBe(false);
    expect(allows('https://otro-complejo.vercel.app')).toBe(false);
    expect(allows('http://localhost:3001')).toBe(false);
  });

  it('deja pasar lo que no trae origen: no es una petición de navegador', () => {
    // curl, health checks y el webhook de Mercado Pago caen acá.
    expect(allows(undefined)).toBe(true);
  });
});
