import {
  buildSlotGrid,
  classifyExceptions,
  computeAvailableSlots,
} from './availability.calculator';

// Sin TestingModule y sin fake timers: el corte por hora entra como parámetro,
// así que no hay reloj que congelar.
const starts = (slots: { startTime: string }[]) => slots.map((s) => s.startTime);

const open = (start: string, end: string) => ({ startTime: start, endTime: end });

describe('classifyExceptions', () => {
  it('un bloqueo sin horario cierra el día entero', () => {
    const plan = classifyExceptions([
      { isAvailable: false, startTime: null, endTime: null },
    ]);
    expect(plan.closedAllDay).toBe(true);
  });

  // Las excepciones vienen sin ORDER BY: el cierre total tiene que ganar
  // aunque llegue después de una apertura especial.
  it('el cierre de día completo gana sin importar el orden', () => {
    const plan = classifyExceptions([
      { isAvailable: true, startTime: '10:00', endTime: '14:00' },
      { isAvailable: false, startTime: null, endTime: null },
    ]);
    expect(plan.closedAllDay).toBe(true);
  });

  it('separa aperturas especiales de bloqueos parciales', () => {
    const plan = classifyExceptions([
      { isAvailable: true, startTime: '10:00', endTime: '14:00' },
      { isAvailable: false, startTime: '12:00', endTime: '13:00' },
    ]);
    expect(plan.hasEnablingException).toBe(true);
    expect(plan.openWindows).toEqual([{ start: '10:00', end: '14:00' }]);
    expect(plan.blockedRanges).toEqual([{ start: '12:00', end: '13:00' }]);
  });

  it('normaliza el HH:mm:ss que devuelve la DB', () => {
    const plan = classifyExceptions([
      { isAvailable: true, startTime: '10:00:00', endTime: '14:00:00' },
    ]);
    expect(plan.openWindows).toEqual([{ start: '10:00', end: '14:00' }]);
  });
});

describe('buildSlotGrid', () => {
  const plan = classifyExceptions([]);

  it('parte la ventana en turnos de slotDuration', () => {
    const slots = buildSlotGrid({
      plan,
      rules: [open('09:00', '12:00')],
      bookings: [],
      slotDuration: 60,
      cutoff: null,
    });
    expect(starts(slots)).toEqual(['09:00', '10:00', '11:00']);
  });

  // El turno que no entra completo no se ofrece: 21:30-22:30 se saldría de la
  // ventana que cierra 22:00.
  it('descarta el turno que no entra completo en la ventana', () => {
    const slots = buildSlotGrid({
      plan,
      rules: [open('20:00', '22:30')],
      bookings: [],
      slotDuration: 60,
      cutoff: null,
    });
    expect(starts(slots)).toEqual(['20:00', '21:00']);
  });

  it('descuenta los turnos ya reservados', () => {
    const slots = buildSlotGrid({
      plan,
      rules: [open('09:00', '12:00')],
      bookings: [open('10:00', '11:00')],
      slotDuration: 60,
      cutoff: null,
    });
    expect(starts(slots)).toEqual(['09:00', '11:00']);
  });

  it('sin reglas no hay turnos (BR-009)', () => {
    const slots = buildSlotGrid({
      plan,
      rules: [],
      bookings: [],
      slotDuration: 60,
      cutoff: null,
    });
    expect(slots).toEqual([]);
  });

  it('una apertura especial pisa la regla semanal (BR-007)', () => {
    const enabling = classifyExceptions([
      { isAvailable: true, startTime: '18:00', endTime: '20:00' },
    ]);
    const slots = buildSlotGrid({
      plan: enabling,
      rules: [open('09:00', '12:00')],
      bookings: [],
      slotDuration: 60,
      cutoff: null,
    });
    expect(starts(slots)).toEqual(['18:00', '19:00']);
  });

  it('un bloqueo parcial saca los turnos que pisa', () => {
    const blocked = classifyExceptions([
      { isAvailable: false, startTime: '10:00', endTime: '11:00' },
    ]);
    const slots = buildSlotGrid({
      plan: blocked,
      rules: [open('09:00', '12:00')],
      bookings: [],
      slotDuration: 60,
      cutoff: null,
    });
    expect(starts(slots)).toEqual(['09:00', '11:00']);
  });

  it('el día cerrado por completo deja la grilla vacía', () => {
    const closed = classifyExceptions([
      { isAvailable: false, startTime: null, endTime: null },
    ]);
    const slots = buildSlotGrid({
      plan: closed,
      rules: [open('09:00', '12:00')],
      bookings: [],
      slotDuration: 60,
      cutoff: null,
    });
    expect(slots).toEqual([]);
  });

  // El corte es el FIN del turno y no su arranque: el mostrador todavía tiene
  // que poder cargar al que entró a jugar recién.
  it('recorta por cutoff usando el fin del turno', () => {
    const slots = buildSlotGrid({
      plan,
      rules: [open('09:00', '13:00')],
      bookings: [],
      slotDuration: 60,
      cutoff: '10:30',
    });
    expect(starts(slots)).toEqual(['10:00', '11:00', '12:00']);
  });

  it('descarta el turno que termina justo en el cutoff', () => {
    const slots = buildSlotGrid({
      plan,
      rules: [open('09:00', '12:00')],
      bookings: [],
      slotDuration: 60,
      cutoff: '10:00',
    });
    expect(starts(slots)).toEqual(['10:00', '11:00']);
  });

  // Dos reglas semanales solapadas ofrecían el mismo turno dos veces. Invisible
  // en la grilla de una cancha, muy visible en un listado de ciudad.
  it('no repite un turno cubierto por dos reglas solapadas', () => {
    const slots = buildSlotGrid({
      plan,
      rules: [open('08:00', '12:00'), open('10:00', '14:00')],
      bookings: [],
      slotDuration: 60,
      cutoff: null,
    });
    expect(starts(slots)).toEqual([
      '08:00',
      '09:00',
      '10:00',
      '11:00',
      '12:00',
      '13:00',
    ]);
  });

  it('devuelve los turnos ordenados aunque las ventanas no lo estén', () => {
    const slots = buildSlotGrid({
      plan,
      rules: [open('18:00', '20:00'), open('09:00', '11:00')],
      bookings: [],
      slotDuration: 60,
      cutoff: null,
    });
    expect(starts(slots)).toEqual(['09:00', '10:00', '18:00', '19:00']);
  });

  it('normaliza el HH:mm:ss de reglas y reservas', () => {
    const slots = buildSlotGrid({
      plan,
      rules: [open('09:00:00', '12:00:00')],
      bookings: [open('10:00:00', '11:00:00')],
      slotDuration: 60,
      cutoff: null,
    });
    expect(starts(slots)).toEqual(['09:00', '11:00']);
  });

  it('respeta la duración por cancha', () => {
    const slots = buildSlotGrid({
      plan,
      rules: [open('09:00', '12:00')],
      bookings: [],
      slotDuration: 90,
      cutoff: null,
    });
    expect(starts(slots)).toEqual(['09:00', '10:30']);
  });
});

describe('computeAvailableSlots', () => {
  it('compone clasificación y grilla en un paso', () => {
    const slots = computeAvailableSlots({
      slotDuration: 60,
      exceptions: [{ isAvailable: false, startTime: '10:00', endTime: '11:00' }],
      rules: [open('09:00', '12:00')],
      bookings: [],
      cutoff: null,
    });
    expect(starts(slots)).toEqual(['09:00', '11:00']);
  });
});
