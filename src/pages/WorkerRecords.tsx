import React, { useCallback, useEffect, useState, useMemo } from 'react';
import type { User } from '../services/mockData';
import {
  getMyWorker,
  listMyServiceReports,
  listMyKeyDeliveries,
  listMyIncidentReports,
} from '../services/reportsApi';
import { computeHoursPay } from '../utils/payments';
import { hhmmToHours, hoursBetween, EXTRA_HOUR_RATE, isExtraReservationAccommodation } from '../utils/paymentsSupabase';
import { Search, ChevronDown, X } from 'lucide-react';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import PullToRefreshIndicator from '../components/workers/PullToRefreshIndicator';
import { formatName } from '../utils/formatters';
import { useAnimatedNumber } from '../hooks/useAnimatedNumber';
import { usePullToRefresh } from '../hooks/usePullToRefresh';

interface WorkerRecordsProps {
  user: User;
}

type DateRangePreset = 'thisMonth' | 'lastMonth' | 'last7' | 'all' | 'custom';

interface DateRangeFilter {
  startDate: string; // YYYY-MM-DD ('' = sin límite)
  endDate: string;
}

const toIso = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const computePresetRange = (preset: DateRangePreset): DateRangeFilter => {
  const now = new Date();
  if (preset === 'thisMonth') {
    const first = new Date(now.getFullYear(), now.getMonth(), 1);
    const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return { startDate: toIso(first), endDate: toIso(last) };
  }
  if (preset === 'lastMonth') {
    const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const last = new Date(now.getFullYear(), now.getMonth(), 0);
    return { startDate: toIso(first), endDate: toIso(last) };
  }
  if (preset === 'last7') {
    const end = new Date(now);
    const start = new Date(now);
    start.setDate(end.getDate() - 6);
    return { startDate: toIso(start), endDate: toIso(end) };
  }
  return { startDate: '', endDate: '' };
};

const presetLabel: Record<DateRangePreset, string> = {
  thisMonth: 'Este mes',
  lastMonth: 'Mes pasado',
  last7: 'Últimos 7 días',
  all: 'Todo',
  custom: 'Personalizado',
};

export type RecordType = 'Normal' | 'Manitas' | 'Incidencia' | 'Llaves';

interface UnifiedRecord {
  id: string;
  type: RecordType;
  date: string;
  accommodation: string;
  kms: number;
  hoursWorked: number;
  earnings: number;
  observations: string;
  horaEntrada?: string;
  horaSalida?: string;
  // Campos extra Incidencias
  description?: string;
  // Campos extra Entrega de Llaves
  nombreCliente?: string;
  fechaEntrada?: string;
  fechaSalida?: string;
}

// duracion "HH:MM" → horas decimales.
const durationToHours = (raw: string): number => {
  const m = raw?.match(/^(\d{1,2}):(\d{2})$/);
  return m ? Number(m[1]) + Number(m[2]) / 60 : 0;
};

