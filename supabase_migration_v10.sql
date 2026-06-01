-- ============================================================
-- Migración v10 — Storage público para firmas de entrega de llaves
-- ============================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('firmas-entrega', 'firmas-entrega', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "Firmas entrega upload" ON storage.objects;
CREATE POLICY "Firmas entrega upload"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'firmas-entrega');

DROP POLICY IF EXISTS "Firmas entrega update" ON storage.objects;
CREATE POLICY "Firmas entrega update"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'firmas-entrega');

DROP POLICY IF EXISTS "Firmas entrega read public" ON storage.objects;
CREATE POLICY "Firmas entrega read public"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'firmas-entrega');

NOTIFY pgrst, 'reload schema';
