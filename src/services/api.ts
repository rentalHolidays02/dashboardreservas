import { 
  MOCK_USERS, 
  MOCK_WORKERS, 
  MOCK_NORMAL_CLEANS,
  MOCK_INITIAL_CLEANS,
  MOCK_HANDYMAN_RECORDS,
  User, 
  Worker,
  NormalCleanRecord,
  InitialCleanRecord,
  HandymanRecord
} from './mockData';

// Simulación de persistencia en localStorage para el MVP
const getStoredWorkers = (): Worker[] => {
  const stored = localStorage.getItem('rh_workers');
  if (stored) {
    return JSON.parse(stored);
  }
  return MOCK_WORKERS;
};

let currentWorkers = getStoredWorkers();

const saveWorkers = (workers: Worker[]) => {
  currentWorkers = workers;
  localStorage.setItem('rh_workers', JSON.stringify(workers));
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
  }
};

