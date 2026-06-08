// Cálculo de nóminas mensuales a partir de los datos de Supabase
// (service_reports, key_deliveries, incident_reports).
//
// Sustituye al anterior cálculo basado en Apps Script (utils/payments.ts +
// utils/paymentItems.ts) específicamente para la pantalla Pagos.tsx.

import type {
  ServiceReportDB,
  KeyDeliveryDB,
  IncidentReportDB,
  WorkerPayments,
} from '../services/supabaseOperationsApi';

export const EXTRA_HOUR_RATE = 10; // €/h fijos para horas extra y manitas

// Extrae YYYY-MM de un ISO o timestamp string.
export const yearMonthOf = (iso: string | null | undefined): string | null => {
  if (!iso) return null;
  // Supabase devuelve "YYYY-MM-DD HH:MM:SS" o "YYYY-MM-DDTHH:MM:SS"
  const m = String(iso).match(/^(\d{4})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}` : null;
};

// Convierte "HH:MM" a horas decimales. Devuelve 0 si vacío o inválido.
export const hhmmToHours = (val: string | null | undefined): number => {
  if (!val) return 0;
  const m = String(val).match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return 0;
  return parseInt(m[1], 10) + parseInt(m[2], 10) / 60;
};

// Diferencia en horas entre dos "HH:MM". Si salida < entrada, asume cruce de medianoche.
export const hoursBetween = (entrada: string | null, salida: string | null): number => {
  if (!entrada || !salida) return 0;
  const a = hhmmToHours(entrada);
  const b = hhmmToHours(salida);
  if (a === 0 || b === 0) return 0;
  let diff = b - a;
  if (diff < 0) diff += 24;
  return diff;
};

// ── Resumen mensual por trabajador ─────────────────────────────────
export interface MonthlySummary {
  workerId: string;
  worker: WorkerPayments;
  // Cantidades
  numReservations: number;
  numKilometers: number;
  reservaHours: number;
  extraHours: number;       // horas_extra de los servicios reserva
  manitasHours: number;
  numIncidents: number;
  numLinenServices: number;
  // Importes
  montoReservas: number;
  montoExtras: number;
  montoManitas: number;
  montoKm: number;
  montoIncidencias: number;
  montoSabanas: number;
  efectivoRetenidoMes: number;
  total: number;
}

// Detalle granular para el desglose expandible del modal.
export interface DesgloseFila {
  id: string;
  date: string;       // YYYY-MM-DD
  concept: string;
  sub?: string;
  monto: number;
}

export interface DesgloseDetalle {
  reservas: DesgloseFila[];
  extras: DesgloseFila[];
  manitas: DesgloseFila[];
  km: DesgloseFila[];
  sabanas: DesgloseFila[];
  incidencias: DesgloseFila[];
}

const toShortDate = (iso: string): string => (iso || '').slice(0, 10);

// Filtra registros del mes seleccionado por la columna created_at.
const ofMonth = <T extends { created_at: string }>(rows: T[], ym: string): T[] =>
  rows.filter(r => yearMonthOf(r.created_at) === ym);

// Cuenta sábanas/toallas entregadas en una key_delivery (si entregadas, 1 servicio).
const linenServicesCount = (kd: KeyDeliveryDB): number => kd.sabanas_entregadas ? 1 : 0;

// Suma fianzas cobradas en efectivo (monto + garantía) de una entrega.
const cashRetained = (kd: KeyDeliveryDB): number => {
  let s = 0;
  if (kd.fianza_monto_metodo === 'Efectivo') s += Number(kd.cantidad_pagada_monto) || 0;
  if (kd.fianza_garantia_metodo === 'Efectivo') s += Number(kd.cantidad_pagada_garantia) || 0;
  return s;
};

export const computeMonthlySummaries = (
  workers: WorkerPayments[],
  services: ServiceReportDB[],
  keyDeliveries: KeyDeliveryDB[],
  incidents: IncidentReportDB[],
  ym: string,
): MonthlySummary[] => {
  const srvM = ofMonth(services, ym);
  const kdM  = ofMonth(keyDeliveries, ym);
  const incM = ofMonth(incidents, ym);

  return workers.map(w => {
    const wSrv = srvM.filter(s => s.worker_id === w.id);
    const wKd  = kdM.filter(k => k.worker_id === w.id);
    const wInc = incM.filter(i => i.worker_id === w.id);

    const reservas = wSrv.filter(s => s.kind === 'reserva');
    const manitas  = wSrv.filter(s => s.kind === 'manitas');

    const numReservations = reservas.length;
    const numKilometers   = wSrv.reduce((s, r) => s + (Number(r.km) || 0), 0);
    const reservaHours    = reservas.reduce((s, r) => s + hoursBetween(r.hora_entrada, r.hora_salida), 0);
    const extraHours      = reservas.reduce((s, r) => s + hhmmToHours(r.horas_extra), 0);
    const manitasHours    = manitas.reduce((s, r) => s + hoursBetween(r.hora_entrada, r.hora_salida), 0);
    const numIncidents    = wInc.length;
    const numLinenServices = wKd.reduce((s, k) => s + linenServicesCount(k), 0);
    const efectivoRetenidoMes = wKd.reduce((s, k) => s + cashRetained(k), 0);

    const montoReservas    = numReservations * w.pay_per_reservation;
    const montoExtras      = extraHours * EXTRA_HOUR_RATE;
    const montoManitas     = manitasHours * EXTRA_HOUR_RATE;
    const montoKm          = numKilometers * w.price_per_km;
    const montoIncidencias = numIncidents * w.pay_per_incident;
    const montoSabanas     = numLinenServices * w.pay_per_linen_service;

    const total = montoReservas + montoExtras + montoManitas + montoKm + montoIncidencias + montoSabanas;

    return {
      workerId: w.id,
      worker: w,
      numReservations,
      numKilometers: Math.round(numKilometers * 100) / 100,
      reservaHours: Math.round(reservaHours * 100) / 100,
      extraHours: Math.round(extraHours * 100) / 100,
      manitasHours: Math.round(manitasHours * 100) / 100,
      numIncidents,
      numLinenServices,
      montoReservas: Math.round(montoReservas * 100) / 100,
      montoExtras: Math.round(montoExtras * 100) / 100,
      montoManitas: Math.round(montoManitas * 100) / 100,
      montoKm: Math.round(montoKm * 100) / 100,
      montoIncidencias: Math.round(montoIncidencias * 100) / 100,
      montoSabanas: Math.round(montoSabanas * 100) / 100,
      efectivoRetenidoMes: Math.round(efectivoRetenidoMes * 100) / 100,
      total: Math.round(total * 100) / 100,
    };
  });
};

// Desglose por trabajador (filas individuales) para el modal de detalle.
export const computeDesglose = (
  worker: WorkerPayments,
  services: ServiceReportDB[],
  keyDeliveries: KeyDeliveryDB[],
  incidents: IncidentReportDB[],
  ym: string,
): DesgloseDetalle => {
  const srvM = ofMonth(services, ym).filter(s => s.worker_id === worker.id);
  const kdM  = ofMonth(keyDeliveries, ym).filter(k => k.worker_id === worker.id);
  const incM = ofMonth(incidents, ym).filter(i => i.worker_id === worker.id);

  const reservas: DesgloseFila[] = srvM
    .filter(s => s.kind === 'reserva')
    .map(s => ({
      id: s.id,
      date: toShortDate(s.created_at),
      concept: s.accommodation_name || 'Reserva',
      monto: worker.pay_per_reservation,
    }));

  const extras: DesgloseFila[] = srvM
    .filter(s => s.kind === 'reserva' && hhmmToHours(s.horas_extra) > 0)
    .map(s => {
      const h = hhmmToHours(s.horas_extra);
      return {
        id: `${s.id}-extra`,
        date: toShortDate(s.created_at),
        concept: s.accommodation_name || 'Reserva',
        sub: `${h.toFixed(1)} h × ${EXTRA_HOUR_RATE}€`,
        monto: Math.round(h * EXTRA_HOUR_RATE * 100) / 100,
      };
    });

  const manitas: DesgloseFila[] = srvM
    .filter(s => s.kind === 'manitas')
    .map(s => {
      const h = hoursBetween(s.hora_entrada, s.hora_salida);
      return {
        id: `${s.id}-mn`,
        date: toShortDate(s.created_at),
        concept: s.accommodation_name || 'Manitas',
        sub: `${h.toFixed(1)} h × ${EXTRA_HOUR_RATE}€`,
        monto: Math.round(h * EXTRA_HOUR_RATE * 100) / 100,
      };
    });

  const km: DesgloseFila[] = srvM
    .filter(s => (Number(s.km) || 0) > 0)
    .map(s => {
      const k = Number(s.km) || 0;
      return {
        id: `${s.id}-km`,
        date: toShortDate(s.created_at),
        concept: s.accommodation_name || (s.kind === 'manitas' ? 'Manitas' : 'Reserva'),
        sub: `${k.toFixed(1)} km × ${worker.price_per_km}€`,
        monto: Math.round(k * worker.price_per_km * 100) / 100,
      };
    });

  const sabanas: DesgloseFila[] = kdM
    .filter(k => k.sabanas_entregadas)
    .map(k => ({
      id: `${k.id}-sab`,
      date: toShortDate(k.created_at),
      concept: k.accommodation_name || 'Entrega',
      sub: `${k.sabanas_personas ?? 0} pers.`,
      monto: worker.pay_per_linen_service,
    }));

  const incidencias: DesgloseFila[] = incM.map(i => ({
    id: i.id,
    date: toShortDate(i.created_at),
    concept: i.accommodation_name || 'Incidencia',
    sub: i.duracion || undefined,
    monto: worker.pay_per_incident,
  }));

  return { reservas, extras, manitas, km, sabanas, incidencias };
};