const WorkerRecords: React.FC<WorkerRecordsProps> = ({ user }) => {
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<UnifiedRecord[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  // Pills de tipo (sector). Set vacío = mostrar todos.
  const [selectedTypes, setSelectedTypes] = useState<Set<RecordType>>(new Set());

  // Selector de rango de fechas (sustituye al modal de filtros).
  const [preset, setPreset] = useState<DateRangePreset>('thisMonth');
  const [range, setRange] = useState<DateRangeFilter>(() => computePresetRange('thisMonth'));
  const [isRangePickerOpen, setIsRangePickerOpen] = useState(false);
  const [customDraft, setCustomDraft] = useState<DateRangeFilter>(() => computePresetRange('thisMonth'));

  const fetchData = useCallback(async (showSkeleton = false) => {
    if (showSkeleton) setLoading(true);
    try {
      const [me, services, keys, incidents] = await Promise.all([
        getMyWorker(),
        listMyServiceReports(),
        listMyKeyDeliveries(),
        listMyIncidentReports(),
      ]);

      if (!me) {
        setRecords([]);
        return;
      }

        const unified: UnifiedRecord[] = [
          ...services.map((s): UnifiedRecord => {
            if (s.kind === 'reserva') {
              const hoursWorked = hoursBetween(s.horaEntrada || null, s.horaSalida || null);
              const extraHours = hhmmToHours(s.horasExtra);
              const extraReserva = isExtraReservationAccommodation(s.accommodationName)
                ? me.pagoPorReservaAdicional
                : 0;
              const earnings =
                me.pagoPorReserva
                + extraReserva
                + extraHours * EXTRA_HOUR_RATE
                + s.km * me.precioPorKm;
              return {
                id: s.id,
                type: 'Normal',
                date: s.createdAt,
                accommodation: s.accommodationName,
                kms: s.km,
                hoursWorked,
                earnings,
                observations: s.notas,
                horaEntrada: s.horaEntrada || undefined,
                horaSalida: s.horaSalida || undefined,
              };
            }
            const hp = computeHoursPay(s.horaEntrada || '', s.horaSalida || '');
            return {
              id: s.id,
              type: 'Manitas',
              date: s.createdAt,
              accommodation: s.accommodationName,
              kms: s.km,
              hoursWorked: hp.hours,
              earnings: hp.pay + s.km * me.precioPorKm,
              observations: s.notas,
              horaEntrada: s.horaEntrada || undefined,
              horaSalida: s.horaSalida || undefined,
            };
          }),
          ...keys.map((k): UnifiedRecord => ({
            id: k.id,
            type: 'Llaves',
            date: k.createdAt,
            accommodation: k.accommodationName,
            kms: k.km,
            hoursWorked: 0,
            earnings:
              (k.sabanasEntregadas ? me.pagoPorServicioSabanas * (k.sabanasPersonas ?? 0) : 0) +
              k.km * me.precioPorKm,
            observations: k.observaciones,
            nombreCliente: k.nombreCliente,
            fechaEntrada: k.fechaEntradaReserva || undefined,
            fechaSalida: k.fechaSalidaReserva || undefined,
          })),
          ...incidents.map((i): UnifiedRecord => ({
            id: i.id,
            type: 'Incidencia',
            date: i.createdAt,
            accommodation: i.accommodationName,
            kms: 0,
            hoursWorked: durationToHours(i.duracion),
            earnings: me.pagoPorIncidencia,
            observations: '',
            description: i.detalles,
          })),
        ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      setRecords(unified);
    } catch (error) {
      console.error('Error fetching records:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(true);
  }, [fetchData, user]);

  const refreshAll = useCallback(() => fetchData(false), [fetchData]);
  const { rootRef, pullY, refreshing, dragging } = usePullToRefresh(refreshAll);

  // Normaliza la fecha del registro a YYYY-MM-DD (soporta ISO y "D/M/YYYY").
  const toIsoKey = (raw: string): string => {
    if (!raw) return '';
    const head = String(raw).split('|')[0].trim();
    const iso = head.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
    const loc = head.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (loc) return `${loc[3]}-${loc[2].padStart(2, '0')}-${loc[1].padStart(2, '0')}`;
    return '';
  };

  const filteredRecords = useMemo(() => {
    return records.filter(r => {
      const matchesSearch =
        r.accommodation.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.observations.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesType = selectedTypes.size === 0 || selectedTypes.has(r.type);

      let matchesDate = true;
      if (range.startDate || range.endDate) {
        const key = toIsoKey(r.date);
        if (!key) matchesDate = false;
        else {
          if (range.startDate && key < range.startDate) matchesDate = false;
          if (range.endDate && key > range.endDate) matchesDate = false;
        }
      }

      return matchesSearch && matchesType && matchesDate;
    });
  }, [records, range, searchTerm, selectedTypes]);

  const toggleType = (t: RecordType) => {
    setSelectedTypes(prev => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });
  };

  // Aplica preset y cierra el picker.
  const applyPreset = (p: DateRangePreset) => {
    setPreset(p);
    if (p === 'custom') {
      setCustomDraft(range);
      return;
    }
    setRange(computePresetRange(p));
    setIsRangePickerOpen(false);
  };

  const applyCustom = () => {
    if (!customDraft.startDate || !customDraft.endDate) return;
    setRange(customDraft);
    setIsRangePickerOpen(false);
  };

  const rangeLabel = preset === 'custom' && range.startDate && range.endDate
    ? `${range.startDate.slice(8, 10)}/${range.startDate.slice(5, 7)} – ${range.endDate.slice(8, 10)}/${range.endDate.slice(5, 7)}`
    : presetLabel[preset];

  // Totales del resumen
  const totals = useMemo(() => ({
    earnings: filteredRecords.reduce((s, r) => s + r.earnings, 0),
    hours: filteredRecords.reduce((s, r) => s + r.hoursWorked, 0),
    count: filteredRecords.length,
  }), [filteredRecords]);

  const animCount = useAnimatedNumber(totals.count);
  const animHours = useAnimatedNumber(totals.hours);
  const animEarnings = useAnimatedNumber(totals.earnings);

  if (loading) {
    return (
      <div ref={rootRef} className="relative animate-in fade-in duration-500">
        <PullToRefreshIndicator pullY={pullY} refreshing={refreshing} dragging={dragging} />
        <div className="px-6 pt-4 pb-10 space-y-8 lg:px-0 lg:pt-0 lg:pb-0">
          {/* Skeleton selector */}
          <div className="max-w-xl mx-auto lg:mx-0 pt-2">
            <div className="h-9 w-40 rounded-lg bg-stone-200/60 dark:bg-stone-800/40 animate-pulse" />
          </div>
          {/* Skeleton boxes resumen */}
          <div className="max-w-xl mx-auto lg:mx-0 space-y-3">
            <div className="h-3 w-16 rounded bg-stone-200/60 dark:bg-stone-800/40 animate-pulse ml-1" />
            <div className="grid grid-cols-3 gap-2">
              {[0, 1, 2].map(i => (
                <div
                  key={i}
                  className="aspect-square rounded-2xl bg-stone-100/60 dark:bg-stone-800/30 border border-stone-200/50 dark:border-stone-700/40 animate-pulse"
                />
              ))}
            </div>
          </div>
          {/* Skeleton buscador */}
          <div className="max-w-xl mx-auto lg:mx-0">
            <div className="h-11 w-full rounded-xl bg-stone-100/60 dark:bg-stone-800/30 border border-stone-200/50 dark:border-stone-700/40 animate-pulse" />
          </div>
          {/* Skeleton lista */}
          <div className="max-w-xl mx-auto lg:mx-0 space-y-3">
            <div className="h-3 w-20 rounded bg-stone-200/60 dark:bg-stone-800/40 animate-pulse ml-1" />
            <div className="rounded-xl bg-stone-50/60 dark:bg-stone-800/25 border border-stone-200/70 dark:border-stone-700/50 divide-y divide-stone-200/60 dark:divide-stone-700/40">
              {[0, 1, 2, 3].map(i => (
                <div key={i} className="px-4 py-4 flex items-center gap-3">
                  <div className="w-[52px] h-[52px] rounded-lg bg-stone-200/60 dark:bg-stone-800/40 animate-pulse" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3.5 w-2/3 rounded bg-stone-200/60 dark:bg-stone-800/40 animate-pulse" />
                    <div className="h-3 w-1/3 rounded bg-stone-200/50 dark:bg-stone-800/30 animate-pulse" />
                  </div>
                  <div className="h-4 w-14 rounded bg-stone-200/60 dark:bg-stone-800/40 animate-pulse" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Etiqueta visible por tipo (sin badge de color — sintonía con Inicio).
  const typeLabel: Record<RecordType, string> = {
    Normal: 'Limpieza',
    Manitas: 'Manitas',
    Incidencia: 'Incidencia',
    Llaves: 'Entrega de llaves',
  };

  // Marcador-fecha: día y mes corto (mismo formato que "Últimos trabajos" de Inicio).
  const dayNum = (raw: string) => {
    const d = raw ? new Date(raw) : null;
    return d && !isNaN(d.getTime()) ? d.getDate() : '—';
  };
  const monthShort = (raw: string) => {
    const d = raw ? new Date(raw) : null;
    if (!d || isNaN(d.getTime())) return '';
    return d.toLocaleString('es-ES', { month: 'short' }).replace('.', '');
  };
  const fechaLarga = (raw: string) => {
    const d = raw ? new Date(raw) : null;
    return d && !isNaN(d.getTime())
      ? d.toLocaleString('es-ES', { dateStyle: 'long', timeStyle: 'short' })
      : '—';
  };

  const settling = !dragging && !refreshing;

  return (
    <div ref={rootRef} className="relative animate-in fade-in slide-in-from-bottom-4 duration-700">
      <PullToRefreshIndicator pullY={pullY} refreshing={refreshing} dragging={dragging} />
      <div
        style={{
          transform: `translateY(${pullY}px)`,
          transition: settling ? 'transform 360ms cubic-bezier(0.22,1,0.36,1)' : 'none',
        }}
      >
      <div className="px-6 pt-4 pb-10 space-y-8 lg:px-0 lg:pt-0 lg:pb-0">

        {/* ── Selector de rango — tipografía del greeting de Inicio ── */}
        <div className="max-w-xl mx-auto lg:mx-0 pt-2 pr-8">
          <button
            onClick={() => setIsRangePickerOpen(true)}
            className="inline-flex items-center gap-2 text-left text-3xl font-medium tracking-tight leading-snug text-[#bfb9b7] dark:text-stone-500 font-dm active:opacity-70 transition-opacity"
          >
            <span className="text-stone-800 dark:text-stone-200">{rangeLabel}</span>
            <ChevronDown size={22} strokeWidth={2.5} className="text-stone-800 dark:text-stone-200 relative top-[1px]" />
          </button>
        </div>

        {/* ── Resumen — boxes estilo cards de Inicio ── */}
        {filteredRecords.length > 0 && (
          <section className="max-w-xl mx-auto lg:mx-0 space-y-3 font-gsf">
            <h2 className="px-1 text-xs font-medium text-slate-500 dark:text-stone-400">Resumen</h2>
            <div className="grid grid-cols-3 gap-2">
              {[
                {
                  label: 'Servicios',
                  value: animCount.toFixed(0),
                  valueClass: 'text-slate-800 dark:text-stone-100',
                },
                {
                  label: 'Horas',
                  value: `${animHours.toFixed(1).replace('.', ',')}h`,
                  valueClass: 'text-slate-800 dark:text-stone-100',
                },
                {
                  label: 'Ganado',
                  value: `${animEarnings.toFixed(2).replace('.', ',')}€`,
                  valueClass: 'text-emerald-600 dark:text-emerald-400',
                },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="aspect-square rounded-2xl bg-stone-50 dark:bg-stone-800/40 border border-stone-200/70 dark:border-stone-700/50 p-4 flex flex-col justify-between"
                >
                  <span className="text-[11px] font-medium text-slate-500 dark:text-stone-400 font-gsf">
                    {stat.label}
                  </span>
                  <span className={`text-xl font-medium tabular-nums font-dm leading-tight ${stat.valueClass}`}>
                    {stat.value}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Buscador + pills de tipo. Ocultos si no hay nada y no se está buscando. ── */}
        {(records.length > 0 || searchTerm) && (
          <div className="max-w-xl mx-auto lg:mx-0 space-y-3">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-stone-500" />
              <input
                type="search"
                placeholder="Buscar por alojamiento…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-xl bg-stone-50 dark:bg-stone-800/40 border border-stone-200/70 dark:border-stone-700/50 text-sm text-slate-700 dark:text-stone-200 placeholder:text-slate-400 dark:placeholder:text-stone-500 font-gsf focus:outline-none focus:ring-2 focus:ring-orange-500/20"
              />
            </div>
            {/* Pills de sector */}
            <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1">
              {(['Normal', 'Manitas', 'Llaves', 'Incidencia'] as RecordType[]).map((t) => {
                const active = selectedTypes.has(t);
                return (
                  <button
                    key={t}
                    onClick={() => toggleType(t)}
                    className={`shrink-0 px-3.5 py-1.5 rounded-full text-sm font-medium font-gsf border transition-colors active:scale-[0.97] ${
                      active
                        ? 'bg-stone-100 dark:bg-stone-800/60 border-stone-200/70 dark:border-stone-700/50 text-slate-700 dark:text-stone-200'
                        : 'bg-transparent border-stone-200/70 dark:border-stone-700/40 text-slate-500 dark:text-stone-400'
                    }`}
                  >
                    {typeLabel[t]}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Lista de registros ── */}
        <section className="max-w-xl mx-auto lg:mx-0 space-y-3 font-gsf">
          {filteredRecords.length === 0 ? (
            <div className="px-4 py-6 rounded-xl border border-dashed border-stone-200/70 dark:border-stone-700/40 text-center">
              <p className="text-sm text-slate-400 dark:text-stone-500">
                No se encontraron registros.
              </p>
            </div>
          ) : (
            <div className="rounded-xl bg-stone-50/60 dark:bg-stone-800/25 border border-stone-200/70 dark:border-stone-700/50 divide-y divide-stone-200/60 dark:divide-stone-700/40">
              {filteredRecords.map((r) => {
                const isExpanded = expandedId === r.id;
                return (
                  <div key={r.id}>
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : r.id)}
                      className="w-full px-4 py-4 flex items-center gap-3 text-left active:bg-stone-100/40 dark:active:bg-stone-700/20 transition-colors"
                    >
                      {/* Marcador-fecha 52×52 — sin fondo ni borde */}
                      <div className="shrink-0 w-[52px] h-[52px] flex flex-col items-center justify-center">
                        <span className="text-base font-medium text-slate-800 dark:text-stone-100 leading-none tabular-nums">
                          {dayNum(r.date)}
                        </span>
                        <span className="text-[10px] uppercase tracking-wide text-slate-400 dark:text-stone-500 mt-0.5">
                          {monthShort(r.date)}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1 space-y-1">
                        <p className="text-sm font-medium text-slate-800 dark:text-stone-100 truncate">
                          {r.accommodation ? formatName(r.accommodation) : '—'}
                        </p>
                        <p className="text-[11px] text-slate-400 dark:text-stone-500">
                          {typeLabel[r.type]}
                          {r.hoursWorked > 0 ? ` · ${r.hoursWorked.toFixed(1).replace('.', ',')} h` : ''}
                          {r.kms > 0 ? ` · ${r.kms} km` : ''}
                        </p>
                      </div>
                      <span className={`shrink-0 text-sm font-medium tabular-nums ${
                        r.earnings > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-stone-500'
                      }`}>
                        {r.earnings > 0 ? `${r.earnings.toFixed(2).replace('.', ',')} €` : '—'}
                      </span>
                    </button>

                    {/* Expansión: animación nativa via grid-template-rows 0fr→1fr + fade. */}
                    <div
                      className="grid transition-[grid-template-rows,opacity] duration-[400ms] ease-in-out"
                      style={{
                        gridTemplateRows: isExpanded ? '1fr' : '0fr',
                        opacity: isExpanded ? 1 : 0,
                      }}
                    >
                      <div className="overflow-hidden">
                        <div className="px-4 pb-4 -mt-1 space-y-2 font-gsf text-[12px]">
                          <div className="flex items-center justify-between">
                            <span className="text-slate-400 dark:text-stone-500">Fecha</span>
                            <span className="text-slate-700 dark:text-stone-200 text-right">{fechaLarga(r.date)}</span>
                          </div>

                          {(r.type === 'Normal' || r.type === 'Manitas') && r.horaEntrada && r.horaSalida && (
                            <div className="flex items-center justify-between">
                              <span className="text-slate-400 dark:text-stone-500">Horario</span>
                              <span className="text-slate-700 dark:text-stone-200 tabular-nums">{r.horaEntrada} – {r.horaSalida}</span>
                            </div>
                          )}

                          {r.type === 'Incidencia' && (
                            <>
                              {r.hoursWorked > 0 && (
                                <div className="flex items-center justify-between">
                                  <span className="text-slate-400 dark:text-stone-500">Duración</span>
                                  <span className="text-slate-700 dark:text-stone-200 tabular-nums">
                                    {r.hoursWorked.toFixed(1).replace('.', ',')} h
                                  </span>
                                </div>
                              )}
                              {r.description && (
                                <div className="space-y-1">
                                  <span className="text-slate-400 dark:text-stone-500">Descripción</span>
                                  <p className="text-slate-700 dark:text-stone-200 leading-relaxed">{r.description}</p>
                                </div>
                              )}
                            </>
                          )}

                          {r.type === 'Llaves' && (
                            <>
                              {r.nombreCliente && (
                                <div className="flex items-center justify-between">
                                  <span className="text-slate-400 dark:text-stone-500">Cliente</span>
                                  <span className="text-slate-700 dark:text-stone-200">{r.nombreCliente}</span>
                                </div>
                              )}
                              {r.fechaEntrada && (
                                <div className="flex items-center justify-between">
                                  <span className="text-slate-400 dark:text-stone-500">Entrada reserva</span>
                                  <span className="text-slate-700 dark:text-stone-200">
                                    {new Date(r.fechaEntrada).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })}
                                  </span>
                                </div>
                              )}
                              {r.fechaSalida && (
                                <div className="flex items-center justify-between">
                                  <span className="text-slate-400 dark:text-stone-500">Salida reserva</span>
                                  <span className="text-slate-700 dark:text-stone-200">
                                    {new Date(r.fechaSalida).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })}
                                  </span>
                                </div>
                              )}
                            </>
                          )}

                          {r.observations && (
                            <div className="space-y-1">
                              <span className="text-slate-400 dark:text-stone-500">Observaciones</span>
                              <p className="text-slate-700 dark:text-stone-200 leading-relaxed">{r.observations}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
      </div>

      {/* ── Picker de rango (modal) ── */}
      {isRangePickerOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200"
          onClick={() => setIsRangePickerOpen(false)}
        >
          <div className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm" />
          <div
            className="relative w-full sm:max-w-sm bg-white dark:bg-stone-900 rounded-t-3xl sm:rounded-3xl border border-stone-200/70 dark:border-stone-700/50 p-6 space-y-4 animate-in slide-in-from-bottom-6 sm:zoom-in-95 duration-300 font-gsf"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-medium text-slate-800 dark:text-stone-100 font-dm">
                Periodo
              </h3>
              <button
                onClick={() => setIsRangePickerOpen(false)}
                className="p-1.5 -mr-1.5 rounded-full text-slate-400 dark:text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
                aria-label="Cerrar"
              >
                <X size={16} />
              </button>
            </div>
            <div className="space-y-2">
              {(['thisMonth', 'lastMonth', 'last7', 'all', 'custom'] as DateRangePreset[]).map((p) => {
                const active = preset === p;
                return (
                  <button
                    key={p}
                    onClick={() => applyPreset(p)}
                    className={`w-full text-left px-4 py-3 rounded-xl border transition-colors text-sm ${
                      active
                        ? 'bg-stone-100 dark:bg-stone-800/60 border-stone-200/70 dark:border-stone-700/50 text-slate-800 dark:text-stone-100 font-medium'
                        : 'bg-transparent border-stone-200/70 dark:border-stone-700/40 text-slate-600 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-800/30'
                    }`}
                  >
                    {presetLabel[p]}
                  </button>
                );
              })}
            </div>

            {preset === 'custom' && (
              <div className="space-y-3 pt-2">
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-slate-500 dark:text-stone-400">Desde</label>
                    <input
                      type="date"
                      value={customDraft.startDate}
                      onChange={(e) => setCustomDraft((s) => ({ ...s, startDate: e.target.value }))}
                      className="w-full px-3 py-2.5 rounded-xl bg-stone-50 dark:bg-stone-800/40 border border-stone-200/70 dark:border-stone-700/50 text-sm text-slate-700 dark:text-stone-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-slate-500 dark:text-stone-400">Hasta</label>
                    <input
                      type="date"
                      value={customDraft.endDate}
                      onChange={(e) => setCustomDraft((s) => ({ ...s, endDate: e.target.value }))}
                      className="w-full px-3 py-2.5 rounded-xl bg-stone-50 dark:bg-stone-800/40 border border-stone-200/70 dark:border-stone-700/50 text-sm text-slate-700 dark:text-stone-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                    />
                  </div>
                </div>
                <button
                  onClick={applyCustom}
                  disabled={!customDraft.startDate || !customDraft.endDate}
                  className="w-full py-3 rounded-xl bg-orange-500 text-white text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98] transition-transform"
                >
                  Aplicar
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkerRecords;
