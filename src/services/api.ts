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
const SPREADSHEET_ID = '1Z1qYQ2ykQG2Kq1hO9K2PdjES_OvOR2d1yKPv7MdyAa4'; // Alojamientos
const WORKERS_SPREADSHEET_ID = '1ntCYcUaUvsMWD7bOCaVmEzBqnHqf09MFd6SEjwv1OWM'; // Pagos Generales (Operarios)
const ACCOMMODATIONS_RANGE = "'ALOJAMIENTOS ACTIVOS'!A:Z";
const WORKERS_RANGE = "'informacion operarios'!A:Z";
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzMYYFUlgbqqfbVIGSKLO7LCDyg7aZpsIXamrq8F7eNcRqdtK9A1R8lVTI6OD0deeWr/exec';
const WORKERS_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwhZWguaA9HkDCRKIeS5eAxoMR-u6hKA7FoJ2yn_mfBTA3IyCH1Xoey93SGh10CTc5uDA/exec';
const INCIDENCIAS_SPREADSHEET_ID = '1xSeU9XyvZIWuifWNXgR99l6qftpsRT4hg55tsZn7IE4';
const INCIDENCIAS_RANGE = "'Informe_Incidencia'!A:Z";
const INCIDENCIAS_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzCG3ACe12pP9GmGjNpWCK9iMrBTSXMTJmYT6BjcFj5e-BsP2PL3Sf4isXObYHppLk1YA/exec';

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
    try {
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${WORKERS_SPREADSHEET_ID}/values/${encodeURIComponent(WORKERS_RANGE)}?key=${GOOGLE_API_KEY}`;
      const response = await fetch(url);
      
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

      const workers: Worker[] = rows
        .map((row: any[], index: number): Worker => {
          const getVal = (headerName: string) => {
            const idx = headers.findIndex((h: string) => h && h.trim().toUpperCase() === headerName.trim().toUpperCase());
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
            // Campos de resumen (se calculan o vienen de otro sitio)
            netMoneyMonth: 0,
            cleansCountMonth: 0,
            kmsMonth: 0,
            accommodations: []
          };
        })
        .filter((w: Worker) => w.fullName && w.fullName.trim() !== '' && w.fullName !== 'Sin nombre');

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
        ...workerData,
        // Limpiar comillas existentes y añadir la comilla simple para forzar formato texto en Excel
        telefono: workerData.telefono ? `'${workerData.telefono.replace(/^'/, '')}` : '',
        telefonoBizum: workerData.telefonoBizum ? `'${workerData.telefonoBizum.replace(/^'/, '')}` : '',
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
      const payload = {
        ...workerData,
        telefono: workerData.telefono ? `'${workerData.telefono.replace(/^'/, '')}` : '',
        telefonoBizum: workerData.telefonoBizum ? `'${workerData.telefonoBizum.replace(/^'/, '')}` : '',
      };

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
          ...worker,
          telefono: worker.telefono ? `'${worker.telefono.replace(/^'/, '')}` : '',
          telefonoBizum: worker.telefonoBizum ? `'${worker.telefonoBizum.replace(/^'/, '')}` : '',
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
      const response = await fetch(url);
      
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

      const allValues = data.values as any[][];
      const headers = allValues[0] as string[];
      const rows = allValues.slice(1);

      // Mapeo dinámico de columnas con tipado fuerte
      const accommodations: Accommodation[] = rows
        .map((row: any[], index: number): Accommodation => {
          const getVal = (headerName: string) => {
            const idx = headers.findIndex((h: string) => h && h.trim() === headerName.trim());
            return idx !== -1 ? row[idx] : undefined;
          };

          return {
            id: `real_${index + 2}`,
            name: String(getVal('PROPIEDAD') || 'Sin nombre'),
            ref: String(getVal('REF') || getVal('Ref') || getVal('ref') || ''),
            address: String(getVal('DIRECCIÓN') || getVal('Dirección') || ''),
            city: String(getVal('POBLACIÓN') || ''),
            zipCode: String(getVal('CP') || ''),
            notes: String(getVal('OBSERVACIONES') || ''),
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

