import { NormalCleanRecord, InitialCleanRecord, HandymanRecord, EntregaLlaves, Worker } from '../services/mockData';

export const EXTRA_HOUR_RATE = 10; // €/h para horas extra
export const SABANAS_TOALLAS_COST = 5; // € por entrega con sábanas/toallas en efectivo

// Detecta horas esperadas por tipo de alojamiento a partir del nombre
export const getExpectedHours = (apartmentName: string): number => {
  if (!apartmentName) return 2;
  const n = apartmentName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  if (n.includes('atico') && n.includes('duplex')) return 3;
  if (
    n.includes('adosado') ||
    n.includes('villa') ||
    n.includes('bungalow') ||
    n.includes('chalet')
  ) return 4;
  return 2;
};

// Convierte "HH:mm" o "HH:mm:ss" a minutos; devuelve null si no se puede
const timeToMinutes = (t: string): number | null => {
  if (!t) return null;
  const m = String(t).trim().match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const mm = parseInt(m[2], 10);
  if (isNaN(h) || isNaN(mm)) return null;
  return h * 60 + mm;
};

// Calcula horas trabajadas a partir de horaEntrada y horaSalida (HH:mm).
// Si salida < entrada se asume cruce de medianoche.
export const computeHoursWorked = (horaEntrada: string, horaSalida: string): number => {
  const a = timeToMinutes(horaEntrada);
  const b = timeToMinutes(horaSalida);
  if (a == null || b == null) return 0;
  let diff = b - a;
  if (diff < 0) diff += 24 * 60;
  return diff / 60;
};

// Pago por un registro de limpieza (sin km): base por reserva + horas extra proporcionales
export const computeCleanPay = (
  apartmentName: string,
  horaEntrada: string,
  horaSalida: string,
  pagoPorReserva: number
): { base: number; extraHours: number; extraPay: number; expectedHours: number; hoursWorked: number } => {
  const expectedHours = getExpectedHours(apartmentName);
  const hoursWorked = computeHoursWorked(horaEntrada, horaSalida);
  const extraHours = Math.max(0, hoursWorked - expectedHours);
  const extraPay = extraHours * EXTRA_HOUR_RATE;
  return {
    base: pagoPorReserva,
    extraHours,
    extraPay,
    expectedHours,
    hoursWorked,
  };
};

// Coincidencia flexible por teléfono celular
export const cleanPhone = (phone?: string): string => {
  if (!phone) return '';
  let digits = String(phone).replace(/\D/g, '');
  if (digits.startsWith('34') && digits.length >= 11) {
    digits = String(digits).slice(-9);
  } else if (digits.length > 9) {
    digits = String(digits).slice(-9);
  }
  return digits;
};

export const matchesWorkerByPhone = (recordPhone?: string, workerPhone?: string): boolean => {
  const p1 = cleanPhone(recordPhone);
  const p2 = cleanPhone(workerPhone);
  if (!p1 || !p2) return false;
  return p1 === p2;
};

export interface WorkerEarnings {
  cleanCount: number;          // Nº de limpiezas (normal + inicial)
  reservasPay: number;         // Suma de pagoPorReserva por cada limpieza
  extraHours: number;          // Total de horas extra
  extraPay: number;            // Pago por horas extra
  kms: number;                 // Km totales
  kmsPay: number;              // Pago por km
  totalOwed: number;           // Total debido por trabajo (reservas + extras + km)
  efectivoRetenido: number; // Dinero en efectivo cobrado y retenido por el trabajador (Sábanas, Fianzas, Garantías)
}

