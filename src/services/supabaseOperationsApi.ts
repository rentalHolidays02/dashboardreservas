import { supabase } from './supabaseClient';

export interface WorkerOption {
  id: string;
  full_name: string;
  phone: string;
}

export interface ServiceReportDB {
  id: string;
  worker_id: string;
  worker_name: string;
  worker_phone: string;
  kind: 'reserva' | 'manitas';
  accommodation_id: string | null;
  accommodation_name: string;
  hora_entrada: string | null;
  hora_salida: string | null;
  km: number;
  recoge_llaves: boolean;
  sigue_huesped: boolean;
  hora_salida_huesped: string | null;
  horas_extra: string;
  justificacion_extra: string;
  notas: string;
  created_at: string;
}

export interface KeyDeliveryDB {
  id: string;
  worker_id: string;
  worker_name: string;
  worker_phone: string;
  parent_service_id: string | null;
  parent_service_kind?: string | null;
  accommodation_id: string | null;
  accommodation_name: string;
  nombre_cliente: string;
  fecha_entrada_reserva: string | null;
  fecha_salida_reserva: string | null;
  sabanas_entregadas: boolean;
  sabanas_personas: number | null;
  fianza_monto_metodo: string | null;
  bizum_monto: string;
  cantidad_pagada_monto: number;
  fianza_garantia_metodo: string | null;
  bizum_garantia: string;
  cantidad_pagada_garantia: number;
  km: number;
  observaciones: string;
  firma_trabajador_url: string | null;
  firma_huesped_url: string | null;
  created_at: string;
}

export interface IncidentReportDB {
  id: string;
  worker_id: string;
  worker_name: string;
  worker_phone: string;
  parent_service_id: string | null;
  parent_service_kind?: string | null;
  accommodation_id: string | null;
  accommodation_name: string;
  duracion: string;
  detalles: string;
  created_at: string;
}

// Helpers
const transformWorkerName = (worker: any) => worker ? worker.full_name : 'Desconocido';
const transformWorkerPhone = (worker: any) => worker ? worker.phone : '';

