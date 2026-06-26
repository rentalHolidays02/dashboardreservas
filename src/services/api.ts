import {
  MOCK_WORKERS,
  MOCK_CHECKINS,
  MOCK_PAGOS,
  User,
  Worker,
  CheckInOut,
  Incidencia,
  EntregaLlaves,
  NormalCleanRecord,
  InitialCleanRecord,
  HandymanRecord,
  PagoRecord,
  Accommodation,
  MOCK_ACCOMMODATIONS,
  Suggestion,
  WorkerAccommodationDetails,
  AppFeedbackPayload
} from './mockData';
import { supabase, memStore } from './supabaseClient';
import { computeWorkerEarnings, matchesWorkerByPhone } from '../utils/payments';

// Google Sheets — solo Checkins (alimentados por reservas externas) y migraciones únicas
const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_API_KEY || '';
const CLEANS_SPREADSHEET_ID = import.meta.env.VITE_CLEANS_SPREADSHEET_ID || ''; // Checkins pendientes
const CLEANS_APPS_SCRIPT_URL = import.meta.env.VITE_CLEANS_APPS_SCRIPT_URL || ''; // deleteCheckinRecord
const INCIDENCIAS_SPREADSHEET_ID = import.meta.env.VITE_INCIDENCIAS_SPREADSHEET_ID || ''; // migración única
const INCIDENCIAS_RANGE = "'Informe_Incidencia'!A:Z";
const ENTREGA_LLAVES_SPREADSHEET_ID = import.meta.env.VITE_ENTREGA_LLAVES_SPREADSHEET_ID || ''; // migración única
const ENTREGA_LLAVES_RANGE = "'Informe_Entrega_Llaves'!A:U";
const FIRMAS_ENTREGA_BUCKET = 'firmas-entrega';
const SUGERENCIAS_APPS_SCRIPT_URL = import.meta.env.VITE_SUGERENCIAS_APPS_SCRIPT_URL || '';


// Migraciones ya confirmadas en esta sesión → no volver a consultar Supabase ni caer a Apps Script
const _migrationsConfirmed = new Set<string>();

// --- Sheets cache (TTL + in-flight deduplication) ---
const SHEETS_CACHE_TTL_MS = 90_000; // 90 segundos
interface CacheEntry<T> { data: T; ts: number; }
const sheetsCache = new Map<string, CacheEntry<any>>();
const sheetsInflight = new Map<string, Promise<any>>();

function withSheetsCache<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const cached = sheetsCache.get(key);
  if (cached && now - cached.ts < SHEETS_CACHE_TTL_MS) {
    return Promise.resolve(cached.data);
  }
  const inflight = sheetsInflight.get(key);
  if (inflight) return inflight;
  const promise = fetcher().then(data => {
    sheetsCache.set(key, { data, ts: Date.now() });
    sheetsInflight.delete(key);
    return data;
  }).catch(err => {
    sheetsInflight.delete(key);
    throw err;
  });
  sheetsInflight.set(key, promise);
  return promise;
}

function invalidateSheetsCache(key: string) {
  sheetsCache.delete(key);
  sheetsInflight.delete(key);
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64] = dataUrl.split(',');
  const mime = header.match(/:(.*?);/)?.[1] || 'image/png';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

/** URL de imagen que el navegador puede mostrar (Drive → thumbnail) */
function toDisplayableFirmaUrl(url: string): string {
  if (!url.includes('drive.google.com')) return url;
  const idMatch = url.match(/(?:[?&]id=|\/d\/)([a-zA-Z0-9_-]+)/);
  if (idMatch?.[1]) {
    return `https://drive.google.com/thumbnail?id=${idMatch[1]}&sz=w1000`;
  }
  return url;
}

/** Convierte celda del Sheet (URL, =IMAGE("url") o base64) en URL usable en la web */
function parseEntregaFirmaCell(raw: unknown): string | undefined {
  const s = String(raw ?? '').trim();
  if (!s) return undefined;
  if (s.startsWith('data:image/')) return s;
  let url: string | undefined;
  if (/^https?:\/\//i.test(s)) {
    url = s;
  } else {
    const imageMatch =
      s.match(/=IMAGE\s*\(\s*"([^"]+)"/i) ||
      s.match(/=IMAGE\s*\(\s*'([^']+)'/i);
    url = imageMatch?.[1]?.trim();
  }
  return url ? toDisplayableFirmaUrl(url) : undefined;
}

async function uploadEntregaFirmaIfNeeded(
  value: string | undefined,
  storageKey: string
): Promise<string | undefined> {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  if (!trimmed.startsWith('data:image/')) return trimmed;

  const path = `entrega-llaves/${storageKey}.png`;
  const blob = dataUrlToBlob(trimmed);
  const { error } = await supabase.storage
    .from(FIRMAS_ENTREGA_BUCKET)
    .upload(path, blob, { upsert: true, contentType: 'image/png' });
  if (error) throw error;

  const { data } = supabase.storage.from(FIRMAS_ENTREGA_BUCKET).getPublicUrl(path);
  return `${data.publicUrl}?t=${Date.now()}`;
}
function incRowToIncidencia(r: any): Incidencia {
  return {
    id: r.id,
    userName: r.user_name ?? '',
    description: r.description ?? '',
    timestamp: r.timestamp ?? r.created_at ?? new Date().toISOString(),
    accommodationId: r.accommodation_id ?? '',
    accommodationName: r.accommodation_name ?? '',
    coste: Number(r.coste) || 0,
    pagadoPor: r.pagado_por ?? 'empresa',
    kms: r.kms != null ? Number(r.kms) : undefined,
    checked: r.checked ?? false,
    telefono: r.telefono ?? '',
    nombre: r.nombre ?? '',
    apellidos: r.apellidos ?? '',
    paradaInicial: r.parada_inicial ?? '',
    paradaOpcional1: r.parada_opcional1 ?? '',
    paradaOpcional2: r.parada_opcional2 ?? '',
    paradaOpcional3: r.parada_opcional3 ?? '',
    paradaOpcional4: r.parada_opcional4 ?? '',
    paradaOpcional5: r.parada_opcional5 ?? '',
    paradaFinal: r.parada_final ?? '',
    observaciones: r.observaciones ?? '',
  };
}

function incidenciaToRow(d: Omit<Incidencia, 'id'>) {
  return {
    user_name: d.userName,
    description: d.description,
    timestamp: d.timestamp,
    accommodation_id: d.accommodationId,
    accommodation_name: d.accommodationName,
    coste: d.coste,
    pagado_por: d.pagadoPor,
    kms: d.kms ?? null,
    checked: d.checked ?? false,
    telefono: d.telefono ?? '',
    nombre: d.nombre ?? '',
    apellidos: d.apellidos ?? '',
    parada_inicial: d.paradaInicial ?? '',
    parada_opcional1: d.paradaOpcional1 ?? '',
    parada_opcional2: d.paradaOpcional2 ?? '',
    parada_opcional3: d.paradaOpcional3 ?? '',
    parada_opcional4: d.paradaOpcional4 ?? '',
    parada_opcional5: d.paradaOpcional5 ?? '',
    parada_final: d.paradaFinal ?? '',
    observaciones: d.observaciones ?? '',
  };
}

function elkRowToEntregaLlaves(r: any): EntregaLlaves {
  return {
    id: r.id,
    telefono: r.telefono ?? '',
    nombre: r.nombre ?? '',
    apellidos: r.apellidos ?? '',
    fechaUbicacionEntrega: r.fecha_ubicacion_entrega ?? '',
    apartamento: r.apartamento ?? '',
    nombreCliente: r.nombre_cliente ?? '',
    fechaEntradaReserva: r.fecha_entrada_reserva ?? '',
    fechaSalidaReserva: r.fecha_salida_reserva ?? '',
    entregaLlaves: r.entrega_llaves ?? false,
    sabanasToallas: r.sabanas_toallas ?? 'No',
    km: Number(r.km) || 0,
    observaciones: r.observaciones ?? '',
    fianzaMonto: r.fianza_monto ?? 'Efectivo',
    bizumMonto: r.bizum_monto ?? '',
    cantidadPagadaMonto: r.cantidad_pagada_monto ?? '',
    fianzaGarantia: r.fianza_garantia ?? 'Efectivo',
    bizumGarantia: r.bizum_garantia ?? '',
    cantidadPagadaGarantia: r.cantidad_pagada_garantia ?? '',
    checked: r.checked ?? false,
    firmaTrabajador: r.firma_trabajador ?? undefined,
    firmaHuesped: r.firma_huesped ?? undefined,
  };
}

function entregaLlavesToRow(d: Omit<EntregaLlaves, 'id'>) {
  return {
    telefono: d.telefono,
    nombre: d.nombre,
    apellidos: d.apellidos,
    fecha_ubicacion_entrega: d.fechaUbicacionEntrega,
    apartamento: d.apartamento,
    nombre_cliente: d.nombreCliente,
    fecha_entrada_reserva: d.fechaEntradaReserva,
    fecha_salida_reserva: d.fechaSalidaReserva,
    entrega_llaves: d.entregaLlaves,
    sabanas_toallas: d.sabanasToallas,
    km: d.km,
    observaciones: d.observaciones,
    fianza_monto: d.fianzaMonto,
    bizum_monto: d.bizumMonto,
    cantidad_pagada_monto: d.cantidadPagadaMonto,
    fianza_garantia: d.fianzaGarantia,
    bizum_garantia: d.bizumGarantia,
    cantidad_pagada_garantia: d.cantidadPagadaGarantia,
    checked: d.checked,
    firma_trabajador: d.firmaTrabajador || null,
    firma_huesped: d.firmaHuesped || null,
  };
}

// --- Fin cache ---

export type CleansFetchStatus = 'ok' | 'empty' | 'error';
export type CleansFetchResult<T> = { records: T[]; status: CleansFetchStatus; error?: string };

// Utilidad para limpiar números formateados (ej: "10,00 €" -> 10.0)
const parseExcelNumber = (val: any): number => {
  if (val === undefined || val === null || val === '') return 0;
  if (typeof val === 'number') return val;
  
  let str = String(val).trim().replace('€', '').replace(/\s/g, '');
  
  // Si tiene punto y coma, el punto es de miles (1.234,56)
  if (str.includes(',') && str.includes('.')) {
    str = str.replace(/\./g, '').replace(',', '.');
  } 
  // Si solo tiene coma, es el decimal (0,50)
  else if (str.includes(',')) {
    str = str.replace(',', '.');
  }
  // Si tiene un punto y NO tiene coma, en esta App lo tratamos como decimal (0.50)
  // A menos que sea un número muy grande, pero para KMS siempre será decimal.
  
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
};

// Utilidad para normalizar cabeceras (quitar acentos, espacios y pasar a minúsculas)
const normalizeHeader = (h: string) => {
  if (!h) return '';
  return h.trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
};

// Utilidad para calcular distancia entre dos puntos (Haversine)
export const getDistanceMeters = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371e3; // Radio de la Tierra en metros
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) *
    Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
};

// Parsear coordenadas "lat, lng" a [number, number]
export const parseCoords = (str: string | undefined): [number, number] | null => {
  if (!str) return null;
  const parts = str.split(',').map(s => parseFloat(s.trim()));
  if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
    return [parts[0], parts[1]];
  }
  return null;
};