// Calcula ingresos de un trabajador a partir de todos los registros disponibles.
// efectivoRetenido: suma cobros en efectivo (fianzas, garantías y los 5€ de sábanas).
export const computeWorkerEarnings = (
  worker: Worker,
  normalCleans: NormalCleanRecord[],
  initialCleans: InitialCleanRecord[],
  handymanRecords: HandymanRecord[],
  entregaLlaves: EntregaLlaves[]
): WorkerEarnings => {
  const pagoPorReserva = worker.pagoPorReserva ?? 0;
  const precioPorKm = worker.precioPorKm ?? 0;

  let cleanCount = 0;
  let reservasPay = 0;
  let extraHours = 0;
  let extraPay = 0;
  let kms = 0;

  const applyClean = (apartamento: string, horaEntrada: string, horaSalida: string, km: number) => {
    cleanCount += 1;
    const calc = computeCleanPay(apartamento, horaEntrada, horaSalida, pagoPorReserva);
    reservasPay += calc.base;
    extraHours += calc.extraHours;
    extraPay += calc.extraPay;
    kms += km || 0;
  };

  normalCleans.forEach(r => {
    if (matchesWorkerByPhone(r.telefono, worker.telefono)) {
      applyClean(r.apartamento, r.horaEntrada, r.horaSalida, r.km);
    }
  });

  initialCleans.forEach(r => {
    if (matchesWorkerByPhone(r.telefono, worker.telefono)) {
      applyClean(r.apartamento, r.horaEntrada, r.horaSalida, r.km);
    }
  });

  // Manitas: aporta km pero no reserva, pero sí cuenta como trabajo
  handymanRecords.forEach(r => {
    if (matchesWorkerByPhone(r.telefono, worker.telefono)) {
      cleanCount += 1;
      kms += r.cantidadMinutos || 0; // el campo "Km" está en cantidadMinutos por historial del parser
    }
  });

  const kmsPay = kms * precioPorKm;
  const totalOwed = reservasPay + extraPay + kmsPay;

  // Efectivo retenido: Cobros en efectivo de fianzas, garantías y recargos por sábanas
  let efectivoRetenido = 0;
  entregaLlaves.forEach(e => {
    if (!matchesWorkerByPhone(e.telefono, worker.telefono)) return;
    const entregado = String(e.sabanasToallas || '').toLowerCase();
    const tieneSabanas = entregado.includes('si') || entregado.includes('sí') || entregado === 'true';
    
    const montoEfectivo = String(e.fianzaMonto || '').toLowerCase() === 'efectivo';
    const garantiaEfectivo = String(e.fianzaGarantia || '').toLowerCase() === 'efectivo';
    
    if (tieneSabanas && (montoEfectivo || garantiaEfectivo)) {
      efectivoRetenido += SABANAS_TOALLAS_COST;
    }
    
    if (montoEfectivo) {
      const valorMonto = parseFloat(String(e.cantidadPagadaMonto || '0').replace(',', '.')) || 0;
      efectivoRetenido += valorMonto;
    }
    
    if (garantiaEfectivo) {
      const valorGarantia = parseFloat(String(e.cantidadPagadaGarantia || '0').replace(',', '.')) || 0;
      efectivoRetenido += valorGarantia;
    }
  });

  return {
    cleanCount,
    reservasPay,
    extraHours,
    extraPay,
    kms,
    kmsPay,
    totalOwed,
    efectivoRetenido,
  };
};

// Filtra los registros para quedarse sólo con los que caen dentro de una ventana de periodo.
export const filterRecordsByPeriod = <T extends { date: string }>(
  records: T[],
  period: 'semanal' | 'mensual' | 'trimestral' | 'personalizado',
  desde?: string,
  hasta?: string,
  referenceDate?: Date
): T[] => {
  const today = referenceDate ? new Date(referenceDate) : new Date();
  today.setHours(0, 0, 0, 0);
  let days = 30;
  let endDate = today;

  if (period === 'semanal') days = 7;
  else if (period === 'mensual') days = 30;
  else if (period === 'trimestral') days = 12 * 7;
  else if (period === 'personalizado' && desde && hasta) {
    const start = new Date(desde);
    const end = new Date(hasta);
    endDate = end;
    days = Math.min(Math.round((end.getTime() - start.getTime()) / 86400000) + 1, 90);
  }

  const startDate = new Date(endDate);
  startDate.setDate(endDate.getDate() - (days - 1));
  const startIso = startDate.toISOString().split('T')[0];
  const endIso = endDate.toISOString().split('T')[0];

  return records.filter(r => {
    const raw = r.date;
    if (!raw) return false;
    const part = String(raw).split('T')[0].split(' ')[0];
    if (!/^\d{4}-\d{2}-\d{2}$/.test(part)) return false;
    return part >= startIso && part <= endIso;
  });
};

