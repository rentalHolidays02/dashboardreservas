-- v18: soft-delete para workers
-- Añade deleted_at. Borrado definitivo desde papelera hace CASCADE real.

ALTER TABLE workers ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;

-- FKs en cascada para borrado definitivo (si no existen ya)
ALTER TABLE service_reports
  DROP CONSTRAINT IF EXISTS service_reports_worker_id_fkey,
  ADD CONSTRAINT service_reports_worker_id_fkey
    FOREIGN KEY (worker_id) REFERENCES workers(id) ON DELETE CASCADE;

ALTER TABLE key_deliveries
  DROP CONSTRAINT IF EXISTS key_deliveries_worker_id_fkey,
  ADD CONSTRAINT key_deliveries_worker_id_fkey
    FOREIGN KEY (worker_id) REFERENCES workers(id) ON DELETE CASCADE;

ALTER TABLE incident_reports
  DROP CONSTRAINT IF EXISTS incident_reports_worker_id_fkey,
  ADD CONSTRAINT incident_reports_worker_id_fkey
    FOREIGN KEY (worker_id) REFERENCES workers(id) ON DELETE CASCADE;

ALTER TABLE report_drafts
  DROP CONSTRAINT IF EXISTS report_drafts_worker_id_fkey,
  ADD CONSTRAINT report_drafts_worker_id_fkey
    FOREIGN KEY (worker_id) REFERENCES workers(id) ON DELETE CASCADE;

ALTER TABLE worker_sensitive_data
  DROP CONSTRAINT IF EXISTS worker_sensitive_data_id_fkey,
  ADD CONSTRAINT worker_sensitive_data_id_fkey
    FOREIGN KEY (id) REFERENCES workers(id) ON DELETE CASCADE;

ALTER TABLE worker_accommodations
  DROP CONSTRAINT IF EXISTS worker_accommodations_worker_id_fkey,
  ADD CONSTRAINT worker_accommodations_worker_id_fkey
    FOREIGN KEY (worker_id) REFERENCES workers(id) ON DELETE CASCADE;
