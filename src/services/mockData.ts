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
export interface BaseRecord {
  id: string;
  telefono: string;
  nombre: string;
  apellidos: string;
  checkinFecha: string;
  checkinUbicacion: string;
}

export interface NormalCleanRecord extends BaseRecord {
  checkoutFecha: string;
  checkoutUbicacion: string;
  apartamento: string;
  horaEntrada: string;
  horaSalida: string;
  sigueHuesped: boolean;
  fechaSalidaReserva: string;
  recogeLlaves: boolean;
  km: number;
  observaciones: string;
  checked: boolean;
}

export interface InitialCleanRecord extends BaseRecord {
  checkoutFecha: string;
  checkoutUbicacion: string;
  apartamento: string;
  horaEntrada: string;
  horaSalida: string;
  km: number;
  observaciones: string;
  checked: boolean;
}

export interface HandymanRecord {
  id: string;
  telefono: string;
  nombre: string;
  apellidos: string;
  fechaLlegada: string;
  ubicacionInicio: string;
  fechaFin: string;
  ubicacionFin: string;
  alojamiento: string;
  horaInicioTarea: string;
  horaFinTarea: string;
  cantidadMinutos: number;
  observacionesTarea: string;
  estadoCompletado: string;
}

export const MOCK_NORMAL_CLEANS: NormalCleanRecord[] = [
  {
    id: 'nc1',
    telefono: '600000001',
    nombre: 'Juan',
    apellidos: 'Pérez',
    checkinFecha: '2026-03-30 09:00',
    checkinUbicacion: 'Calle Mayor 1',
    checkoutFecha: '2026-03-30 11:30',
    checkoutUbicacion: 'Calle Mayor 1',
    apartamento: 'Sol 1A',
    horaEntrada: '09:15',
    horaSalida: '11:15',
    sigueHuesped: false,
    fechaSalidaReserva: '2026-03-30',
    recogeLlaves: true,
    km: 5,
    observaciones: 'Todo correcto',
    checked: true
  }
];

export const MOCK_INITIAL_CLEANS: InitialCleanRecord[] = [
  {
    id: 'ic1',
    telefono: '600000002',
    nombre: 'María',
    apellidos: 'García',
    checkinFecha: '2026-03-30 08:30',
    checkinUbicacion: 'Avenida Libertad 10',
    checkoutFecha: '2026-03-30 13:00',
    checkoutUbicacion: 'Avenida Libertad 10',
    apartamento: 'Marina 4B',
    horaEntrada: '08:45',
    horaSalida: '12:45',
    km: 12,
    observaciones: 'Limpieza a fondo realizada',
    checked: true
  }
];

export const MOCK_HANDYMAN_RECORDS: HandymanRecord[] = [
  {
    id: 'hm1',
    telefono: '600000003',
    nombre: 'Carlos',
    apellidos: 'Rodríguez',
    fechaLlegada: '2026-03-30 10:00',
    ubicacionInicio: 'Calle Luna 5',
    fechaFin: '2026-03-30 11:00',
    ubicacionFin: 'Calle Luna 5',
    alojamiento: 'Luna 5',
    horaInicioTarea: '10:10',
    horaFinTarea: '10:50',
    cantidadMinutos: 40,
    observacionesTarea: 'Reparación de persiana',
    estadoCompletado: 'Completado'
  }
];
