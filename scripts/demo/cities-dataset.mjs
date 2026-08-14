// Nueve complejos demo repartidos en tres ciudades, para probar la busqueda
// publica con variedad real: cada ciudad tiene un padel, un futbol y un basquet,
// asi el filtro por deporte y el selector de ciudad se ejercitan de verdad.
//
// Todo se identifica por el dominio DEMO_TAG y lo borra clean-demo.mjs.

export const CITIES = [
  { city: 'Rosario', citySlug: 'rosario', province: 'Santa Fe' },
  { city: 'Córdoba', citySlug: 'cordoba', province: 'Córdoba' },
  {
    city: 'Mar del Plata',
    citySlug: 'mar-del-plata',
    province: 'Buenos Aires',
  },
];

// `openings` define la agenda semanal: [dias, desde, hasta]. Los dias son
// 0=domingo..6=sabado, como Date.getDay().
const TODA_LA_SEMANA = [0, 1, 2, 3, 4, 5, 6];
const SEMANA = [1, 2, 3, 4, 5];
const FINDE = [0, 6];

export const BUSINESSES = [
  // ── Rosario ──────────────────────────────────────────────────────────────
  {
    slug: 'padel-rosario-centro',
    name: 'Pádel Rosario Centro',
    description: 'Cuatro canchas panorámicas a dos cuadras del Monumento.',
    address: 'Córdoba 1250',
    city: 'Rosario',
    phone: '+543415550101',
    slotDuration: 90,
    pricePerSlot: 22000,
    openings: [
      [SEMANA, '08:00', '23:00'],
      [FINDE, '09:00', '22:00'],
    ],
    courts: [
      { name: 'Panorámica 1', sport: 'padel', surface: 'Cristal', indoor: true },
      { name: 'Panorámica 2', sport: 'padel', surface: 'Cristal', indoor: true },
      { name: 'Muro 1', sport: 'padel', surface: 'Cemento', indoor: false },
      { name: 'Muro 2', sport: 'padel', surface: 'Cemento', indoor: false },
    ],
    // Cuantos turnos de la agenda quedan ocupados, de 0 a 1. Sirve para que los
    // complejos no tengan todos el mismo "proximo turno".
    ocupacion: 0.55,
  },
  {
    slug: 'futbol-la-ribera',
    name: 'Fútbol La Ribera',
    description: 'Tres canchas de césped sintético con luz para jugar de noche.',
    address: 'Av. Pellegrini 3400',
    city: 'Rosario',
    phone: '+543415550102',
    slotDuration: 60,
    pricePerSlot: 28000,
    openings: [[TODA_LA_SEMANA, '09:00', '00:00']],
    courts: [
      { name: 'Cancha 1', sport: 'futbol5', surface: 'Césped sintético' },
      { name: 'Cancha 2', sport: 'futbol5', surface: 'Césped sintético' },
      { name: 'Cancha Grande', sport: 'futbol7', surface: 'Césped sintético', price: 36000 },
    ],
    ocupacion: 0.7,
  },
  {
    slug: 'basquet-club-norte',
    name: 'Básquet Club Norte',
    description: 'Gimnasio techado con parquet y tablero reglamentario.',
    address: 'Bv. Oroño 980',
    city: 'Rosario',
    phone: '+543415550103',
    slotDuration: 60,
    pricePerSlot: 19000,
    openings: [[TODA_LA_SEMANA, '10:00', '22:00']],
    courts: [
      { name: 'Gimnasio A', sport: 'basquet', surface: 'Parquet', indoor: true },
      { name: 'Playón', sport: 'basquet', surface: 'Cemento', indoor: false, price: 14000 },
    ],
    ocupacion: 0.3,
  },

  // ── Córdoba ──────────────────────────────────────────────────────────────
  {
    slug: 'padel-nueva-cordoba',
    name: 'Pádel Nueva Córdoba',
    description: 'Cuatro canchas techadas, se juega llueva o truene.',
    address: 'Bv. Chacabuco 720',
    city: 'Córdoba',
    phone: '+543515550201',
    slotDuration: 90,
    pricePerSlot: 24000,
    openings: [[TODA_LA_SEMANA, '08:00', '23:30']],
    courts: [
      { name: 'Cancha 1', sport: 'padel', surface: 'Cristal', indoor: true },
      { name: 'Cancha 2', sport: 'padel', surface: 'Cristal', indoor: true },
      { name: 'Cancha 3', sport: 'padel', surface: 'Cristal', indoor: true },
      { name: 'Cancha 4', sport: 'padel', surface: 'Cristal', indoor: true },
    ],
    ocupacion: 0.8,
  },
  {
    slug: 'futbol-cerro',
    name: 'Fútbol Cerro',
    description: 'Cuatro canchas de fútbol 5 con parrillas y vestuarios.',
    address: 'Av. Colón 2100',
    city: 'Córdoba',
    phone: '+543515550202',
    slotDuration: 60,
    pricePerSlot: 26000,
    openings: [
      [SEMANA, '16:00', '01:00'],
      [FINDE, '10:00', '01:00'],
    ],
    courts: [
      { name: 'Cancha 1', sport: 'futbol5', surface: 'Césped sintético' },
      { name: 'Cancha 2', sport: 'futbol5', surface: 'Césped sintético' },
      { name: 'Cancha 3', sport: 'futbol5', surface: 'Césped sintético' },
      { name: 'Cancha 4', sport: 'futbol5', surface: 'Césped sintético', active: false,
        description: 'Fuera de servicio: se está recambiando la carpeta.' },
    ],
    ocupacion: 0.6,
  },
  {
    slug: 'basquet-arena-cordoba',
    name: 'Básquet Arena Córdoba',
    description: 'Dos canchas techadas con marcador electrónico.',
    address: 'Av. Vélez Sarsfield 1500',
    city: 'Córdoba',
    phone: '+543515550203',
    slotDuration: 60,
    pricePerSlot: 21000,
    openings: [[TODA_LA_SEMANA, '09:00', '23:00']],
    courts: [
      { name: 'Arena 1', sport: 'basquet', surface: 'Parquet', indoor: true },
      { name: 'Arena 2', sport: 'basquet', surface: 'Piso flotante', indoor: true },
    ],
    ocupacion: 0.45,
  },

  // ── Mar del Plata ────────────────────────────────────────────────────────
  {
    slug: 'padel-playa-grande',
    name: 'Pádel Playa Grande',
    description: 'Tres canchas a una cuadra del mar.',
    address: 'Alem 3200',
    city: 'Mar del Plata',
    phone: '+542235550301',
    slotDuration: 90,
    pricePerSlot: 25000,
    openings: [[TODA_LA_SEMANA, '08:00', '22:30']],
    courts: [
      { name: 'Cancha 1', sport: 'padel', surface: 'Cristal', indoor: false },
      { name: 'Cancha 2', sport: 'padel', surface: 'Cristal', indoor: false },
      { name: 'Cancha Techada', sport: 'padel', surface: 'Cristal', indoor: true, price: 29000 },
    ],
    ocupacion: 0.35,
  },
  {
    slug: 'futbol-mar-y-sol',
    name: 'Fútbol Mar y Sol',
    description: 'Fútbol 5 y 7 con cantina y estacionamiento.',
    address: 'Av. Constitución 4500',
    city: 'Mar del Plata',
    phone: '+542235550302',
    slotDuration: 60,
    pricePerSlot: 27000,
    openings: [[TODA_LA_SEMANA, '10:00', '00:00']],
    courts: [
      { name: 'Cancha 1', sport: 'futbol5', surface: 'Césped sintético' },
      { name: 'Cancha 2', sport: 'futbol5', surface: 'Césped sintético' },
      { name: 'Cancha 7', sport: 'futbol7', surface: 'Césped sintético', price: 35000 },
    ],
    ocupacion: 0.5,
  },
  {
    slug: 'basquet-costa',
    name: 'Básquet Costa',
    description: 'Dos playones al aire libre con luz led.',
    address: 'Av. Independencia 2800',
    city: 'Mar del Plata',
    phone: '+542235550303',
    slotDuration: 60,
    pricePerSlot: 20000,
    // Sin agenda cargada a proposito: es el caso `hasSchedule: false` (BR-009),
    // que la pantalla tiene que distinguir de "no le quedan turnos".
    openings: [],
    courts: [
      { name: 'Playón 1', sport: 'basquet', surface: 'Cemento', indoor: false },
      { name: 'Playón 2', sport: 'basquet', surface: 'Cemento', indoor: false },
    ],
    ocupacion: 0,
  },
];
