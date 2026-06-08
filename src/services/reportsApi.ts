import { supabase } from './supabaseClient';

export type ServiceKind = 'reserva' | 'manitas';
export type DraftKind = 'service' | 'key_delivery' | 'incident';
export type MetodoPagoDB = 'Efectivo' | 'Tarjeta' | 'Bizum';

// ─── Tipos del payload (camelCase en el front, snake_case en DB) ─────────

export interface ServiceReportInput {
  kind: ServiceKind;
  accommodationId?: string | null;
  accommodationName: string;
  horaEntrada?: string;       // HH:MM
  horaSalida?: string;        // HH:MM
  km?: number;
  notas?: string;             // texto libre (observaciones reserva / descripción manitas)
  recogeLlaves?: boolean;
  sigueHuesped?: boolean;
  horaSalidaHuesped?: string; // HH:MM, sólo si sigueHuesped
  horasExtra?: string;        // HH:MM
  justificacionExtra?: string;
}

export interface KeyDeliveryInput {
  parentServiceId?: string | null;
  accommodationId?: string | null;
  accommodationName: string;
  nombreCliente: string;
  fechaEntradaReserva?: string;   // datetime-local "YYYY-MM-DDTHH:mm"
  fechaSalidaReserva?: string;
  sabanasEntregadas: boolean;
  sabanasPersonas?: number | null;
  fianzaMontoMetodo: MetodoPagoDB;
  bizumMonto?: string;
  cantidadPagadaMonto?: number;
  fianzaGarantiaMetodo: MetodoPagoDB;
  bizumGarantia?: string;
  cantidadPagadaGarantia?: number;
  km?: number;
  observaciones?: string;
  firmaTrabajadorBase64?: string; // data:image/...
  firmaHuespedBase64?: string;
}

