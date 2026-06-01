import { Worker, NormalCleanRecord, InitialCleanRecord, HandymanRecord } from '../services/mockData';
import { Period } from '../components/dashboard/DashboardFilterModal';
import { computeCleanPay, computeHoursPay, cleanPhone, matchesWorkerByPhone } from './payments';

export interface ChartPoint {
  label: string;
  dinero: number;
  limpiezas: number;
  km: number;
}

const normName = (s: string) =>
  (s || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

// Igual que `matchRecord` en WorkerPanel: teléfono si ambos existen; si no, nombre+apellidos.
const matchRecordVsWorker = (
  recordPhone: string,
  recordNombre: string,
  recordApellidos: string,
  worker: Worker
): boolean => {
  const recPhone = cleanPhone(recordPhone);
  const wPhone = cleanPhone(worker.telefono);
  if (recPhone && wPhone) return recPhone === wPhone;

  const full = normName(`${recordNombre} ${recordApellidos}`);
  const target = normName(worker.fullName);
  if (!full || !target) return false;
  return target.split(/\s+/).every(part => full.includes(part));
};

export const aggregateDailyData = (
  workers: Worker[],
  normalCleans: NormalCleanRecord[],
  initialCleans: InitialCleanRecord[],
  handymanRecords: HandymanRecord[],
  period: Period,
  customDesde?: string,
  customHasta?: string,
  selectedWorkerId?: string | null
): ChartPoint[] => {
  const result: Record<string, ChartPoint> = {};

  // Clave YYYY-MM-DD en hora LOCAL (evita el desfase de toISOString a UTC).
  const localKey = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  // Base date = hoy; permitimos sobrescribir con customHasta para modo personalizado.
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let iterations = 30;
  let step = 1;
  let endDate = today;

  if (period === 'semanal') { iterations = 7; step = 1; }
  else if (period === 'mensual') { iterations = 30; step = 1; }
  else if (period === 'trimestral') { iterations = 12; step = 7; }
  else if (period === 'personalizado' && customDesde && customHasta) {
    const start = new Date(customDesde);
    const end = new Date(customHasta);
    endDate = end;
    iterations = Math.min(Math.round((end.getTime() - start.getTime()) / 86400000) + 1, 90);
  }

  for (let i = iterations - 1; i >= 0; i--) {
    const d = new Date(endDate);
    d.setDate(endDate.getDate() - i * step);
    const iso = localKey(d);
    const label = d.toLocaleString('es-ES', { day: 'numeric', month: 'short' });
    result[iso] = { label, dinero: 0, limpiezas: 0, km: 0 };
  }

  const selectedWorker = selectedWorkerId ? workers.find(w => w.id === selectedWorkerId) : null;

  const findWorker = (telefono: string): Worker | undefined => {
    return workers.find(w => matchesWorkerByPhone(w.telefono, telefono));
  };

  const processClean = (
    fecha: string,
    telefono: string,
    nombre: string,
    apellidos: string,
    apartamento: string,
    horaEntrada: string,
    horaSalida: string,
    km: number
  ) => {
    if (!fecha) return;
    const datePart = String(fecha).split(' ')[0].split('T')[0];
    if (!result[datePart]) return;

    if (selectedWorker) {
      if (!matchRecordVsWorker(telefono, nombre, apellidos, selectedWorker)) return;
    }

    const worker = findWorker(telefono) ?? selectedWorker ?? undefined;
    const pagoPorReserva = worker?.pagoPorReserva ?? 20;
    const precioPorKm = worker?.precioPorKm ?? 0.19;

    const pay = computeCleanPay(apartamento, horaEntrada, horaSalida, pagoPorReserva);
    result[datePart].dinero += pay.base + pay.extraPay + (km || 0) * precioPorKm;
    result[datePart].km += km || 0;
    result[datePart].limpiezas += 1;
  };

  // Limpieza inicial: TODAS las horas × 10 + km (no base por reserva)
  const processInitial = (
    fecha: string,
    telefono: string,
    nombre: string,
    apellidos: string,
    horaEntrada: string,
    horaSalida: string,
    km: number
  ) => {
    if (!fecha) return;
    const datePart = String(fecha).split(' ')[0].split('T')[0];
    if (!result[datePart]) return;

    if (selectedWorker) {
      if (!matchRecordVsWorker(telefono, nombre, apellidos, selectedWorker)) return;
    }

    const worker = findWorker(telefono) ?? selectedWorker ?? undefined;
    const precioPorKm = worker?.precioPorKm ?? 0.19;
    const hp = computeHoursPay(horaEntrada, horaSalida);
    result[datePart].dinero += hp.pay + (km || 0) * precioPorKm;
    result[datePart].km += km || 0;
    result[datePart].limpiezas += 1;
  };

  // Manitas: horas × 10 + km
  const processHandyman = (
    fecha: string,
    telefono: string,
    nombre: string,
    apellidos: string,
    horaInicio: string,
    horaFin: string,
    km: number
  ) => {
    if (!fecha) return;
    const datePart = String(fecha).split(' ')[0].split('T')[0];
    if (!result[datePart]) return;

    if (selectedWorker) {
      if (!matchRecordVsWorker(telefono, nombre, apellidos, selectedWorker)) return;
    }

    const worker = findWorker(telefono) ?? selectedWorker ?? undefined;
    const precioPorKm = worker?.precioPorKm ?? 0.19;
    const hp = computeHoursPay(horaInicio, horaFin);
    result[datePart].dinero += hp.pay + (km || 0) * precioPorKm;
    result[datePart].km += km || 0;
  };

  normalCleans.forEach(r =>
    processClean(r.checkoutFecha || r.checkinFecha, r.telefono, r.nombre, r.apellidos, r.apartamento, r.horaEntrada, r.horaSalida, r.km)
  );
  initialCleans.forEach(r =>
    processInitial(r.checkoutFecha || r.checkinFecha, r.telefono, r.nombre, r.apellidos, r.horaEntrada, r.horaSalida, r.km)
  );
  handymanRecords.forEach(r =>
    processHandyman(r.fechaFin || r.fechaLlegada, r.telefono, r.nombre, r.apellidos, r.horaInicioTarea, r.horaFinTarea, r.cantidadMinutos)
  );

  return Object.values(result);
};
