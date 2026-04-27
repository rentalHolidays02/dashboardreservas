-- =============================================================
-- MIGRACIÓN v2: Añadir detalles de precio y ropa a la relación
--               trabajador <-> alojamiento
-- Ejecutar en Supabase > SQL Editor
-- =============================================================

ALTER TABLE worker_accommodations
  ADD COLUMN IF NOT EXISTS precio        numeric  DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sabanas_incl  boolean  DEFAULT false,
  ADD COLUMN IF NOT EXISTS toallas_incl  boolean  DEFAULT false;

-- Forzar recarga del schema cache de PostgREST para que reconozca
-- las nuevas columnas inmediatamente (sin necesidad de reiniciar)
NOTIFY pgrst, 'reload schema';
