-- ============================================================
-- Migración v11 — Permitir a administradores borrar perfiles
-- Ejecutar en Supabase → SQL Editor (después de v10)
-- ============================================================

-- Función auxiliar (evita recursión RLS al comprobar rol admin)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'admin'
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Borrar perfiles (Gestión de usuarios → Eliminar)
DROP POLICY IF EXISTS "Admins pueden borrar perfiles" ON public.profiles;
CREATE POLICY "Admins pueden borrar perfiles"
  ON public.profiles
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- Actualizar cualquier perfil (editar rol, nombre, teléfono de otros usuarios)
DROP POLICY IF EXISTS "Admins pueden actualizar perfiles" ON public.profiles;
CREATE POLICY "Admins pueden actualizar perfiles"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Insertar perfiles al crear / upsert desde la app
DROP POLICY IF EXISTS "Admins pueden insertar perfiles" ON public.profiles;
CREATE POLICY "Admins pueden insertar perfiles"
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

-- Leer todos los perfiles (listado en Gestión de usuarios)
DROP POLICY IF EXISTS "Admins pueden leer todos los perfiles" ON public.profiles;
CREATE POLICY "Admins pueden leer todos los perfiles"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (public.is_admin() OR auth.uid() = id);

NOTIFY pgrst, 'reload schema';
