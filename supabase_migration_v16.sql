-- v16: Limpieza en cascada al borrar usuarios de auth.users
--
-- Problema:
--   Cuando se borra un usuario desde Supabase Authentication (auth.users), la fila
--   correspondiente en public.profiles permanecía huérfana, y workers.profile_id
--   apuntando a un perfil ya inexistente seguía marcando al trabajador como "asignado",
--   impidiendo reasignarlo desde el panel.
--
-- Solución:
--   1) profiles.id → auth.users.id  con ON DELETE CASCADE.
--   2) workers.profile_id → profiles.id  con ON DELETE SET NULL.
--
-- IMPORTANTE: hay que limpiar los huérfanos ANTES de crear los nuevos FK,
-- si no Postgres rechaza el ADD CONSTRAINT con 23503.

-- ── 1. LIMPIAR HUÉRFANOS PREVIOS ──

-- workers.profile_id apuntando a profiles inexistentes → resetea a NULL.
UPDATE public.workers w
SET profile_id = NULL
WHERE profile_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = w.profile_id);

-- profiles.id sin contraparte en auth.users → huérfanos por borrados manuales previos.
-- Antes de borrar el profile, libera cualquier worker que aún lo referencie.
UPDATE public.workers w
SET profile_id = NULL
WHERE profile_id IN (
  SELECT p.id FROM public.profiles p
  WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p.id)
);

DELETE FROM public.profiles p
WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p.id);

-- ── 2. profiles.id → auth.users.id ──
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_id_fkey;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_id_fkey
  FOREIGN KEY (id)
  REFERENCES auth.users(id)
  ON DELETE CASCADE;

-- ── 3. workers.profile_id → profiles.id ──
ALTER TABLE public.workers
  DROP CONSTRAINT IF EXISTS workers_profile_id_fkey;

ALTER TABLE public.workers
  ADD CONSTRAINT workers_profile_id_fkey
  FOREIGN KEY (profile_id)
  REFERENCES public.profiles(id)
  ON DELETE SET NULL;
