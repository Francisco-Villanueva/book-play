import { hoursUntil, nowLocalTime, todayLocalISO } from './time.util';

// El servidor corre en UTC (Render) y el complejo vive en UTC-3. Estos tests
// fijan el reloj en la franja donde las dos zonas están en días distintos, que
// es exactamente el horario pico del pádel.
describe('time.util — el ahora se resuelve en la zona del complejo', () => {
  const freeze = (iso: string) => {
    jest.useFakeTimers({ doNotFake: ['nextTick'] });
    jest.setSystemTime(new Date(iso));
  };

  afterEach(() => {
    jest.useRealTimers();
  });

  it('a las 22:00 ART el "hoy" sigue siendo el día de Argentina, no el de UTC', () => {
    // 2026-08-04T01:00Z === 2026-08-03T22:00 ART
    freeze('2026-08-04T01:00:00Z');

    expect(todayLocalISO()).toBe('2026-08-03');
    expect(nowLocalTime()).toBe('22:00');
  });

  it('a las 20:59 ART todavía no cambió el día en ninguna de las dos', () => {
    freeze('2026-08-03T23:59:00Z');

    expect(todayLocalISO()).toBe('2026-08-03');
    expect(nowLocalTime()).toBe('20:59');
  });

  it('pasada la medianoche de Argentina sí avanza el día', () => {
    // 2026-08-04T03:30Z === 2026-08-04T00:30 ART
    freeze('2026-08-04T03:30:00Z');

    expect(todayLocalISO()).toBe('2026-08-04');
    expect(nowLocalTime()).toBe('00:30');
  });

  it('hoursUntil mide contra la hora de pared del complejo', () => {
    freeze('2026-08-04T01:00:00Z'); // 22:00 ART del 03

    // El turno de las 23:00 de esa misma noche está a una hora.
    expect(hoursUntil('2026-08-03', '23:00')).toBeCloseTo(1, 5);
    // Y el de las 21:00 ya pasó hace una hora.
    expect(hoursUntil('2026-08-03', '21:00')).toBeCloseTo(-1, 5);
  });

  it('hoursUntil acepta el HH:mm:ss que devuelve la DB', () => {
    freeze('2026-08-04T01:00:00Z');

    expect(hoursUntil('2026-08-03', '23:30:00')).toBeCloseTo(1.5, 5);
  });
});
