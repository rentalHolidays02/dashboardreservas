import {
  MOCK_USERS,
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
  Suggestion
} from './mockData';
import { computeWorkerEarnings, matchesWorkerByPhone } from '../utils/payments';

// Google Sheets API Configuration
const GOOGLE_API_KEY = 'AIzaSyAU6iF2xDuxgrGv6q6Z8wQg0MkZVbFXc5M';
const SPREADSHEET_ID = '1Z1qYQ2ykQG2Kq1hO9K2PdjES_OvOR2d1yKPv7MdyAa4'; // Alojamientos
const WORKERS_SPREADSHEET_ID = '1ntCYcUaUvsMWD7bOCaVmEzBqnHqf09MFd6SEjwv1OWM'; // Pagos Generales (Operarios)
const CLEANS_SPREADSHEET_ID = '1xSeU9XyvZIWuifWNXgR99l6qftpsRT4hg55tsZn7IE4'; // INFORMES_OPERARIOS
const ACCOMMODATIONS_RANGE = "'ALOJAMIENTOS ACTIVOS'!A:AJ"; // Extendido para incluir CP, POBLACIÓN y PROVINCIA del apartamento
const WORKERS_RANGE = "'informacion operarios'!A:Z";
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzMYYFUlgbqqfbVIGSKLO7LCDyg7aZpsIXamrq8F7eNcRqdtK9A1R8lVTI6OD0deeWr/exec';
const CLEANS_APPS_SCRIPT_URL =
  import.meta.env.VITE_CLEANS_APPS_SCRIPT_URL ||
  'https://script.google.com/macros/s/AKfycbzm72ot1nECxcBf406o--XzL2jty55cxNRrG1Nbd64YAmYU4wl7kwi842jjlybE4ErVgw/exec';
const WORKERS_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwhZWguaA9HkDCRKIeS5eAxoMR-u6hKA7FoJ2yn_mfBTA3IyCH1Xoey93SGh10CTc5uDA/exec';
const INCIDENCIAS_SPREADSHEET_ID = '1xSeU9XyvZIWuifWNXgR99l6qftpsRT4hg55tsZn7IE4';
const INCIDENCIAS_RANGE = "'Informe_Incidencia'!A:Z";
const INCIDENCIAS_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxX8IQ6wsfmnJt77UWCpR3Zt0ND0RDFXafIEgrzZtBC5QzMSeLLYipcYx3l6qRWvPA9LA/exec';
const ENTREGA_LLAVES_RANGE = "'Informe_Entrega_Llaves'!A:S";
const ENTREGA_LLAVES_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwbGhmFQLhv7ndi_pdnFLGgUTYKcygm1H3H8R0kpOGX_SyxHI2G3snlaDHkawH1DUneUA/exec';
const SUGERENCIAS_APPS_SCRIPT_URL = 
  import.meta.env.VITE_SUGERENCIAS_APPS_SCRIPT_URL || 
  'https://script.google.com/macros/s/AKfycbz9MwFzH_C0yQsW5F3_KDsZ23pd9dtOMCcW6jJmN-ON9H44l0EBd3DzatWTwzpK0mS2/exec';

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