export interface IncidentReportInput {
  parentServiceId?: string | null;
  accommodationId?: string | null;
  accommodationName: string;
  duracion: string;   // HH:MM
  detalles: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────

const emptyToNull = <T>(v: T | undefined | ''): T | null =>
  v === undefined || v === '' ? null : (v as T);

// Quita espacios (y otros no-dígitos por seguridad) → "612 34 56 78" → "612345678".
const stripBizum = (v: string | undefined): string =>
  (v ?? '').replace(/\D/g, '');

// Devuelve el worker_id del trabajador conectado (vía profile_id = auth.uid()).
export const getCurrentWorkerId = async (): Promise<string | null> => {
  const { data: auth, error: authErr } = await supabase.auth.getUser();
  if (authErr || !auth.user) return null;
  const { data, error } = await supabase
    .from('workers')
    .select('id')
    .eq('profile_id', auth.user.id)
    .maybeSingle();
  if (error || !data) return null;
  return data.id as string;
};

// Sube una firma (data:image/png;base64,…) a Storage y devuelve URL pública.
export const uploadSignature = async (
  base64: string,
  filenamePrefix: string
): Promise<string | null> => {
  if (!base64?.startsWith('data:image/')) return null;
  try {
    const match = base64.match(/^data:(image\/\w+);base64,(.+)$/);
    if (!match) return null;
    const mime = match[1];
    const ext = mime.split('/')[1] || 'png';
    const b64 = match[2];
    // Decodifica base64 → bytes
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const blob = new Blob([bytes], { type: mime });

    const path = `${filenamePrefix}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage
      .from('signatures')
      .upload(path, blob, { contentType: mime, upsert: false });
    if (error) {
      console.error('[reportsApi] uploadSignature error:', error);
      return null;
    }
    const { data } = supabase.storage.from('signatures').getPublicUrl(path);
    return data.publicUrl;
  } catch (e) {
    console.error('[reportsApi] uploadSignature exception:', e);
    return null;
  }
};

// ─── service_reports ─────────────────────────────────────────────────────

export const submitServiceReport = async (input: ServiceReportInput): Promise<string> => {
  const workerId = await getCurrentWorkerId();
  if (!workerId) throw new Error('No hay trabajador asociado a esta cuenta');

  const isManitas = input.kind === 'manitas';
  const row = {
    worker_id: workerId,
    kind: input.kind,
    accommodation_id: input.accommodationId ?? null,
    accommodation_name: input.accommodationName,
    hora_entrada: emptyToNull(input.horaEntrada),
    hora_salida: emptyToNull(input.horaSalida),
    km: input.km ?? 0,
    notas: input.notas ?? '',
    // Campos exclusivos de reserva → si es manitas, forzamos los valores neutros
    // que el CHECK constraint exige.
    recoge_llaves: isManitas ? false : (input.recogeLlaves ?? false),
    sigue_huesped: isManitas ? false : (input.sigueHuesped ?? false),
    hora_salida_huesped: isManitas ? null : emptyToNull(input.horaSalidaHuesped),
    horas_extra: isManitas ? '00:00' : (input.horasExtra || '00:00'),
    justificacion_extra: isManitas ? '' : (input.justificacionExtra ?? ''),
  };

  const { data, error } = await supabase
    .from('service_reports')
    .insert(row)
    .select('id')
    .single();
  if (error) throw error;
  return data.id as string;
};

// ─── key_deliveries ──────────────────────────────────────────────────────

export const submitKeyDelivery = async (input: KeyDeliveryInput): Promise<string> => {
  const workerId = await getCurrentWorkerId();
  if (!workerId) throw new Error('No hay trabajador asociado a esta cuenta');

  // Sube las firmas si vienen como base64
  const firmaTrabajadorUrl = input.firmaTrabajadorBase64
    ? await uploadSignature(input.firmaTrabajadorBase64, `trabajador-${workerId}`)
    : null;
  const firmaHuespedUrl = input.firmaHuespedBase64
    ? await uploadSignature(input.firmaHuespedBase64, `huesped-${workerId}`)
    : null;

  const row = {
    worker_id: workerId,
    parent_service_id: input.parentServiceId ?? null,
    accommodation_id: input.accommodationId ?? null,
    accommodation_name: input.accommodationName,
    nombre_cliente: input.nombreCliente,
    fecha_entrada_reserva: emptyToNull(input.fechaEntradaReserva),
    fecha_salida_reserva: emptyToNull(input.fechaSalidaReserva),
    sabanas_entregadas: input.sabanasEntregadas,
    sabanas_personas: input.sabanasEntregadas ? input.sabanasPersonas ?? null : null,
    fianza_monto_metodo: input.fianzaMontoMetodo,
    bizum_monto: input.fianzaMontoMetodo === 'Bizum' ? stripBizum(input.bizumMonto) : '',
    cantidad_pagada_monto: input.cantidadPagadaMonto ?? 0,
    fianza_garantia_metodo: input.fianzaGarantiaMetodo,
    bizum_garantia: input.fianzaGarantiaMetodo === 'Bizum' ? stripBizum(input.bizumGarantia) : '',
    cantidad_pagada_garantia: input.cantidadPagadaGarantia ?? 0,
    km: input.km ?? 0,
    observaciones: input.observaciones ?? '',
    firma_trabajador_url: firmaTrabajadorUrl,
    firma_huesped_url: firmaHuespedUrl,
  };

  const { data, error } = await supabase
    .from('key_deliveries')
    .insert(row)
    .select('id')
    .single();
  if (error) throw error;
  return data.id as string;
};

// ─── incident_reports ────────────────────────────────────────────────────

export const submitIncidentReport = async (input: IncidentReportInput): Promise<string> => {
  const workerId = await getCurrentWorkerId();
  if (!workerId) throw new Error('No hay trabajador asociado a esta cuenta');

  // duracion ahora es text con CHECK ^HH:MM$ → si no es válido, '00:00'.
  const validHHMM = /^([0-9]{1,2}):[0-5][0-9]$/.test(input.duracion);
  const row = {
    worker_id: workerId,
    parent_service_id: input.parentServiceId ?? null,
    accommodation_id: input.accommodationId ?? null,
    accommodation_name: input.accommodationName,
    duracion: validHHMM ? input.duracion : '00:00',
    detalles: input.detalles,
  };

  const { data, error } = await supabase
    .from('incident_reports')
    .insert(row)
    .select('id')
    .single();
  if (error) throw error;
  return data.id as string;
};

// ─── report_drafts ───────────────────────────────────────────────────────

export interface DraftRow {
  id: string;
  workerId: string;
  kind: DraftKind;
  payload: unknown;
  createdAt: string;
  updatedAt: string;
}

const mapDraftRow = (r: any): DraftRow => ({
  id: r.id,
  workerId: r.worker_id,
  kind: r.kind,
  payload: r.payload,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

// Crea o actualiza un borrador (si `id` viene, hace upsert; si no, inserta).
export const saveDraft = async <T>(
  kind: DraftKind,
  payload: T,
  id?: string
): Promise<string> => {
  const workerId = await getCurrentWorkerId();
  if (!workerId) throw new Error('No hay trabajador asociado a esta cuenta');

  if (id) {
    const { error } = await supabase
      .from('report_drafts')
      .update({ payload, kind })
      .eq('id', id);
    if (error) throw error;
    return id;
  }

  const { data, error } = await supabase
    .from('report_drafts')
    .insert({ worker_id: workerId, kind, payload })
    .select('id')
    .single();
  if (error) throw error;
  return data.id as string;
};

export const listDrafts = async (kind?: DraftKind): Promise<DraftRow[]> => {
  const workerId = await getCurrentWorkerId();
  if (!workerId) return [];

  let q = supabase
    .from('report_drafts')
    .select('*')
    .eq('worker_id', workerId)
    .order('updated_at', { ascending: false });

  if (kind) q = q.eq('kind', kind);

  const { data, error } = await q;
  if (error) throw error;
  return (data || []).map(mapDraftRow);
};

export const loadDraft = async (id: string): Promise<DraftRow | null> => {
  const { data, error } = await supabase
    .from('report_drafts')
    .select('*')
    .eq('id', id)
    .single();
  if (error) return null;
  return mapDraftRow(data);
};

export const deleteDraft = async (id: string): Promise<void> => {
  const { error } = await supabase.from('report_drafts').delete().eq('id', id);
  if (error) throw error;
};

// ─── Lectores para vistas del trabajador (Inicio + Historial) ────────────

export interface MyWorkerRow {
  id: string;
  fullName: string;
  pagoPorReserva: number;
  pagoPorReservaAdicional: number;
  precioPorKm: number;
  pagoPorServicioSabanas: number;
  pagoPorIncidencia: number;
}

// Devuelve el worker autenticado con su subset de tarifas.
export const getMyWorker = async (): Promise<MyWorkerRow | null> => {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const { data, error } = await supabase
    .from('workers')
    .select('id, full_name, pay_per_reservation, pay_per_extra_reservation, price_per_km, pay_per_linen_service, pay_per_incident')
    .eq('profile_id', auth.user.id)
    .maybeSingle();
  if (error || !data) return null;
  return {
    id: data.id,
    fullName: data.full_name,
    pagoPorReserva: Number(data.pay_per_reservation || 0),
    pagoPorReservaAdicional: Number(data.pay_per_extra_reservation || 0),
    precioPorKm: Number(data.price_per_km || 0),
    pagoPorServicioSabanas: Number(data.pay_per_linen_service || 0),
    pagoPorIncidencia: Number(data.pay_per_incident || 0),
  };
};

export interface ServiceReportRow {
  id: string;
  kind: 'reserva' | 'manitas';
  accommodationName: string;
  horaEntrada: string | null;
  horaSalida: string | null;
  km: number;
  notas: string;
  horasExtra: string;
  createdAt: string;
}

export const listMyServiceReports = async (): Promise<ServiceReportRow[]> => {
  const workerId = await getCurrentWorkerId();
  if (!workerId) return [];
  const { data, error } = await supabase
    .from('service_reports')
    .select('id, kind, accommodation_name, hora_entrada, hora_salida, km, notas, horas_extra, created_at')
    .eq('worker_id', workerId)
    .order('created_at', { ascending: false });
  if (error) return [];
  return (data || []).map((r: any) => ({
    id: r.id,
    kind: r.kind,
    accommodationName: r.accommodation_name || '',
    horaEntrada: r.hora_entrada,
    horaSalida: r.hora_salida,
    km: Number(r.km || 0),
    notas: r.notas || '',
    horasExtra: r.horas_extra || '00:00',
    createdAt: r.created_at,
  }));
};

export interface KeyDeliveryRow {
  id: string;
  accommodationName: string;
  nombreCliente: string;
  km: number;
  sabanasEntregadas: boolean;
  sabanasPersonas: number | null;
  fechaEntradaReserva: string | null;
  fechaSalidaReserva: string | null;
  observaciones: string;
  createdAt: string;
}

export const listMyKeyDeliveries = async (): Promise<KeyDeliveryRow[]> => {
  const workerId = await getCurrentWorkerId();
  if (!workerId) return [];
  const { data, error } = await supabase
    .from('key_deliveries')
    .select('id, accommodation_name, nombre_cliente, km, sabanas_entregadas, sabanas_personas, fecha_entrada_reserva, fecha_salida_reserva, observaciones, created_at')
    .eq('worker_id', workerId)
    .order('created_at', { ascending: false });
  if (error) return [];
  return (data || []).map((r: any) => ({
    id: r.id,
    accommodationName: r.accommodation_name || '',
    nombreCliente: r.nombre_cliente || '',
    km: Number(r.km || 0),
    sabanasEntregadas: !!r.sabanas_entregadas,
    sabanasPersonas: r.sabanas_personas ?? null,
    fechaEntradaReserva: r.fecha_entrada_reserva,
    fechaSalidaReserva: r.fecha_salida_reserva,
    observaciones: r.observaciones || '',
    createdAt: r.created_at,
  }));
};

export interface IncidentReportRow {
  id: string;
  accommodationName: string;
  duracion: string;
  detalles: string;
  createdAt: string;
}

export const listMyIncidentReports = async (): Promise<IncidentReportRow[]> => {
  const workerId = await getCurrentWorkerId();
  if (!workerId) return [];
  const { data, error } = await supabase
    .from('incident_reports')
    .select('id, accommodation_name, duracion, detalles, created_at')
    .eq('worker_id', workerId)
    .order('created_at', { ascending: false });
  if (error) return [];
  return (data || []).map((r: any) => ({
    id: r.id,
    accommodationName: r.accommodation_name || '',
    duracion: r.duracion || '00:00',
    detalles: r.detalles || '',
    createdAt: r.created_at,
  }));
};
