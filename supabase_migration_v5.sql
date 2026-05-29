-- =============================================================
-- MIGRACIÓN v5: Crear tabla para el registro de logs de actividad
-- Ejecutar en Supabase > SQL Editor
-- =============================================================

-- 1. Crear la tabla de logs de actividad
CREATE TABLE IF NOT EXISTS activity_log (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID REFERENCES profiles(id) ON DELETE SET NULL, -- ID del usuario en Supabase
  user_name   TEXT NOT NULL,                                   -- Nombre de pantalla del usuario
  action      TEXT NOT NULL,                                   -- Descripción detallada de la acción realizada
  action_type TEXT NOT NULL DEFAULT 'general',                 -- Tipo: 'crear_usuario', 'editar_nomina', 'generar_informe', etc.
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- 2. Habilitar la seguridad a nivel de fila (RLS)
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

-- 3. Eliminar políticas si ya existían para evitar fallos de duplicación
DROP POLICY IF EXISTS "Permitir a usuarios autenticados insertar logs" ON activity_log;
DROP POLICY IF EXISTS "Permitir a usuarios ver sus propios logs o a administradores ver todo" ON activity_log;

-- 4. Crear política que permite a cualquier usuario autenticado insertar registros de logs
CREATE POLICY "Permitir a usuarios autenticados insertar logs"
ON activity_log
FOR INSERT
TO authenticated
WITH CHECK (true);

-- 5. Crear política que permite a los usuarios leer sus propios logs y a los administradores ver todos
CREATE POLICY "Permitir a usuarios ver sus propios logs o a administradores ver todo"
ON activity_log
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

-- 6. Forzar la recarga del caché de esquemas de PostgREST para Supabase
NOTIFY pgrst, 'reload schema';
