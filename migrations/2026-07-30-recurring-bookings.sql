-- Turnos fijos (BR-028). Aditiva y reejecutable.
-- Aplicar en cada base: aunque hoy `database.provider.ts` corre sync({ alter: true })
-- y terminaría creando todo solo, eso es justamente lo que INFRA-02 busca eliminar —
-- el esquema se versiona acá, no en el arranque.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_recurring_bookings_status') THEN
    CREATE TYPE enum_recurring_bookings_status AS ENUM ('ACTIVE', 'ENDED');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS recurring_bookings (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id      UUID NOT NULL REFERENCES businesses (id) ON DELETE CASCADE,
  court_id         UUID NOT NULL REFERENCES courts (id) ON DELETE CASCADE,
  user_id          UUID REFERENCES users (id) ON DELETE SET NULL,
  guest_name       VARCHAR(255),
  guest_phone      VARCHAR(255),
  guest_email      VARCHAR(255),
  day_of_week      INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time       TIME NOT NULL,
  start_date       DATE NOT NULL,
  end_date         DATE,
  -- Hasta dónde ya se materializaron instancias; hace idempotente al cron.
  generated_until  DATE NOT NULL,
  status           enum_recurring_bookings_status NOT NULL DEFAULT 'ACTIVE',
  notes            TEXT,
  created_by       UUID,
  cancellation_token_hash VARCHAR(255),
  ended_at         TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS recurring_bookings_business_id_status
  ON recurring_bookings (business_id, status);
CREATE INDEX IF NOT EXISTS recurring_bookings_court_id
  ON recurring_bookings (court_id);
-- El cron busca exactamente por acá: series vivas con la ventana corta.
CREATE INDEX IF NOT EXISTS recurring_bookings_status_generated_until
  ON recurring_bookings (status, generated_until);

-- La instancia de un turno fijo es una Booking normal; esta FK es lo único que
-- la distingue. ON DELETE SET NULL: borrar la serie no debe borrar el historial
-- de turnos que ya se jugaron y se cobraron.
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS recurring_booking_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'bookings_recurring_booking_id_fkey'
  ) THEN
    ALTER TABLE bookings
      ADD CONSTRAINT bookings_recurring_booking_id_fkey
      FOREIGN KEY (recurring_booking_id) REFERENCES recurring_bookings (id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS bookings_recurring_booking_id
  ON bookings (recurring_booking_id);
