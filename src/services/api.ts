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
  NormalCleanRecord,
  InitialCleanRecord,
  HandymanRecord,
  PagoRecord,
  Accommodation,
  MOCK_ACCOMMODATIONS
} from './mockData';

// Google Sheets API Configuration
const GOOGLE_API_KEY = 'AIzaSyAU6iF2xDuxgrGv6q6Z8wQg0MkZVbFXc5M';
const SPREADSHEET_ID = '1Z1qYQ2ykQG2Kq1hO9K2PdjES_OvOR2d1yKPv7MdyAa4';
const ACCOMMODATIONS_RANGE = "'ALOJAMIENTOS ACTIVOS'!A:Z";
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyqHkZ8yB1eope2_IESClN0PKWeadZ93fyRx8_50araLaWN_jaayd_90nIYdN3M-nab/exec';

// Simulación de persistencia en localStorage para el MVP
const getStoredWorkers = (): Worker[] => {
  try {
    const stored = localStorage.getItem('rh_workers');
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        return parsed.map(w => ({
          netMoneyMonth: 0,
          cleansCountMonth: 0,
          kmsMonth: 0,
          accommodations: [],
          ...w,
        }));
      }
    }
  } catch (error) {
    console.error("Error loading workers from localStorage:", error);
  }
  return MOCK_WORKERS;
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

export const appsScriptApi = {
  login: async (email: string, pass: string): Promise<User | null> => {
    await delay(800);
    const user = MOCK_USERS.find(u => u.email === email && u.password === pass);
    if (user) {
      const { password, ...userWithoutPass } = user;
      return userWithoutPass;
    }
    return null;
  },

  getWorkers: async (): Promise<Worker[]> => {
    await delay(500);
    return currentWorkers;
  },

  updateWorker: async (workerData: Worker): Promise<Worker> => {
    await delay(1000);
    const updatedWorkers = currentWorkers.map(w => 
      w.id === workerData.id ? { ...workerData } : w
    );
    saveWorkers(updatedWorkers);
    return workerData;
  },

  addWorker: async (workerData: Omit<Worker, 'id'>): Promise<Worker> => {
    await delay(1000);
    // Generar nuevo ID numérico
    const lastId = currentWorkers.length > 0 
      ? Math.max(...currentWorkers.map(w => parseInt(w.id))) 
      : 0;
    const newWorker: Worker = {
      ...workerData,
      id: (lastId + 1).toString()
    };
    const updatedWorkers = [...currentWorkers, newWorker];
    saveWorkers(updatedWorkers);
    return newWorker;
  },

  getRecentCheckIns: async (limit = 10): Promise<CheckInOut[]> => {
    await delay(500);
    return [...MOCK_CHECKINS]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);
  },

  getRecentIncidencias: async (limit = 5): Promise<Incidencia[]> => {
    await delay(500);
    return [...MOCK_INCIDENCIAS]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);
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
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Error en la API de Google Sheets: ${response.statusText}`);
      }

      const data = await response.json();
      if (!data.values || data.values.length === 0) {
        return currentAccommodations;
      }

      const headers = data.values[0];
      const rows = data.values.slice(1);

      // Mapeo dinámico de columnas
      const accommodations: Accommodation[] = rows.map((row: any[], index: number) => {
        const getVal = (headerName: string) => {
          const idx = headers.findIndex((h: string) => h.trim() === headerName.trim());
          return idx !== -1 ? row[idx] : undefined;
        };

        return {
          id: `real_${index + 1}`,
          name: getVal('PROPIEDAD') || 'Sin nombre',
          address: getVal('DIRECCIÓN') || getVal('Dirección') || '',
          city: getVal('POBLACIÓN') || '',
          zipCode: (getVal('CP') || '').toString(),
          notes: getVal('OBSERVACIONES') || '',
          active: true
        };
      });

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
    await delay(1000);
    const updatedAccommodations = currentAccommodations.map(a => 
      a.id === accommodationData.id ? { ...accommodationData } : a
    );
    saveAccommodations(updatedAccommodations);
    return accommodationData;
  },

  addAccommodation: async (accommodationData: Omit<Accommodation, 'id'>): Promise<Accommodation> => {
    try {
      const response = await fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors', // Apps Script requiere no-cors o redirección compleja
        headers: {
          'Content-Type': 'application/json',
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

  getNormalCleans: async (): Promise<NormalCleanRecord[]> => {
    await delay(400);
    return MOCK_NORMAL_CLEANS;
  },

  getInitialCleans: async (): Promise<InitialCleanRecord[]> => {
    await delay(400);
    return MOCK_INITIAL_CLEANS;
  },

  getHandymanRecords: async (): Promise<HandymanRecord[]> => {
    await delay(400);
    return MOCK_HANDYMAN_RECORDS;
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

  getWorkerCleans: async (fullName: string): Promise<{
    normal: NormalCleanRecord[];
    initial: InitialCleanRecord[];
    handyman: HandymanRecord[];
  }> => {
    await delay(300);
    const match = (nombre: string, apellidos: string) =>
      `${nombre} ${apellidos}` === fullName;
    return {
      normal:   MOCK_NORMAL_CLEANS.filter(r => match(r.nombre, r.apellidos)),
      initial:  MOCK_INITIAL_CLEANS.filter(r => match(r.nombre, r.apellidos)),
      handyman: MOCK_HANDYMAN_RECORDS.filter(r => match(r.nombre, r.apellidos)),
    };
  }
};