// Calcula ingresos de un trabajador restringidos a la ventana del periodo.
export const computeWorkerEarningsInRange = (
  worker: Worker,
  normalCleans: NormalCleanRecord[],
  initialCleans: InitialCleanRecord[],
  handymanRecords: HandymanRecord[],
  entregaLlaves: EntregaLlaves[],
  period: 'semanal' | 'mensual' | 'trimestral' | 'personalizado',
  desde?: string,
  hasta?: string,
  referenceDate?: Date
): WorkerEarnings => {
  const nc = filterRecordsByPeriod(
    normalCleans.map(r => ({ ...r, date: r.checkinFecha })),
    period, desde, hasta, referenceDate
  );
  const ic = filterRecordsByPeriod(
    initialCleans.map(r => ({ ...r, date: r.checkinFecha })),
    period, desde, hasta, referenceDate
  );
  const hm = filterRecordsByPeriod(
    handymanRecords.map(r => ({ ...r, date: r.fechaLlegada })),
    period, desde, hasta, referenceDate
  );
  const el = filterRecordsByPeriod(
    entregaLlaves.map(e => ({ ...e, date: e.fechaUbicacionEntrega || '' })),
    period, desde, hasta, referenceDate
  );
  return computeWorkerEarnings(worker, nc, ic, hm, el);
};

// ─── Series temporales por trabajador ────────────────────────────────────────
// Extrae YYYY-MM-DD desde un timestamp soportando tanto "YYYY-MM-DD HH:mm" como "YYYY-MM-DDTHH:mm"
const extractDate = (raw: string): string | null => {
  if (!raw) return null;
  const part = String(raw).split('T')[0].split(' ')[0];
  return /^\d{4}-\d{2}-\d{2}$/.test(part) ? part : null;
};

export type WorkerMetric = 'ingresos' | 'limpiezas' | 'km' | 'duracion' | 'eficiencia';

export interface WorkerSeriesPoint {
  label: string;
  valor: number;
  dateIso: string;
}

export interface WorkerSeriesOptions {
  period: 'semanal' | 'mensual' | 'trimestral' | 'personalizado';
  metric: WorkerMetric;
  desde?: string;
  hasta?: string;
  referenceDate?: Date; // default: hoy
}

// Construye la ventana temporal (misma lógica que aggregateDailyData)
const buildWindow = (period: WorkerSeriesOptions['period'], desde?: string, hasta?: string, referenceDate?: Date) => {
  const today = referenceDate ? new Date(referenceDate) : new Date();
  today.setHours(0, 0, 0, 0);
  let iterations = 30;
  let step = 1;
  let endDate = today;

  if (period === 'semanal') { iterations = 7; step = 1; }
  else if (period === 'mensual') { iterations = 30; step = 1; }
  else if (period === 'trimestral') { iterations = 12; step = 7; }
  else if (period === 'personalizado' && desde && hasta) {
    const start = new Date(desde);
    const end = new Date(hasta);
    endDate = end;
    iterations = Math.min(Math.round((end.getTime() - start.getTime()) / 86400000) + 1, 90);
  }

  const slots: { iso: string; label: string }[] = [];
  for (let i = iterations - 1; i >= 0; i--) {
    const d = new Date(endDate);
    d.setDate(endDate.getDate() - i * step);
    const iso = d.toISOString().split('T')[0];
    const label = d.toLocaleString('es-ES', { day: 'numeric', month: 'short' });
    slots.push({ iso, label });
  }
  return { slots, step };
};

// Devuelve todos los ISOs cubiertos por un bucket (relevante para periodo trimestral con step>1)
const bucketRange = (slotIso: string, step: number): string[] => {
  if (step <= 1) return [slotIso];
  const out: string[] = [];
  const base = new Date(slotIso);
  for (let i = 0; i < step; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() - i);
    out.push(d.toISOString().split('T')[0]);
  }
  return out;
};

// Agrega los datos diarios del trabajador: ingresos, limpiezas, km, duración (min), eficiencia (%)
interface DailyBag { ingresos: number; limpiezas: number; km: number; durTotal: number; durCount: number; checkedCount: number; totalRegs: number; }

