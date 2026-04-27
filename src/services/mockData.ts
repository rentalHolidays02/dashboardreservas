export interface User {
  id?: string;
  email: string;
  role: 'admin' | 'editor' | 'viewer' | 'trabajador';
  name: string;
  telefono?: string;
  last_location?: any;
}

export interface Worker {
  id: string;
  excelId?: string;
  profileId?: string;
  fullName: string;
  telefono?: string;
  email?: string;
  dni?: string;
  netMoneyMonth: number;
  owedMoney: number;
  efectivoRetenido?: number;
  cleansCountMonth: number;
  kmsMonth: number;
  extraHoursMonth?: number;
  accommodations: string[];
  tipoPago?: 'bizum' | 'tarjeta' | 'efectivo';
  pagoPorReserva?: number;
  precioPorKm?: number;
  tipoTrabajador?: 'Limpiador' | 'Manitas';
  // Bizum
  telefonoBizum?: string;
  // Transferencia bancaria
  iban?: string;
  banco?: string;
  titularCuenta?: string;
  photo?: string;
  notes?: string;
}

export interface Accommodation {
  id: string;
  name: string;
  ref?: string;
  address: string;
  city: string;
  zipCode: string;
  provincia?: string;
  notes?: string;
  active: boolean;
  image?: string;
}

export const MOCK_USERS: (User & { password: string })[] = [];

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
  kms?: number;
  checked?: boolean;
}

export interface EntregaLlaves {
  id: string;
  telefono: string;
  nombre: string;
  apellidos: string;
  fechaUbicacionEntrega: string; // Columna D
  apartamento: string;
  nombreCliente: string;
  fechaEntradaReserva: string;
  fechaSalidaReserva: string;
  entregaLlaves: boolean;
  sabanasToallas: string; // "Sí", "No", "Sí, entregadas"
  km: number;
  observaciones: string;
  fianzaMonto: string;
  bizumMonto: string;
  cantidadPagadaMonto: string;
  fianzaGarantia: string;
  bizumGarantia: string;
  cantidadPagadaGarantia: string;
  checked: boolean;
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
    owedMoney: 450.00,
    cleansCountMonth: 12,
    kmsMonth: 450,
    accommodations: ['Penthouse Diagonal', 'Casa Marina 3B', 'Ático Sol 7'],
    tipoPago: 'bizum',
    pagoPorReserva: 20
  },
  {
    id: '2',
    fullName: 'María García',
    netMoneyMonth: 980.20,
    owedMoney: 0,
    cleansCountMonth: 8,
    kmsMonth: 120,
    accommodations: ['Apt. Ramblas 12', 'Loft Born 2'],
    tipoPago: 'tarjeta',
    pagoPorReserva: 25
  },
  {
    id: '3',
    fullName: 'Carlos Rodríguez',
    netMoneyMonth: 1560.00,
    owedMoney: 280.50,
    cleansCountMonth: 15,
    kmsMonth: 600,
    accommodations: ['Estudio Gracia 5', 'Casa Marina 3B', 'Loft Born 2', 'Ático Sol 7'],
    tipoPago: 'efectivo',
    pagoPorReserva: 15
  },
  {
    id: '4',
    fullName: 'Ana Martínez',
    netMoneyMonth: 1100.00,
    owedMoney: 120.00,
    cleansCountMonth: 10,
    kmsMonth: 300,
    accommodations: ['Ático Sol 7'],
    tipoPago: 'bizum',
    pagoPorReserva: 20
  }
];

export const MOCK_ACCOMMODATIONS: Accommodation[] = [
  {
    id: 'a1',
    name: 'Apt. Ramblas 12',
    address: 'Las Ramblas, 12, 2º 1ª',
    city: 'Barcelona',
    zipCode: '08002',
    active: true,
    notes: 'Código portal: 1234. Llave en cajetín.'
  },
  {
    id: 'a2',
    name: 'Casa Marina 3B',
    address: 'Paseo Marítimo, 45',
    city: 'Barcelona',
    zipCode: '08003',
    active: true,
    notes: 'Portero físico de 9 a 20h.'
  },
  {
    id: 'a3',
    name: 'Ático Sol 7',
    address: 'Calle del Sol, 7',
    city: 'Madrid',
    zipCode: '28013',
    active: true
  },
  {
    id: 'a4',
    name: 'Estudio Gracia 5',
    address: 'Carrer de Gràcia, 5',
    city: 'Barcelona',
    zipCode: '08012',
    active: true
  },
  {
    id: 'a5',
    name: 'Loft Born 2',
    address: 'Carrer del Born, 2',
    city: 'Barcelona',
    zipCode: '08003',
    active: false,
    notes: 'En reformas hasta mayo.'
  },
  {
    id: 'a6',
    name: 'Penthouse Diagonal',
    address: 'Avenida Diagonal, 450',
    city: 'Barcelona',
    zipCode: '08036',
    active: true
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
  },
  {
    id: 'nc2',
    telefono: '600000004',
    nombre: 'Ana',
    apellidos: 'López',
    checkinFecha: '2026-04-01 10:00',
    checkinUbicacion: 'Calle Atocha 15',
    checkoutFecha: '2026-04-01 12:00',
    checkoutUbicacion: 'Calle Atocha 15',
    apartamento: 'Latina 2B',
    horaEntrada: '10:15',
    horaSalida: '11:45',
    sigueHuesped: true,
    fechaSalidaReserva: '2026-04-05',
    recogeLlaves: false,
    km: 3.5,
    observaciones: 'El huésped solicitó quedarse más tiempo.',
    checked: false
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

export interface PagoRecord {
  id: string;
  workerId: string;
  workerName: string;
  telefono: string;
  dni: string;
  email: string;
  fecha: string; // 'YYYY-MM-DD'
  concepto: string;
  importe: number;
  limpiezas: number;
  km: number;
  estado: 'pagado' | 'pendiente';
}

export interface Suggestion {
  id: string;
  subject: string;
  from: string;
  date: string;
  snippet: string;
  body: string;
  isRead: boolean;
  isStarred: boolean;
  category?: 'fallo' | 'sugerencia' | 'otro' | string;
}

export const MOCK_PAGOS: PagoRecord[] = [];
