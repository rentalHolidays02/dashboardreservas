-- =============================================================
-- MIGRACIÓN v3: Refuerzo de tabla accommodations
-- Ejecutar en Supabase > SQL Editor
-- =============================================================

-- Asegurar que la tabla existe y tiene las columnas necesarias
CREATE TABLE IF NOT EXISTS accommodations (
  id          uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text    UNIQUE NOT NULL,
  ref         text    DEFAULT '',
  address     text    DEFAULT '',
  city        text    DEFAULT '',
  zip_code    text    DEFAULT '',
  provincia   text    DEFAULT '',
  notes       text    DEFAULT '',
  active      boolean DEFAULT true,
  image_url   text,
  created_at  timestamp with time zone DEFAULT now()
);

-- Si la tabla ya existía, asegurar que las columnas nuevas están presentes
ALTER TABLE accommodations 
  ADD COLUMN IF NOT EXISTS ref        text    DEFAULT '',
  ADD COLUMN IF NOT EXISTS provincia  text    DEFAULT '',
  ADD COLUMN IF NOT EXISTS image_url  text,
  ADD COLUMN IF NOT EXISTS active     boolean DEFAULT true;

-- Habilitar RLS
ALTER TABLE accommodations ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS
-- Permitir lectura a todos los usuarios autenticados
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Permitir lectura a autenticados' AND tablename = 'accommodations') THEN
        CREATE POLICY "Permitir lectura a autenticados" ON accommodations
          FOR SELECT TO authenticated USING (true);
    END IF;
END $$;

-- Permitir escritura a autenticados (Admin/Editor en el front se encarga de la lógica)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Permitir escritura a autenticados' AND tablename = 'accommodations') THEN
        CREATE POLICY "Permitir escritura a autenticados" ON accommodations
          FOR ALL TO authenticated USING (true);
    END IF;
END $$;

-- Forzar recarga del schema cache
NOTIFY pgrst, 'reload schema';