// Coordenadas predefinidas para ciudades comunes (centro aproximado)
const CITY_COORDS: Record<string, { lat: number, lng: number }> = {
  'oropesa del mar': { lat: 40.0783, lng: 0.1550 },
  'oropesa': { lat: 40.0783, lng: 0.1550 },
  'castellon': { lat: 39.9864, lng: -0.0513 },
  'castellon de la plana': { lat: 39.9864, lng: -0.0513 },
  'benicasim': { lat: 40.0520, lng: 0.0670 },
  'benicassim': { lat: 40.0520, lng: 0.0670 },
  'peñiscola': { lat: 40.3670, lng: 0.4080 },
  'peniscola': { lat: 40.3670, lng: 0.4080 },
  'almazora': { lat: 39.9442, lng: -0.0519 },
  'torreblanca': { lat: 40.2120, lng: 0.2100 },
  'vistabella': { lat: 40.1500, lng: -0.3167 },
  'vistavella': { lat: 40.1500, lng: -0.3167 },
  'grao de castellon': { lat: 39.9770, lng: -0.0220 },
  'borriol': { lat: 40.0500, lng: -0.0667 },
  'santa pola': { lat: 38.1919, lng: -0.5664 },
  'benidorm': { lat: 38.5386, lng: -0.1312 },
  'alcala de xivert': { lat: 40.2667, lng: 0.2333 },
  'grao de moncofar': { lat: 39.8167, lng: -0.2000 },
  'lucena del cid': { lat: 40.1500, lng: -0.2833 },
  'alcala de la selva': { lat: 40.3833, lng: -0.6833 }
};

// Geocodificación con caché local - usa coordenadas de ciudad como fallback
const GEO_CACHE_KEY = 'rh_geocoding_cache';

export const geocodeAddress = async (address: string): Promise<{ lat: number, lng: number } | null> => {
  const cache = JSON.parse(localStorage.getItem(GEO_CACHE_KEY) || '{}');
  if (cache[address]) return cache[address];

  // Extraer la ciudad de la dirección
  const addressLower = address.toLowerCase();
  for (const [city, coords] of Object.entries(CITY_COORDS)) {
    if (addressLower.includes(city)) {
      console.log(`📍 Using city coordinates for: ${city}`);
      cache[address] = coords;
      localStorage.setItem(GEO_CACHE_KEY, JSON.stringify(cache));
      return coords;
    }
  }

  console.warn(`⚠️ No coordinates found for: ${address}`);
  return null;
};