const aggregateWorkerDaily = (
  worker: Worker,
  normalCleans: NormalCleanRecord[],
  initialCleans: InitialCleanRecord[],
  handymanRecords: HandymanRecord[]
): Record<string, DailyBag> => {
  const pagoPorReserva = worker.pagoPorReserva ?? 0;
  const precioPorKm = worker.precioPorKm ?? 0;
  const targetPhone = cleanPhone(worker.telefono);
  const bags: Record<string, DailyBag> = {};

  const ensure = (iso: string): DailyBag => {
    if (!bags[iso]) bags[iso] = { ingresos: 0, limpiezas: 0, km: 0, durTotal: 0, durCount: 0, checkedCount: 0, totalRegs: 0 };
    return bags[iso];
  };

  const handleClean = (r: NormalCleanRecord | InitialCleanRecord) => {
    if (!targetPhone || cleanPhone(r.telefono) !== targetPhone) return;
    const iso = extractDate(r.checkinFecha);
    if (!iso) return;
    const bag = ensure(iso);
    const pay = computeCleanPay(r.apartamento, r.horaEntrada, r.horaSalida, pagoPorReserva);
    bag.ingresos += pay.base + pay.extraPay + (r.km || 0) * precioPorKm;
    bag.limpiezas += 1;
    bag.km += r.km || 0;
    const minutes = pay.hoursWorked * 60;
    if (minutes > 0) { bag.durTotal += minutes; bag.durCount += 1; }
    bag.totalRegs += 1;
    if ((r as any).checked) bag.checkedCount += 1;
  };

  normalCleans.forEach(handleClean);
  initialCleans.forEach(handleClean);

  handymanRecords.forEach(r => {
    if (!targetPhone || cleanPhone(r.telefono) !== targetPhone) return;
    const iso = extractDate(r.fechaLlegada);
    if (!iso) return;
    const bag = ensure(iso);
    const km = r.cantidadMinutos || 0; // nota: el parser guarda Km aquí
    bag.ingresos += km * precioPorKm;
    bag.km += km;
    const mins = computeHoursWorked(r.horaInicioTarea, r.horaFinTarea) * 60;
    if (mins > 0) { bag.durTotal += mins; bag.durCount += 1; }
    bag.totalRegs += 1;
    if (String(r.estadoCompletado).toLowerCase().includes('complet')) bag.checkedCount += 1;
  });

  return bags;
};

export const computeWorkerSeries = (
  worker: Worker,
  normalCleans: NormalCleanRecord[],
  initialCleans: InitialCleanRecord[],
  handymanRecords: HandymanRecord[],
  options: WorkerSeriesOptions
): WorkerSeriesPoint[] => {
  const { period, metric, desde, hasta, referenceDate } = options;
  const { slots, step } = buildWindow(period, desde, hasta, referenceDate);
  const bags = aggregateWorkerDaily(worker, normalCleans, initialCleans, handymanRecords);

  return slots.map(({ iso, label }) => {
    const isos = bucketRange(iso, step);
    let ingresos = 0, limpiezas = 0, km = 0, durTotal = 0, durCount = 0, checkedCount = 0, totalRegs = 0;
    for (const d of isos) {
      const bag = bags[d];
      if (!bag) continue;
      ingresos += bag.ingresos;
      limpiezas += bag.limpiezas;
      km += bag.km;
      durTotal += bag.durTotal;
      durCount += bag.durCount;
      checkedCount += bag.checkedCount;
      totalRegs += bag.totalRegs;
    }
    let valor = 0;
    if (metric === 'ingresos') valor = Math.round(ingresos);
    else if (metric === 'limpiezas') valor = limpiezas;
    else if (metric === 'km') valor = Math.round(km);
    else if (metric === 'duracion') valor = durCount > 0 ? Math.round(durTotal / durCount) : 0;
    else if (metric === 'eficiencia') valor = totalRegs > 0 ? Math.round((checkedCount / totalRegs) * 100) : 0;
    return { label, valor, dateIso: iso };
  });
};
