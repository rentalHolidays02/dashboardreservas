-- =============================================================
-- MIGRACIÓN v15: service_reports en hora civil de Europe/Madrid
-- Ejecutar en Supabase > SQL Editor
--
-- Cambios:
--  1. Elimina las columnas generadas duplicadas created_at_madrid /
--     updated_at_madrid añadidas en v14.
--  2. Convierte created_at y updated_at de `timestamptz` (UTC) a
--     `timestamp` sin zona, guardando ya la hora civil de Madrid.
--     Datos existentes se traducen con AT TIME ZONE 'Europe/Madrid'.
--  3. Sustituye el trigger por una función específica de esta tabla
--     (set_updated_at_service_reports) para no tocar el comportamiento
--     de otras tablas que pudieran compartir `set_updated_at_reports`.
--
-- Trade-off: esta tabla deja de ser timestamptz como el resto. Pierde
-- el offset UTC; el valor representa siempre hora local española
-- (CET en invierno, CEST en verano).
-- =============================================================

-- 1. Borrar columnas generadas duplicadas (v14)
ALTER TABLE service_reports
  DROP COLUMN IF EXISTS created_at_madrid,
  DROP COLUMN IF EXISTS updated_at_madrid;

-- 2. Convertir tipo + cambiar defaults.
--    timestamp(0) = sin fracciones de segundo (sin milisegundos).
ALTER TABLE service_reports
  ALTER COLUMN created_at DROP DEFAULT,
  ALTER COLUMN created_at TYPE timestamp(0)
    USING (created_at AT TIME ZONE 'Europe/Madrid'),
  ALTER COLUMN created_at SET DEFAULT (now() AT TIME ZONE 'Europe/Madrid'),
  ALTER COLUMN updated_at DROP DEFAULT,
  ALTER COLUMN updated_at TYPE timestamp(0)
    USING (updated_at AT TIME ZONE 'Europe/Madrid'),
  ALTER COLUMN updated_at SET DEFAULT (now() AT TIME ZONE 'Europe/Madrid');

-- 3. Función + trigger específicos de service_reports
CREATE OR REPLACE FUNCTION set_updated_at_service_reports()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at := (now() AT TIME ZONE 'Europe/Madrid');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_service_reports_updated_at ON service_reports;
CREATE TRIGGER trg_service_reports_updated_at
  BEFORE UPDATE ON service_reports
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at_service_reports();

NOTIFY pgrst, 'reload schema';
