export interface User {
  email: string;
  role: 'admin' | 'viewer';
  name: string;
}

export interface Worker {
  id: string;
  fullName: string;
  netMoneyMonth: number;
  cleansCountMonth: number;
  kmsMonth: number;
}

export const MOCK_USERS: (User & { password: string })[] = [
  {
    email: 'admin@rh.local',
    password: '1234',
    role: 'admin',
    name: 'Admin RH'
  },
  {
    email: 'view@rh.local',
    password: '1234',
    role: 'viewer',
    name: 'Visualizador RH'
  }
];

export const MOCK_WORKERS: Worker[] = [
  {
    id: '1',
    fullName: 'Juan Pérez',
    netMoneyMonth: 1250.50,
    cleansCountMonth: 12,
    kmsMonth: 450
  },
  {
    id: '2',
    fullName: 'María García',
    netMoneyMonth: 980.20,
    cleansCountMonth: 8,
    kmsMonth: 120
  },
  {
    id: '3',
    fullName: 'Carlos Rodríguez',
    netMoneyMonth: 1560.00,
    cleansCountMonth: 15,
    kmsMonth: 600
  },
  {
    id: '4',
    fullName: 'Ana Martínez',
    netMoneyMonth: 1100.00,
    cleansCountMonth: 10,
    kmsMonth: 300
  }
];
