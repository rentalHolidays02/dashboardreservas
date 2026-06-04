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
  observaciones?: string;     // sólo reserva
  descripcion?: string;       // sólo manitas
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

  const row = {
    worker_id: workerId,
    kind: input.kind,
    accommodation_id: input.accommodationId ?? null,
    accommodation_name: input.accommodationName,
    hora_entrada: emptyToNull(input.horaEntrada),
    hora_salida: emptyToNull(input.horaSalida),
    km: input.km ?? 0,
    observaciones: input.observaciones ?? '',
    descripcion: input.descripcion ?? '',
    recoge_llaves: input.recogeLlaves ?? false,
    sigue_huesped: input.sigueHuesped ?? false,
    hora_salida_huesped: emptyToNull(input.horaSalidaHuesped),
    horas_extra: input.horasExtra || '0',
    justificacion_extra: input.justificacionExtra ?? '',
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
    bizum_monto: input.fianzaMontoMetodo === 'Bizum' ? input.bizumMonto ?? '' : '',
    cantidad_pagada_monto: input.cantidadPagadaMonto ?? 0,
    fianza_garantia_metodo: input.fianzaGarantiaMetodo,
    bizum_garantia: input.fianzaGarantiaMetodo === 'Bizum' ? input.bizumGarantia ?? '' : '',
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

  const row = {
    worker_id: workerId,
    parent_service_id: input.parentServiceId ?? null,
    accommodation_id: input.accommodationId ?? null,
    accommodation_name: input.accommodationName,
    duracion: input.duracion || '0',
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
