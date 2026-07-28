-- BR-025: registro del cobro presencial de un turno.
-- Aditiva y reejecutable. Aplicar en cada base: aunque hoy `database.provider.ts` corre
-- sync({ alter: true }) y terminaría creando las columnas solas, eso es justamente lo que
-- INFRA-02 busca eliminar — el esquema se versiona acá, no en el arranque.

DO $$ BEGIN
  CREATE TYPE "enum_bookings_payment_status" AS ENUM ('UNPAID', 'PARTIAL', 'PAID');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS payment_status "enum_bookings_payment_status" NOT NULL DEFAULT 'UNPAID',
  ADD COLUMN IF NOT EXISTS amount_paid DECIMAL(10, 2),
  ADD COLUMN IF NOT EXISTS total_players INTEGER,
  ADD COLUMN IF NOT EXISTS players_paid INTEGER,
  ADD COLUMN IF NOT EXISTS payment_notes TEXT,
  ADD COLUMN IF NOT EXISTS payment_recorded_by UUID,
  ADD COLUMN IF NOT EXISTS payment_recorded_at TIMESTAMP WITH TIME ZONE;

-- El panel filtra "sin cobrar" por complejo.
CREATE INDEX IF NOT EXISTS bookings_business_id_payment_status
  ON bookings (business_id, payment_status);
