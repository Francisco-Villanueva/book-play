import { normalizeSport } from './sport.enum';

describe('normalizeSport', () => {
  it('normaliza los labels con acento del panel admin', () => {
    expect(normalizeSport('Fútbol 5')).toBe('futbol5');
    expect(normalizeSport('Fútbol 7')).toBe('futbol7');
    expect(normalizeSport('Fútbol 11')).toBe('futbol11');
    expect(normalizeSport('Pádel')).toBe('padel');
    expect(normalizeSport('Básquet')).toBe('basquet');
    expect(normalizeSport('Vóley')).toBe('voley');
    expect(normalizeSport('Hándbol')).toBe('handbol');
  });

  it('deja pasar los slugs que ya guarda el onboarding', () => {
    expect(normalizeSport('futbol5')).toBe('futbol5');
    expect(normalizeSport('padel')).toBe('padel');
    expect(normalizeSport('hockey')).toBe('hockey');
  });

  // Los dos vocabularios tienen que colapsar en el mismo valor: de eso depende
  // que el filtro por deporte encuentre las canchas cargadas por ambas vías.
  it('hace converger ambos vocabularios', () => {
    expect(normalizeSport('Pádel')).toBe(normalizeSport('padel'));
    expect(normalizeSport('Fútbol 5')).toBe(normalizeSport('futbol5'));
  });

  it('normaliza los deportes del seed que no salen del panel', () => {
    expect(normalizeSport('Futsal')).toBe('futsal');
    expect(normalizeSport('Fútbol playa')).toBe('futbol-playa');
    expect(normalizeSport('Beach vóley')).toBe('beach-voley');
    expect(normalizeSport('Squash')).toBe('squash');
    expect(normalizeSport('Tenis')).toBe('tenis');
  });

  it('resuelve escrituras alternativas conocidas', () => {
    expect(normalizeSport('Paddle')).toBe('padel');
    expect(normalizeSport('basket')).toBe('basquet');
    expect(normalizeSport('Volleyball')).toBe('voley');
    expect(normalizeSport('Balonmano')).toBe('handbol');
  });

  it('devuelve null cuando no hay deporte cargado', () => {
    expect(normalizeSport(null)).toBeNull();
    expect(normalizeSport(undefined)).toBeNull();
    expect(normalizeSport('   ')).toBeNull();
  });

  // Un deporte desconocido no puede romper el alta de una cancha: el dato es
  // descriptivo, no de dominio.
  it('cae en "otro" ante un deporte desconocido', () => {
    expect(normalizeSport('Tejo')).toBe('otro');
    expect(normalizeSport('Otro')).toBe('otro');
  });

  it('tolera sufijos sobre un deporte conocido', () => {
    expect(normalizeSport('futbol5 sintético')).toBe('futbol5');
  });
});