export const supabaseOperationsApi = {

  // ── Workers ──────────────────────────────────────────────
  getWorkers: async (): Promise<WorkerOption[]> => {
    const { data, error } = await supabase
      .from('workers')
      .select('id, full_name, phone')
      .order('full_name');
    if (error) { console.error('Error fetching workers:', error); return []; }
    return data;
  },

  // ── Accommodations ───────────────────────────────────────
  getAccommodations: async (): Promise<{ id: string, name: string }[]> => {
    const { data, error } = await supabase
      .from('accommodations')
      .select('id, name')
      .order('name');
    if (error) { console.error('Error fetching accommodations:', error); return []; }
    return data;
  },

  // ── Service Reports ───────────────────────────────────────
  getServiceReports: async (): Promise<ServiceReportDB[]> => {
    const { data, error } = await supabase
      .from('service_reports')
      .select('*, workers(full_name, phone)')
      .order('created_at', { ascending: false });

    if (error) { console.error('Error fetching service reports:', error); return []; }

    return data.map((row: any) => ({
      ...row,
      worker_name: transformWorkerName(row.workers),
      worker_phone: transformWorkerPhone(row.workers),
    }));
  },

  createServiceReport: async (payload: {
    worker_id: string;
    kind: 'reserva' | 'manitas';
    accommodation_id?: string | null;
    accommodation_name: string;
    hora_entrada?: string | null;
    hora_salida?: string | null;
    km?: number;
    recoge_llaves?: boolean;
    sigue_huesped?: boolean;
    hora_salida_huesped?: string | null;
    horas_extra?: string;
    justificacion_extra?: string;
    notas?: string;
  }): Promise<ServiceReportDB | null> => {
    const { data, error } = await supabase
      .from('service_reports')
      .insert({ ...payload })
      .select('*, workers(full_name, phone)')
      .single();
    if (error) { console.error('Error creating service report:', error); return null; }
    return { ...data, worker_name: transformWorkerName(data.workers), worker_phone: transformWorkerPhone(data.workers) };
  },

  updateServiceReport: async (id: string, payload: Partial<Omit<ServiceReportDB, 'id' | 'worker_id' | 'worker_name' | 'worker_phone' | 'submitted_at'>>): Promise<boolean> => {
    const { error } = await supabase.from('service_reports').update(payload).eq('id', id);
    if (error) { console.error('Error updating service report:', error); return false; }
    return true;
  },

  // ── Key Deliveries ────────────────────────────────────────
  getKeyDeliveries: async (): Promise<KeyDeliveryDB[]> => {
    const { data, error } = await supabase
      .from('key_deliveries')
      .select('*, workers(full_name, phone), parent_service:service_reports(kind)')
      .order('created_at', { ascending: false });

    if (error) { console.error('Error fetching key deliveries:', error); return []; }

    return data.map((row: any) => ({
      ...row,
      worker_name: transformWorkerName(row.workers),
      worker_phone: transformWorkerPhone(row.workers),
      parent_service_kind: row.parent_service ? row.parent_service.kind : null,
    }));
  },

  createKeyDelivery: async (payload: {
    worker_id: string;
    parent_service_id?: string | null;
    accommodation_id?: string | null;
    accommodation_name: string;
    nombre_cliente?: string;
    fecha_entrada_reserva?: string | null;
    fecha_salida_reserva?: string | null;
    sabanas_entregadas?: boolean;
    sabanas_personas?: number | null;
    fianza_monto_metodo?: string | null;
    cantidad_pagada_monto?: number;
    bizum_monto?: string;
    fianza_garantia_metodo?: string | null;
    cantidad_pagada_garantia?: number;
    bizum_garantia?: string;
    km?: number;
    observaciones?: string;
    firma_trabajador_url?: string | null;
    firma_huesped_url?: string | null;
  }): Promise<KeyDeliveryDB | null> => {
    const { data, error } = await supabase
      .from('key_deliveries')
      .insert({ ...payload })
      .select('*, workers(full_name, phone)')
      .single();
    if (error) { console.error('Error creating key delivery:', error); return null; }
    return { ...data, worker_name: transformWorkerName(data.workers), worker_phone: transformWorkerPhone(data.workers) };
  },

  updateKeyDelivery: async (id: string, payload: Partial<Omit<KeyDeliveryDB, 'id' | 'worker_id' | 'worker_name' | 'worker_phone' | 'submitted_at'>>): Promise<boolean> => {
    const { error } = await supabase.from('key_deliveries').update(payload).eq('id', id);
    if (error) { console.error('Error updating key delivery:', error); return false; }
    return true;
  },

  // ── Incident Reports ──────────────────────────────────────
  getIncidentReports: async (): Promise<IncidentReportDB[]> => {
    const { data, error } = await supabase
      .from('incident_reports')
      .select('*, workers(full_name, phone), parent_service:service_reports(kind)')
      .order('created_at', { ascending: false });

    if (error) { console.error('Error fetching incident reports:', error); return []; }

    return data.map((row: any) => ({
      ...row,
      worker_name: transformWorkerName(row.workers),
      worker_phone: transformWorkerPhone(row.workers),
      parent_service_kind: row.parent_service ? row.parent_service.kind : null,
    }));
  },

  createIncidentReport: async (payload: {
    worker_id: string;
    parent_service_id?: string | null;
    accommodation_id?: string | null;
    accommodation_name: string;
    duracion?: string;
    detalles?: string;
  }): Promise<IncidentReportDB | null> => {
    const { data, error } = await supabase
      .from('incident_reports')
      .insert({ ...payload })
      .select('*, workers(full_name, phone)')
      .single();
    if (error) { console.error('Error creating incident report:', error); return null; }
    return { ...data, worker_name: transformWorkerName(data.workers), worker_phone: transformWorkerPhone(data.workers) };
  },

  updateIncidentReport: async (id: string, payload: Partial<Omit<IncidentReportDB, 'id' | 'worker_id' | 'worker_name' | 'worker_phone' | 'submitted_at'>>): Promise<boolean> => {
    const { error } = await supabase.from('incident_reports').update(payload).eq('id', id);
    if (error) { console.error('Error updating incident report:', error); return false; }
    return true;
  },

  // ── Delete ─────────────────────────────────────────────────
  deleteRecord: async (table: 'service_reports' | 'key_deliveries' | 'incident_reports', id: string) => {
    const { error } = await supabase.from(table).delete().eq('id', id);
    return !error;
  }
};
