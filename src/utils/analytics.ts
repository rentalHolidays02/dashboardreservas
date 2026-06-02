import { Worker, NormalCleanRecord, InitialCleanRecord, HandymanRecord, Incidencia, EntregaLlaves } from '../services/mockData';
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
  selectedWorkerId?: string | null,
  incidencias: Incidencia[] = [],
  entregaLlaves: EntregaLlaves[] = []
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
  else if (period === 'mensual') {
    // Mes natural: día 1 → último día del mes en curso (no últimos 30 días).
    const first = new Date(today.getFullYear(), today.getMonth(), 1);
    const last  = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    endDate = last;
    iterations = last.getDate();
    step = 1;
    for (let day = 1; day <= iterations; day++) {
      const d = new Date(first.getFullYear(), first.getMonth(), day);
      const iso = localKey(d);
      const label = d.toLocaleString('es-ES', { day: 'numeric', month: 'short' });
      result[iso] = { label, dinero: 0, limpiezas: 0, km: 0 };
    }
  }
  else if (period === 'trimestral') { iterations = 12; step = 7; }
  else if (period === 'personalizado' && customDesde && customHasta) {
    const start = new Date(customDesde);
    const end = new Date(customHasta);
    endDate = end;
    iterations = Math.min(Math.round((end.getTime() - start.getTime()) / 86400000) + 1, 90);
  }

  if (period !== 'mensual') {
    for (let i = iterations - 1; i >= 0; i--) {
      const d = new Date(endDate);
      d.setDate(endDate.getDate() - i * step);
      const iso = localKey(d);
      const label = d.toLocaleString('es-ES', { day: 'numeric', month: 'short' });
      result[iso] = { label, dinero: 0, limpiezas: 0, km: 0 };
    }
  }

  const selectedWorker = selectedWorkerId ? workers.find(w => w.id === selectedWorkerId) : null;

  const findWorker = (telefono: string): Worker | undefined => {
    return workers.find(w => matchesWorkerByPhone(w.telefono, telefono));
  };

  // Acepta ISO "YYYY-MM-DD…", locale "D/M/YYYY…" y sufijo "… | lat, lng".
  const extractKey = (raw: string): string | null => {
    if (!raw) return null;
    const head = String(raw).split('|')[0].trim();
    const iso = head.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (iso) return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`;
    const loc = head.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (loc) return `${loc[3]}-${loc[2].padStart(2, '0')}-${loc[1].padStart(2, '0')}`;
    return null;
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
    const datePart = extractKey(fecha);
    if (!datePart || !result[datePart]) return;

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
    const datePart = extractKey(fecha);
    if (!datePart || !result[datePart]) return;

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
    const datePart = extractKey(fecha);
    if (!datePart || !result[datePart]) return;

    if (selectedWorker) {
      if (!matchRecordVsWorker(telefono, nombre, apellidos, selectedWorker)) return;
    }

    const worker = findWorker(telefono) ?? selectedWorker ?? undefined;
    const precioPorKm = worker?.precioPorKm ?? 0.19;
    const hp = computeHoursPay(horaInicio, horaFin);
    result[datePart].dinero += hp.pay + (km || 0) * precioPorKm;
    result[datePart].km += km || 0;
    result[datePart].limpiezas += 1;
  };

  // Incidencia: pagoPorIncidencia + km × precioPorKm
  const processIncidencia = (i: Incidencia) => {
    const datePart = extractKey(i.timestamp);
    if (!datePart || !result[datePart]) return;
    if (selectedWorker) {
      if (!matchRecordVsWorker(i.telefono || '', i.nombre || '', i.apellidos || '', selectedWorker)) return;
    }
    const worker = findWorker(i.telefono || '') ?? selectedWorker ?? undefined;
    const precioPorKm = worker?.precioPorKm ?? 0.19;
    const pagoInc = worker?.pagoPorIncidencia ?? 0;
    const km = Number(i.kms) || 0;
    result[datePart].dinero += pagoInc + km * precioPorKm;
    result[datePart].km += km;
    result[datePart].limpiezas += 1;
  };

  // Entrega de llaves: sábanas (si entregadas) + km × precioPorKm
  const processLlaves = (e: EntregaLlaves) => {
    const datePart = extractKey(e.fechaUbicacionEntrega || '');
    if (!datePart || !result[datePart]) return;
    if (selectedWorker) {
      if (!matchRecordVsWorker(e.telefono || '', e.nombre || '', e.apellidos || '', selectedWorker)) return;
    }
    const worker = findWorker(e.telefono || '') ?? selectedWorker ?? undefined;
    const precioPorKm = worker?.precioPorKm ?? 0.19;
    const sab = String(e.sabanasToallas || '').toLowerCase();
    const sabPaga = sab.includes('entregad') || sab.includes('sí') || sab.includes('si') || sab === 'true';
    const pagoSab = sabPaga ? (worker?.pagoPorServicioSabanas ?? 0) : 0;
    const km = Number(e.km) || 0;
    result[datePart].dinero += pagoSab + km * precioPorKm;
    result[datePart].km += km;
    result[datePart].limpiezas += 1;
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
  incidencias.forEach(processIncidencia);
  entregaLlaves.forEach(processLlaves);

  return Object.values(result);
};
