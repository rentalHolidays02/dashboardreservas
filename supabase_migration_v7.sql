-- =============================================================
-- MIGRACIÓN v7: Añadir columnas phone y last_seen a profiles
-- Ejecutar en Supabase > SQL Editor
-- =============================================================

-- 1. Añadir columnas a la tabla profiles si no existen
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_seen TIMESTAMPTZ;

-- 2. Asegurar políticas RLS para permitir a usuarios actualizar su propia fila
-- (necesario para el registro de last_seen en tiempo de ejecución)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE policyname = 'Permitir a usuarios actualizar su propio perfil' 
          AND tablename = 'profiles'
    ) THEN
        CREATE POLICY "Permitir a usuarios actualizar su propio perfil" 
        ON profiles
        FOR UPDATE
        TO authenticated
        USING (auth.uid() = id)
        WITH CHECK (auth.uid() = id);
    END IF;
END $$;

-- 3. Forzar la recarga del caché de esquemas de PostgREST
NOTIFY pgrst, 'reload schema';
