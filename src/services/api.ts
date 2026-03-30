import { MOCK_USERS, MOCK_WORKERS, MOCK_CHECKINS, MOCK_INCIDENCIAS, User, Worker, CheckInOut, Incidencia } from './mockData';

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
    return MOCK_WORKERS;
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
    const totalMoney = MOCK_WORKERS.reduce((acc, w) => acc + w.netMoneyMonth, 0);
    const totalCleans = MOCK_WORKERS.reduce((acc, w) => acc + w.cleansCountMonth, 0);
    return {
      totalMoney,
      totalCleans
    };
  }
};
