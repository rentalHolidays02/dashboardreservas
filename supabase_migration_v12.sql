-- ============================================================
-- Migración v12 — Aceptación de Términos y Condiciones
-- Ejecutar en Supabase → SQL Editor (después de v11)
-- ============================================================

-- Fecha (UTC) en la que cada usuario aceptó los T&C al crear su cuenta.
-- NULL = aún no aceptados (cuentas legacy creadas antes de esta migración).
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ;

-- Las RLS existentes de v11 ya permiten:
--   - SELECT: el propio usuario (auth.uid() = id) o admins.
--   - UPDATE: admins. El usuario marca su propia aceptación durante el
--     flujo de invitación, momento en el que aún tiene sesión Supabase
--     iniciada con su UID; añadimos política específica para self-update
--     limitada a esta columna.
DROP POLICY IF EXISTS "Usuarios pueden marcar aceptación de T&C" ON public.profiles;
CREATE POLICY "Usuarios pueden marcar aceptación de T&C"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

NOTIFY pgrst, 'reload schema';
