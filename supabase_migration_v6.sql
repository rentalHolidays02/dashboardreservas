-- =============================================================
-- MIGRACIÓN v6: Tabla para el historial de informes generados
-- Ejecutar en Supabase > SQL Editor
-- =============================================================

-- 1. Crear la tabla de historial de informes
CREATE TABLE IF NOT EXISTS report_history (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID REFERENCES profiles(id) ON DELETE SET NULL,
  user_name     TEXT NOT NULL,
  file_name     TEXT NOT NULL,          -- nombre del PDF (ej: informe_rh_mes-pasado_2026-06-01.pdf)
  periodo       TEXT NOT NULL,          -- 'este-mes', 'mes-pasado', 'trimestre', 'personalizado'
  periodo_label TEXT NOT NULL,          -- etiqueta legible (ej: "Mayo 2026")
  worker_name   TEXT,                   -- NULL = todos los trabajadores
  acc_name      TEXT,                   -- NULL = todos los alojamientos
  sections      TEXT[] DEFAULT '{}',    -- secciones incluidas: {'pagos','limpiezas','incidencias','handyman'}
  summary_text  TEXT,                   -- texto con el resumen del informe (KPIs, totales, etc.)
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- 2. Índice para consultas rápidas por fecha
CREATE INDEX IF NOT EXISTS report_history_created_at_idx ON report_history (created_at DESC);

-- 3. Habilitar RLS
ALTER TABLE report_history ENABLE ROW LEVEL SECURITY;

-- 4. Eliminar políticas anteriores si existen
DROP POLICY IF EXISTS "Usuarios autenticados pueden insertar informes" ON report_history;
DROP POLICY IF EXISTS "Admins ven todos los informes; usuarios los suyos" ON report_history;

-- 5. Política INSERT: cualquier usuario autenticado puede guardar informes
CREATE POLICY "Usuarios autenticados pueden insertar informes"
ON report_history
FOR INSERT
TO authenticated
WITH CHECK (true);

-- 6. Política SELECT: admins ven todos; el resto solo los suyos
CREATE POLICY "Admins ven todos los informes; usuarios los suyos"
ON report_history
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
  )
);

-- 7. Recargar esquema PostgREST
NOTIFY pgrst, 'reload schema';
