-- =============================================================
-- MIGRACIÓN v4: Permitir a administradores gestionar datos sensibles
-- Ejecutar en Supabase > SQL Editor
-- =============================================================

-- Asegurar que Row Level Security está activo en la tabla
ALTER TABLE worker_sensitive_data ENABLE ROW LEVEL SECURITY;

-- Eliminar la política si ya existía para evitar duplicados
DROP POLICY IF EXISTS "Permitir a administradores gestionar todos los datos sensibles" ON worker_sensitive_data;

-- Crear la política que permite a usuarios con rol 'admin' realizar
-- cualquier operación (SELECT, INSERT, UPDATE, DELETE) en worker_sensitive_data
CREATE POLICY "Permitir a administradores gestionar todos los datos sensibles" 
ON worker_sensitive_data
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'admin'
  )
);

-- Forzar la recarga del caché de esquemas de PostgREST
NOTIFY pgrst, 'reload schema';
