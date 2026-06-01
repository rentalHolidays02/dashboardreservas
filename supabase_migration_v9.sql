-- ============================================================
-- Migración v9 — Añadir columnas de pago adicionales a workers
-- ============================================================

ALTER TABLE workers
  ADD COLUMN IF NOT EXISTS pay_per_extra_reservation NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pay_per_linen_service NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pay_per_incident NUMERIC DEFAULT 0;

-- Recargar esquema PostgREST para asegurar que la API lo reconozca inmediatamente
NOTIFY pgrst, 'reload schema';