// Geocodificación inversa con caché local
export const reverseGeocode = async (coords: string | undefined): Promise<string | null> => {
  if (!coords) return null;
  const cache = JSON.parse(localStorage.getItem(GEO_CACHE_KEY) || '{}');
  if (cache[coords]) return cache[coords];

  try {
    const parts = coords.split(',').map(s => s.trim());
    if (parts.length < 2) return null;
    const [lat, lon] = parts;

    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`;
    const response = await fetch(url, {
      headers: { 'User-Agent': 'BaseDatosPagosRH/1.0' }
    });
    const data = await response.json();

    if (data && data.display_name) {
      // Extraer una dirección más corta (Calle, Número...)
      const addressParts = data.display_name.split(',');
      const street = addressParts[0] || '';
      const number = addressParts[1] || '';
      const shortAddress = `${street}${number ? ',' + number : ''}`.trim();
      
      cache[coords] = shortAddress;
      localStorage.setItem(GEO_CACHE_KEY, JSON.stringify(cache));
      return shortAddress;
    }
  } catch (error) {
    console.warn('Reverse geocoding error for:', coords, error);
  }
  return null;
};

// Utilidad global para parsear fechas y horas de Excel/Sheets
export const parseDateTime = (dateVal: any, timeVal?: any): string => {
  if (!dateVal && !timeVal) return '';

  const excelSerialToIso = (serial: number): string => {
    const ms = (serial - 25569) * 86400000;
    const d = new Date(ms);
    const y = d.getUTCFullYear();
    const mo = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    const h = String(d.getUTCHours()).padStart(2, '0');
    const mi = String(d.getUTCMinutes()).padStart(2, '0');
    return `${y}-${mo}-${day}T${h}:${mi}`;
  };

  if (typeof dateVal === 'number' && dateVal > 1000) {
    return excelSerialToIso(dateVal);
  }

  let datePart = String(dateVal || '').trim();
  let timePart = String(timeVal || '12:00').trim();

  const serialNum = Number(datePart.replace(',', '.'));
  if (!Number.isNaN(serialNum) && serialNum > 30000 && serialNum < 1000000) {
    return excelSerialToIso(serialNum);
  }

  // Si datePart trae fecha y hora (ej: "20/04/2026 13:05")
  if (datePart.includes(' ') || datePart.includes(',')) {
    const sep = datePart.includes(',') ? ',' : ' ';
    const parts = datePart.split(sep);
    datePart = parts[0].trim();
    if (!timeVal) {
      const timeMatch = parts[1]?.match(/\d{1,2}:\d{2}/);
      if (timeMatch) timePart = timeMatch[0];
    }
  }

  // Normalizar fecha a YYYY-MM-DD
  let ymd = datePart;
  if (datePart.includes('/')) {
    const p = datePart.split('/');
    if (p.length === 3) {
      // Asumimos DD/MM/YYYY o YYYY/MM/DD
      if (p[0].length === 4) ymd = `${p[0]}-${p[1].padStart(2, '0')}-${p[2].padStart(2, '0')}`;
      else ymd = `${p[2]}-${p[1].padStart(2, '0')}-${p[0].padStart(2, '0')}`;
    }
  } else if (datePart.includes('-')) {
    const p = datePart.split('-');
    if (p.length === 3 && p[0].length <= 2) {
      ymd = `${p[2]}-${p[1].padStart(2, '0')}-${p[0].padStart(2, '0')}`;
    }
  }

  // Normalizar hora a HH:mm
  const timeMatch = timePart.match(/(\d{1,2}):(\d{2})/);
  const h = timeMatch ? timeMatch[1].padStart(2, '0') : '12';
  const m = timeMatch ? timeMatch[2].padStart(2, '0') : '00';

  if (!ymd || ymd.length < 10) return '';
  return `${ymd}T${h}:${m}`;
};

const parseBool = (val: any): boolean => {
  if (val === true || val === 'TRUE' || val === 'true' || val === '1') return true;
  if (typeof val === 'string') {
    const v = normalizeHeader(val);
    return v === 'si' || v === 'true' || v === '1';
  }
  return false;
};

const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));

const fetchWithRetry = async (url: string, options?: RequestInit, retries = 3): Promise<Response> => {
  let lastResponse: Response | null = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const response = await fetch(url, options);
    lastResponse = response;
    const shouldRetry = response.status === 429 || response.status >= 500;
    if (!shouldRetry || attempt === retries) return response;
    const backoff = 600 * Math.pow(2, attempt) + Math.floor(Math.random() * 300);
    await sleep(backoff);
  }
  return lastResponse as Response;
};

// Simulación de persistencia en localStorage para el MVP
const getStoredWorkers = (): Worker[] => {
  try {
    const stored = localStorage.getItem('rh_workers');
    if (!stored) return MOCK_WORKERS;

    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) return MOCK_WORKERS;

    return parsed.map((w) => ({
      ...w,
      netMoneyMonth: w.netMoneyMonth ?? 0,
      cleansCountMonth: w.cleansCountMonth ?? 0,
      kmsMonth: w.kmsMonth ?? 0,
      extraHoursMonth: w.extraHoursMonth ?? 0,
      efectivoRetenido: w.efectivoRetenido ?? 0,
      accommodations: w.accommodations ?? [],
      accommodationDetails: w.accommodationDetails ?? [],
    }));
  } catch (error) {
    console.error('Error loading workers from localStorage:', error);
    return MOCK_WORKERS;
  }
};

let currentWorkers = getStoredWorkers();

const saveWorkers = (workers: Worker[]) => {
  currentWorkers = workers;
  localStorage.setItem('rh_workers', JSON.stringify(workers));
};

// Accommodations persistence
const getStoredAccommodations = (): Accommodation[] => {
  const stored = localStorage.getItem('rh_accommodations');
  if (stored) return JSON.parse(stored);
  return MOCK_ACCOMMODATIONS;
};

let currentAccommodations = getStoredAccommodations();

const saveAccommodations = (accommodations: Accommodation[]) => {
  currentAccommodations = accommodations;
  localStorage.setItem('rh_accommodations', JSON.stringify(accommodations));
};

// Reemplaza todas las asignaciones de alojamiento de un trabajador en la tabla pivote
const setWorkerAccommodations = async (workerId: string, details: WorkerAccommodationDetails[]): Promise<void> => {
  if (!details || details.length === 0) {
    await supabase.from('worker_accommodations').delete().eq('worker_id', workerId);
    return;
  }

  const accommodationNames = details.map(d => d.accommodationName);

  // Buscar IDs de los alojamientos por nombre
  const { data: existing } = await supabase
    .from('accommodations')
    .select('id, name')
    .in('name', accommodationNames);

  const nameToId = new Map<string, string>((existing || []).map((a: any) => [a.name, a.id]));

  // Crear los que no existan aún
  const missingNames = accommodationNames.filter(n => !nameToId.has(n));
  if (missingNames.length > 0) {
    const { data: created } = await supabase
      .from('accommodations')
      .insert(missingNames.map(name => ({
        name,
        active: true,
        address: '',
        city: '',
        zip_code: '',
        notes: 'Registrado automáticamente desde Operarios',
      })))
      .select('id, name');
    (created || []).forEach((a: any) => nameToId.set(a.name, a.id));
  }

  // Reemplazar todas las entradas del trabajador
  await supabase.from('worker_accommodations').delete().eq('worker_id', workerId);

  const rows = details
    .map(d => {
      const accommodation_id = nameToId.get(d.accommodationName);
      if (!accommodation_id) return null;
      return {
        worker_id: workerId,
        accommodation_id,
        precio: Number(d.precio ?? 0),
        sabanas_incl: Boolean(d.sabanasIncluidas ?? false),
        toallas_incl: Boolean(d.toallasIncluidas ?? false),
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  if (rows.length > 0) {
    const { error } = await supabase.from('worker_accommodations').insert(rows);
    if (error) {
      // Columnas nuevas no disponibles aún: guardar al menos la asociación básica
      console.warn('worker_accommodations INSERT con columnas nuevas falló, intentando inserción básica:', error.message);
      const basicRows = rows.map(r => ({ worker_id: r.worker_id, accommodation_id: r.accommodation_id }));
      const { error: basicError } = await supabase.from('worker_accommodations').insert(basicRows);
      if (basicError) {
        console.error('Error en inserción básica de worker_accommodations:', basicError);
        throw basicError;
      }
    }
  }
};

// Pagos persistence
const getStoredPagos = (): PagoRecord[] => {
  try {
    const stored = localStorage.getItem('rh_pagos_v2');
    if (stored) return JSON.parse(stored);
  } catch {}
  return [...MOCK_PAGOS];
};

const savePagos = (pagos: PagoRecord[]) => {
  localStorage.setItem('rh_pagos_v2', JSON.stringify(pagos));
};

let currentPagos = getStoredPagos();

// Payment undo stack
export interface PaymentAction {
  id: string;
  workerId: string;
  pagoIds: string[];
  amount: number;
  timestamp: string;
}

const getUndoStack = (): PaymentAction[] => {
  try {
    const stored = localStorage.getItem('rh_payment_undo');
    if (stored) return JSON.parse(stored);
  } catch {}
  return [];
};

const saveUndoStack = (stack: PaymentAction[]) => {
  localStorage.setItem('rh_payment_undo', JSON.stringify(stack));
};

// Simulación de delay para llamadas a "Apps Script"
const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

type CleanSheetType = 'normal' | 'initial' | 'handyman';



const cleansCacheKey = (type: CleanSheetType): string =>
  type === 'normal' ? 'normalCleans' : type === 'initial' ? 'initialCleans' : 'handymanRecords';

const getCheckinSheetName = (type: string): string => {
  if (type === 'normal') return 'Checkin_Limpieza_Normal';
  if (type === 'initial') return 'Checkin_Limpieza_Inicial';
  return 'Checkin_Manitas';
};

const parseRowIndexFromId = (id: string): number => {
  if (!id) return -1;
  // Soporta formatos nc_123, ic_123, hm_123, check_norm_123 o simplemente el número
  const parts = String(id).split('_');
  const indexStr = parts[parts.length - 1]; // Tomar siempre el último fragmento
  const rowIndex = parseInt(indexStr, 10);
  if (!Number.isFinite(rowIndex) || rowIndex <= 1) {
    console.warn(`⚠️ Invalid clean record id for indexing: ${id}`);
    return -1;
  }
  return rowIndex;
};


// ============================================================
// CLEANS: mapeo fila Supabase <-> record de dominio
// ============================================================
const rowToNormalClean = (r: any): NormalCleanRecord => ({
  id: r.id, telefono: r.telefono || '', nombre: r.nombre || '', apellidos: r.apellidos || '',
  checkinFecha: r.checkin_fecha || '', checkinUbicacion: r.checkin_ubicacion || '',
  checkoutFecha: r.checkout_fecha || '', checkoutUbicacion: r.checkout_ubicacion || '',
  apartamento: r.apartamento || '', horaEntrada: r.hora_entrada || '', horaSalida: r.hora_salida || '',
  sigueHuesped: !!r.sigue_huesped, fechaSalidaReserva: r.fecha_salida_reserva || '',
  recogeLlaves: !!r.recoge_llaves, km: Number(r.km || 0), observaciones: r.observaciones || '',
  checked: !!r.checked,
});
const rowToInitialClean = (r: any): InitialCleanRecord => ({
  id: r.id, telefono: r.telefono || '', nombre: r.nombre || '', apellidos: r.apellidos || '',
  checkinFecha: r.checkin_fecha || '', checkinUbicacion: r.checkin_ubicacion || '',
  checkoutFecha: r.checkout_fecha || '', checkoutUbicacion: r.checkout_ubicacion || '',
  apartamento: r.apartamento || '', horaEntrada: r.hora_entrada || '', horaSalida: r.hora_salida || '',
  km: Number(r.km || 0), observaciones: r.observaciones || '', checked: !!r.checked,
});
const rowToHandyman = (r: any): HandymanRecord => ({
  id: r.id, telefono: r.telefono || '', nombre: r.nombre || '', apellidos: r.apellidos || '',
  fechaLlegada: r.checkin_fecha || '', ubicacionInicio: r.checkin_ubicacion || '',
  fechaFin: r.checkout_fecha || '', ubicacionFin: r.checkout_ubicacion || '',
  alojamiento: r.apartamento || '', horaInicioTarea: r.hora_entrada || '', horaFinTarea: r.hora_salida || '',
  cantidadMinutos: Number(r.km || 0), observacionesTarea: r.observaciones || '',
  estadoCompletado: r.checked ? 'Completado' : 'Pendiente',
});

const cleanRecordToRow = (type: CleanSheetType, record: NormalCleanRecord | InitialCleanRecord | HandymanRecord): Record<string, any> => {
  if (type === 'normal') {
    const d = record as NormalCleanRecord;
    return {
      type: 'normal', telefono: d.telefono, nombre: d.nombre, apellidos: d.apellidos,
      checkin_fecha: d.checkinFecha, checkin_ubicacion: d.checkinUbicacion,
      checkout_fecha: d.checkoutFecha, checkout_ubicacion: d.checkoutUbicacion,
      apartamento: d.apartamento, hora_entrada: d.horaEntrada, hora_salida: d.horaSalida,
      sigue_huesped: !!d.sigueHuesped, fecha_salida_reserva: d.fechaSalidaReserva,
      recoge_llaves: !!d.recogeLlaves, km: Number(d.km || 0), observaciones: d.observaciones, checked: !!d.checked,
    };
  }
  if (type === 'initial') {
    const d = record as InitialCleanRecord;
    return {
      type: 'initial', telefono: d.telefono, nombre: d.nombre, apellidos: d.apellidos,
      checkin_fecha: d.checkinFecha, checkin_ubicacion: d.checkinUbicacion,
      checkout_fecha: d.checkoutFecha, checkout_ubicacion: d.checkoutUbicacion,
      apartamento: d.apartamento, hora_entrada: d.horaEntrada, hora_salida: d.horaSalida,
      km: Number(d.km || 0), observaciones: d.observaciones, checked: !!d.checked,
    };
  }
  const d = record as HandymanRecord;
  return {
    type: 'handyman', telefono: d.telefono, nombre: d.nombre, apellidos: d.apellidos,
    checkin_fecha: d.fechaLlegada, checkin_ubicacion: d.ubicacionInicio,
    checkout_fecha: d.fechaFin, checkout_ubicacion: d.ubicacionFin,
    apartamento: d.alojamiento, hora_entrada: d.horaInicioTarea, hora_salida: d.horaFinTarea,
    km: Number(d.cantidadMinutos || 0), observaciones: d.observacionesTarea,
    checked: d.estadoCompletado === 'Completado',
  };
};

const rowToSuggestion = (r: any): Suggestion => ({
  id: r.id,
  subject: r.subject || '',
  from: r.from_text || '',
  date: r.created_at,
  snippet: r.snippet || (r.body ? String(r.body).slice(0, 140) : ''),
  body: r.body || '',
  isRead: !!r.is_read,
  isStarred: !!r.is_starred,
  category: r.category || undefined,
});

// Lectores de los Sheets viejos — solo para la migración única a Supabase.
const sheetReadCleans = async (sheetName: string, range: string, mapRow: (getVal: (h: string) => any, index: number) => any): Promise<any[]> => {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${CLEANS_SPREADSHEET_ID}/values/${sheetName}!${range}?key=${GOOGLE_API_KEY}&t=${Date.now()}`;
  const response = await fetchWithRetry(url);
  if (!response.ok) throw new Error(`Error leyendo ${sheetName}: ${response.statusText}`);
  const data = await response.json();
  if (!data.values || data.values.length <= 1) return [];
  const headers = data.values[0] as string[];
  return data.values.slice(1).map((row: any[], index: number) => {
    const getVal = (headerName: string) => {
      const norm = normalizeHeader(headerName);
      const idx = headers.findIndex((h: string) => normalizeHeader(h) === norm);
      return idx !== -1 ? row[idx] : undefined;
    };
    return mapRow(getVal, index);
  }).filter((r: any) => r !== null);
};

export const appsScriptApi = {
  login: async (email: string, pass: string): Promise<User | null> => {
    try {
      // ponytail: fetch directo al REST de Supabase Auth — bypasea el lock interno del SDK
      // que cuelga signInWithPassword indefinidamente en v2.x con sessionStorage storage
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
      const authResp = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: { 'apikey': supabaseKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: pass }),
      });
      const authJson = await authResp.json();
      if (!authResp.ok || authJson.error) {
        console.error('Error de autenticación:', authJson.error_description || authJson.error);
        return null;
      }
      // Escribir token directamente en el memStore que usa el SDK como storage.
      // Esto popula la caché del cliente sin pasar por setSession() ni signInWithPassword()
      // (ambos cuelgan por el navigatorLock del SDK). Con memStorage sincrónico,
      // getSession() del SDK encuentra el token inmediatamente y no hace red.
      const projectRef = supabaseUrl.match(/\/\/([^.]+)/)?.[1] ?? '';
      const storageKey = `sb-${projectRef}-auth-token`;
      const sessionPayload = {
        access_token: authJson.access_token,
        refresh_token: authJson.refresh_token,
        expires_at: authJson.expires_at ?? Math.floor(Date.now() / 1000) + (authJson.expires_in ?? 3600),
        expires_in: authJson.expires_in ?? 3600,
        token_type: 'bearer',
        user: authJson.user,
      };
      const sessionStr = JSON.stringify(sessionPayload);
      memStore.set(storageKey, sessionStr);
      sessionStorage.setItem(storageKey, sessionStr); // backup para sobrevivir F5
      // Parchear _currentSession directamente sin pasar por setSession() (que hace red a /auth/v1/user).
      // El SDK usa _currentSession para el header Authorization de las queries RLS.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase.auth as any)._currentSession = sessionPayload;
      const sessionUser = { id: authJson.user?.id as string, email: authJson.user?.email as string };
      if (!sessionUser.id) return null;

      // ponytail: fetch directo al REST de Supabase para el perfil — SDK en memoria aún tiene sesión null
      const profileResp = await fetch(
        `${supabaseUrl}/rest/v1/profiles?id=eq.${sessionUser.id}&select=id,email,full_name,role,phone,avatar_url&limit=1`,
        { headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${authJson.access_token}` } }
      );
      const profileRows = profileResp.ok ? await profileResp.json() : [];
      const profile = profileRows[0] ?? null;

      if (!profile) {
        console.warn('🚩 [Login] Perfil no encontrado en Supabase. Fallback a viewer.');
        return {
          id: sessionUser.id,
          email: sessionUser.email || '',
          role: 'viewer',
          name: (authJson.user as any)?.user_metadata?.full_name || (authJson.user as any)?.user_metadata?.name || 'Usuario'
        };
      }

      const p = profile as any;
      const finalUser: User = {
        id: p.id || sessionUser.id,
        email: p.email || sessionUser.email,
        role: (p.role || 'viewer') as any,
        name: p.full_name || p.name || (authJson.user as any)?.user_metadata?.full_name || 'Usuario',
        telefono: p.phone || p.telefono || undefined,
        avatar_url: p.avatar_url || null
      };
      
      console.log('👤 [Login] Usuario autenticado:', finalUser.name, 'Rol:', finalUser.role);
      return finalUser;
    } catch (error) {
      console.error('Error durante el proceso de login:', error);
      return null;
    }
  },

  getProfileByEmail: async (email: string): Promise<User | null> => {
    try {
      // Solo Supabase (la consulta a Apps Script se eliminó: cold start de 3-8s
      // que ralentizaba cada verificación de login). maybeSingle() devuelve null
      // en vez de 406 si no hay perfil (caso normal durante la creación).
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('email', email)
        .maybeSingle();

      if (profile) {
        return {
          id: profile.id,
          email: profile.email,
          role: profile.role,
          name: profile.full_name,
          telefono: profile.phone,
          avatar_url: profile.avatar_url || null
        } as User;
      }
      return null;
    } catch (error) {
      console.error('Error en getProfileByEmail:', error);
      return null;
    }
  },

  updateUserPassword: async (password: string): Promise<{ ok: boolean; error?: string }> => {
    try {
      // Cambia password + marca metadata.password_set para que no salga otra vez el modal forzado.
      const { error } = await supabase.auth.updateUser({
        password,
        data: { password_set: true },
      });
      if (error) throw error;
      return { ok: true };
    } catch (error: any) {
      console.error('Error al actualizar contraseña:', error);
      return { ok: false, error: error.message };
    }
  },

  // Registra la fecha en la que el usuario aceptó los T&C (flujo de invitación).
  // No bloquea el onboarding si falla; solo deja log.
  acceptTerms: async (userId: string): Promise<{ ok: boolean; error?: string }> => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ terms_accepted_at: new Date().toISOString() })
        .eq('id', userId);
      if (error) {
        console.error('No se pudo registrar la aceptación de T&C:', error.message);
        return { ok: false, error: error.message };
      }
      return { ok: true };
    } catch (error: any) {
      console.error('Excepción al registrar aceptación de T&C:', error);
      return { ok: false, error: error?.message };
    }
  },

  uploadReportPDF: async (blob: Blob, filename: string): Promise<{ ok: boolean, error?: string }> => {
    try {
      const { error } = await supabase.storage
        .from('pdfs')
        .upload(filename, blob, { contentType: 'application/pdf', upsert: true });
      if (error) throw error;
      return { ok: true };
    } catch (e: any) {
      console.error('Error al subir PDF:', e);
      return { ok: false, error: e.message };
    }
  },


  inviteUser: async (email: string, userData: { name: string; role: string; telefono?: string; dni?: string; home_address?: string; bank_account?: string }): Promise<{ ok: boolean; id?: string; error?: string }> => {
    try {
      // Crear usuario directamente con contraseña por defecto vía Edge Function.
      // Usa service_role internamente para crear auth.users + profiles.
      const { data, error } = await supabase.functions.invoke('create-user-with-password', {
        body: {
          email,
          full_name: (userData as any).full_name || userData.name,
          role: userData.role,
          phone: userData.telefono || '',
        },
      });

      if (error) {
        const msg = (data as any)?.error || error.message || 'Error al crear el usuario';
        return { ok: false, error: msg };
      }

      if (data && !data.ok) {
        return { ok: false, error: data.error || 'Error desconocido al crear el usuario' };
      }

      return { ok: true, id: data?.id };
    } catch (error: any) {
      console.error('Error al crear usuario:', error);
      return { ok: false, error: String(error) };
    }
  },

  // --- Funciones de Administración (Supabase) ---

  getAllUsers: async (): Promise<User[]> => {
    // Verificar sesión antes de la query: RLS devuelve [] silencioso si no hay token.
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) throw new Error('Sesión caducada — cierra sesión y vuelve a entrar.');

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('full_name', { ascending: true });

    if (error) {
      console.error('[getAllUsers] Supabase error:', error);
      throw error;
    }
    return (data || []).map(p => ({
      id: p.id,
      email: p.email,
      role: p.role as any,
      name: p.full_name || p.name,
      telefono: p.phone || p.telefono || undefined,
      last_seen: p.last_seen,
      avatar_url: p.avatar_url || null,
    }));
  },

  updateProfile: async (userId: string, profileData: Partial<User>) => {
    // Invocamos la edge function `update-user-profile`. Esta sincroniza el email
    // en `auth.users` (que requiere service_role) además de actualizar `profiles`.
    // Hacer sólo la upsert de profile rompía el login al cambiar email desde el panel.
    const { data, error } = await supabase.functions.invoke('update-user-profile', {
      body: {
        id: userId,
        email: profileData.email,
        name: profileData.name,
        role: profileData.role,
        phone: profileData.telefono,
      },
    });
    if (error) {
      // El cuerpo de error de funciones suele venir en `data.error`
      const msg = (data as any)?.error || error.message || 'Error al actualizar el perfil';
      throw new Error(msg);
    }
  },

  deleteProfile: async (userId: string) => {
    // Usa el RPC `admin_delete_user` (SECURITY DEFINER en SQL, migración v17).
    // La función corre como superuser y borra de auth.users; la FK CASCADE de v16
    // limpia profiles automáticamente. No requiere service_role ni edge function.
    const { error } = await supabase.rpc('admin_delete_user', { target_id: userId });
    if (error) {
      throw new Error(error.message || 'Error al borrar el usuario');
    }
  },

  // Vincula un trabajador (workers.id) con la cuenta de usuario (profiles.id) recién creada.
  linkWorkerProfile: async (workerId: string, profileId: string) => {
    const { error } = await supabase
      .from('workers')
      .update({ profile_id: profileId })
      .eq('id', workerId);
    if (error) throw error;
  },

  // Reenvía acceso al email: dispara a la vez magic link (signInWithOtp) y recuperación de contraseña
  // (resetPasswordForEmail). Así el usuario recibe ambos correos: uno para entrar directo y otro para
  // (re)establecer contraseña. No pasa por el Apps Script.
  //
  // redirectTo: tras pulsar el enlace del correo, Supabase manda al usuario a esta URL con el token
  // de recuperación en el hash. Login.tsx detecta `type=recovery` y abre el flujo de nueva contraseña.
  // Esta URL DEBE estar en la whitelist de Dashboard → Authentication → URL Configuration → Redirect URLs.
  resendInvitation: async (email: string): Promise<{ ok: boolean; error?: string }> => {
    // redirectTo debe apuntar a /login para que el hash con el token llegue al componente correcto
    const baseUrl = import.meta.env.VITE_AUTH_REDIRECT_URL
      ? import.meta.env.VITE_AUTH_REDIRECT_URL.replace(/\/$/, '') + '/login'
      : 'https://base-datos-pagos-rh.vercel.app/login';
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: baseUrl });
    if (error) {
      console.error('Error al enviar correo de recuperación:', error.message);
      return { ok: false, error: error.message };
    }
    return { ok: true };
  },

  // Desvincula cualquier trabajador apuntando a este perfil (evita violar la FK al borrar el perfil).
  unlinkWorkerByProfile: async (profileId: string) => {
    const { error } = await supabase
      .from('workers')
      .update({ profile_id: null })
      .eq('profile_id', profileId);
    if (error) throw error;
  },

  getSensitiveData: async (userId: string) => {
    const { data, error } = await supabase
      .from('worker_sensitive_data')
      .select('*')
      .eq('id', userId)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 es "no rows found"
      console.error('Error al obtener datos sensibles:', error.message);
    }
    return data || null;
  },

  updateSensitiveData: async (userId: string, data: { dni?: string; home_address?: string; bank_account?: string }) => {
    const { error } = await supabase
      .from('worker_sensitive_data')
      .upsert({
        id: userId,
        ...data
      });

    if (error) throw error;
  },

  deleteSensitiveData: async (userId: string) => {
    const { error } = await supabase
      .from('worker_sensitive_data')
      .delete()
      .eq('id', userId);
    if (error) throw error;
  },

  getWorkers: async (): Promise<Worker[]> => {
    try {
      // Limpiezas/entregas no dependen de la tabla workers → se lanzan ya en
      // paralelo para que solapen con las queries de workers/sensitive/accommodations.
      // Antes eran una 3ª ola de red secuencial que ralentizaba el Dashboard.
      const derivedDataPromise = Promise.all([
        appsScriptApi.getNormalCleans().catch(() => []),
        appsScriptApi.getInitialCleans().catch(() => []),
        appsScriptApi.getHandymanRecords().catch(() => []),
        appsScriptApi.getEntregaLlaves().catch(() => []),
      ]);

      // 1. Fetch from Supabase 'workers' table
      const { data: dbWorkers, error: dbError } = await supabase
        .from('workers')
        .select(`
          *,
          profile:profile_id (
            id,
            email,
            full_name,
            phone,
            avatar_url
          )
        `)
        .order('full_name', { ascending: true });

      if (dbError) throw dbError;

      const profileIds = dbWorkers.filter((w: any) => w.profile_id).map((w: any) => w.profile_id);
      const workerIds = dbWorkers.map((w: any) => w.id);

      // 2+3. Sensitive data y accommodations en paralelo (ambas dependen de step 1)
      const [sensitiveData, waResult] = await Promise.all([
        profileIds.length > 0
          ? supabase.from('worker_sensitive_data').select('*').in('id', profileIds)
          : Promise.resolve({ data: [] as any[], error: null }),
        workerIds.length > 0
          ? supabase.from('worker_accommodations')
              .select('worker_id, precio, sabanas_incl, toallas_incl, accommodations(name)')
              .in('worker_id', workerIds)
          : Promise.resolve({ data: [] as any[], error: null }),
      ]);

      const sensitiveMap: Record<string, any> = (sensitiveData.data || []).reduce(
        (acc: Record<string, any>, curr: any) => ({ ...acc, [curr.id]: curr }), {}
      );

      const workerAccDetailsMap: Record<string, WorkerAccommodationDetails[]> = {};
      const populate = (entries: any[], withDetails: boolean) => {
        entries.forEach((entry: any) => {
          if (!workerAccDetailsMap[entry.worker_id]) workerAccDetailsMap[entry.worker_id] = [];
          if (entry.accommodations?.name) {
            workerAccDetailsMap[entry.worker_id].push({
              accommodationName: entry.accommodations.name,
              precio: withDetails ? Number(entry.precio ?? 0) : 0,
              sabanasIncluidas: withDetails ? (entry.sabanas_incl ?? false) : false,
              toallasIncluidas: withDetails ? (entry.toallas_incl ?? false) : false,
            });
          }
        });
      };
      if (!waResult.error && waResult.data) {
        populate(waResult.data, true);
      } else {
        if (waResult.error) console.warn('worker_accommodations fallback:', waResult.error.message);
        const { data: basicData } = await supabase
          .from('worker_accommodations').select('worker_id, accommodations(name)').in('worker_id', workerIds);
        if (basicData) populate(basicData, false);
      }

      // 4. Map to Worker interface
      const baseWorkers: Worker[] = dbWorkers.map((w: any): Worker => {
        const sensitive = w.profile_id ? sensitiveMap[w.profile_id] : null;

        return {
          id: w.id,
          excelId: w.excel_id,
          profileId: w.profile_id,
          fullName: w.full_name,
          telefono: w.phone || '',
          email: w.email || '',
          dni: sensitive?.dni || w.dni || '',
          iban: sensitive?.bank_account || w.iban || '',
          tipoPago: w.payment_method as Worker['tipoPago'],
          pagoPorReserva: Number(w.pay_per_reservation || 0),
          pagoPorReservaAdicional: Number(w.pay_per_extra_reservation || 0),
          pagoPorServicioSabanas: Number(w.pay_per_linen_service || 0),
          pagoPorIncidencia: Number(w.pay_per_incident || 0),
          precioPorKm: Number(w.price_per_km || 0),
          notes: w.notes || '',
          netMoneyMonth: 0,
          owedMoney: Number(w.pending_balance || 0),
          efectivoRetenido: Number(w.retained_cash || 0),
          cleansCountMonth: 0,
          kmsMonth: 0,
          extraHoursMonth: 0,
          accommodationDetails: workerAccDetailsMap[w.id] || [],
          accommodations: (workerAccDetailsMap[w.id] || []).map(d => d.accommodationName),
          tipoTrabajador: w.worker_type,
          telefonoBizum: w.bizum_phone,
          photo: w.photo_url || w.profile?.avatar_url || ''
        } as any;
      });

      // 4. Compute derived values (ya lanzadas arriba en paralelo)
      const [normalCleans, initialCleans, handymanRecords, entregaLlaves] = await derivedDataPromise;

      const workers: Worker[] = baseWorkers.map(w => {
        const earnings = computeWorkerEarnings(w, normalCleans, initialCleans, handymanRecords, entregaLlaves);
        return {
          ...w,
          cleansCountMonth: earnings.cleanCount,
          kmsMonth: Math.round(earnings.kms * 100) / 100,
          extraHoursMonth: Math.round(earnings.extraHours * 100) / 100,
          netMoneyMonth: Math.round(earnings.totalOwed * 100) / 100,
        };
      });

      saveWorkers(workers);
      return workers;
    } catch (error) {
      console.error('Error fetching workers from Supabase:', error);
      return currentWorkers;
    }
  },

  // --- Sincronización Excel -> Supabase ---
  // ponytail: sync manual eliminado — Supabase es la fuente de verdad desde 2026-06-23
  syncWorkersFromSheets: async (): Promise<void> => {},
  syncAccommodationsFromSheets: async (): Promise<void> => {},

  updateWorker: async (workerData: Worker): Promise<Worker> => {
    try {
      // Escritura en Supabase (fuente única tras migración desde Apps Script)
      const { error } = await supabase
        .from('workers')
        .update({
          full_name: workerData.fullName,
          phone: workerData.telefono,
          email: workerData.email,
          payment_method: workerData.tipoPago,
          pay_per_reservation:       workerData.pagoPorReserva,
          pay_per_extra_reservation: workerData.pagoPorReservaAdicional ?? 0,
          pay_per_linen_service:     workerData.pagoPorServicioSabanas ?? 0,
          pay_per_incident:          workerData.pagoPorIncidencia ?? 0,
          price_per_km:              workerData.precioPorKm,
          notes: workerData.notes,
          pending_balance: workerData.owedMoney,
          retained_cash: workerData.efectivoRetenido,
          bizum_phone: workerData.telefonoBizum,
          worker_type: workerData.tipoTrabajador,
          photo_url: workerData.photo,
          iban: workerData.iban,
          dni: workerData.dni
        })
        .eq('id', workerData.id);

      if (error) throw error;

      // 4. Guardar asignaciones de alojamiento en tabla pivote
      if (Array.isArray(workerData.accommodationDetails)) {
        await setWorkerAccommodations(workerData.id, workerData.accommodationDetails);
      } else if (Array.isArray(workerData.accommodations) && workerData.accommodations.length > 0) {
        // Fallback: si solo llegan nombres, crea detalles con valores por defecto
        const fallback = (workerData.accommodations as string[]).map(name => ({
          accommodationName: name, precio: 0, sabanasIncluidas: false, toallasIncluidas: false,
        }));
        await setWorkerAccommodations(workerData.id, fallback);
      }

      const updatedWorkers = currentWorkers.map(w =>
        w.id === workerData.id ? { ...workerData } : w
      );
      saveWorkers(updatedWorkers);
      return workerData;
    } catch (error) {
      console.error('Error updating worker (Dual Write):', error);
      throw error;
    }
  },

  addWorker: async (workerData: Omit<Worker, 'id'>): Promise<Worker> => {
    try {
      // Dedupe por teléfono (columna UNIQUE en Supabase): si existe, es un update.
      const existingBD = currentWorkers.find(w => w.telefono === workerData.telefono);
      if (existingBD) {
        return appsScriptApi.updateWorker({ ...workerData, id: existingBD.id } as Worker);
      }

      // Escritura en Supabase
      const { data, error } = await supabase
        .from('workers')
        .insert([{
          full_name: workerData.fullName,
          phone: workerData.telefono,
          email: workerData.email,
          payment_method: workerData.tipoPago,
          pay_per_reservation:       workerData.pagoPorReserva,
          pay_per_extra_reservation: workerData.pagoPorReservaAdicional ?? 0,
          pay_per_linen_service:     workerData.pagoPorServicioSabanas ?? 0,
          pay_per_incident:          workerData.pagoPorIncidencia ?? 0,
          price_per_km:              workerData.precioPorKm,
          notes: workerData.notes,
          pending_balance: workerData.owedMoney,
          retained_cash: workerData.efectivoRetenido,
          bizum_phone: workerData.telefonoBizum,
          worker_type: workerData.tipoTrabajador,
          photo_url: workerData.photo,
          iban: workerData.iban,
          dni: workerData.dni,
          active: true
        }])
        .select()
        .single();

      if (error) throw error;

      // 4. Guardar asignaciones de alojamiento en tabla pivote
      if (Array.isArray(workerData.accommodationDetails) && workerData.accommodationDetails.length > 0) {
        await setWorkerAccommodations(data.id, workerData.accommodationDetails);
      }

      const newWorker: Worker = { ...workerData, id: data.id } as Worker;
      const updatedWorkers = [...currentWorkers, newWorker];
      saveWorkers(updatedWorkers);
      return newWorker;
    } catch (error) {
      console.error('Error adding worker (Dual Write):', error);
      throw error;
    }
  },

  deleteWorker: async (id: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('workers')
        .delete()
        .eq('id', id);

      if (error) throw error;

      const updatedWorkers = currentWorkers.filter(w => w.id !== id);
      saveWorkers(updatedWorkers);
      return true;
    } catch (error) {
      console.error('Error deleting worker from Supabase:', error);
      throw error;
    }
  },

  restoreWorker: async (worker: Worker): Promise<void> => {
    try {
      const { error } = await supabase
        .from('workers')
        .insert([{
          id: worker.id,
          full_name: worker.fullName,
          phone: worker.telefono,
          email: worker.email,
          payment_method: worker.tipoPago,
          pay_per_reservation: worker.pagoPorReserva,
          price_per_km: worker.precioPorKm,
          notes: worker.notes,
          pending_balance: worker.owedMoney,
          retained_cash: worker.efectivoRetenido,
          bizum_phone: worker.telefonoBizum,
          worker_type: worker.tipoTrabajador,
          photo_url: worker.photo,
          iban: worker.iban,
          dni: worker.dni
        }]);

      if (error) throw error;
      
      const updatedWorkers = [worker, ...currentWorkers.filter(w => w.id !== worker.id)];
      saveWorkers(updatedWorkers);
    } catch (error) {
      console.error('Error restoring worker in Supabase:', error);
      throw error;
    }
  },

  getRecentCheckIns: async (limit = 10): Promise<CheckInOut[]> => {
    return [...MOCK_CHECKINS]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);
  },

  getRecentIncidencias: async (limit = 50): Promise<Incidencia[]> => {
    try {
      const { data, error } = await supabase
        .from('incidencias_logistica')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data || []).map(incRowToIncidencia);
    } catch (error) {
      console.error('Error fetching incidencias from Supabase:', error);
      return [];
    }
  },

  migrateIncidenciasFromSheets: async (): Promise<{ inserted: number; skipped: boolean }> => {
    if (_migrationsConfirmed.has('incidencias')) return { inserted: 0, skipped: true };
    const { count } = await supabase.from('incidencias_logistica').select('id', { count: 'exact', head: true });
    if ((count ?? 0) > 0) { _migrationsConfirmed.add('incidencias'); return { inserted: 0, skipped: true }; }
    if (!INCIDENCIAS_SPREADSHEET_ID || !GOOGLE_API_KEY) return { inserted: 0, skipped: false };

    try {
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${INCIDENCIAS_SPREADSHEET_ID}/values/${encodeURIComponent(INCIDENCIAS_RANGE)}?key=${GOOGLE_API_KEY}`;
      const response = await fetchWithRetry(url);
      if (!response.ok) return { inserted: 0, skipped: false };
      const sheetData = await response.json();
      if (!sheetData.values || sheetData.values.length < 2) return { inserted: 0, skipped: false };

      const headers = sheetData.values[0] as string[];
      const rows = sheetData.values.slice(1) as any[][];
      const getVal = (row: any[], h: string) => {
        const idx = headers.findIndex(x => x && x.trim().toUpperCase() === h.toUpperCase());
        return idx !== -1 ? String(row[idx] ?? '').trim() : '';
      };

      const parseIncFecha = (f: string): string => {
        const m = f.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[,\s]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
        if (m) {
          const [, dd, mo, yy, hh = '00', mi = '00', ss = '00'] = m;
          return `${yy}-${mo.padStart(2,'0')}-${dd.padStart(2,'0')}T${hh.padStart(2,'0')}:${mi.padStart(2,'0')}:${ss.padStart(2,'0')}`;
        }
        return new Date().toISOString();
      };

      const inserts = rows.map(row => ({
        user_name: `${getVal(row,'NOMBRE')} ${getVal(row,'APELLIDOS')}`.trim() || 'Desconocido',
        description: getVal(row, 'DETALLES INCIDENCIA'),
        timestamp: parseIncFecha(getVal(row, 'FECHA')),
        accommodation_id: '',
        accommodation_name: getVal(row, 'APARTAMENTO') || 'Sin especificar',
        coste: 0,
        pagado_por: 'empresa' as const,
        kms: parseExcelNumber(getVal(row, 'KMS TOTAL')) || null,
        checked: getVal(row, 'CHECKED').toUpperCase() === 'TRUE',
        telefono: getVal(row, 'TELEFONO'),
        nombre: getVal(row, 'NOMBRE'),
        apellidos: getVal(row, 'APELLIDOS'),
        parada_inicial: getVal(row, 'PARADA INICIAL'),
        parada_opcional1: getVal(row, 'PARADA OPCIONAL 1'),
        parada_opcional2: getVal(row, 'PARADA OPCIONAL 2'),
        parada_opcional3: getVal(row, 'PARADA OPCIONAL 3'),
        parada_opcional4: getVal(row, 'PARADA OPCIONAL 4'),
        parada_opcional5: getVal(row, 'PARADA OPCIONAL 5'),
        parada_final: getVal(row, 'PARADA FINAL'),
        observaciones: getVal(row, 'OBSERVACIONES'),
      }));

      if (inserts.length === 0) return { inserted: 0, skipped: false };
      const { error } = await supabase.from('incidencias_logistica').insert(inserts);
      if (error) throw error;
      console.log(`[migrateIncidencias] Insertadas ${inserts.length} incidencias.`);
      return { inserted: inserts.length, skipped: false };
    } catch (err) {
      console.error('[migrateIncidencias] Error:', err);
      return { inserted: 0, skipped: false };
    }
  },

  // Migración única: copia las sugerencias del Sheet viejo a la tabla `suggestions`.
  // Idempotente: se omite si la tabla ya tiene filas.
  migrateSuggestionsFromSheets: async (): Promise<{ inserted: number; skipped: boolean }> => {
    const { count } = await supabase.from('suggestions').select('id', { count: 'exact', head: true });
    if ((count ?? 0) > 0) return { inserted: 0, skipped: true };
    if (!SUGERENCIAS_APPS_SCRIPT_URL) return { inserted: 0, skipped: false };

    const response = await fetch(`${SUGERENCIAS_APPS_SCRIPT_URL}?action=listSuggestions&limit=1000`);
    if (!response.ok) return { inserted: 0, skipped: false };
    const data = await response.json();
    const olds: Suggestion[] = data?.ok ? (data.suggestions || []) : [];
    if (olds.length === 0) return { inserted: 0, skipped: false };

    const rows = olds.map(s => ({
      subject: s.subject || '',
      from_text: s.from || '',
      email: s.from?.includes('<') ? (s.from.match(/<([^>]+)>/)?.[1] || '') : '',
      category: s.category || 'otro',
      body: s.body || '',
      snippet: s.snippet || '',
      is_read: !!s.isRead,
      is_starred: !!s.isStarred,
      created_at: s.date || new Date().toISOString(),
    }));
    const { error } = await supabase.from('suggestions').insert(rows);
    if (error) throw error;
    console.log(`[migrateSuggestions] Insertadas ${rows.length} sugerencias.`);
    return { inserted: rows.length, skipped: false };
  },

  getSuggestions: async (limit = 40): Promise<Suggestion[]> => {
    try {
      const { data, error } = await supabase
        .from('suggestions').select('*').order('created_at', { ascending: false }).limit(limit);
      if (error) throw error;
      return (data || []).map(rowToSuggestion);
    } catch (error) {
      console.error('[API Sugerencias] Error:', error);
      return [];
    }
  },

  markSuggestionAsRead: async (id: string): Promise<boolean> => {
    const { error } = await supabase.from('suggestions').update({ is_read: true }).eq('id', id);
    if (error) { console.error('Error marking as read:', error); return false; }
    return true;
  },

  markSuggestionAsUnread: async (id: string): Promise<boolean> => {
    const { error } = await supabase.from('suggestions').update({ is_read: false }).eq('id', id);
    if (error) { console.error('Error marking as unread:', error); return false; }
    return true;
  },

  starSuggestion: async (id: string): Promise<boolean> => {
    const { error } = await supabase.from('suggestions').update({ is_starred: true }).eq('id', id);
    if (error) { console.error('Error starring suggestion:', error); return false; }
    return true;
  },

  unstarSuggestion: async (id: string): Promise<boolean> => {
    const { error } = await supabase.from('suggestions').update({ is_starred: false }).eq('id', id);
    if (error) { console.error('Error unstarring suggestion:', error); return false; }
    return true;
  },

  deleteSuggestion: async (id: string): Promise<boolean> => {
    const { error } = await supabase.from('suggestions').delete().eq('id', id);
    if (error) { console.error('Error deleting suggestion:', error); return false; }
    return true;
  },

  // ponytail: la respuesta se guarda en la columna `reply`; el envío de email al
  // usuario (que hacía Apps Script con MailApp) se pierde. Reañadir con una Edge
  // Function + proveedor de email si se necesita notificar de vuelta.
  replySuggestion: async (id: string, body: string): Promise<boolean> => {
    const { error } = await supabase.from('suggestions').update({ reply: body, is_read: true }).eq('id', id);
    if (error) { console.error('Error replying to suggestion:', error); return false; }
    return true;
  },

  sendAppFeedback: async (payload: AppFeedbackPayload): Promise<boolean> => {
    try {
      const nombreCompleto = `${payload.nombre} ${payload.apellidos}`.trim();
      const subjectByTipo = payload.tipo === 'fallo' ? 'Problema reportado'
        : payload.tipo === 'sugerencia' ? 'Sugerencia' : 'Mensaje';
      const { error } = await supabase.from('suggestions').insert([{
        subject: subjectByTipo,
        from_text: payload.email ? `${nombreCompleto} <${payload.email}>` : nombreCompleto,
        email: payload.email || '',
        telefono: payload.telefono || '',
        category: payload.tipo,
        body: payload.descripcion,
        snippet: payload.descripcion.slice(0, 140),
        is_read: false,
        is_starred: false,
      }]);
      if (error) throw error;
      return true;
    } catch (error) {
      console.error('[API Feedback] Error enviando sugerencia:', error);
      return false;
    }
  },

  updateIncidencia: async (incidencia: Incidencia): Promise<boolean> => {
    try {
      const { id, ...rest } = incidencia;
      const { error } = await supabase
        .from('incidencias_logistica')
        .update(incidenciaToRow(rest))
        .eq('id', id);
      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error updating incidencia:', error);
      throw error;
    }
  },

  createIncidencia: async (incidencia: Omit<Incidencia, 'id'>): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('incidencias_logistica')
        .insert(incidenciaToRow(incidencia));
      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error creating incidencia:', error);
      throw error;
    }
  },

  deleteIncidencia: async (id: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('incidencias_logistica')
        .delete()
        .eq('id', id);
      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error deleting incidencia:', error);
      throw error;
    }
  },

  getEntregaLlaves: async (): Promise<EntregaLlaves[]> => {
    try {
      const { data, error } = await supabase
        .from('entrega_llaves_logistica')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []).map(elkRowToEntregaLlaves);
    } catch (error) {
      console.error('Error in getEntregaLlaves:', error);
      return [];
    }
  },

  prepareEntregaLlavesForSave: async (
    data: Omit<EntregaLlaves, 'id'>,
    options?: { rowKey?: string }
  ): Promise<Omit<EntregaLlaves, 'id'>> => {
    const rowKey = options?.rowKey ?? `${data.telefono || 'entrega'}-${Date.now()}`;
    let firmaTrabajador = data.firmaTrabajador;
    let firmaHuesped = data.firmaHuesped;
    if (firmaTrabajador?.startsWith('data:image/')) {
      firmaTrabajador = (await uploadEntregaFirmaIfNeeded(firmaTrabajador, `${rowKey}-trabajador`)) ?? '';
    }
    if (firmaHuesped?.startsWith('data:image/')) {
      firmaHuesped = (await uploadEntregaFirmaIfNeeded(firmaHuesped, `${rowKey}-huesped`)) ?? '';
    }
    return { ...data, firmaTrabajador, firmaHuesped };
  },

  addEntregaLlaves: async (data: Omit<EntregaLlaves, 'id'>): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('entrega_llaves_logistica')
        .insert(entregaLlavesToRow(data));
      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error adding Entrega de Llaves:', error);
      throw error;
    }
  },

  updateEntregaLlaves: async (data: EntregaLlaves): Promise<boolean> => {
    try {
      const { id, ...rest } = data;
      const { error } = await supabase
        .from('entrega_llaves_logistica')
        .update(entregaLlavesToRow(rest))
        .eq('id', id);
      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error updating Entrega de Llaves:', error);
      throw error;
    }
  },

  deleteEntregaLlaves: async (id: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('entrega_llaves_logistica')
        .delete()
        .eq('id', id);
      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error deleting Entrega de Llaves:', error);
      throw error;
    }
  },

  migrateEntregaLlavesFromSheets: async (): Promise<{ inserted: number; skipped: boolean }> => {
    if (_migrationsConfirmed.has('entregaLlaves')) return { inserted: 0, skipped: true };
    const { count } = await supabase
      .from('entrega_llaves_logistica')
      .select('id', { count: 'exact', head: true });
    if ((count ?? 0) > 0) {
      _migrationsConfirmed.add('entregaLlaves');
      return { inserted: 0, skipped: true };
    }

    try {
      const sheetBase = `https://sheets.googleapis.com/v4/spreadsheets/${ENTREGA_LLAVES_SPREADSHEET_ID}/values/`;
      const [fmtRes, formulaRes] = await Promise.all([
        fetch(`${sheetBase}${encodeURIComponent(ENTREGA_LLAVES_RANGE)}?key=${GOOGLE_API_KEY}`),
        fetch(`${sheetBase}${encodeURIComponent("'Informe_Entrega_Llaves'!S:U")}?valueRenderOption=FORMULA&key=${GOOGLE_API_KEY}`),
      ]);
      if (!fmtRes.ok) throw new Error(`Sheet error: ${fmtRes.statusText}`);
      const sheetData = await fmtRes.json();
      if (!sheetData.values || sheetData.values.length < 2) return { inserted: 0, skipped: false };

      const formulaData = formulaRes.ok ? await formulaRes.json() : { values: [] };
      const formulaRows = (formulaData.values || []).slice(1) as string[][];

      const headers = sheetData.values[0] as string[];
      const normalize = (h: string) => h.trim().toUpperCase().normalize('NFD').replace(/\p{M}/gu, '');
      const hIdx = (...names: string[]) => {
        for (const n of names) {
          const i = headers.findIndex(h => h && normalize(String(h)) === normalize(n));
          if (i !== -1) return i;
        }
        return -1;
      };

      const parsePayment = (val: any) => {
        const s = String(val || '').trim().toLowerCase();
        if (s.includes('bizum')) return 'Bizum';
        if (s.includes('tarjeta')) return 'Tarjeta';
        return 'Efectivo';
      };

      const rows = sheetData.values.slice(1).map((row: any[], i: number) => {
        const g = (n: string) => { const idx = hIdx(n); return idx !== -1 ? row[idx] : undefined; };
        const formulaRow = formulaRows[i] || [];
        const firma = (col: number) => parseEntregaFirmaCell(formulaRow[col]);

        const rawTel = String(g('TELEFONO') || g('Telefono') || '').replace(/\D/g, '');
        const tel = (rawTel.startsWith('34') && rawTel.length >= 11) ? rawTel.slice(-9) : rawTel;
        const rawEntrega = String(g('ENTREGA LLAVES') || g('Entrega Llaves') || '').toUpperCase();
        const rawChecked = String(g('CHECKED') || g('Checked') || '').toUpperCase();

        return {
          telefono: tel,
          nombre: String(g('NOMBRE') || g('Nombre') || ''),
          apellidos: String(g('APELLIDOS') || g('Apellidos') || ''),
          fecha_ubicacion_entrega: String(g('FECHA Y UBICACION DE LLAVES ENTREGADAS') || g('Fecha y ubicacion de llaves entregadas') || ''),
          apartamento: String(g('APARTAMENTO') || g('Apartamento') || ''),
          nombre_cliente: String(g('NOMBRE CLIENTE') || g('Nombre Cliente') || ''),
          fecha_entrada_reserva: parseDateTime(g('FECHA ENTRADA RESERVA') || g('Fecha Entrada Reserva')),
          fecha_salida_reserva: parseDateTime(g('FECHA SALIDA RE') || g('FECHA SALIDA RESERVA') || g('Fecha Salida Reserva')),
          entrega_llaves: rawEntrega === 'SÍ' || rawEntrega === 'SI' || rawEntrega === 'YES' || rawEntrega === 'TRUE',
          sabanas_toallas: String(g('SÁBANAS Y TOALLAS') || g('Sábanas y Toallas') || 'No'),
          km: parseExcelNumber(g('KM') || g('Km')),
          observaciones: String(g('OBSERVACIONES') || g('Observaciones') || ''),
          fianza_monto: parsePayment(g('FIANZA (MONTO)') || g('Fianza (Monto)')),
          bizum_monto: String(g('NUMERO BIZUM (MONTO)') || g('Numero Bizum (Monto)') || ''),
          cantidad_pagada_monto: String(parseExcelNumber(g('CANTIDAD PAGADA (MONTO)') || g('Cantidad Pagada (Monto)'))),
          fianza_garantia: parsePayment(g('FIANZA (GARANTIA)') || g('Fianza (Garantia)')),
          bizum_garantia: String(g('NUMERO BIZUM (GARANTIA)') || g('Numero Bizum (Garantia)') || ''),
          cantidad_pagada_garantia: String(parseExcelNumber(g('CANTIDAD PAGADA (GARANTIA)') || g('Cantidad Pagada (Garantia)'))),
          checked: rawChecked === 'TRUE' || rawChecked === 'VERDADERO',
          firma_trabajador: firma(0) || parseEntregaFirmaCell(g('FIRMA TRABAJADOR') || g('Firma Trabajador')) || null,
          firma_huesped: firma(1) || parseEntregaFirmaCell(g('FIRMA HUESPED') || g('Firma Huesped')) || null,
        };
      }).filter((r: any) => r.nombre || r.apellidos || r.telefono);

      if (rows.length === 0) return { inserted: 0, skipped: false };
      const { error } = await supabase.from('entrega_llaves_logistica').insert(rows);
      if (error) throw error;
      console.log(`[migrateELK] Insertados ${rows.length} registros.`);
      return { inserted: rows.length, skipped: false };
    } catch (err) {
      console.error('[migrateELK] Error:', err);
      return { inserted: 0, skipped: false };
    }
  },

  getAnalytics: async () => {

    const totalMoney = currentWorkers.reduce((acc, w) => acc + w.netMoneyMonth, 0);
    const totalCleans = currentWorkers.reduce((acc, w) => acc + w.cleansCountMonth, 0);
    return {
      totalMoney,
      totalCleans
    };
  },

  getAccommodations: async (): Promise<Accommodation[]> => {
    const mapDbRow = (a: any): Accommodation => ({
      id:       a.id,
      name:     a.name,
      ref:      a.ref      || '',
      address:  a.address  || '',
      city:     a.city     || '',
      zipCode:  a.zip_code || '',
      provincia: a.provincia || '',
      notes:    a.notes    || '',
      active:   a.active   ?? true,
      image:    a.image_url || undefined,
    });

    try {
      // Caché TTL + deduplicación de peticiones en vuelo: varios componentes
      // (Dashboard, Workers, etc.) piden alojamientos al montar a la vez. Sin
      // esto, cada uno lanza una query de ~4MB (image_url en base64) por
      // separado. Con el caché compartido solo se descarga una vez por TTL.
      const accommodations = await withSheetsCache('accommodations', async () => {
        const { data, error } = await supabase
          .from('accommodations')
          .select('*')
          .order('name', { ascending: true });

        if (error) {
          console.error('❌ Error de Supabase al leer alojamientos:', error);
          throw error;
        }

        return (data || []).map(mapDbRow);
      });

      saveAccommodations(accommodations);
      return accommodations;
    } catch (err) {
      console.error('⚠️ Fallo en getAccommodations:', err);
      return currentAccommodations;
    }
  },

  updateAccommodation: async (accommodationData: Accommodation): Promise<Accommodation> => {
    try {
      const payload = {
        name:      accommodationData.name,
        ref:       accommodationData.ref       || '',
        address:   accommodationData.address   || '',
        city:      accommodationData.city      || '',
        zip_code:  accommodationData.zipCode   || '',
        provincia: accommodationData.provincia || '',
        notes:     accommodationData.notes     || '',
        active:    accommodationData.active    ?? true,
        image_url: accommodationData.image     || null,
      };

      // Anti-duplicado: si el ID viene de Sheets (real_), usamos upsert por nombre
      if (accommodationData.id.startsWith('real_')) {
        const { error } = await supabase
          .from('accommodations')
          .upsert(payload, { onConflict: 'name' });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('accommodations')
          .update(payload)
          .eq('id', accommodationData.id);
        if (error) throw error;
      }
    } catch (error) {
      console.error('Error updating accommodation in Supabase:', error);
      throw error;
    }

    const updated = currentAccommodations.map(a =>
      a.id === accommodationData.id ? { ...accommodationData } : a
    );
    saveAccommodations(updated);
    invalidateSheetsCache('accommodations');
    return accommodationData;
  },

  addAccommodation: async (accommodationData: Omit<Accommodation, 'id'>): Promise<Accommodation> => {
    try {
      // Verificar si ya existe por nombre para evitar duplicados
      const { data: existing } = await supabase
        .from('accommodations')
        .select('id')
        .eq('name', accommodationData.name)
        .maybeSingle();

      if (existing) {
        return appsScriptApi.updateAccommodation({ ...accommodationData, id: existing.id } as Accommodation);
      }

      const { data, error } = await supabase
        .from('accommodations')
        .insert([{
          name:      accommodationData.name,
          ref:       accommodationData.ref       || '',
          address:   accommodationData.address   || '',
          city:      accommodationData.city      || '',
          zip_code:  accommodationData.zipCode   || '',
          provincia: accommodationData.provincia || '',
          notes:     accommodationData.notes     || '',
          active:    accommodationData.active    ?? true,
          image_url: accommodationData.image     || null,
        }])
        .select()
        .single();

      if (error) throw error;

      const newAccommodation: Accommodation = {
        ...accommodationData,
        id: data.id,
      };
      currentAccommodations = [newAccommodation, ...currentAccommodations];
      saveAccommodations(currentAccommodations);
      invalidateSheetsCache('accommodations');
      return newAccommodation;
    } catch (error) {
      console.error('Error adding accommodation to Supabase:', error);
      throw error;
    }
  },

  deleteAccommodation: async (id: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('accommodations')
        .delete()
        .eq('id', id);

      if (error) throw error;

      const updated = currentAccommodations.filter(a => a.id !== id);
      saveAccommodations(updated);
      invalidateSheetsCache('accommodations');
      return true;
    } catch (error) {
      console.error('Error deleting accommodation from Supabase:', error);
      throw error;
    }
  },

  restoreAccommodation: async (accommodation: Accommodation): Promise<void> => {
    try {
      const { error } = await supabase
        .from('accommodations')
        .upsert({
          id:        accommodation.id,
          name:      accommodation.name,
          ref:       accommodation.ref       || '',
          address:   accommodation.address   || '',
          city:      accommodation.city      || '',
          zip_code:  accommodation.zipCode   || '',
          provincia: accommodation.provincia || '',
          notes:     accommodation.notes     || '',
          active:    accommodation.active    ?? true,
          image_url: accommodation.image     || null,
        });

      if (error) throw error;

      const updated = [accommodation, ...currentAccommodations.filter(a => a.id !== accommodation.id)];
      saveAccommodations(updated);
      invalidateSheetsCache('accommodations');
    } catch (error) {
      console.error('Error restoring accommodation in Supabase:', error);
      throw error;
    }
  },

  getNormalCleansResult: async (): Promise<CleansFetchResult<NormalCleanRecord>> => {
    try {
      const { data, error } = await supabase
        .from('cleans').select('*').eq('type', 'normal').order('created_at', { ascending: true });
      if (error) throw error;
      const records = (data || []).map(rowToNormalClean);
      return { records, status: records.length ? 'ok' : 'empty' };
    } catch (error) {
      console.error('Error fetching normal cleans from Supabase:', error);
      return { records: [], status: 'error', error: String((error as any)?.message || error) };
    }
  },

  getNormalCleans: async (): Promise<NormalCleanRecord[]> => {
    return withSheetsCache('normalCleans', async () => {
      const res = await appsScriptApi.getNormalCleansResult();
      return res.records;
    });
  },

  // Migración única: copia los checkouts de los Sheets viejos a la tabla `cleans`.
  // Solo inserta si la tabla está vacía (idempotente — no duplica si se re-ejecuta).
  migrateCleansFromSheets: async (): Promise<{ inserted: number; skipped: boolean }> => {
    const { count } = await supabase.from('cleans').select('id', { count: 'exact', head: true });
    if ((count ?? 0) > 0) {
      console.warn('[migrateCleans] La tabla cleans ya tiene datos; se omite la migración.');
      return { inserted: 0, skipped: true };
    }

    const normal = await sheetReadCleans('Checkout_Limpieza_Normal', 'A:P', (getVal): NormalCleanRecord | null => {
      const nombre = String(getVal('Nombre') || ''); const apellidos = String(getVal('Apellidos') || '');
      if (!nombre && !apellidos) return null;
      return {
        id: '', telefono: String(getVal('Telefono') || ''), nombre, apellidos,
        checkinFecha: parseDateTime(getVal('Checkin Fecha Trabajador')),
        checkinUbicacion: String(getVal('Checkin Ubicacion Trabajador') || ''),
        checkoutFecha: parseDateTime(getVal('Checkout Fecha Trabajador')),
        checkoutUbicacion: String(getVal('Checkout Ubicacion Trabajador') || ''),
        apartamento: String(getVal('Apartamento') || ''),
        horaEntrada: String(getVal('Hora Limpieza Entrada') || ''),
        horaSalida: String(getVal('Hora Limpieza Salida') || ''),
        sigueHuesped: parseBool(getVal('Sigue Huesped')),
        fechaSalidaReserva: String(getVal('Fecha Salida Reserva') || getVal('FECHA SALIDA RESERVA') || getVal('FECHA SALIDA RE') || '').trim(),
        recogeLlaves: parseBool(getVal('Recoge Llaves')),
        km: parseExcelNumber(getVal('Km')), observaciones: String(getVal('Observaciones') || ''),
        checked: parseBool(getVal('Checked')),
      };
    });

    const initial = await sheetReadCleans('Checkout_Limpieza_Inicial', 'A:M', (getVal): InitialCleanRecord | null => {
      const nombre = String(getVal('Nombre') || ''); const apellidos = String(getVal('Apellidos') || '');
      if (!nombre && !apellidos) return null;
      return {
        id: '', telefono: String(getVal('Telefono') || ''), nombre, apellidos,
        checkinFecha: parseDateTime(getVal('Checkin Fecha Trabajador')),
        checkinUbicacion: String(getVal('Checkin Ubicacion Trabajador') || ''),
        checkoutFecha: parseDateTime(getVal('Checkout Fecha Trabajador')),
        checkoutUbicacion: String(getVal('Checkout Ubicacion Trabajador') || ''),
        apartamento: String(getVal('Apartamento') || ''),
        horaEntrada: String(getVal('Hora Limpieza Entrada') || ''),
        horaSalida: String(getVal('Hora Limpieza Salida') || ''),
        km: parseExcelNumber(getVal('Km')), observaciones: String(getVal('Observaciones') || ''),
        checked: parseBool(getVal('Checked')),
      };
    });

    const handyman = await sheetReadCleans('Checkout_Manitas', 'A:M', (getVal): HandymanRecord | null => {
      const nombre = String(getVal('Nombre') || ''); const apellidos = String(getVal('Apellidos') || '');
      if (!nombre && !apellidos) return null;
      return {
        id: '', telefono: String(getVal('Telefono') || ''), nombre, apellidos,
        fechaLlegada: parseDateTime(getVal('Checkin Fecha Trabajador')),
        ubicacionInicio: String(getVal('Checkin Ubicacion Trabajador') || ''),
        fechaFin: parseDateTime(getVal('Checkout Fecha Trabajador')),
        ubicacionFin: String(getVal('Checkout Ubicacion Trabajador') || ''),
        alojamiento: String(getVal('Apartamento') || ''),
        horaInicioTarea: String(getVal('Hora Reparacion Entrada') || ''),
        horaFinTarea: String(getVal('Hora Reparacion Salida') || ''),
        cantidadMinutos: parseExcelNumber(getVal('Km')),
        observacionesTarea: String(getVal('Observaciones') || ''),
        estadoCompletado: parseBool(getVal('Checked')) ? 'Completado' : 'Pendiente',
      };
    });

    const rows = [
      ...normal.map((r: NormalCleanRecord) => cleanRecordToRow('normal', r)),
      ...initial.map((r: InitialCleanRecord) => cleanRecordToRow('initial', r)),
      ...handyman.map((r: HandymanRecord) => cleanRecordToRow('handyman', r)),
    ];
    if (rows.length === 0) return { inserted: 0, skipped: false };

    const { error } = await supabase.from('cleans').insert(rows);
    if (error) throw error;
    console.log(`[migrateCleans] Insertados ${rows.length} registros en cleans.`);
    return { inserted: rows.length, skipped: false };
  },

  updateCleanStatus: async (type: CleanSheetType, id: string, checked: boolean): Promise<boolean> => {
    try {
      const { error } = await supabase.from('cleans').update({ checked }).eq('id', id);
      if (error) throw error;
      invalidateSheetsCache(cleansCacheKey(type));
      return true;
    } catch (error) {
      console.error('Error updating clean status:', error);
      return false;
    }
  },

  createCheckoutRecord: async (type: CleanSheetType, record: NormalCleanRecord | InitialCleanRecord | HandymanRecord): Promise<boolean> => {
    try {
      const { error } = await supabase.from('cleans').insert([cleanRecordToRow(type, record)]);
      if (error) throw error;
      invalidateSheetsCache(cleansCacheKey(type));
      return true;
    } catch (error) {
      console.error('❌ Error creating checkout record:', error);
      return false;
    }
  },

  updateCheckoutRecord: async (type: CleanSheetType, id: string, record: NormalCleanRecord | InitialCleanRecord | HandymanRecord): Promise<boolean> => {
    try {
      const { type: _t, ...row } = cleanRecordToRow(type, record); // no reescribir el discriminador
      const { error } = await supabase.from('cleans').update(row).eq('id', id);
      if (error) throw error;
      invalidateSheetsCache(cleansCacheKey(type));
      return true;
    } catch (error) {
      console.error('❌ Error updating checkout record:', error);
      return false;
    }
  },

  deleteCheckoutRecord: async (type: CleanSheetType, id: string): Promise<boolean> => {
    try {
      const { error } = await supabase.from('cleans').delete().eq('id', id);
      if (error) throw error;
      invalidateSheetsCache(cleansCacheKey(type));
      return true;
    } catch (error) {
      console.error('❌ Error deleting checkout record:', error);
      return false;
    }
  },

  getInitialCleansResult: async (): Promise<CleansFetchResult<InitialCleanRecord>> => {
    try {
      const { data, error } = await supabase
        .from('cleans').select('*').eq('type', 'initial').order('created_at', { ascending: true });
      if (error) throw error;
      const records = (data || []).map(rowToInitialClean);
      return { records, status: records.length ? 'ok' : 'empty' };
    } catch (error) {
      console.error('Error fetching initial cleans from Supabase:', error);
      return { records: [], status: 'error', error: String((error as any)?.message || error) };
    }
  },

  getInitialCleans: async (): Promise<InitialCleanRecord[]> => {
    return withSheetsCache('initialCleans', async () => {
      const res = await appsScriptApi.getInitialCleansResult();
      return res.records;
    });
  },

  getHandymanRecordsResult: async (): Promise<CleansFetchResult<HandymanRecord>> => {
    try {
      const { data, error } = await supabase
        .from('cleans').select('*').eq('type', 'handyman').order('created_at', { ascending: true });
      if (error) throw error;
      const records = (data || []).map(rowToHandyman);
      return { records, status: records.length ? 'ok' : 'empty' };
    } catch (error) {
      console.error('Error fetching handyman records from Supabase:', error);
      return { records: [], status: 'error', error: String((error as any)?.message || error) };
    }
  },

  getHandymanRecords: async (): Promise<HandymanRecord[]> => {
    return withSheetsCache('handymanRecords', async () => {
      const res = await appsScriptApi.getHandymanRecordsResult();
      return res.records;
    });
  },

  getNormalCheckins: async (): Promise<NormalCleanRecord[]> => {
    try {
      const { supabase } = await import('./supabaseClient');
      const { data, error } = await supabase
        .from('checkins')
        .select('*')
        .eq('type', 'normal')
        .order('checkin_fecha', { ascending: false });
      if (error) throw error;
      return (data || []).map((r: any): NormalCleanRecord => ({
        id: r.id,
        telefono: r.telefono || '',
        nombre: r.nombre || '',
        apellidos: r.apellidos || '',
        checkinFecha: r.checkin_fecha || '',
        checkinUbicacion: r.checkin_ubicacion || '',
        checkoutFecha: r.checkout_fecha || '',
        checkoutUbicacion: r.checkout_ubicacion || '',
        apartamento: r.apartamento || 'Ubicación Desconocida',
        horaEntrada: r.hora_entrada || '',
        horaSalida: r.hora_salida || '',
        sigueHuesped: !!r.sigue_huesped,
        fechaSalidaReserva: r.fecha_salida_reserva || '',
        recogeLlaves: !!r.recoge_llaves,
        km: r.km ?? 0,
        observaciones: r.observaciones || '',
        checked: !!r.checked,
      }));
    } catch (error) {
      console.error('Error getNormalCheckins:', error);
      return [];
    }
  },

  getInitialCheckins: async (): Promise<InitialCleanRecord[]> => {
    try {
      const { supabase } = await import('./supabaseClient');
      const { data, error } = await supabase
        .from('checkins')
        .select('*')
        .eq('type', 'initial')
        .order('checkin_fecha', { ascending: false });
      if (error) throw error;
      return (data || []).map((r: any): InitialCleanRecord => ({
        id: r.id,
        telefono: r.telefono || '',
        nombre: r.nombre || '',
        apellidos: r.apellidos || '',
        checkinFecha: r.checkin_fecha || '',
        checkinUbicacion: r.checkin_ubicacion || '',
        checkoutFecha: r.checkout_fecha || '',
        checkoutUbicacion: r.checkout_ubicacion || '',
        apartamento: r.apartamento || 'Ubicación Desconocida',
        horaEntrada: r.hora_entrada || '',
        horaSalida: r.hora_salida || '',
        km: Number(r.km || 0),
        observaciones: r.observaciones || '',
        checked: !!r.checked,
      }));
    } catch (error) {
      console.error('Error getInitialCheckins:', error);
      return [];
    }
  },

  getHandymanCheckins: async (): Promise<HandymanRecord[]> => {
    try {
      const { supabase } = await import('./supabaseClient');
      const { data, error } = await supabase
        .from('checkins')
        .select('*')
        .eq('type', 'handyman')
        .order('checkin_fecha', { ascending: false });
      if (error) throw error;
      return (data || []).map((r: any): HandymanRecord => ({
        id: r.id,
        telefono: r.telefono || '',
        nombre: r.nombre || '',
        apellidos: r.apellidos || '',
        fechaLlegada: r.checkin_fecha || '',
        ubicacionInicio: r.checkin_ubicacion || '',
        fechaFin: r.checkout_fecha || '',
        ubicacionFin: r.checkout_ubicacion || '',
        alojamiento: r.apartamento || 'Ubicación Desconocida',
        horaInicioTarea: r.hora_entrada || '',
        horaFinTarea: r.hora_salida || '',
        cantidadMinutos: Number(r.km || 0),
        observacionesTarea: r.observaciones || '',
        estadoCompletado: 'Trabajando...',
      }));
    } catch (error) {
      console.error('Error getHandymanCheckins:', error);
      return [];
    }
  },

  getPagos: async (desde: string, hasta: string): Promise<PagoRecord[]> => {

    return currentPagos.filter(p => p.fecha >= desde && p.fecha <= hasta)
      .sort((a, b) => b.fecha.localeCompare(a.fecha));
  },

  getAllPagos: async (): Promise<PagoRecord[]> => {

    return [...currentPagos].sort((a, b) => b.fecha.localeCompare(a.fecha));
  },

  getWorkerPagos: async (workerId: string): Promise<PagoRecord[]> => {

    return currentPagos.filter(p => p.workerId === workerId)
      .sort((a, b) => b.fecha.localeCompare(a.fecha));
  },

  markPagosAsPaid: async (pagoIds: string[]): Promise<PaymentAction> => {

    const targets = currentPagos.filter(p => pagoIds.includes(p.id));
    const amount = targets.reduce((acc, p) => acc + p.importe, 0);
    const workerId = targets[0]?.workerId ?? '';

    currentPagos = currentPagos.map(p =>
      pagoIds.includes(p.id) ? { ...p, estado: 'pagado' as const } : p
    );
    savePagos(currentPagos);

    const action: PaymentAction = {
      id: Date.now().toString(),
      workerId,
      pagoIds,
      amount,
      timestamp: new Date().toISOString(),
    };
    saveUndoStack([action, ...getUndoStack()].slice(0, 20));
    return action;
  },

  undoPayment: async (actionId: string): Promise<void> => {

    const stack = getUndoStack();
    const action = stack.find(a => a.id === actionId);
    if (!action) return;
    currentPagos = currentPagos.map(p =>
      action.pagoIds.includes(p.id) ? { ...p, estado: 'pendiente' as const } : p
    );
    savePagos(currentPagos);
    saveUndoStack(stack.filter(a => a.id !== actionId));
  },

  getWorkerPaymentActions: async (workerId: string): Promise<PaymentAction[]> => {

    return getUndoStack().filter(a => a.workerId === workerId);
  },

  createPago: async (pago: Omit<PagoRecord, 'id'>): Promise<PagoRecord> => {

    const newPago: PagoRecord = { ...pago, id: `p_${Date.now()}` };
    currentPagos = [newPago, ...currentPagos];
    savePagos(currentPagos);
    return newPago;
  },

  getWorkerCleans: async (workerPhone: string): Promise<{
    normal: NormalCleanRecord[];
    initial: InitialCleanRecord[];
    handyman: HandymanRecord[];
  }> => {
    const [normal, initial, handyman] = await Promise.all([
      appsScriptApi.getNormalCleans().catch(() => [] as NormalCleanRecord[]),
      appsScriptApi.getInitialCleans().catch(() => [] as InitialCleanRecord[]),
      appsScriptApi.getHandymanRecords().catch(() => [] as HandymanRecord[]),
    ]);

    return {
      normal: normal.filter(r => matchesWorkerByPhone(r.telefono, workerPhone)),
      initial: initial.filter(r => matchesWorkerByPhone(r.telefono, workerPhone)),
      handyman: handyman.filter(r => matchesWorkerByPhone(r.telefono, workerPhone)),
    };
  },

  deleteCheckinRecord: async (type: string, id: string): Promise<boolean> => {
    try {
      const sheetName = getCheckinSheetName(type);
      const rowIndex = parseRowIndexFromId(id);
      await fetch(CLEANS_APPS_SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({
          action: 'deleteCheckout', // The script uses this action for generic row deletion
          sheetName,
          rowIndex
        })
      });
      return true;
    } catch (error) {
      console.error('Error deleteCheckinRecord:', error);
      throw error;
    }
  }
};


