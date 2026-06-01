import {
  Worker, NormalCleanRecord, InitialCleanRecord, HandymanRecord,
  EntregaLlaves, Incidencia
} from '../services/mockData';
import { computeCleanPay, computeHoursPay, cleanPhone, HOURLY_RATE } from './payments';

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
  // Quita sufijo de ubicación "… | lat, lng" si existe.
  const head = String(raw).split('|')[0].trim();
  // ISO: "YYYY-MM-DD" o "YYYY-MM-DDTHH:MM"
  if (/^\d{4}-\d{2}-\d{2}/.test(head)) return head.slice(0, 10);
  // Locale es-ES: "D/M/YYYY" o "DD/MM/YYYY"
  const m = head.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return '';
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
      const hp = computeHoursPay(r.horaEntrada, r.horaSalida);
      const kmPay = (r.km || 0) * precioKm;
      const monto = hp.pay + kmPay;
      if (monto <= 0) continue;
      const subParts: string[] = [];
      if (hp.pay > 0) subParts.push(`${hp.hours.toFixed(1)} h × ${HOURLY_RATE}€ = ${hp.pay.toFixed(2)}€`);
      if (kmPay > 0) subParts.push(`${(r.km || 0).toFixed(2)}€ km`);
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
        subtitle: subParts.join(' + '),
      });
    }

    for (const r of handymanRecords) {
      if (cleanPhone(r.telefono) !== phone) continue;
      const date = ymdOf(r.fechaLlegada);
      if (!date) continue;
      const km = r.cantidadMinutos || 0;
      const hp = computeHoursPay(r.horaInicioTarea, r.horaFinTarea);
      const kmPay = km * precioKm;
      const monto = hp.pay + kmPay;
      if (monto <= 0) continue;
      const subParts: string[] = [];
      if (hp.pay > 0) subParts.push(`${hp.hours.toFixed(1)} h × ${HOURLY_RATE}€`);
      if (km > 0)    subParts.push(`${km.toFixed(1)} km`);
      out.push({
        key: `hm:${r.id}`,
        sourceId: r.id,
        type: 'reserva',
        workerId: w.id,
        workerName: w.fullName,
        date,
        yearMonth: ym(date),
        apartamento: `${r.alojamiento || '—'} · manitas`,
        monto: Math.round(monto * 100) / 100,
        subtitle: subParts.join(' + '),
      });
    }

    for (const e of entregaLlaves) {
      if (cleanPhone(e.telefono) !== phone) continue;
      const v = String(e.sabanasToallas || '').toLowerCase();
      // EntregaDeLlaves guarda "Sí, entregadas" cuando se han entregado.
      // Aceptamos también legacy "Sí"/"Si"/"true" y cualquier variante con "entregad".
      if (!(v.includes('entregad') || v.includes('sí') || v.includes('si') || v === 'true')) continue;
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

// ─── Desglose económico detallado por trabajador ───────────────────────
// Para el modal de Pagos: cada línea (Reservas/Extras/Km/Sábanas/Incidencias)
// se puede desplegar y mostrar los registros que la componen.

export interface DesgloseFila {
  id: string;
  date: string;       // YYYY-MM-DD
  concept: string;    // apartamento o descripción
  sub?: string;       // detalle extra (horas, km, etc)
  monto: number;
}

export interface DesgloseDetalle {
  reservas:            DesgloseFila[];
  extras:              DesgloseFila[];
  horasInicialManitas: DesgloseFila[];
  km:                  DesgloseFila[];
  sabanas:             DesgloseFila[];
  incidencias:         DesgloseFila[];
}

export const buildDesgloseDetalle = (
  worker: Worker,
  normalCleans: NormalCleanRecord[],
  initialCleans: InitialCleanRecord[],
  handymanRecords: HandymanRecord[],
  entregaLlaves: EntregaLlaves[],
  incidencias: Incidencia[],
): DesgloseDetalle => {
  const phone = cleanPhone(worker.telefono);
  const out: DesgloseDetalle = { reservas: [], extras: [], horasInicialManitas: [], km: [], sabanas: [], incidencias: [] };
  if (!phone) return out;

  const pagoR    = worker.pagoPorReserva ?? 0;
  const precioKm = worker.precioPorKm ?? 0;
  const pagoSab  = worker.pagoPorServicioSabanas ?? 0;
  const pagoInc  = worker.pagoPorIncidencia ?? 0;

  // Reservas normales: base + extras + km
  for (const r of normalCleans) {
    if (cleanPhone(r.telefono) !== phone) continue;
    const date = ymdOf(r.checkinFecha);
    if (!date) continue;
    const calc = computeCleanPay(r.apartamento, r.horaEntrada, r.horaSalida, pagoR);
    const aptName = r.apartamento || '—';
    if (calc.base > 0) {
      out.reservas.push({ id: `nc:${r.id}`, date, concept: aptName, monto: calc.base });
    }
    if (calc.extraHours > 0) {
      out.extras.push({
        id: `ex:${r.id}`, date, concept: aptName,
        sub: `${calc.hoursWorked.toFixed(1)} h trabajadas · ${calc.extraHours.toFixed(1)} h extra`,
        monto: calc.extraPay,
      });
    }
    if ((r.km || 0) > 0 && precioKm > 0) {
      out.km.push({
        id: `km:${r.id}`, date, concept: aptName,
        sub: `${r.km.toFixed(1)} km × ${precioKm.toFixed(2)}€`,
        monto: (r.km || 0) * precioKm,
      });
    }
  }

  // Limpieza inicial: TODAS las horas × 10 (no base, no extras separados) + km
  for (const r of initialCleans) {
    if (cleanPhone(r.telefono) !== phone) continue;
    const date = ymdOf(r.checkinFecha);
    if (!date) continue;
    const hp = computeHoursPay(r.horaEntrada, r.horaSalida);
    const aptName = `${r.apartamento || '—'} · inicial`;
    if (hp.pay > 0) {
      out.horasInicialManitas.push({
        id: `ih:${r.id}`, date, concept: aptName,
        sub: `${hp.hours.toFixed(1)} h × ${HOURLY_RATE}€`,
        monto: hp.pay,
      });
    }
    if ((r.km || 0) > 0 && precioKm > 0) {
      out.km.push({
        id: `ikm:${r.id}`, date, concept: aptName,
        sub: `${r.km.toFixed(1)} km × ${precioKm.toFixed(2)}€`,
        monto: (r.km || 0) * precioKm,
      });
    }
  }

  // Manitas: horas × 10 + km
  for (const r of handymanRecords) {
    if (cleanPhone(r.telefono) !== phone) continue;
    const date = ymdOf(r.fechaLlegada);
    if (!date) continue;
    const aptName = `${r.alojamiento || '—'} · manitas`;
    const hp = computeHoursPay(r.horaInicioTarea, r.horaFinTarea);
    if (hp.pay > 0) {
      out.horasInicialManitas.push({
        id: `mh:${r.id}`, date, concept: aptName,
        sub: `${hp.hours.toFixed(1)} h × ${HOURLY_RATE}€`,
        monto: hp.pay,
      });
    }
    const km = r.cantidadMinutos || 0;
    if (km > 0 && precioKm > 0) {
      out.km.push({
        id: `mkm:${r.id}`, date, concept: aptName,
        sub: `${km.toFixed(1)} km × ${precioKm.toFixed(2)}€`,
        monto: km * precioKm,
      });
    }
  }

  for (const e of entregaLlaves) {
    if (cleanPhone(e.telefono) !== phone) continue;
    const v = String(e.sabanasToallas || '').toLowerCase();
    if (!(v.includes('si') || v.includes('sí') || v === 'true')) continue;
    if (pagoSab <= 0) continue;
    const date = ymdOf(e.fechaUbicacionEntrega || '');
    if (!date) continue;
    out.sabanas.push({
      id: `el:${e.id}`, date, concept: e.apartamento || '—',
      sub: 'sábanas/toallas',
      monto: pagoSab,
    });
  }

  for (const i of incidencias) {
    if (cleanPhone(i.telefono) !== phone) continue;
    if (pagoInc <= 0) continue;
    const date = ymdOf(i.timestamp);
    if (!date) continue;
    out.incidencias.push({
      id: `in:${i.id}`, date,
      concept: i.accommodationName || (i.description || '—').slice(0, 40),
      sub: (i.description || '').slice(0, 60) || undefined,
      monto: pagoInc,
    });
  }

  const sortByDateDesc = (a: DesgloseFila, b: DesgloseFila) => b.date.localeCompare(a.date);
  out.reservas.sort(sortByDateDesc);
  out.extras.sort(sortByDateDesc);
  out.horasInicialManitas.sort(sortByDateDesc);
  out.km.sort(sortByDateDesc);
  out.sabanas.sort(sortByDateDesc);
  out.incidencias.sort(sortByDateDesc);
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
