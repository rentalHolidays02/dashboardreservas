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
  PagoRecord
} from './mockData';

// Simulación de persistencia en localStorage para el MVP
const getStoredWorkers = (): Worker[] => {
  const stored = localStorage.getItem('rh_workers');
  if (stored) {
    const parsed: Worker[] = JSON.parse(stored);
    return parsed.map(w => ({
      netMoneyMonth: 0,
      cleansCountMonth: 0,
      kmsMonth: 0,
      accommodations: [],
      ...w,
    }));
  }
  return MOCK_WORKERS;
};

let currentWorkers = getStoredWorkers();

const saveWorkers = (workers: Worker[]) => {
  currentWorkers = workers;
  localStorage.setItem('rh_workers', JSON.stringify(workers));
};

// Pagos persistence
const getStoredPagos = (): PagoRecord[] => {
  try {
    const stored = localStorage.getItem('rh_pagos');
    if (stored) return JSON.parse(stored);
  } catch {}
  return [...MOCK_PAGOS];
};

const savePagos = (pagos: PagoRecord[]) => {
  localStorage.setItem('rh_pagos', JSON.stringify(pagos));
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

