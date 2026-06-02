-- =============================================================
-- MIGRACIÓN v12: Permitir borrar historial de informes
-- Ejecutar en Supabase > SQL Editor
-- =============================================================

ALTER TABLE report_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins y usuarios borran su historial" ON report_history;

CREATE POLICY "Admins y usuarios borran su historial"
ON report_history
FOR DELETE
TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
  )
);

NOTIFY pgrst, 'reload schema';

