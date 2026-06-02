-- =============================================================
-- MIGRACIÓN v13: Reforzar políticas de historial y actividad
-- Ejecutar en Supabase > SQL Editor
-- =============================================================

ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir a usuarios autenticados insertar logs" ON activity_log;
DROP POLICY IF EXISTS "Permitir a usuarios ver sus propios logs o a administradores ver todo" ON activity_log;
CREATE POLICY "Permitir a usuarios autenticados insertar logs"
ON activity_log
FOR INSERT
TO authenticated
WITH CHECK (true);
CREATE POLICY "Permitir a usuarios ver sus propios logs o a administradores ver todo"
ON activity_log
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
  )
);

DROP POLICY IF EXISTS "Usuarios autenticados pueden insertar informes" ON report_history;
DROP POLICY IF EXISTS "Admins ven todos los informes; usuarios los suyos" ON report_history;
DROP POLICY IF EXISTS "Admins y usuarios borran su historial" ON report_history;
CREATE POLICY "Usuarios autenticados pueden insertar informes"
ON report_history
FOR INSERT
TO authenticated
WITH CHECK (true);
CREATE POLICY "Admins ven todos los informes; usuarios los suyos"
ON report_history
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
  )
);

CREATE POLICY "Admins y usuarios borran su historial"
ON report_history
FOR DELETE
TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
  )
);

NOTIFY pgrst, 'reload schema';

