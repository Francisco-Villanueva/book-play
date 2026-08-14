-- Ubicación del complejo: es lo que hace posible la home pública de
-- descubrimiento (elegir ciudad → ver complejos → ver próximos turnos).
-- Aditiva y reejecutable.

-- `city` es lo que se muestra; `city_slug` es con lo que se filtra. Sin el slug,
-- "CABA", "Capital Federal" y "capital federal" son tres ciudades distintas en
-- el selector. Lo deriva el service, nunca lo manda el cliente.
ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS city      VARCHAR(255),
  ADD COLUMN IF NOT EXISTS city_slug VARCHAR(255),
  ADD COLUMN IF NOT EXISTS province  VARCHAR(255);

-- Las pone el geocoder (Nominatim) y las corrige el dueño con el pin del mapa.
-- Nullable a propósito: sin coordenadas el complejo igual aparece por ciudad,
-- sólo queda fuera del orden por cercanía.
ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS latitude  NUMERIC(9, 6),
  ADD COLUMN IF NOT EXISTS longitude NUMERIC(9, 6);

-- Permite salir del directorio público sin dar de baja la cuenta. El link
-- directo al complejo sigue funcionando. DEFAULT true: no cambia nada para los
-- complejos que ya existen.
ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS is_listed BOOLEAN NOT NULL DEFAULT true;

-- Por acá pega todo el descubrimiento: el filtro de ciudad es la primera
-- condición de las tres consultas públicas.
CREATE INDEX IF NOT EXISTS businesses_city_slug
  ON businesses (city_slug);

-- La búsqueda pública arranca por las canchas activas de cada complejo, y
-- `courts` no declaraba ningún índice.
CREATE INDEX IF NOT EXISTS courts_business_id_is_active
  ON courts (business_id, is_active);

-- La consulta batcheada de disponibilidad pide reglas por (complejo, día de la
-- semana) para muchos complejos a la vez.
CREATE INDEX IF NOT EXISTS availability_rules_business_id_day_of_week_is_active
  ON availability_rules (business_id, day_of_week, is_active);