const buildWorkersSheetPayload = (workerData: Partial<Worker> & { fullName?: string; telefono?: string; telefonoBizum?: string }) => {
  const fullName = String(workerData.fullName || '').trim();
  const telefonoText = workerData.telefono ? `'${String(workerData.telefono).replace(/^'/, '')}` : '';
  const telefonoBizumText = workerData.telefonoBizum ? `'${String(workerData.telefonoBizum).replace(/^'/, '')}` : '';

  return {
    ...workerData,
    // Columnas del Excel (por compatibilidad, mandamos varias claves posibles)
    OPERARIO: fullName,
    OPERARIOS: fullName,
    MOVIL: telefonoText,
    Telefono: telefonoText,
    telefono: telefonoText,
    telefonoBizum: telefonoBizumText,
  };
};

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
    await delay(800);
    
    // 1. Intentar login con usuarios predefinidos (Admin/Viewer)
    const mockUser = MOCK_USERS.find(u => u.email === email && u.password === pass);
    if (mockUser) {
      const { password, ...userWithoutPass } = mockUser;
      // Si es trabajador, enriquecer la sesión con el teléfono real de la BBDD (ID único)
      if (userWithoutPass.role === 'trabajador') {
        try {
          const workers = await appsScriptApi.getWorkers();
          const normName = (s: string) =>
            s.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
          const worker = workers.find(w =>
            (w.email && w.email.toLowerCase() === email.toLowerCase()) ||
            normName(w.fullName).startsWith(normName(userWithoutPass.name).split(/\s+/)[0])
          );
          if (worker?.telefono) {
            return { ...userWithoutPass, telefono: worker.telefono };
          }
        } catch (_) { /* fallback sin teléfono */ }
      }
      return userWithoutPass;
    }

    // 2. Si no es admin/viewer, buscar en la BBDD de trabajadores
    try {
      // Usamos el password '1234' por defecto para todos los trabajadores en este entorno
      if (pass !== '1234') return null;

      const workers = await appsScriptApi.getWorkers();
      const worker = workers.find(w => 
        (w.email && w.email.toLowerCase() === email.toLowerCase()) || 
        (w.fullName && w.fullName.toLowerCase().replace(/\s/g, '.') + '@rh.local' === email.toLowerCase())
      );

      if (worker) {
        return {
          email: worker.email || email,
          role: 'trabajador',
          name: worker.fullName,
          telefono: worker.telefono || undefined
        };
      }
    } catch (error) {
      console.error('Error durante el login de trabajador:', error);
    }

    return null;
  },

  getWorkers: async (): Promise<Worker[]> => {
    try {
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${WORKERS_SPREADSHEET_ID}/values/${encodeURIComponent(WORKERS_RANGE)}?key=${GOOGLE_API_KEY}`;
      const response = await fetchWithRetry(url);

      if (!response.ok) {
        throw new Error(`Error en la API de Google Sheets (Operarios): ${response.statusText}`);
      }

      const data = await response.json();
      if (!data.values || data.values.length === 0) {
        return currentWorkers;
      }

      const allValues = data.values as any[][];
      const headers = allValues[0] as string[];
      const rows = allValues.slice(1);

      const baseWorkers: Worker[] = rows
        .map((row: any[], index: number): Worker => {
          const getVal = (headerName: string) => {
            const norm = normalizeHeader(headerName);
            const idx = headers.findIndex((h: string) => normalizeHeader(h) === norm);
            return idx !== -1 ? row[idx] : undefined;
          };

          const medioPago = String(getVal('MEDIO DE PAGO') || '').toLowerCase();
          const tipoPago: Worker['tipoPago'] = medioPago.includes('bizum') ? 'bizum' :
                                               medioPago.includes('tarjeta') ? 'tarjeta' :
                                               'efectivo';

          return {
            id: `real_worker_${index + 2}`,
            fullName: String(getVal('OPERARIO') || 'Sin nombre'),
            telefono: String(getVal('MOVIL') || ''),
            iban: String(getVal('CUENTA BANCARIA') || ''),
            tipoPago,
            pagoPorReserva: parseExcelNumber(getVal('PAGO POR RESERVA')),
            precioPorKm: parseExcelNumber(getVal('KILOMETRAJE')),
            notes: String(getVal('OBSERVACIONES') || ''),
            netMoneyMonth: 0,
            owedMoney: parseExcelNumber(getVal('SALDO PENDIENTE')),
            efectivoRetenido: parseExcelNumber(getVal('EFECTIVO RETENIDO')),
            cleansCountMonth: 0,
            kmsMonth: 0,
            extraHoursMonth: 0,
            accommodations: []
          };
        })
        .filter((w: Worker) => w.fullName && w.fullName.trim() !== '' && w.fullName !== 'Sin nombre');

      // Calcular valores derivados cruzando con registros de limpieza y entrega de llaves.
      // Si alguna llamada falla, se continúa con arrays vacíos para no romper la carga.
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
          // Mantenemos owedMoney y efectivoRetenido que vienen de las columnas estáticas del Excel
        };
      });

      saveWorkers(workers);
      return workers;
    } catch (error) {
      console.error('Error fetching workers from Sheets:', error);
      return currentWorkers;
    }
  },

  updateWorker: async (workerData: Worker): Promise<Worker> => {
    try {
      const payload = {
        ...buildWorkersSheetPayload(workerData),
        action: 'update'
      };
      
      fetch(WORKERS_APPS_SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: {
          'Content-Type': 'text/plain',
        },
        body: JSON.stringify(payload)
      });

      const updatedWorkers = currentWorkers.map(w => 
        w.id === workerData.id ? { ...workerData } : w
      );
      saveWorkers(updatedWorkers);
      return workerData;
    } catch (error) {
      console.error('Error updating worker in Sheets:', error);
      throw error;
    }
  },

  addWorker: async (workerData: Omit<Worker, 'id'>): Promise<Worker> => {
    try {
      const payload = buildWorkersSheetPayload(workerData);

      // Intentamos sincronizar con Google Sheets
      fetch(WORKERS_APPS_SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: {
          'Content-Type': 'text/plain',
        },
        body: JSON.stringify(payload)
      });

      // Generar ID temporal local hasta la próxima recarga del Excel
      const tempId = `temp_${Date.now()}`;
      const newWorker: Worker = {
        ...workerData,
        id: tempId
      };
      
      const updatedWorkers = [...currentWorkers, newWorker];
      saveWorkers(updatedWorkers);
      return newWorker;
    } catch (error) {
      console.error('Error adding worker to Sheets:', error);
      throw error;
    }
  },

  deleteWorker: async (id: string): Promise<boolean> => {
    try {
      // Solo enviar al Apps Script si el ID viene del Excel real
      // Los IDs temporales (temp_*) no tienen fila real y enviarles delete podría romper el Excel
      const isRealExcelRow = id.startsWith('real_worker_');
      if (isRealExcelRow) {
        await fetch(WORKERS_APPS_SCRIPT_URL, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'text/plain' },
          body: JSON.stringify({ id, action: 'delete' })
        });
      }

      const updatedWorkers = currentWorkers.filter(w => w.id !== id);
      saveWorkers(updatedWorkers);
      return true;
    } catch (error) {
      console.error('Error deleting worker from Sheets:', error);
      throw error;
    }
  },

  restoreWorker: async (worker: Worker): Promise<void> => {
    try {
      const isRealExcelRow = worker.id.startsWith('real_worker_');
      if (isRealExcelRow) {
        const payload = {
          ...buildWorkersSheetPayload(worker),
          action: 'restore',
        };
        fetch(WORKERS_APPS_SCRIPT_URL, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'text/plain' },
          body: JSON.stringify(payload),
        });
      }
      const updatedWorkers = [worker, ...currentWorkers.filter(w => w.id !== worker.id)];
      saveWorkers(updatedWorkers);
    } catch (error) {
      console.error('Error restoring worker:', error);
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
    try {
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(ACCOMMODATIONS_RANGE)}?key=${GOOGLE_API_KEY}`;
      const response = await fetchWithRetry(url);
      
      if (!response.ok) {
        throw new Error(`Error en la API de Google Sheets: ${response.statusText}`);
      }

      const data = await response.json();
      if (!data.values || data.values.length === 0) {
        return currentAccommodations;
      }

      const allValues = data.values as any[][];
      const headers = allValues[0] as string[];
      const rows = allValues.slice(1);

      // Mapeo dinámico de columnas con tipado fuerte
      const accommodations: Accommodation[] = rows
        .map((row: any[], index: number): Accommodation => {
          const getVal = (headerName: string) => {
            const norm = normalizeHeader(headerName);
            const idx = headers.findIndex((h: string) => h && normalizeHeader(h) === norm);
            return idx !== -1 ? row[idx] : undefined;
          };

          // Priorizar dirección del alojamiento turístico sobre dirección del propietario
          const touristAddress = String(getVal('DIRECCIÓN ALOJAMIENTO TURÍSTICO') || getVal('DIRECCION ALOJAMIENTO TURISTICO') || '').trim();
          const ownerAddress = String(getVal('DIRECCIÓN') || getVal('Dirección') || '').trim();

          // Las columnas 27-29 corresponden al CP, POBLACIÓN y PROVINCIA del apartamento turístico
          // (después de la columna 26 "PARKINGS")
          // Buscamos por posición ya que tienen el mismo nombre que las del propietario
          const touristZipCode = row[26] ? String(row[26]).trim() : '';
          const touristCity = row[27] ? String(row[27]).trim() : '';
          const touristProvincia = row[28] ? String(row[28]).trim() : '';

          return {
            id: `real_${index + 2}`,
            name: String(getVal('PROPIEDAD') || getVal('NOMBRE') || getVal('Apartamento') || 'Sin nombre').trim(),
            ref: String(getVal('REF') || getVal('Ref') || getVal('ref') || '').trim(),
            address: touristAddress || ownerAddress,
            city: touristCity || String(getVal('POBLACIÓN') || ''),
            zipCode: touristZipCode || String(getVal('CP') || '').trim(),
            provincia: touristProvincia || String(getVal('PROVINCIA') || ''),
            notes: String(getVal('OBSERVACIONES') || '').trim(),
            active: true
          };
        })
        .filter((acc: Accommodation) => acc.name && acc.name.trim() !== '' && acc.name !== 'Sin nombre');

      // Actualizamos la caché local con la realidad del Excel
      saveAccommodations(accommodations);
      return accommodations;
    } catch (error) {
      console.error('Error fetching accommodations from Sheets:', error);
      // fallback a mock data si falla la red
      return currentAccommodations;
    }
  },

  updateAccommodation: async (accommodationData: Accommodation): Promise<Accommodation> => {
    try {
      const payload = {
        ...accommodationData,
        action: 'update'
      };
      fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: {
          'Content-Type': 'text/plain',
        },
        body: JSON.stringify(payload),
      });

      // Actualizamos localmente
      const updatedAccommodations = currentAccommodations.map(a => 
        a.id === accommodationData.id ? { ...accommodationData } : a
      );
      saveAccommodations(updatedAccommodations);
      
      return accommodationData;
    } catch (error) {
      console.error('Error updating accommodation in Sheets:', error);
      // Fallback
      const updatedAccommodations = currentAccommodations.map(a => 
        a.id === accommodationData.id ? { ...accommodationData } : a
      );
      saveAccommodations(updatedAccommodations);
      return accommodationData;
    }
  },

  addAccommodation: async (accommodationData: Omit<Accommodation, 'id'>): Promise<Accommodation> => {
    try {
      fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: {
          'Content-Type': 'text/plain',
        },
        body: JSON.stringify(accommodationData),
      });

      // Nota: Con 'no-cors' no podemos leer la respuesta, pero el envío se realiza.
      // Generamos un ID temporal para la UI
      const newAccommodation: Accommodation = {
        ...accommodationData,
        id: `real_new_${Date.now()}`
      };
      
      // Actualizamos caché local
      currentAccommodations = [newAccommodation, ...currentAccommodations];
      saveAccommodations(currentAccommodations);
      
      return newAccommodation;
    } catch (error) {
      console.error('Error adding accommodation to Sheets:', error);
      // Fallback a localStorage si falla la red
      await delay(1000);
      const lastId = currentAccommodations.length > 0 
        ? Math.max(...currentAccommodations.map(a => {
            const numericPart = a.id.startsWith('a') ? a.id.slice(1) : a.id;
            return parseInt(numericPart) || 0;
          }))
        : 0;
      const newAccommodation: Accommodation = {
        ...accommodationData,
        id: `a${lastId + 1}`
      };
      currentAccommodations = [...currentAccommodations, newAccommodation];
      saveAccommodations(currentAccommodations);
      return newAccommodation;
    }
  },

  deleteAccommodation: async (id: string): Promise<boolean> => {
    try {
      // Solo enviar al Apps Script si el ID viene del Excel real (empieza por "real_" pero NO por "real_new_")
      // Los IDs locales (real_new_*, a*) no tienen fila real en el Excel y enviarles delete rompería las cabeceras
      const isRealExcelRow = id.startsWith('real_') && !id.startsWith('real_new_');
      if (isRealExcelRow) {
        await fetch(APPS_SCRIPT_URL, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'text/plain' },
          body: JSON.stringify({ id, action: 'delete' })
        });
      }

      const updatedAccommodations = currentAccommodations.filter(a => a.id !== id);
      saveAccommodations(updatedAccommodations);
      return true;
    } catch (error) {
      console.error('Error deleting accommodation from Sheets:', error);
      throw error;
    }
  },

  restoreAccommodation: async (accommodation: Accommodation): Promise<void> => {
    try {
      const isRealExcelRow = accommodation.id.startsWith('real_') && !accommodation.id.startsWith('real_new_');
      if (isRealExcelRow) {
        fetch(APPS_SCRIPT_URL, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'text/plain' },
          body: JSON.stringify({ ...accommodation, action: 'restore' }),
        });
      }
      const updatedAccommodations = [accommodation, ...currentAccommodations.filter(a => a.id !== accommodation.id)];
      saveAccommodations(updatedAccommodations);
    } catch (error) {
      console.error('Error restoring accommodation:', error);
      throw error;
    }
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

