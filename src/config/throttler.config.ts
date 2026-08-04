import { ThrottlerModuleOptions } from '@nestjs/throttler';

// Un solo throttler global y overrides por ruta con @Throttle.
//
// Ojo con la tentación de declarar acá varios throttlers con nombre ("auth",
// "email"): se aplican TODOS a TODAS las rutas salvo que cada una los anule uno
// por uno, así que el cupo más chico termina siendo el techo de la API entera.
export const THROTTLER_CONFIG: ThrottlerModuleOptions = {
  throttlers: [{ name: 'default', ttl: 60_000, limit: 120 }],
};

// Fuerza bruta contra contraseñas. Cuenta por IP, así que un complejo entero
// detrás del mismo NAT comparte el cupo: 10 por minuto alcanza para el que se
// equivoca tipeando y no para el que prueba un diccionario.
export const AUTH_THROTTLE = { default: { ttl: 60_000, limit: 10 } };

// Cada request acá puede terminar en un correo saliente, y la casilla de Google
// Workspace tiene ~2.000 por día. Es el cupo más caro de la casa, por eso se
// mide por hora y no por minuto.
export const EMAIL_THROTTLE = { default: { ttl: 3_600_000, limit: 5 } };

// Una reserva creada ocupa una cancha real y dispara un correo, y el endpoint es
// público y sin captcha. 10 por minuto deja trabajar al mostrador cargando
// turnos uno atrás del otro.
export const PUBLIC_WRITE_THROTTLE = { default: { ttl: 60_000, limit: 10 } };
