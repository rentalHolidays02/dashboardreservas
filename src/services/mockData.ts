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
  accommodations: string[];
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

export interface CheckInOut {
  id: string;
  cleanerName: string;
  accommodation: string;
  timestamp: string; // ISO 8601
  type: 'check-in' | 'check-out';
}

export const MOCK_CHECKINS: CheckInOut[] = [
  { id: 'c1',  cleanerName: 'María García',      accommodation: 'Apt. Ramblas 12',    timestamp: '2026-03-30T09:05:00', type: 'check-in'  },
  { id: 'c2',  cleanerName: 'Juan Pérez',         accommodation: 'Casa Marina 3B',     timestamp: '2026-03-30T09:18:00', type: 'check-in'  },
  { id: 'c3',  cleanerName: 'Ana Martínez',       accommodation: 'Ático Sol 7',        timestamp: '2026-03-30T09:45:00', type: 'check-in'  },
  { id: 'c4',  cleanerName: 'María García',       accommodation: 'Apt. Ramblas 12',    timestamp: '2026-03-30T10:30:00', type: 'check-out' },
  { id: 'c5',  cleanerName: 'Carlos Rodríguez',   accommodation: 'Estudio Gracia 5',   timestamp: '2026-03-30T10:52:00', type: 'check-in'  },
  { id: 'c6',  cleanerName: 'Juan Pérez',         accommodation: 'Casa Marina 3B',     timestamp: '2026-03-30T11:10:00', type: 'check-out' },
  { id: 'c7',  cleanerName: 'Ana Martínez',       accommodation: 'Ático Sol 7',        timestamp: '2026-03-30T11:35:00', type: 'check-out' },
  { id: 'c8',  cleanerName: 'Carlos Rodríguez',   accommodation: 'Estudio Gracia 5',   timestamp: '2026-03-30T12:20:00', type: 'check-out' },
  { id: 'c9',  cleanerName: 'Juan Pérez',         accommodation: 'Penthouse Diagonal', timestamp: '2026-03-30T12:40:00', type: 'check-in'  },
  { id: 'c10', cleanerName: 'María García',       accommodation: 'Loft Born 2',        timestamp: '2026-03-30T13:05:00', type: 'check-in'  },
];

export interface Incidencia {
  id: string;
  userName: string;
  description: string;
  timestamp: string;
  accommodationId: string;
  accommodationName: string;
  coste: number;
  pagadoPor: 'limpiador' | 'empresa';
}

export const MOCK_INCIDENCIAS: Incidencia[] = [
  { id: 'i1', userName: 'María García',    description: 'persiana rota en habitación principal', timestamp: '2026-03-30T08:47:00', accommodationId: 'a1', accommodationName: 'Apt. Ramblas 12',   coste: 45.00, pagadoPor: 'empresa'   },
  { id: 'i2', userName: 'Juan Pérez',      description: 'mancha en el sofá difícil de limpiar',  timestamp: '2026-03-30T09:55:00', accommodationId: 'a2', accommodationName: 'Casa Marina 3B',   coste: 12.50, pagadoPor: 'limpiador' },
  { id: 'i3', userName: 'Ana Martínez',    description: 'falta una toalla del set completo',      timestamp: '2026-03-30T10:12:00', accommodationId: 'a3', accommodationName: 'Ático Sol 7',      coste: 8.00,  pagadoPor: 'empresa'   },
  { id: 'i4', userName: 'Carlos Rodríguez',description: 'grifo de la cocina con fuga leve',       timestamp: '2026-03-30T11:03:00', accommodationId: 'a4', accommodationName: 'Estudio Gracia 5', coste: 30.00, pagadoPor: 'limpiador' },
  { id: 'i5', userName: 'María García',    description: 'mando del AC sin pilas',                 timestamp: '2026-03-30T12:30:00', accommodationId: 'a5', accommodationName: 'Loft Born 2',      coste: 4.50,  pagadoPor: 'empresa'   },
];

export const MOCK_WORKERS: Worker[] = [
  {
    id: '1',
    fullName: 'Juan Pérez',
    netMoneyMonth: 1250.50,
    cleansCountMonth: 12,
    kmsMonth: 450,
    accommodations: ['Penthouse Diagonal', 'Casa Marina 3B', 'Ático Sol 7']
  },
  {
    id: '2',
    fullName: 'María García',
    netMoneyMonth: 980.20,
    cleansCountMonth: 8,
    kmsMonth: 120,
    accommodations: ['Apt. Ramblas 12', 'Loft Born 2']
  },
  {
    id: '3',
    fullName: 'Carlos Rodríguez',
    netMoneyMonth: 1560.00,
    cleansCountMonth: 15,
    kmsMonth: 600,
    accommodations: ['Estudio Gracia 5', 'Casa Marina 3B', 'Loft Born 2', 'Ático Sol 7']
  },
  {
    id: '4',
    fullName: 'Ana Martínez',
    netMoneyMonth: 1100.00,
    cleansCountMonth: 10,
    kmsMonth: 300,
    accommodations: ['Ático Sol 7']
  }
];
