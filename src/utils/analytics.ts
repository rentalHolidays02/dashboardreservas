import { Worker, NormalCleanRecord, InitialCleanRecord, HandymanRecord } from '../services/mockData';
import { Period } from '../components/dashboard/DashboardFilterModal';
import { computeCleanPay, cleanPhone, matchesWorkerByPhone } from './payments';

export interface ChartPoint {
  label: string;
  dinero: number;
  limpiezas: number;
  km: number;
}

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
    const iso = d.toISOString().split('T')[0];
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
    apartamento: string,
    horaEntrada: string,
    horaSalida: string,
    km: number
  ) => {
    const datePart = fecha.split(' ')[0].split('T')[0];
    if (!result[datePart]) return;

    if (selectedWorker) {
      if (!matchesWorkerByPhone(telefono, selectedWorker.telefono)) return;
    }

    const worker = findWorker(telefono);
    const pagoPorReserva = worker?.pagoPorReserva ?? 20;
    const precioPorKm = worker?.precioPorKm ?? 0.19;

    const pay = computeCleanPay(apartamento, horaEntrada, horaSalida, pagoPorReserva);
    result[datePart].dinero += pay.base + pay.extraPay + (km || 0) * precioPorKm;
    result[datePart].km += km || 0;
    result[datePart].limpiezas += 1;
  };

  const processHandyman = (
    fecha: string,
    telefono: string,
    km: number
  ) => {
    const datePart = fecha.split(' ')[0].split('T')[0];
    if (!result[datePart]) return;

    if (selectedWorker) {
      if (!matchesWorkerByPhone(telefono, selectedWorker.telefono)) return;
    }

    const worker = findWorker(telefono);
    const precioPorKm = worker?.precioPorKm ?? 0.19;
    result[datePart].dinero += (km || 0) * precioPorKm;
    result[datePart].km += km || 0;
  };

  normalCleans.forEach(r =>
    processClean(r.checkinFecha, r.telefono, r.apartamento, r.horaEntrada, r.horaSalida, r.km)
  );
  initialCleans.forEach(r =>
    processClean(r.checkinFecha, r.telefono, r.apartamento, r.horaEntrada, r.horaSalida, r.km)
  );
  handymanRecords.forEach(r =>
    processHandyman(r.fechaLlegada, r.telefono, r.cantidadMinutos)
  );

  return Object.values(result);
};