// --- API de Actividad Reciente (Log de Actividades en Supabase) ---
export interface ActivityLog {
  id: string;
  user_id: string | null;
  user_name: string;
  action: string;
  action_type: string;
  created_at: string;
}

export const activityLogApi = {
  async log(userId: string | null, userName: string, action: string, actionType: string): Promise<ActivityLog | null> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.warn('No se pudo registrar actividad: sesión no válida.');
        return null;
      }
      const { data, error } = await supabase
        .from('activity_log')
        .insert({
          user_id: userId,
          user_name: userName,
          action,
          action_type: actionType
        })
        .select('*')
        .single();
      if (error) {
        console.error('Error logging activity:', error);
        return null;
      }
      return data as ActivityLog;
    } catch (err) {
      console.error('Exception logging activity:', err);
      return null;
    }
  },

  async getLatest(limit = 10): Promise<ActivityLog[]> {
    try {
      const { data, error } = await supabase
        .from('activity_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) {
        console.error('Error fetching activity log:', error);
        return [];
      }
      return data ?? [];
    } catch (err) {
      console.error('Exception fetching activity log:', err);
      return [];
    }
  }
};


// --- API de Historial de Informes (report_history en Supabase) ---
export interface ReportHistoryEntry {
  id: string;
  user_id: string | null;
  user_name: string;
  file_name: string;
  periodo: string;
  periodo_label: string;
  worker_name: string | null;
  acc_name: string | null;
  sections: string[];
  summary_text: string | null;
  created_at: string;
}

