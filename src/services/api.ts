import {
  MOCK_WORKERS,
  MOCK_CHECKINS,
  MOCK_INCIDENCIAS,
  MOCK_NORMAL_CLEANS,
  MOCK_INITIAL_CLEANS,
  MOCK_HANDYMAN_RECORDS,
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
  WorkerAccommodationDetails
} from './mockData';
import { supabase } from './supabaseClient';
import { computeWorkerEarnings, matchesWorkerByPhone } from '../utils/payments';

// Google Sheets API Configuration
const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_API_KEY || '';
const SPREADSHEET_ID = import.meta.env.VITE_SPREADSHEET_ID || ''; // Alojamientos
const WORKERS_SPREADSHEET_ID = import.meta.env.VITE_WORKERS_SPREADSHEET_ID || ''; // Pagos Generales (Operarios)
const CLEANS_SPREADSHEET_ID = import.meta.env.VITE_CLEANS_SPREADSHEET_ID || ''; // INFORMES_OPERARIOS
const ACCOMMODATIONS_RANGE = "'ALOJAMIENTOS ACTIVOS'!A:AJ"; // Extendido para incluir CP, POBLACIÓN y PROVINCIA del apartamento
const WORKERS_RANGE = "'informacion operarios'!A:Z";
const APPS_SCRIPT_URL = import.meta.env.VITE_APPS_SCRIPT_URL || '';
const CLEANS_APPS_SCRIPT_URL = import.meta.env.VITE_CLEANS_APPS_SCRIPT_URL || '';
const WORKERS_APPS_SCRIPT_URL = import.meta.env.VITE_WORKERS_APPS_SCRIPT_URL || '';
const INCIDENCIAS_SPREADSHEET_ID = import.meta.env.VITE_INCIDENCIAS_SPREADSHEET_ID || '';
const INCIDENCIAS_RANGE = "'Informe_Incidencia'!A:Z";
const INCIDENCIAS_APPS_SCRIPT_URL = import.meta.env.VITE_INCIDENCIAS_APPS_SCRIPT_URL || '';
const ENTREGA_LLAVES_RANGE = "'Informe_Entrega_Llaves'!A:S";
const ENTREGA_LLAVES_APPS_SCRIPT_URL = import.meta.env.VITE_ENTREGA_LLAVES_APPS_SCRIPT_URL || '';
const SUGERENCIAS_APPS_SCRIPT_URL = import.meta.env.VITE_SUGERENCIAS_APPS_SCRIPT_URL || '';
const SAVE_PDF_APPS_SCRIPT_URL = import.meta.env.VITE_SAVE_PDF_APPS_SCRIPT_URL || '';
const PDF_FOLDER_ID = import.meta.env.VITE_PDF_FOLDER_ID || '';

type AppsScriptJsonResponse = { ok: boolean; error?: string; [k: string]: any };

const postToCleansScript = async (payload: Record<string, any>): Promise<AppsScriptJsonResponse> => {
  try {
    // Apps Script Web App no permite controlar CORS headers en la respuesta (TextOutput no soporta setHeader),
    // así que desde localhost el navegador bloqueará leer la respuesta. Enviamos fire-and-forget con no-cors.
    await fetch(CLEANS_APPS_SCRIPT_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
    });
    return { ok: true };
  } catch (error: any) {
    return { ok: false, error: String(error?.message || error) };
  }
};

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
  
  let datePart = String(dateVal || '').trim();
  let timePart = String(timeVal || '12:00').trim();

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



const getCleanSheetName = (type: CleanSheetType): string => {
  if (type === 'normal') return 'Checkout_Limpieza_Normal';
  if (type === 'initial') return 'Checkout_Limpieza_Inicial';
  return 'Checkout_Manitas';
};

const getCheckinSheetName = (type: string): string => {
  if (type === 'normal') return 'Checkin_Limpieza_Normal';
  if (type === 'initial') return 'Checkin_Limpieza_Inicial';
  return 'Checkin_Manitas';
};

const parseRowIndexFromId = (id: string): number => {
  if (!id) return -1;
  // Soporta formatos nc_123, ic_123, hm_123 o simplemente el número
  const parts = String(id).split('_');
  const indexStr = parts.length > 1 ? parts[1] : parts[0];
  const rowIndex = parseInt(indexStr, 10);
  if (!Number.isFinite(rowIndex) || rowIndex <= 1) {
    console.warn(`⚠️ Invalid clean record id for indexing: ${id}`);
    return -1;
  }
  return rowIndex;
};

const cleanRecordToPayload = (type: CleanSheetType, record: NormalCleanRecord | InitialCleanRecord | HandymanRecord): Record<string, any> => {
  if (type === 'normal') {
    const data = record as NormalCleanRecord;
    return {
      Telefono: data.telefono,
      Nombre: data.nombre,
      Apellidos: data.apellidos,
      'Checkin Fecha Trabajador': data.checkinFecha,
      'Checkin Ubicacion Trabajador': data.checkinUbicacion,
      'Checkout Fecha Trabajador': data.checkoutFecha,
      'Checkout Ubicacion Trabajador': data.checkoutUbicacion,
      Apartamento: data.apartamento,
      'Hora Limpieza Entrada': data.horaEntrada,
      'Hora Limpieza Salida': data.horaSalida,
      'Sigue Huesped': data.sigueHuesped,
      'Fecha Salida Reserva': data.fechaSalidaReserva,
      'Recoge Llaves': data.recogeLlaves,
      Km: data.km,
      Observaciones: data.observaciones,
      Checked: data.checked,
    };
  }
  if (type === 'initial') {
    const data = record as InitialCleanRecord;
    return {
      Telefono: data.telefono,
      Nombre: data.nombre,
      Apellidos: data.apellidos,
      'Checkin Fecha Trabajador': data.checkinFecha,
      'Checkin Ubicacion Trabajador': data.checkinUbicacion,
      'Checkout Fecha Trabajador': data.checkoutFecha,
      'Checkout Ubicacion Trabajador': data.checkoutUbicacion,
      Apartamento: data.apartamento,
      'Hora Limpieza Entrada': data.horaEntrada,
      'Hora Limpieza Salida': data.horaSalida,
      Km: data.km,
      Observaciones: data.observaciones,
      Checked: data.checked,
    };
  }
  const data = record as HandymanRecord;
  return {
    Telefono: data.telefono,
    Nombre: data.nombre,
    Apellidos: data.apellidos,
    'Checkin Fecha Trabajador': data.fechaLlegada,
    'Checkin Ubicacion Trabajador': data.ubicacionInicio,
    'Checkout Fecha Trabajador': data.fechaFin,
    'Checkout Ubicacion Trabajador': data.ubicacionFin,
    Apartamento: data.alojamiento,
    'Hora Reparacion Entrada': data.horaInicioTarea,
    'Hora Reparacion Salida': data.horaFinTarea,
    Km: data.cantidadMinutos,
    Observaciones: data.observacionesTarea,
    Checked: data.estadoCompletado === 'Completado',
  };
};

