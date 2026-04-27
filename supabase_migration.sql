-- =============================================================
-- MIGRACIÓN: Tabla de Alojamientos y Relación con Trabajadores
-- Ejecutar en Supabase > SQL Editor
-- =============================================================

-- 1. Tabla de alojamientos
CREATE TABLE IF NOT EXISTS accommodations (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name        text NOT NULL,
  ref         text DEFAULT '',
  address     text DEFAULT '',
  city        text DEFAULT '',
  zip_code    text DEFAULT '',
  provincia   text DEFAULT '',
  notes       text DEFAULT '',
  active      boolean DEFAULT true,
  image_url   text,
  created_at  timestamptz DEFAULT now()
);

-- Unicidad por nombre para facilitar el upsert desde Sheets
CREATE UNIQUE INDEX IF NOT EXISTS accommodations_name_idx ON accommodations (name);

-- 2. Tabla pivote trabajador <-> alojamiento
CREATE TABLE IF NOT EXISTS worker_accommodations (
  worker_id        uuid NOT NULL REFERENCES workers(id)        ON DELETE CASCADE,
  accommodation_id uuid NOT NULL REFERENCES accommodations(id) ON DELETE CASCADE,
  PRIMARY KEY (worker_id, accommodation_id)
);

-- 3. Row Level Security
ALTER TABLE accommodations        ENABLE ROW LEVEL SECURITY;
ALTER TABLE worker_accommodations ENABLE ROW LEVEL SECURITY;

-- Usuarios autenticados pueden leer y modificar alojamientos
CREATE POLICY "auth_read_accommodations"   ON accommodations FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert_accommodations" ON accommodations FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update_accommodations" ON accommodations FOR UPDATE TO authenticated USING (true);
CREATE POLICY "auth_delete_accommodations" ON accommodations FOR DELETE TO authenticated USING (true);

-- Usuarios autenticados pueden gestionar las asignaciones
CREATE POLICY "auth_read_wa"   ON worker_accommodations FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert_wa" ON worker_accommodations FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_delete_wa" ON worker_accommodations FOR DELETE TO authenticated USING (true);