export const reportHistoryApi = {
  async save(entry: Omit<ReportHistoryEntry, 'id' | 'created_at'>): Promise<ReportHistoryEntry | null> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.warn('No se pudo guardar historial: sesión no válida.');
        return null;
      }
      const { data, error } = await supabase
        .from('report_history')
        .insert({
          user_id:      entry.user_id,
          user_name:    entry.user_name,
          file_name:    entry.file_name,
          periodo:      entry.periodo,
          periodo_label: entry.periodo_label,
          worker_name:  entry.worker_name,
          acc_name:     entry.acc_name,
          sections:     entry.sections,
          summary_text: entry.summary_text,
        })
        .select('*')
        .single();
      if (error) {
        console.error('Error saving report history:', error);
        return null;
      }
      return data as ReportHistoryEntry;
    } catch (err) {
      console.error('Exception saving report history:', err);
      return null;
    }
  },

  async getLatest(limit = 20): Promise<ReportHistoryEntry[]> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return [];
      const { data, error } = await supabase
        .from('report_history')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) {
        console.error('Error fetching report history:', error);
        return [];
      }
      return (data ?? []) as ReportHistoryEntry[];
    } catch (err) {
      console.error('Exception fetching report history:', err);
      return [];
    }
  },

  async clearAll(): Promise<boolean> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return false;
      const { error } = await supabase.from('report_history').delete();
      if (error) {
        console.error('Error clearing report history:', error);
        return false;
      }
      return true;
    } catch (err) {
      console.error('Exception clearing report history:', err);
      return false;
    }
  },

  async clearByUser(userId: string): Promise<boolean> {
    try {
      if (!userId) return false;
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return false;
      const { error } = await supabase
        .from('report_history')
        .delete()
        .eq('user_id', userId);
      if (error) {
        console.error('Error clearing user report history:', error);
        return false;
      }
      return true;
    } catch (err) {
      console.error('Exception clearing user report history:', err);
      return false;
    }
  },
};