export const appsScriptApi = {
  login: async (email: string, pass: string): Promise<User | null> => {
    try {
      // Autenticar exclusivamente con Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password: pass,
      });

      if (authError) {
        console.error('Error de autenticación:', authError.message);
        return null;
      }

      const sessionUser = authData.user;
      if (!sessionUser) return null;

      // Usamos variables mutables para permitir el fallback a Google
      let { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, email, full_name, role, phone')
        .eq('id', sessionUser.id)
        .single();

      if (profileError || !profile || profile.role === 'viewer') {
        console.warn('Perfil no encontrado, RLS bloqueado o rol de visualizador detectado. Verificando con el puente de Google...');
        try {
          const url = new URL(APPS_SCRIPT_URL);
          url.searchParams.append('action', 'getProfile');
          url.searchParams.append('email', sessionUser.email || '');

          const response = await fetch(url.toString(), { method: 'GET' });
          const data = await response.json();
          
          console.log('🔍 [Login] Respuesta completa de Google:', JSON.stringify(data));

          if (data.ok && data.profile) {
            const googleProfile = data.profile;
            console.info('✅ [Login] Perfil encontrado en Google:', googleProfile.full_name, 'Rol:', googleProfile.role);
            
            // Sincronizar con Supabase usando el ID real
            const { error: upsertError } = await supabase
              .from('profiles')
              .upsert({
                id: sessionUser.id,
                email: sessionUser.email,
                full_name: googleProfile.full_name || googleProfile.nombre || googleProfile.name,
                role: googleProfile.role || googleProfile.rol || 'viewer',
                phone: googleProfile.phone || googleProfile.telefono || googleProfile.phone_number
              });

            if (!upsertError) {
              console.info('✨ [Login] Perfil sincronizado con Supabase.');
              profile = { ...googleProfile, id: sessionUser.id };
            } else {
              console.error('❌ [Login] Error al sincronizar:', upsertError.message);
              profile = { ...googleProfile, id: sessionUser.id };
            }
            profileError = null;
          } else {
            console.warn('⚠️ [Login] Google no encontró el perfil o devolvió error:', data.error);
          }
        } catch (gasError) {
          console.error('❌ [Login] Fallo crítico en el puente de Google:', gasError);
        }

        if (!profile) {
          console.warn('🚩 [Login] Fallback final a metadatos de Auth.');
          return {
            id: sessionUser.id,
            email: sessionUser.email || '',
            role: 'viewer',
            name: sessionUser.user_metadata?.full_name || sessionUser.user_metadata?.name || 'Usuario'
          };
        }
      }

      const p = profile as any;
      const finalUser: User = {
        id: p.id || sessionUser.id,
        email: p.email || sessionUser.email,
        role: (p.role || 'viewer') as any,
        name: p.full_name || p.name || sessionUser.user_metadata?.full_name || 'Usuario',
        telefono: p.phone || p.telefono || undefined
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
      console.log('🔍 [API] Buscando perfil por email:', email);
      
      // 1. Intentar Google primero (es nuestra fuente de verdad para roles heredados)
      try {
        const url = new URL(APPS_SCRIPT_URL);
        url.searchParams.append('action', 'getProfile');
        url.searchParams.append('email', email);
        const response = await fetch(url.toString(), { method: 'GET' });
        const data = await response.json();
        if (data.ok && data.profile) {
          console.log('✅ [API] Perfil recuperado de Google');
          return {
            id: data.profile.id,
            email: data.profile.email,
            role: data.profile.role || data.profile.rol || 'viewer',
            name: data.profile.full_name || data.profile.nombre || data.profile.name,
            telefono: data.profile.phone || data.profile.telefono || data.profile.phone_number
          };
        }
      } catch (e) {
        console.warn('⚠️ [API] Fallo al consultar Google en getProfileByEmail');
      }

      // 2. Fallback a Supabase
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('email', email)
        .single();
      
      if (profile) {
        return {
          id: profile.id,
          email: profile.email,
          role: profile.role,
          name: profile.full_name,
          telefono: profile.phone
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
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      return { ok: true };
    } catch (error: any) {
      console.error('Error al actualizar contraseña:', error);
      return { ok: false, error: error.message };
    }
  },

  uploadReportPDF: async (blob: Blob, filename: string): Promise<{ ok: boolean, error?: string }> => {
    try {
      if (!SAVE_PDF_APPS_SCRIPT_URL) {
        throw new Error('La URL de SAVE_PDF_APPS_SCRIPT_URL no está configurada.');
      }
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      const response = await fetch(SAVE_PDF_APPS_SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'uploadPDF',
          filename,
          base64,
          folderId: PDF_FOLDER_ID
        })
      });
      // no-cors no nos permite leer la respuesta, por lo que asumimos que está ok si no lanza excepción
      return { ok: true };
    } catch (e: any) {
      console.error('Error al subir PDF:', e);
      return { ok: false, error: e.message };
    }
  },


  inviteUser: async (email: string, userData: { name: string; role: string; telefono?: string; dni?: string; home_address?: string; bank_account?: string }): Promise<{ ok: boolean; id?: string; error?: string }> => {
    try {
      // Apps Script Web App no permite controlar CORS headers en la respuesta.
      // Enviamos vía POST con no-cors para asegurar que la petición llegue.
      const url = new URL(APPS_SCRIPT_URL);
      url.searchParams.append('action', 'inviteUser');
      url.searchParams.append('email', email);
      url.searchParams.append('userData', JSON.stringify(userData));

      await fetch(url.toString(), {
        method: 'GET',
        mode: 'no-cors'
      });
      
      // Con no-cors no podemos leer la respuesta (ID), pero la invitación se envía.
      // El perfil se creará/actualizará en el siguiente paso de handleSave.
      return { ok: true, id: 'temp-id-' + Date.now() }; 
    } catch (error: any) {
      console.error('Error al invitar usuario:', error);
      return { ok: false, error: String(error) };
    }
  },

  // --- Funciones de Administración (Supabase) ---

  getAllUsers: async (): Promise<User[]> => {
    let { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('full_name', { ascending: true });

    if (!data || data.length === 0) {
      console.warn('⚠️ [API] Supabase no devolvió perfiles. Intentando Google...');
      try {
        const url = new URL(APPS_SCRIPT_URL);
        url.searchParams.append('action', 'getAllProfiles');
        // Usamos un proxy de CORS o intentamos fetch normal (aunque falle)
        const response = await fetch(url.toString(), { method: 'GET' });
        const gasData = await response.json();
        if (gasData.ok && gasData.profiles) {
          data = gasData.profiles;
        }
      } catch (e) {
        console.error('❌ [API] Fallo al obtener perfiles desde Google (CORS):', e);
      }
    }

    const finalProfiles = (data || []).map(p => ({
      id: p.id,
      email: p.email,
      role: p.role as any,
      name: p.full_name || p.name,
      telefono: p.phone || p.telefono || undefined,
      last_seen: p.last_seen // Campo para el estado de conexión
    }));

    return finalProfiles;
  },

  updateProfile: async (userId: string, profileData: Partial<User>) => {
    const { error } = await supabase
      .from('profiles')
      .upsert({
        id: userId,
        email: profileData.email,
        full_name: profileData.name,
        role: profileData.role,
        phone: profileData.telefono,
      });

    if (error) throw error;
  },

  deleteProfile: async (userId: string) => {
    const { error } = await supabase
      .from('profiles')
      .delete()
      .eq('id', userId);
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
      // 1. Fetch from Supabase 'workers' table
      const { data: dbWorkers, error: dbError } = await supabase
        .from('workers')
        .select(`
          *,
          profile:profile_id (
            id,
            email,
            full_name,
            phone
          )
        `)
        .order('full_name', { ascending: true });

      if (dbError) throw dbError;

      // 2. Fetch sensitive data if available (DNI/IBAN)
      // Note: We'll fetch all sensitive data for linked profiles to merge it
      const profileIds = dbWorkers.filter(w => w.profile_id).map(w => w.profile_id);
      let sensitiveMap: Record<string, any> = {};
      
      if (profileIds.length > 0) {
        const { data: sensitiveData } = await supabase
          .from('worker_sensitive_data')
          .select('*')
          .in('id', profileIds);
        
        if (sensitiveData) {
          sensitiveMap = sensitiveData.reduce((acc, curr) => ({
            ...acc,
            [curr.id]: curr
          }), {});
        }
      }

      // 3. Fetch accommodation assignments from pivot table
      const workerIds = dbWorkers.map((w: any) => w.id);
      const workerAccDetailsMap: Record<string, WorkerAccommodationDetails[]> = {};

      if (workerIds.length > 0) {
        // Intentamos leer las columnas nuevas; si no existen aún hacemos fallback a la query básica
        const { data: waData, error: waError } = await supabase
          .from('worker_accommodations')
          .select('worker_id, precio, sabanas_incl, toallas_incl, accommodations(name)')
          .in('worker_id', workerIds);

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

        if (!waError && waData) {
          populate(waData, true);
        } else {
          // Fallback: columnas nuevas no disponibles aún — usamos query básica
          if (waError) console.warn('worker_accommodations: columnas nuevas no disponibles, usando fallback:', waError.message);
          const { data: basicData } = await supabase
            .from('worker_accommodations')
            .select('worker_id, accommodations(name)')
            .in('worker_id', workerIds);
          if (basicData) populate(basicData, false);
        }
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
          photo: w.photo_url
        } as any;
      });

      // 4. Compute derived values (same as before)
      const [normalCleans, initialCleans, handymanRecords, entregaLlaves] = await Promise.all([
        appsScriptApi.getNormalCleans().catch(() => []),
        appsScriptApi.getInitialCleans().catch(() => []),
        appsScriptApi.getHandymanRecords().catch(() => []),
        appsScriptApi.getEntregaLlaves().catch(() => []),
      ]);

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
  syncWorkersFromSheets: async (): Promise<void> => {
    try {
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${WORKERS_SPREADSHEET_ID}/values/${encodeURIComponent(WORKERS_RANGE)}?key=${GOOGLE_API_KEY}`;
      const response = await fetchWithRetry(url);
      if (!response.ok) return;

      const data = await response.json();
      if (!data.values || data.values.length < 2) return;

      const headers = data.values[0];
      const rows = data.values.slice(1);

      const workersToSync = rows.map((row: any[], index: number) => {
        const getVal = (headerName: string) => {
          const norm = normalizeHeader(headerName);
          const idx = headers.findIndex((h: string) => normalizeHeader(h) === norm);
          return idx !== -1 ? row[idx] : undefined;
        };

        const medioPago = String(getVal('MEDIO DE PAGO') || '').toLowerCase();
        const tipoPago = medioPago.includes('bizum') ? 'bizum' :
                         medioPago.includes('tarjeta') ? 'tarjeta' :
                         'efectivo';

        return {
          full_name: String(getVal('OPERARIO') || ''),
          phone: String(getVal('MOVIL') || ''),
          iban: String(getVal('CUENTA BANCARIA') || ''),
          payment_method: tipoPago,
          pay_per_reservation: parseExcelNumber(getVal('PAGO POR RESERVA')),
          price_per_km: parseExcelNumber(getVal('KILOMETRAJE')),
          notes: String(getVal('OBSERVACIONES') || ''),
          pending_balance: parseExcelNumber(getVal('SALDO PENDIENTE')),
          retained_cash: parseExcelNumber(getVal('EFECTIVO RETENIDO')),
          active: true
        };
      }).filter((w: any) => w.full_name && w.phone);

      // Upsert en Supabase usando el teléfono como clave única
      const { error } = await supabase
        .from('workers')
        .upsert(workersToSync, { onConflict: 'phone' });

      if (error) {
        console.error('Error en sincronización Supabase:', error);
      } else {
        // --- SINCRONIZAR ELIMINACIONES DEL EXCEL ---
        // Extraemos los teléfonos que están actualmente en el Excel
        const activePhones = workersToSync.map((w: any) => w.phone);
        
        // Consultamos qué teléfonos tenemos en Supabase
        const { data: dbWorkers } = await supabase.from('workers').select('id, phone');
        if (dbWorkers) {
          const dbPhones = dbWorkers.map(w => w.phone);
          // Los que están en Supabase pero ya NO están en Excel, los eliminamos
          const phonesToDelete = dbPhones.filter(phone => !activePhones.includes(phone) && phone !== '');
          
          if (phonesToDelete.length > 0) {
            await supabase.from('workers').delete().in('phone', phonesToDelete);
            console.log(`Sincronización: Eliminados ${phonesToDelete.length} trabajadores que fueron borrados del Excel.`);
          }
        }
        
        console.log('✅ Sincronización Excel -> Supabase completada');
      }
    } catch (error) {
      console.error('Error sincronizando trabajadores:', error);
    }
  },

  // --- Sincronización Alojamientos: Sheets -> Supabase ---
  syncAccommodationsFromSheets: async (): Promise<void> => {
    try {
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(ACCOMMODATIONS_RANGE)}?key=${GOOGLE_API_KEY}`;
      const response = await fetchWithRetry(url);
      if (!response.ok) return;

      const data = await response.json();
      if (!data.values || data.values.length < 2) return;

      const headers = data.values[0] as string[];
      const rows = data.values.slice(1) as any[][];

      const toSync = rows
        .map((row) => {
          const getVal = (headerName: string) => {
            const norm = normalizeHeader(headerName);
            const idx = headers.findIndex((h: string) => h && normalizeHeader(h) === norm);
            return idx !== -1 ? row[idx] : undefined;
          };

          const name = String(getVal('PROPIEDAD') || getVal('NOMBRE') || getVal('Apartamento') || '').trim();
          if (!name) return null;

          const touristAddress = String(getVal('DIRECCIÓN ALOJAMIENTO TURÍSTICO') || getVal('DIRECCION ALOJAMIENTO TURISTICO') || '').trim();
          const ownerAddress  = String(getVal('DIRECCIÓN') || getVal('Dirección') || '').trim();

          return {
            name,
            ref:       String(getVal('REF') || getVal('Ref') || getVal('ref') || '').trim(),
            address:   touristAddress || ownerAddress,
            city:      row[27] ? String(row[27]).trim() : String(getVal('POBLACIÓN') || ''),
            zip_code:  row[26] ? String(row[26]).trim() : String(getVal('CP') || '').trim(),
            provincia: row[28] ? String(row[28]).trim() : String(getVal('PROVINCIA') || ''),
            notes:     String(getVal('OBSERVACIONES') || '').trim(),
            active:    true,
          };
        })
        .filter(Boolean) as Record<string, any>[];

      if (toSync.length === 0) return;

      const { error } = await supabase
        .from('accommodations')
        .upsert(toSync, { onConflict: 'name' });

      if (error) {
        console.error('Error sincronizando alojamientos a Supabase:', error);
      } else {
        console.log(`✅ Alojamientos sincronizados a Supabase: ${toSync.length} registros`);
      }
    } catch (error) {
      console.error('Error en syncAccommodationsFromSheets:', error);
    }
  },

  // --- Helper para formatear el teléfono como quiere el Excel ---
  formatPhoneForExcel: (phone: string = ''): string => {
    let cleaned = phone.replace(/\s+/g, '').replace(/'/g, '');
    if (!cleaned) return '';
    if (!cleaned.startsWith('+')) cleaned = '+34' + cleaned;
    const prefix = cleaned.slice(0, 3);
    const rest = cleaned.slice(3);
    const formatted = `${prefix} ${rest.slice(0,3)} ${rest.slice(3,5)} ${rest.slice(5,7)} ${rest.slice(7,9)}`.trim();
    return `'${formatted}`;
  },

  // --- Helper para buscar el ID real del Excel por Teléfono en tiempo real ---
  getExcelIdByPhone: async (phone: string): Promise<string | null> => {
    if (!phone) return null;
    try {
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${WORKERS_SPREADSHEET_ID}/values/${encodeURIComponent(WORKERS_RANGE)}?key=${GOOGLE_API_KEY}`;
      const response = await fetchWithRetry(url);
      if (!response.ok) return null;
      const data = await response.json();
      if (!data.values || data.values.length === 0) return null;
      
      const headers = data.values[0] || [];
      const movilIdx = headers.findIndex((h: string) => String(h).toUpperCase().includes('MOVIL'));
      if (movilIdx === -1) return null;
      
      const searchPhone = phone.replace(/\s+/g, '').replace(/'/g, '');
      
      for (let i = 1; i < data.values.length; i++) {
        const cellPhone = String(data.values[i][movilIdx] || '').replace(/\s+/g, '').replace(/'/g, '');
        if (cellPhone === searchPhone) {
           return `real_worker_${i + 1}`; // i=1 es la fila 2 del excel
        }
      }
      return null;
    } catch (e) {
      console.error('Error buscando ID en Excel:', e);
      return null;
    }
  },

  updateWorker: async (workerData: Worker): Promise<Worker> => {
    try {
      // 1. IMPORTANTE: Buscar en el Excel usando el teléfono ORIGINAL (por si lo acaba de cambiar)
      const originalWorker = currentWorkers.find(w => w.id === workerData.id);
      const searchPhone = originalWorker?.telefono || workerData.telefono;
      
      let targetExcelId = await appsScriptApi.getExcelIdByPhone(searchPhone || '');
      
      const excelPhone = appsScriptApi.formatPhoneForExcel(workerData.telefono);
      
      // 2. Escritura en Excel
      const payload = {
        ...workerData,
        id: targetExcelId || '', // Si es un update, debería tener targetExcelId
        OPERARIO: workerData.fullName,
        MOVIL: excelPhone,
        telefono: excelPhone,
        Telefono: excelPhone,
        action: 'update'
      };
      
      fetch(WORKERS_APPS_SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify(payload)
      });

      // 3. Escritura en Supabase
      const { error } = await supabase
        .from('workers')
        .update({
          full_name: workerData.fullName,
          phone: workerData.telefono,
          email: workerData.email,
          payment_method: workerData.tipoPago,
          pay_per_reservation: workerData.pagoPorReserva,
          price_per_km: workerData.precioPorKm,
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
      // 1. OBLIGATORIO: Revisar el Excel en tiempo real para evitar duplicados absolutos
      const existingExcelId = await appsScriptApi.getExcelIdByPhone(workerData.telefono || '');
      
      if (existingExcelId) {
        console.warn('El trabajador ya existe en el Excel con este teléfono. Transformando en UPDATE...');
        // Buscar el UUID correspondiente en BD para poder hacer el update
        const existingBD = currentWorkers.find(w => w.telefono === workerData.telefono);
        if (existingBD) {
           return appsScriptApi.updateWorker({ ...workerData, id: existingBD.id, excelId: existingExcelId } as Worker);
        }
      }

      const excelPhone = appsScriptApi.formatPhoneForExcel(workerData.telefono);

      // 2. Escritura en Excel (Como no existe, enviamos string vacío para que el Script haga AppendRow)
      const payload = {
        ...workerData,
        id: '', 
        OPERARIO: workerData.fullName,
        MOVIL: excelPhone,
        telefono: excelPhone,
        Telefono: excelPhone,
        action: 'add'
      };

      fetch(WORKERS_APPS_SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify(payload)
      });

      // 3. Escritura en Supabase
      const { data, error } = await supabase
        .from('workers')
        .insert([{
          full_name: workerData.fullName,
          phone: workerData.telefono,
          email: workerData.email,
          payment_method: workerData.tipoPago,
          pay_per_reservation: workerData.pagoPorReserva,
          price_per_km: workerData.precioPorKm,
          notes: workerData.notes,
          pending_balance: workerData.owedMoney,
          retained_cash: workerData.efectivoRetenido,
          bizum_phone: workerData.telefonoBizum,
          worker_type: workerData.tipoTrabajador,
          photo_url: workerData.photo,
          iban: workerData.iban,
          dni: workerData.dni
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
      const workerToDelete = currentWorkers.find(w => w.id === id);
      
      // Encontrar la fila exacta en Excel usando el teléfono ANTES de borrarlo
      const targetExcelId = await appsScriptApi.getExcelIdByPhone(workerToDelete?.telefono || '');
      
      // Enviar delete al Apps Script usando el ID de fila
      fetch(WORKERS_APPS_SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ 
          id: targetExcelId, 
          action: 'delete' 
        })
      });

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
      // Restaurar en Excel
      const payload = {
        ...worker,
        OPERARIO: worker.fullName,
        MOVIL: `'${worker.telefono}`,
        action: 'restore',
      };
      fetch(WORKERS_APPS_SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify(payload),
      });

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
    await delay(500);
    return [...MOCK_CHECKINS]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);
  },

  getRecentIncidencias: async (limit = 50): Promise<Incidencia[]> => {
    try {
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${INCIDENCIAS_SPREADSHEET_ID}/values/${encodeURIComponent(INCIDENCIAS_RANGE)}?key=${GOOGLE_API_KEY}`;
      const response = await fetchWithRetry(url);
      
      if (!response.ok) {
        throw new Error(`Error en la API de Google Sheets (Incidencias): ${response.statusText}`);
      }
  
      const data = await response.json();
      if (!data.values || data.values.length === 0) {
        return MOCK_INCIDENCIAS;
      }
  
      const allValues = data.values as any[][];
      const headers = allValues[0] as string[];
      const rows = allValues.slice(1);
  
      const incidencias: Incidencia[] = rows
        .map((row: any[], index: number): Incidencia => {
          const getVal = (headerName: string) => {
            const idx = headers.findIndex((h: string) => h && h.trim().toUpperCase() === headerName.trim().toUpperCase());
            return idx !== -1 ? row[idx] : undefined;
          };
  
          const nombre = String(getVal('NOMBRE') || '').trim();
          const apellidos = String(getVal('APELLIDOS') || '').trim();
          const fechaExcel = String(getVal('FECHA') || '').trim();
          
          // Formatear fecha para que sea válida para JS (Sheets suele venir en DD/MM/YYYY)
          let timestamp = new Date().toISOString();
          if (fechaExcel) {
            try {
              if (fechaExcel.includes('/')) {
                const parts = fechaExcel.split(',')[0].split('/');
                const timePart = fechaExcel.includes(',') ? fechaExcel.split(',')[1].trim() : '00:00:00';
                // DD/MM/YYYY -> YYYY-MM-DD
                timestamp = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}T${timePart}`;
              } else {
                timestamp = new Date(fechaExcel).toISOString();
              }
            } catch (e) {
              console.warn('Error parseando fecha de incidencia:', fechaExcel);
            }
          }
  
          return {
            id: `real_inc_${index + 2}`,
            userName: `${nombre} ${apellidos}`.replace(/\s+/g, ' ').trim() || 'Desconocido',
            description: String(getVal('DETALLES INCIDENCIA') || '').trim(),
            timestamp,
            accommodationId: `real_acc_${index}`, // ID ficticio basado en fila
            accommodationName: String(getVal('APARTAMENTO') || 'Sin especificar').trim(),
            coste: 0,
            pagadoPor: 'empresa',
            kms: parseExcelNumber(getVal('KMS TOTAL')),
            checked: String(getVal('CHECKED')).toUpperCase() === 'TRUE'
          };
        })
        .filter(inc => inc.description && inc.description.trim() !== '') // Solo las que tienen descripción
        .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
        .slice(0, limit);
  
      return incidencias;
    } catch (error) {
      console.error('Error fetching incidencias from Sheets:', error);
      return MOCK_INCIDENCIAS;
    }
  },

  getSuggestions: async (limit = 40): Promise<Suggestion[]> => {
    try {
      const url = `${SUGERENCIAS_APPS_SCRIPT_URL}?action=listSuggestions&limit=${limit}`;
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error('Error al obtener sugerencias');
      }

      const data = await response.json();
      if (data.ok) return data.suggestions;
      return [];
    } catch (error) {
      console.error('[API Sugerencias] Error:', error);
      return [];
    }
  },

  markSuggestionAsRead: async (id: string): Promise<boolean> => {
    try {
      const url = `${SUGERENCIAS_APPS_SCRIPT_URL}?action=markAsRead&id=${id}`;
      const response = await fetch(url);
      const data = await response.json();
      return data.ok;
    } catch (error) {
      console.error('Error marking as read:', error);
      return false;
    }
  },

  markSuggestionAsUnread: async (id: string): Promise<boolean> => {
    try {
      const url = `${SUGERENCIAS_APPS_SCRIPT_URL}?action=markAsUnread&id=${id}`;
      const response = await fetch(url);
      const data = await response.json();
      return data.ok;
    } catch (error) {
      console.error('Error marking as unread:', error);
      return false;
    }
  },

  starSuggestion: async (id: string): Promise<boolean> => {
    try {
      const url = `${SUGERENCIAS_APPS_SCRIPT_URL}?action=star&id=${id}`;
      const response = await fetch(url);
      const data = await response.json();
      return data.ok;
    } catch (error) {
      console.error('Error starring suggestion:', error);
      return false;
    }
  },

  unstarSuggestion: async (id: string): Promise<boolean> => {
    try {
      const url = `${SUGERENCIAS_APPS_SCRIPT_URL}?action=unstar&id=${id}`;
      const response = await fetch(url);
      const data = await response.json();
      return data.ok;
    } catch (error) {
      console.error('Error unstarring suggestion:', error);
      return false;
    }
  },

  deleteSuggestion: async (id: string): Promise<boolean> => {
    try {
      const url = `${SUGERENCIAS_APPS_SCRIPT_URL}?action=delete&id=${id}`;
      const response = await fetch(url);
      const data = await response.json();
      return data.ok;
    } catch (error) {
      console.error('Error deleting suggestion:', error);
      return false;
    }
  },

  replySuggestion: async (id: string, body: string): Promise<boolean> => {
    try {
      await fetch(SUGERENCIAS_APPS_SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ action: 'reply', id, body })
      });
      return true;
    } catch (error) {
      console.error('Error replying to suggestion:', error);
      return false;
    }
  },

  updateIncidencia: async (incidencia: Incidencia): Promise<boolean> => {
    try {
      await fetch(INCIDENCIAS_APPS_SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: {
          'Content-Type': 'text/plain',
        },
        body: JSON.stringify({ ...incidencia, action: 'update' })
      });

      return true;
    } catch (error) {
      console.error('Error updating incidencia:', error);
      throw error;
    }
  },

  deleteIncidencia: async (id: string): Promise<boolean> => {
    try {
      await fetch(INCIDENCIAS_APPS_SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: {
          'Content-Type': 'text/plain',
        },
        body: JSON.stringify({ id, action: 'delete' })
      });

      return true;
    } catch (error) {
      console.error('Error deleting incidencia:', error);
      throw error;
    }
  },

  getEntregaLlaves: async (): Promise<EntregaLlaves[]> => {
    try {
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${INCIDENCIAS_SPREADSHEET_ID}/values/${encodeURIComponent(ENTREGA_LLAVES_RANGE)}?key=${GOOGLE_API_KEY}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Error fetching Entrega de Llaves: ${response.statusText}`);

      const data = await response.json();
      if (!data.values || data.values.length === 0) return [];

      const headers = data.values[0] as string[];
      const rows = data.values.slice(1);

      return rows.map((row: any[], index: number) => {
        const getVal = (headerName: string) => {
          const idx = headers.findIndex(h => h && h.trim().toUpperCase() === headerName.toUpperCase());
          return idx !== -1 ? row[idx] : undefined;
        };

        const rawTel = String(getVal('TELEFONO') || '').replace(/\D/g, '');
        const cleanTel = (rawTel.startsWith('34') && rawTel.length >= 11) ? rawTel.slice(-9) : rawTel;

        const parsePaymentMethod = (val: any) => {
          const s = String(val || '').trim().toLowerCase();
          if (s.includes('bizum')) return 'Bizum';
          if (s.includes('tarjeta')) return 'Tarjeta';
          return 'Efectivo';
        };

        return {
          id: `real_key_${index + 2}`,
          telefono: cleanTel,
          nombre: String(getVal('NOMBRE') || ''),
          apellidos: String(getVal('APELLIDOS') || ''),
          fechaUbicacionEntrega: String(getVal('FECHA Y UBICACION DE LLAVES ENTREGADAS') || ''),
          apartamento: String(getVal('APARTAMENTO') || ''),
          nombreCliente: String(getVal('NOMBRE CLIENTE') || ''),
          fechaEntradaReserva: parseDateTime(getVal('FECHA ENTRADA RESERVA')),
          fechaSalidaReserva: parseDateTime(getVal('FECHA SALIDA RE') || getVal('FECHA SALIDA RESERVA')),
          entregaLlaves: String(getVal('ENTREGA LLAVES')).toUpperCase() === 'SÍ',
          sabanasToallas: String(getVal('SÁBANAS Y TOALLAS') || ''),
          km: parseExcelNumber(getVal('KM')),
          observaciones: String(getVal('OBSERVACIONES') || ''),
          fianzaMonto: parsePaymentMethod(getVal('FIANZA (MONTO)')),
          bizumMonto: String(getVal('NUMERO BIZUM (MONTO)') || ''),
          cantidadPagadaMonto: String(parseExcelNumber(getVal('CANTIDAD PAGADA (MONTO)'))),
          fianzaGarantia: parsePaymentMethod(getVal('FIANZA (GARANTIA)')),
          bizumGarantia: String(getVal('NUMERO BIZUM (GARANTIA)') || ''),
          cantidadPagadaGarantia: String(parseExcelNumber(getVal('CANTIDAD PAGADA (GARANTIA)'))),
          checked: String(getVal('CHECKED')).toUpperCase() === 'TRUE'
        };
      });
    } catch (error) {
      console.error('Error in getEntregaLlaves:', error);
      return [];
    }
  },

  addEntregaLlaves: async (data: Omit<EntregaLlaves, 'id'>): Promise<boolean> => {
    try {
      await fetch(ENTREGA_LLAVES_APPS_SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ ...data, action: 'add' })
      });
      return true;
    } catch (error) {
      console.error('Error adding Entrega de Llaves:', error);
      throw error;
    }
  },

  updateEntregaLlaves: async (data: EntregaLlaves): Promise<boolean> => {
    try {
      await fetch(ENTREGA_LLAVES_APPS_SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ ...data, action: 'update' })
      });
      return true;
    } catch (error) {
      console.error('Error updating Entrega de Llaves:', error);
      throw error;
    }
  },

  deleteEntregaLlaves: async (id: string): Promise<boolean> => {
    try {
      await fetch(ENTREGA_LLAVES_APPS_SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ id, action: 'delete' })
      });
      return true;
    } catch (error) {
      console.error('Error deleting Entrega de Llaves:', error);
      throw error;
    }
  },

  getAnalytics: async () => {
    await delay(500);
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
      // 1. Intentar Supabase primero
      const { data: dbAccs, error } = await supabase
        .from('accommodations')
        .select('*')
        .order('name', { ascending: true });

      if (!error && dbAccs) {
        if (dbAccs.length > 0) {
          const accommodations = dbAccs.map(mapDbRow);
          saveAccommodations(accommodations);
          return accommodations;
        }
        // 2. Supabase vacío: sincronizar desde Sheets y volver a leer
        await appsScriptApi.syncAccommodationsFromSheets();
        const { data: synced } = await supabase
          .from('accommodations')
          .select('*')
          .order('name', { ascending: true });
        if (synced && synced.length > 0) {
          const accommodations = synced.map(mapDbRow);
          saveAccommodations(accommodations);
          return accommodations;
        }
      }
    } catch (err) {
      console.warn('Supabase no disponible, usando caché local:', err);
    }

    // 3. Fallback directo a Sheets (comportamiento original)
    try {
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(ACCOMMODATIONS_RANGE)}?key=${GOOGLE_API_KEY}`;
      const response = await fetchWithRetry(url);
      if (!response.ok) return currentAccommodations;

      const data = await response.json();
      if (!data.values || data.values.length === 0) return currentAccommodations;

      const headers = data.values[0] as string[];
      const rows    = data.values.slice(1) as any[][];

      const accommodations: Accommodation[] = rows
        .map((row: any[], index: number): Accommodation => {
          const getVal = (h: string) => {
            const norm = normalizeHeader(h);
            const idx  = headers.findIndex((hh: string) => hh && normalizeHeader(hh) === norm);
            return idx !== -1 ? row[idx] : undefined;
          };
          const touristAddress = String(getVal('DIRECCIÓN ALOJAMIENTO TURÍSTICO') || getVal('DIRECCION ALOJAMIENTO TURISTICO') || '').trim();
          return {
            id:       `real_${index + 2}`,
            name:     String(getVal('PROPIEDAD') || getVal('NOMBRE') || getVal('Apartamento') || 'Sin nombre').trim(),
            ref:      String(getVal('REF') || getVal('Ref') || getVal('ref') || '').trim(),
            address:  touristAddress || String(getVal('DIRECCIÓN') || getVal('Dirección') || '').trim(),
            city:     row[27] ? String(row[27]).trim() : String(getVal('POBLACIÓN') || ''),
            zipCode:  row[26] ? String(row[26]).trim() : String(getVal('CP') || '').trim(),
            provincia: row[28] ? String(row[28]).trim() : String(getVal('PROVINCIA') || ''),
            notes:    String(getVal('OBSERVACIONES') || '').trim(),
            active:   true,
          };
        })
        .filter((acc) => acc.name && acc.name.trim() !== '' && acc.name !== 'Sin nombre');

      saveAccommodations(accommodations);
      return accommodations;
    } catch (error) {
      console.error('Error fetching accommodations from Sheets:', error);
      return currentAccommodations;
    }
  },

  updateAccommodation: async (accommodationData: Accommodation): Promise<Accommodation> => {
    try {
      const { error } = await supabase
        .from('accommodations')
        .update({
          name:      accommodationData.name,
          ref:       accommodationData.ref       || '',
          address:   accommodationData.address   || '',
          city:      accommodationData.city      || '',
          zip_code:  accommodationData.zipCode   || '',
          provincia: accommodationData.provincia || '',
          notes:     accommodationData.notes     || '',
          active:    accommodationData.active    ?? true,
          image_url: accommodationData.image     || null,
        })
        .eq('id', accommodationData.id);

      if (error) throw error;
    } catch (error) {
      console.error('Error updating accommodation in Supabase:', error);
    }

    // Fire & forget al Apps Script para mantener el Sheets sincronizado
    fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ ...accommodationData, action: 'update' }),
    });

    const updated = currentAccommodations.map(a =>
      a.id === accommodationData.id ? { ...accommodationData } : a
    );
    saveAccommodations(updated);
    return accommodationData;
  },

  addAccommodation: async (accommodationData: Omit<Accommodation, 'id'>): Promise<Accommodation> => {
    try {
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

      fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ ...accommodationData, action: 'add' }),
      });

      const newAccommodation: Accommodation = {
        ...accommodationData,
        id: data.id,
      };
      currentAccommodations = [newAccommodation, ...currentAccommodations];
      saveAccommodations(currentAccommodations);
      return newAccommodation;
    } catch (error) {
      console.error('Error adding accommodation to Supabase:', error);
      // Fallback local si falla Supabase
      const newAccommodation: Accommodation = {
        ...accommodationData,
        id: `real_new_${Date.now()}`,
      };
      currentAccommodations = [newAccommodation, ...currentAccommodations];
      saveAccommodations(currentAccommodations);
      return newAccommodation;
    }
  },

  deleteAccommodation: async (id: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('accommodations')
        .delete()
        .eq('id', id);

      if (error) console.warn('Supabase delete accommodation warning:', error);
    } catch (error) {
      console.error('Error deleting accommodation from Supabase:', error);
    }

    // Fire & forget al Apps Script (best effort)
    fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ id, action: 'delete' }),
    });

    const updated = currentAccommodations.filter(a => a.id !== id);
    saveAccommodations(updated);
    return true;
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
    } catch (error) {
      console.error('Error restoring accommodation in Supabase:', error);
    }

    fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ ...accommodation, action: 'restore' }),
    });

    const updated = [accommodation, ...currentAccommodations.filter(a => a.id !== accommodation.id)];
    saveAccommodations(updated);
  },

  getNormalCleansResult: async (): Promise<CleansFetchResult<NormalCleanRecord>> => {
    try {
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${CLEANS_SPREADSHEET_ID}/values/Checkout_Limpieza_Normal!A:P?key=${GOOGLE_API_KEY}`;
      const response = await fetchWithRetry(url);

      if (!response.ok) {
        throw new Error(`Error fetching normal cleans: ${response.statusText}`);
      }

      const data = await response.json();
      if (!data.values || data.values.length <= 1) {
        return { records: [], status: 'empty' };
      }

      const headers = data.values[0] as string[];
      const rows = data.values.slice(1);

      const records: NormalCleanRecord[] = rows
        .map((row: any[], index: number): NormalCleanRecord | null => {
          const getVal = (headerName: string) => {
            const norm = normalizeHeader(headerName);
            const idx = headers.findIndex((h: string) => normalizeHeader(h) === norm);
            return idx !== -1 ? row[idx] : undefined;
          };

          const nombre = String(getVal('Nombre') || '');
          const apellidos = String(getVal('Apellidos') || '');
          if (!nombre && !apellidos) return null;

          return {
            id: `nc_${index + 2}`,
            telefono: String(getVal('Telefono') || ''),
            nombre,
            apellidos,
            checkinFecha: parseDateTime(getVal('Checkin Fecha Trabajador')),
            checkinUbicacion: String(getVal('Checkin Ubicacion Trabajador') || ''),
            checkoutFecha: parseDateTime(getVal('Checkout Fecha Trabajador')),
            checkoutUbicacion: String(getVal('Checkout Ubicacion Trabajador') || ''),
            apartamento: String(getVal('Apartamento') || ''),
            horaEntrada: String(getVal('Hora Limpieza Entrada') || ''),
            horaSalida: String(getVal('Hora Limpieza Salida') || ''),
            sigueHuesped: parseBool(getVal('Sigue Huesped')),
            // Mantener como texto: en el sheet puede venir como "DD/MM/YYYY HH:mm" o "HH:mm, DD/MM/YYYY"
            // y no queremos perderlo por parseos.
            fechaSalidaReserva: String(
              getVal('Fecha Salida Reserva') ||
              getVal('FECHA SALIDA RESERVA') ||
              getVal('FECHA SALIDA RE') ||
              ''
            ).trim(),
            recogeLlaves: parseBool(getVal('Recoge Llaves')),
            km: parseExcelNumber(getVal('Km')),
            observaciones: String(getVal('Observaciones') || ''),
            checked: parseBool(getVal('Checked')),
          };
        })
        .filter((r: NormalCleanRecord | null): r is NormalCleanRecord => r !== null);

      return { records, status: records.length ? 'ok' : 'empty' };
    } catch (error) {
      console.error('Error fetching normal cleans from Sheets:', error);
      return { records: [], status: 'error', error: String((error as any)?.message || error) };
    }
  },

  getNormalCleans: async (): Promise<NormalCleanRecord[]> => {
    const res = await appsScriptApi.getNormalCleansResult();
    return res.records;
  },

  updateCleanStatus: async (type: CleanSheetType, id: string, checked: boolean): Promise<boolean> => {
    try {
      const rowIndex = parseRowIndexFromId(id);
      const sheetName = getCleanSheetName(type);

      const payload = {
        action: 'updateCleanStatus',
        sheetName,
        rowIndex,
        checked
      };

      const res = await postToCleansScript(payload);
      if (!res.ok) {
        console.error('Apps Script updateCleanStatus failed:', res);
        return false;
      }
      return true;
    } catch (error) {
      console.error('Error updating clean status:', error);
      return false;
    }
  },

  createCheckoutRecord: async (type: CleanSheetType, record: NormalCleanRecord | InitialCleanRecord | HandymanRecord): Promise<boolean> => {
    try {
      const payload = {
        action: 'createCheckout',
        sheetName: getCleanSheetName(type),
        record: cleanRecordToPayload(type, record)
      };
      
      const res = await postToCleansScript(payload);
      if (!res.ok) {
        console.error('Apps Script createCheckout failed:', res);
        return false;
      }
      return true;
    } catch (error) {
      console.error('❌ Error creating checkout record:', error);
      return false;
    }
  },

  updateCheckoutRecord: async (type: CleanSheetType, id: string, record: NormalCleanRecord | InitialCleanRecord | HandymanRecord): Promise<boolean> => {
    try {
      const rowIndex = parseRowIndexFromId(id);
      if (rowIndex === -1) return false;

      const payload = {
        action: 'updateCheckout',
        sheetName: getCleanSheetName(type),
        rowIndex,
        record: cleanRecordToPayload(type, record)
      };
      
      const res = await postToCleansScript(payload);
      if (!res.ok) {
        console.error('Apps Script updateCheckout failed:', res);
        return false;
      }
      return true;
    } catch (error) {
      console.error('❌ Error updating checkout record:', error);
      return false;
    }
  },

  deleteCheckoutRecord: async (type: CleanSheetType, id: string): Promise<boolean> => {
    try {
      const rowIndex = parseRowIndexFromId(id);
      if (rowIndex === -1) return false;

      const payload = {
        action: 'deleteCheckout',
        sheetName: getCleanSheetName(type),
        rowIndex
      };
      
      const res = await postToCleansScript(payload);
      if (!res.ok) {
        console.error('Apps Script deleteCheckout failed:', res);
        return false;
      }
      return true;
    } catch (error) {
      console.error('❌ Error deleting checkout record:', error);
      return false;
    }
  },

  getInitialCleansResult: async (): Promise<CleansFetchResult<InitialCleanRecord>> => {
    try {
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${CLEANS_SPREADSHEET_ID}/values/Checkout_Limpieza_Inicial!A:M?key=${GOOGLE_API_KEY}`;
      const response = await fetchWithRetry(url);

      if (!response.ok) {
        throw new Error(`Error fetching initial cleans: ${response.statusText}`);
      }

      const data = await response.json();
      if (!data.values || data.values.length <= 1) {
        return { records: [], status: 'empty' };
      }

      const headers = data.values[0] as string[];
      const rows = data.values.slice(1);

      const records: InitialCleanRecord[] = rows
        .map((row: any[], index: number): InitialCleanRecord | null => {
          const getVal = (headerName: string) => {
            const norm = normalizeHeader(headerName);
            const idx = headers.findIndex((h: string) => normalizeHeader(h) === norm);
            return idx !== -1 ? row[idx] : undefined;
          };

          const nombre = String(getVal('Nombre') || '');
          const apellidos = String(getVal('Apellidos') || '');
          if (!nombre && !apellidos) return null;

          const parseBool = (val: any): boolean => {
            if (val === true || val === 'TRUE' || val === 'true' || val === '1' || val === 'Sí' || val === 'SI' || val === 'si') return true;
            return false;
          };

          return {
            id: `ic_${index + 2}`,
            telefono: String(getVal('Telefono') || ''),
            nombre,
            apellidos,
            checkinFecha: parseDateTime(getVal('Checkin Fecha Trabajador')),
            checkinUbicacion: String(getVal('Checkin Ubicacion Trabajador') || ''),
            checkoutFecha: parseDateTime(getVal('Checkout Fecha Trabajador')),
            checkoutUbicacion: String(getVal('Checkout Ubicacion Trabajador') || ''),
            apartamento: String(getVal('Apartamento') || ''),
            horaEntrada: String(getVal('Hora Limpieza Entrada') || ''),
            horaSalida: String(getVal('Hora Limpieza Salida') || ''),
            km: parseExcelNumber(getVal('Km')),
            observaciones: String(getVal('Observaciones') || ''),
            checked: parseBool(getVal('Checked')),
          };
        })
        .filter((r: InitialCleanRecord | null): r is InitialCleanRecord => r !== null);

      return { records, status: records.length ? 'ok' : 'empty' };
    } catch (error) {
      console.error('Error fetching initial cleans from Sheets:', error);
      return { records: [], status: 'error', error: String((error as any)?.message || error) };
    }
  },

  getInitialCleans: async (): Promise<InitialCleanRecord[]> => {
    const res = await appsScriptApi.getInitialCleansResult();
    return res.records;
  },

  getHandymanRecordsResult: async (): Promise<CleansFetchResult<HandymanRecord>> => {
    try {
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${CLEANS_SPREADSHEET_ID}/values/Checkout_Manitas!A:M?key=${GOOGLE_API_KEY}`;
      const response = await fetchWithRetry(url);

      if (!response.ok) {
        throw new Error(`Error fetching handyman records: ${response.statusText}`);
      }

      const data = await response.json();
      if (!data.values || data.values.length <= 1) {
        return { records: [], status: 'empty' };
      }

      const headers = data.values[0] as string[];
      const rows = data.values.slice(1);

      const records: HandymanRecord[] = rows
        .map((row: any[], index: number): HandymanRecord | null => {
          const getVal = (headerName: string) => {
            const norm = normalizeHeader(headerName);
            const idx = headers.findIndex((h: string) => normalizeHeader(h) === norm);
            return idx !== -1 ? row[idx] : undefined;
          };

          const nombre = String(getVal('Nombre') || '');
          const apellidos = String(getVal('Apellidos') || '');
          if (!nombre && !apellidos) return null;

          const parseBool = (val: any): boolean => {
            if (val === true || val === 'TRUE' || val === 'true' || val === '1' || val === 'Sí' || val === 'SI' || val === 'si') return true;
            return false;
          };

          return {
            id: `hm_${index + 2}`,
            telefono: String(getVal('Telefono') || ''),
            nombre,
            apellidos,
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
        })
        .filter((r: HandymanRecord | null): r is HandymanRecord => r !== null);

      return { records, status: records.length ? 'ok' : 'empty' };
    } catch (error) {
      console.error('Error fetching handyman records from Sheets:', error);
      return { records: [], status: 'error', error: String((error as any)?.message || error) };
    }
  },

  getHandymanRecords: async (): Promise<HandymanRecord[]> => {
    const res = await appsScriptApi.getHandymanRecordsResult();
    return res.records;
  },

  getNormalCheckins: async (): Promise<NormalCleanRecord[]> => {
    try {
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${CLEANS_SPREADSHEET_ID}/values/Checkin_Limpieza_Normal!A:P?key=${GOOGLE_API_KEY}`;
      const response = await fetchWithRetry(url);
      if (!response.ok) throw new Error(`Error fetching normal checkins: ${response.statusText}`);
      const data = await response.json();
      if (!data.values || data.values.length <= 1) return [];
      const headers = data.values[0] as string[];
      const rows = data.values.slice(1);

      return Promise.all(rows.map(async (row: any[], index: number): Promise<NormalCleanRecord> => {
        const getVal = (headerName: string) => {
          const norm = normalizeHeader(headerName);
          const idx = headers.findIndex((h: string) => normalizeHeader(h) === norm);
          return idx !== -1 ? row[idx] : undefined;
        };

        const apartamento = String(getVal('Apartamento') || '');
        const coords = String(getVal('Checkin Ubicacion Trabajador') || '');
        const realStreet = (!apartamento && coords) ? await reverseGeocode(coords) : null;

        return {
          id: `check_norm_${index + 2}`,
          telefono: String(getVal('Telefono') || ''),
          nombre: String(getVal('Nombre') || ''),
          apellidos: String(getVal('Apellidos') || ''),
          checkinFecha: parseDateTime(getVal('Checkin Fecha Trabajador'), getVal('Hora Reserva Entrada')),
          checkinUbicacion: coords,
          apartamento: apartamento || realStreet || 'Ubicación Desconocida',
          horaEntrada: String(getVal('Hora Reserva Entrada') || ''),
          checked: false
        } as NormalCleanRecord;
      }));
    } catch (error) {
      console.error('Error getNormalCheckins:', error);
      return [];
    }
  },

  getInitialCheckins: async (): Promise<InitialCleanRecord[]> => {
    try {
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${CLEANS_SPREADSHEET_ID}/values/Checkin_Limpieza_Inicial!A:P?key=${GOOGLE_API_KEY}`;
      const response = await fetchWithRetry(url);
      if (!response.ok) throw new Error(`Error fetching initial checkins: ${response.statusText}`);
      const data = await response.json();
      if (!data.values || data.values.length <= 1) return [];
      const headers = data.values[0] as string[];
      const rows = data.values.slice(1);

      return Promise.all(rows.map(async (row: any[], index: number): Promise<InitialCleanRecord> => {
        const getVal = (headerName: string) => {
          const norm = normalizeHeader(headerName);
          const idx = headers.findIndex((h: string) => normalizeHeader(h) === norm);
          return idx !== -1 ? row[idx] : undefined;
        };

        const apartamento = String(getVal('Apartamento') || '');
        const coords = String(getVal('Checkin Ubicacion Trabajador') || '');
        const realStreet = (!apartamento && coords) ? await reverseGeocode(coords) : null;

        return {
          id: `check_init_${index + 2}`,
          telefono: String(getVal('Telefono') || ''),
          nombre: String(getVal('Nombre') || ''),
          apellidos: String(getVal('Apellidos') || ''),
          checkinFecha: parseDateTime(getVal('Checkin Fecha Trabajador'), getVal('Hora Reserva Entrada')),
          checkinUbicacion: coords,
          apartamento: apartamento || realStreet || 'Ubicación Desconocida',
          horaEntrada: String(getVal('Hora Reserva Entrada') || ''),
          checked: false
        } as InitialCleanRecord;
      }));
    } catch (error) {
      console.error('Error getInitialCheckins:', error);
      return [];
    }
  },

  getHandymanCheckins: async (): Promise<HandymanRecord[]> => {
    try {
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${CLEANS_SPREADSHEET_ID}/values/Checkin_Manitas!A:M?key=${GOOGLE_API_KEY}`;
      const response = await fetchWithRetry(url);
      if (!response.ok) throw new Error(`Error fetching handyman checkins: ${response.statusText}`);
      const data = await response.json();
      if (!data.values || data.values.length <= 1) return [];
      const headers = data.values[0] as string[];
      const rows = data.values.slice(1);

      return Promise.all(rows.map(async (row: any[], index: number): Promise<HandymanRecord> => {
        const getVal = (headerName: string) => {
          const norm = normalizeHeader(headerName);
          const idx = headers.findIndex((h: string) => normalizeHeader(h) === norm);
          return idx !== -1 ? row[idx] : undefined;
        };

        const apartamento = String(getVal('Apartamento') || '');
        const coords = String(getVal('Checkin Ubicacion Trabajador') || '');
        const realStreet = (!apartamento && coords) ? await reverseGeocode(coords) : null;

        return {
          id: `check_hm_${index + 2}`,
          telefono: String(getVal('Telefono') || ''),
          nombre: String(getVal('Nombre') || ''),
          apellidos: String(getVal('Apellidos') || ''),
          fechaLlegada: parseDateTime(getVal('Checkin Fecha Trabajador'), getVal('Hora Reparacion Entrada')),
          ubicacionInicio: coords,
          alojamiento: apartamento || realStreet || 'Ubicación Desconocida',
          horaInicioTarea: String(getVal('Hora Reparacion Entrada') || ''),
          estadoCompletado: 'Trabajando...',
        } as HandymanRecord;
      }));
    } catch (error) {
      console.error('Error getHandymanCheckins:', error);
      return [];
    }
  },

  getPagos: async (desde: string, hasta: string): Promise<PagoRecord[]> => {
    await delay(400);
    return currentPagos.filter(p => p.fecha >= desde && p.fecha <= hasta)
      .sort((a, b) => b.fecha.localeCompare(a.fecha));
  },

  getAllPagos: async (): Promise<PagoRecord[]> => {
    await delay(500);
    return [...currentPagos].sort((a, b) => b.fecha.localeCompare(a.fecha));
  },

  getWorkerPagos: async (workerId: string): Promise<PagoRecord[]> => {
    await delay(300);
    return currentPagos.filter(p => p.workerId === workerId)
      .sort((a, b) => b.fecha.localeCompare(a.fecha));
  },

  markPagosAsPaid: async (pagoIds: string[]): Promise<PaymentAction> => {
    await delay(400);
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
    await delay(400);
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
    await delay(100);
    return getUndoStack().filter(a => a.workerId === workerId);
  },

  createPago: async (pago: Omit<PagoRecord, 'id'>): Promise<PagoRecord> => {
    await delay(400);
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

