-- Preferencias de notificación del jugador (BE-05, primera pieza).
-- Aditiva y reejecutable. Aplicar en cada base: aunque hoy `database.provider.ts` corre
-- sync({ alter: true }) y terminaría creando la columna sola, eso es justamente lo que
-- INFRA-02 busca eliminar — el esquema se versiona acá, no en el arranque.

-- DEFAULT true: los usuarios existentes ya venían recibiendo los correos de reserva.
-- Cambiarlo a false los daría de baja en silencio.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS notify_bookings BOOLEAN NOT NULL DEFAULT true;
