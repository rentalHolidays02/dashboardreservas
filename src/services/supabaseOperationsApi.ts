import { supabase } from './supabaseClient';

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
  getServiceReports: async (): Promise<ServiceReportDB[]> => {
    const { data, error } = await supabase
      .from('service_reports')
      .select('*, workers(full_name, phone)')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching service reports:', error);
      return [];
    }

    return data.map((row: any) => ({
      ...row,
      worker_name: transformWorkerName(row.workers),
      worker_phone: transformWorkerPhone(row.workers),
    }));
  },

  getKeyDeliveries: async (): Promise<KeyDeliveryDB[]> => {
    const { data, error } = await supabase
      .from('key_deliveries')
      .select('*, workers(full_name, phone)')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching key deliveries:', error);
      return [];
    }

    return data.map((row: any) => ({
      ...row,
      worker_name: transformWorkerName(row.workers),
      worker_phone: transformWorkerPhone(row.workers),
    }));
  },

  getIncidentReports: async (): Promise<IncidentReportDB[]> => {
    const { data, error } = await supabase
      .from('incident_reports')
      .select('*, workers(full_name, phone)')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching incident reports:', error);
      return [];
    }

    return data.map((row: any) => ({
      ...row,
      worker_name: transformWorkerName(row.workers),
      worker_phone: transformWorkerPhone(row.workers),
    }));
  },

  deleteRecord: async (table: 'service_reports' | 'key_deliveries' | 'incident_reports', id: string) => {
    const { error } = await supabase.from(table).delete().eq('id', id);
    return !error;
  }
};
