import { useEffect, useState } from 'react';
import type { User } from '../services/mockData';
import {
  getMyWorker,
  listMyServiceReports,
  listMyKeyDeliveries,
  listMyIncidentReports,
} from '../services/reportsApi';
import { computeCleanPay, computeHoursPay } from '../utils/payments';

export interface WorkerMonthStats {
  totalOwed: number;
  cleanCount: number;
  hoursWorked: number;
  kms: number;
}

export interface RecentJob {
  id: string;
  type: 'Limpieza' | 'Manitas';
  name: string;
  date: Date;
  pay: number;     // € generados por este trabajo (base + extras + km)
  hours: number;   // horas trabajadas
  km: number;      // km recorridos
}

// service_reports.created_at viene como timestamp local Madrid (sin tz).
const parseSupabaseDate = (raw?: string | null): Date | null => {
  if (!raw) return null;
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
};

const isSameMonth = (d: Date, now: Date) =>
  d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();

// Devuelve resumen del mes en curso + últimos trabajos del trabajador autenticado.
// stats === null cuando no hay worker asociado a la cuenta.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const useWorkerMonthStats = (_user: User) => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<WorkerMonthStats | null>(null);
  const [recentJobs, setRecentJobs] = useState<RecentJob[]>([]);
  const [totalJobs, setTotalJobs] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [me, services, keys, incidents] = await Promise.all([
          getMyWorker(),
          listMyServiceReports(),
          listMyKeyDeliveries(),
          listMyIncidentReports(),
        ]);

        if (!me) {
          if (!cancelled) { setStats(null); setRecentJobs([]); setTotalJobs(0); setLoading(false); }
          return;
        }

        const now = new Date();

        // Stats del mes en curso (greeting).
        let totalOwed = 0;
        let cleanCount = 0;
        let hoursWorked = 0;
        let kms = 0;

        services.forEach(s => {
          const d = parseSupabaseDate(s.createdAt);
          if (!d || !isSameMonth(d, now)) return;
          cleanCount += 1;
          if (s.kind === 'reserva') {
            const calc = computeCleanPay(
              s.accommodationName,
              s.horaEntrada || '',
              s.horaSalida || '',
              me.pagoPorReserva
            );
            totalOwed += calc.base + calc.extraPay + s.km * me.precioPorKm;
            hoursWorked += calc.hoursWorked;
          } else {
            const hp = computeHoursPay(s.horaEntrada || '', s.horaSalida || '');
            totalOwed += hp.pay + s.km * me.precioPorKm;
            hoursWorked += hp.hours;
          }
          kms += s.km;
        });

        incidents.forEach(i => {
          const d = parseSupabaseDate(i.createdAt);
          if (!d || !isSameMonth(d, now)) return;
          totalOwed += me.pagoPorIncidencia;
          // duracion HH:MM → horas
          const m = i.duracion.match(/^(\d{1,2}):(\d{2})$/);
          if (m) hoursWorked += Number(m[1]) + Number(m[2]) / 60;
        });

        keys.forEach(k => {
          const d = parseSupabaseDate(k.createdAt);
          if (!d || !isSameMonth(d, now)) return;
          if (k.sabanasEntregadas) {
            totalOwed += me.pagoPorServicioSabanas * (k.sabanasPersonas ?? 0);
          }
          totalOwed += k.km * me.precioPorKm;
          kms += k.km;
        });

        // Últimos trabajos: sólo service_reports (limpieza + manitas).
        const jobs: RecentJob[] = services
          .map((s): RecentJob | null => {
            const d = parseSupabaseDate(s.createdAt);
            if (!d) return null;
            if (s.kind === 'reserva') {
              const calc = computeCleanPay(
                s.accommodationName,
                s.horaEntrada || '',
                s.horaSalida || '',
                me.pagoPorReserva
              );
              return {
                id: s.id,
                type: 'Limpieza',
                name: s.accommodationName,
                date: d,
                pay: calc.base + calc.extraPay + s.km * me.precioPorKm,
                hours: calc.hoursWorked,
                km: s.km,
              };
            }
            const hp = computeHoursPay(s.horaEntrada || '', s.horaSalida || '');
            return {
              id: s.id,
              type: 'Manitas',
              name: s.accommodationName,
              date: d,
              pay: hp.pay + s.km * me.precioPorKm,
              hours: hp.hours,
              km: s.km,
            };
          })
          .filter((j): j is RecentJob => j !== null)
          .sort((a, b) => b.date.getTime() - a.date.getTime());

        if (!cancelled) {
          setStats({
            totalOwed: Math.round(totalOwed * 100) / 100,
            cleanCount,
            hoursWorked: Math.round(hoursWorked * 100) / 100,
            kms: Math.round(kms * 100) / 100,
          });
          setRecentJobs(jobs.slice(0, 3));
          setTotalJobs(jobs.length);
          setLoading(false);
        }
      } catch {
        if (!cancelled) { setStats(null); setRecentJobs([]); setTotalJobs(0); setLoading(false); }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return { loading, stats, recentJobs, totalJobs };
};
