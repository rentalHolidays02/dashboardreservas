import {
  Worker, NormalCleanRecord, InitialCleanRecord, HandymanRecord,
  EntregaLlaves, Incidencia
} from '../services/mockData';
import { computeCleanPay, cleanPhone } from './payments';

export type ItemType = 'reserva' | 'entrega' | 'incidencia';

export interface PayableItem {
  key: string;
  sourceId: string;
  type: ItemType;
  workerId: string;
  workerName: string;
  date: string;        // YYYY-MM-DD
  yearMonth: string;   // YYYY-MM
  apartamento: string;
  monto: number;
  subtitle?: string;
}

const ymdOf = (raw: string): string => {
  if (!raw) return '';
  const p = String(raw).split('T')[0].split(' ')[0];
  return /^\d{4}-\d{2}-\d{2}$/.test(p) ? p : '';
};

const ym = (d: string) => d.slice(0, 7);

const subtitleClean = (base: number, extra: number, km: number): string => {
  const parts: string[] = [];
  if (base > 0) parts.push(`${base.toFixed(2)}€ base`);
  if (extra > 0) parts.push(`${extra.toFixed(2)}€ extras`);
  if (km > 0) parts.push(`${km.toFixed(2)}€ km`);
  return parts.join(' + ');
};

export const buildPayableItems = (
  workers: Worker[],
  normalCleans: NormalCleanRecord[],
  initialCleans: InitialCleanRecord[],
  handymanRecords: HandymanRecord[],
  entregaLlaves: EntregaLlaves[],
  incidencias: Incidencia[],
): PayableItem[] => {
  const out: PayableItem[] = [];

  for (const w of workers) {
    const phone = cleanPhone(w.telefono);
    if (!phone) continue;
    const pagoR    = w.pagoPorReserva ?? 0;
    const precioKm = w.precioPorKm ?? 0;
    const pagoSab  = w.pagoPorServicioSabanas ?? 0;
    const pagoInc  = w.pagoPorIncidencia ?? 0;

    for (const r of normalCleans) {
      if (cleanPhone(r.telefono) !== phone) continue;
      const date = ymdOf(r.checkinFecha);
      if (!date) continue;
      const calc = computeCleanPay(r.apartamento, r.horaEntrada, r.horaSalida, pagoR);
      const kmPay = (r.km || 0) * precioKm;
      const monto = calc.base + calc.extraPay + kmPay;
      if (monto <= 0) continue;
      out.push({
        key: `nc:${r.id}`,
        sourceId: r.id,
        type: 'reserva',
        workerId: w.id,
        workerName: w.fullName,
        date,
        yearMonth: ym(date),
        apartamento: r.apartamento || '—',
        monto: Math.round(monto * 100) / 100,
        subtitle: subtitleClean(calc.base, calc.extraPay, kmPay),
      });
    }

    for (const r of initialCleans) {
      if (cleanPhone(r.telefono) !== phone) continue;
      const date = ymdOf(r.checkinFecha);
      if (!date) continue;
      const calc = computeCleanPay(r.apartamento, r.horaEntrada, r.horaSalida, pagoR);
      const kmPay = (r.km || 0) * precioKm;
      const monto = calc.base + calc.extraPay + kmPay;
      if (monto <= 0) continue;
      out.push({
        key: `ic:${r.id}`,
        sourceId: r.id,
        type: 'reserva',
        workerId: w.id,
        workerName: w.fullName,
        date,
        yearMonth: ym(date),
        apartamento: `${r.apartamento || '—'} · inicial`,
        monto: Math.round(monto * 100) / 100,
        subtitle: subtitleClean(calc.base, calc.extraPay, kmPay),
      });
    }

    for (const r of handymanRecords) {
      if (cleanPhone(r.telefono) !== phone) continue;
      const date = ymdOf(r.fechaLlegada);
      if (!date) continue;
      const km = r.cantidadMinutos || 0;
      const kmPay = km * precioKm;
      if (kmPay <= 0) continue;
      out.push({
        key: `hm:${r.id}`,
        sourceId: r.id,
        type: 'reserva',
        workerId: w.id,
        workerName: w.fullName,
        date,
        yearMonth: ym(date),
        apartamento: `${r.alojamiento || '—'} · manitas`,
        monto: Math.round(kmPay * 100) / 100,
        subtitle: `${km.toFixed(1)} km`,
      });
    }

    for (const e of entregaLlaves) {
      if (cleanPhone(e.telefono) !== phone) continue;
      const v = String(e.sabanasToallas || '').toLowerCase();
      if (!(v.includes('si') || v.includes('sí') || v === 'true')) continue;
      if (pagoSab <= 0) continue;
      const date = ymdOf(e.fechaUbicacionEntrega || '');
      if (!date) continue;
      out.push({
        key: `el:${e.id}`,
        sourceId: e.id,
        type: 'entrega',
        workerId: w.id,
        workerName: w.fullName,
        date,
        yearMonth: ym(date),
        apartamento: e.apartamento || '—',
        monto: pagoSab,
        subtitle: 'sábanas/toallas',
      });
    }

    for (const i of incidencias) {
      if (cleanPhone(i.telefono) !== phone) continue;
      if (pagoInc <= 0) continue;
      const date = ymdOf(i.timestamp);
      if (!date) continue;
      out.push({
        key: `in:${i.id}`,
        sourceId: i.id,
        type: 'incidencia',
        workerId: w.id,
        workerName: w.fullName,
        date,
        yearMonth: ym(date),
        apartamento: i.accommodationName || (i.description || '').slice(0, 40) || '—',
        monto: pagoInc,
        subtitle: (i.description || '').slice(0, 60) || undefined,
      });
    }
  }

  out.sort((a, b) => b.date.localeCompare(a.date));
  return out;
};

export const ymOfCurrentMonth = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

export const ymOfLastMonth = (): string => {
  const d = new Date(); d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

export const ymLabel = (ym: string): string => {
  if (!/^\d{4}-\d{2}$/.test(ym)) return ym;
  const d = new Date(`${ym}-01T00:00:00`);
  return d.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
};
