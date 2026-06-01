-- ============================================================
-- Migración v8 — Avatar de perfil de usuario
-- ============================================================

-- 1. Añadir columna avatar_url a profiles (si no existe)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS avatar_url TEXT DEFAULT NULL;

-- 2. Crear bucket de Storage para avatares (público)
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 3. Política RLS: cada usuario puede subir/actualizar su propio avatar
DROP POLICY IF EXISTS "Avatar upload own" ON storage.objects;
CREATE POLICY "Avatar upload own"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Avatar update own" ON storage.objects;
CREATE POLICY "Avatar update own"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Avatar read public" ON storage.objects;
CREATE POLICY "Avatar read public"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'avatars');

-- 4. Política RLS: el usuario puede actualizar su propio avatar_url en profiles
DROP POLICY IF EXISTS "Profile update avatar" ON profiles;
CREATE POLICY "Profile update avatar"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- ============================================================
-- INSTRUCCIONES MANUALES (si el bucket no se creó por SQL):
-- 1. Ve a Supabase → Storage → New bucket
-- 2. Nombre: avatars
-- 3. Marca "Public bucket" → Create
-- ============================================================
