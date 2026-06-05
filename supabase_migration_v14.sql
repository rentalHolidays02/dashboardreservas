-- =============================================================
-- MIGRACIÓN v14: Columnas locales (Europe/Madrid) en service_reports
-- Ejecutar en Supabase > SQL Editor
--
-- Motivo: created_at / updated_at son timestamptz (UTC). Supabase
-- Studio los renderiza en UTC, que en CEST aparece "2 h antes". Estas
-- columnas generadas devuelven la misma información ya en hora civil
-- de Madrid para inspección visual; las originales siguen siendo la
-- fuente de verdad.
-- =============================================================

ALTER TABLE service_reports
  ADD COLUMN IF NOT EXISTS created_at_madrid timestamp
    GENERATED ALWAYS AS (created_at AT TIME ZONE 'Europe/Madrid') STORED,
  ADD COLUMN IF NOT EXISTS updated_at_madrid timestamp
    GENERATED ALWAYS AS (updated_at AT TIME ZONE 'Europe/Madrid') STORED;

NOTIFY pgrst, 'reload schema';
