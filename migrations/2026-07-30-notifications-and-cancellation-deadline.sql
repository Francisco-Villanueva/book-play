-- Notificaciones del panel (campana) + plazo mínimo de cancelación (BR-019, BR-030).
-- Aditiva y reejecutable. Va junto con 2026-07-30-recurring-bookings.sql.

-- Antelación mínima con la que el CLIENTE puede cancelar. 0 = sin restricción.
-- DEFAULT 24: es la convención del rubro y el valor que espera un complejo que
-- nunca entró a configurarlo. El staff nunca queda limitado por esta columna.
ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS cancellation_deadline_hours INTEGER NOT NULL DEFAULT 24;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_notifications_type') THEN
    CREATE TYPE enum_notifications_type AS ENUM (
      'BOOKING_CANCELLED_BY_CLIENT',
      'RECURRING_INSTANCE_CANCELLED_BY_CLIENT'
    );
  END IF;
END $$;

-- Por negocio, no por usuario: la ve todo el equipo y se marca leída para todos.
CREATE TABLE IF NOT EXISTS notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses (id) ON DELETE CASCADE,
  type        enum_notifications_type NOT NULL,
  title       VARCHAR(255) NOT NULL,
  body        TEXT NOT NULL,
  -- Sin FK a propósito: si la reserva desaparece, la notificación sigue siendo
  -- un hecho histórico válido.
  booking_id  UUID,
  read_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- El contador de no leídas pega exactamente por acá.
CREATE INDEX IF NOT EXISTS notifications_business_id_read_at
  ON notifications (business_id, read_at);
CREATE INDEX IF NOT EXISTS notifications_business_id_created_at
  ON notifications (business_id, created_at);
