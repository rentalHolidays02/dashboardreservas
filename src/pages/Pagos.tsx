import React, { useState, useEffect, useMemo } from 'react';
import { Banknote, Clock, ChevronLeft, ChevronRight, Search, CheckCircle2, Calculator, Wallet, X } from 'lucide-react';
import { supabaseOperationsApi, WorkerPayments, ServiceReportDB, KeyDeliveryDB, IncidentReportDB } from '../services/supabaseOperationsApi';
import { activityLogApi } from '../services/api';
import { User as AppUser } from '../services/mockData';
import {
  computeMonthlySummaries,
  computeDesglose,
  MonthlySummary,
  DesgloseDetalle,
  DesgloseFila,
  EXTRA_HOUR_RATE,
} from '../utils/paymentsSupabase';
import { useAnimatedNumber } from '../hooks/useAnimatedNumber';
import LoadingSpinner from '../components/ui/LoadingSpinner';

const fmtCurrency = (n: number) =>
  n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });

const fmtMonthYear = (period: string) => {
  const d = new Date(period + 'T00:00:00');
  return d.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
};

const periodOfMonth = (date: Date): string => {
  const y = date.getFullYear();
  const m = (date.getMonth() + 1).toString().padStart(2, '0');
  return `${y}-${m}-01`;
};

const shiftPeriod = (period: string, deltaMonths: number): string => {
  const d = new Date(period + 'T00:00:00');
  d.setMonth(d.getMonth() + deltaMonths);
  return periodOfMonth(d);
};

const periodToYearMonth = (period: string): string => period.slice(0, 7);

interface PagosProps {
  user?: AppUser;
  userRole?: 'admin' | 'editor' | 'viewer' | 'trabajador';
}

type EstadoFilter = 'all' | 'pendiente' | 'pagado';

const Pagos: React.FC<PagosProps> = ({ user, userRole }) => {
  const [workers, setWorkers] = useState<WorkerPayments[]>([]);
  const [services, setServices] = useState<ServiceReportDB[]>([]);
  const [keyDeliveries, setKeyDeliveries] = useState<KeyDeliveryDB[]>([]);
  const [incidents, setIncidents] = useState<IncidentReportDB[]>([]);
  const [loading, setLoading] = useState(true);

  const [period, setPeriod] = useState<string>(periodOfMonth(new Date()));
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<EstadoFilter>('all');
  const [selected, setSelected] = useState<string | null>(null);
  const [savingWorkerId, setSavingWorkerId] = useState<string | null>(null);

  const canEdit = userRole === 'admin' || userRole === 'editor';

  const loadAll = async () => {
    setLoading(true);
    try {
      const [ws, srv, kd, inc] = await Promise.all([
        supabaseOperationsApi.getWorkersPayments(),
        supabaseOperationsApi.getServiceReports(),
        supabaseOperationsApi.getKeyDeliveries(),
        supabaseOperationsApi.getIncidentReports(),
      ]);
      setWorkers(ws);
      setServices(srv);
      setKeyDeliveries(kd);
      setIncidents(inc);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAll(); }, []);

  const summaries = useMemo<MonthlySummary[]>(() => {
    const ym = periodToYearMonth(period);
    return computeMonthlySummaries(workers, services, keyDeliveries, incidents, ym);
  }, [workers, services, keyDeliveries, incidents, period]);

  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return summaries.filter(s => {
      if (q && !s.worker.full_name.toLowerCase().includes(q)) return false;
      const pendiente = s.worker.pending_balance;
      if (filter === 'pendiente' && pendiente <= 0) return false;
      if (filter === 'pagado'    && pendiente >  0) return false;
      if (filter === 'all' && s.total <= 0 && pendiente <= 0 && s.efectivoRetenidoMes <= 0) return false;
      return true;
    });
  }, [summaries, searchTerm, filter]);

  const stats = useMemo(() => {
    const totalMes        = filtered.reduce((sum, s) => sum + s.total, 0);
    const totalPendiente  = filtered.reduce((sum, s) => sum + s.worker.pending_balance, 0);
    const totalRetenido   = filtered.reduce((sum, s) => sum + s.efectivoRetenidoMes, 0);
    const numPendientes   = filtered.filter(s => s.worker.pending_balance > 0).length;
    return { totalMes, totalPendiente, totalRetenido, numPendientes };
  }, [filtered]);

  const animMes = useAnimatedNumber(stats.totalMes);
  const animPendiente = useAnimatedNumber(stats.totalPendiente);
  const animRetenido = useAnimatedNumber(stats.totalRetenido);
  const animNumPendientes = useAnimatedNumber(stats.numPendientes);

  const selectedSummary = useMemo(
    () => selected ? summaries.find(s => s.workerId === selected) : null,
    [selected, summaries]
  );

  const selectedDesglose = useMemo<DesgloseDetalle | null>(() => {
    if (!selectedSummary) return null;
    return computeDesglose(selectedSummary.worker, services, keyDeliveries, incidents, periodToYearMonth(period));
  }, [selectedSummary, period, services, keyDeliveries, incidents]);

  const handleMarcarPagado = async (workerId: string) => {
    if (!canEdit) return;
    setSavingWorkerId(workerId);
    try {
      const w = workers.find(x => x.id === workerId);
      const prevBalance = w?.pending_balance ?? 0;
      const ok = await supabaseOperationsApi.markWorkerAsPaid(workerId);
      if (!ok) throw new Error('No se pudo actualizar');
      setWorkers(prev => prev.map(x => x.id === workerId ? { ...x, pending_balance: 0 } : x));
      await activityLogApi.log(
        user?.id || null, user?.name || 'Sistema',
        `Marcó como pagado a ${w?.full_name || 'trabajador'} (saldaba ${prevBalance.toFixed(2)}€)`,
        'marcar_pagado'
      );
    } catch (e: any) {
      console.error('Error marcando como pagado:', e);
      alert(`Error: ${e?.message || e}`);
    } finally {
      setSavingWorkerId(null);
    }
  };

  const handleAddToPending = async (workerId: string, amount: number) => {
    if (!canEdit || amount <= 0) return;
    setSavingWorkerId(workerId);
    try {
      const w = workers.find(x => x.id === workerId);
      const ok = await supabaseOperationsApi.addToWorkerBalance(workerId, amount);
      if (!ok) throw new Error('No se pudo actualizar');
      const next = Math.round(((w?.pending_balance ?? 0) + amount) * 100) / 100;
      setWorkers(prev => prev.map(x => x.id === workerId ? { ...x, pending_balance: next } : x));
      await activityLogApi.log(
        user?.id || null, user?.name || 'Sistema',
        `Sumó ${amount.toFixed(2)}€ al pendiente de ${w?.full_name || 'trabajador'} (total mes)`,
        'asignar_cobro_mes'
      );
    } catch (e: any) {
      console.error('Error añadiendo al pendiente:', e);
      alert(`Error: ${e?.message || e}`);
    } finally {
      setSavingWorkerId(null);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-700">
      {/* Cabecera */}
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 px-1 mb-2">
        <div>
          <h1 className="text-xl font-normal text-slate-800 dark:text-stone-200 tracking-tight font-display shrink-0">
            Nóminas mensuales
          </h1>
          <p className="text-xs text-slate-400 dark:text-stone-500 mt-1">
            Cálculo en vivo desde servicios, entregas e incidencias del mes
          </p>
        </div>

        <div className="flex flex-col md:flex-row gap-3 justify-end items-stretch md:items-center">
          <div className="flex items-center bg-white/40 dark:bg-stone-900/40 backdrop-blur-md border border-white/60 dark:border-stone-700/50 rounded-xl">
            <button onClick={() => setPeriod(shiftPeriod(period, -1))}
              className="p-2.5 text-slate-500 dark:text-stone-400 hover:text-orange-500 transition-colors" aria-label="Mes anterior">
              <ChevronLeft size={16} />
            </button>
            <span className="px-3 text-xs font-medium text-slate-700 dark:text-stone-200 capitalize tabular-nums min-w-[110px] text-center">
              {fmtMonthYear(period)}
            </span>
            <button onClick={() => setPeriod(shiftPeriod(period, 1))}
              className="p-2.5 text-slate-500 dark:text-stone-400 hover:text-orange-500 transition-colors" aria-label="Mes siguiente">
              <ChevronRight size={16} />
            </button>
          </div>

          <div className="relative w-full md:w-56">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-stone-500 pointer-events-none" size={14} />
            <input type="text" placeholder="Buscar trabajador..." value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-white/40 dark:bg-stone-900/40 backdrop-blur-md border border-white/60 dark:border-stone-700/50 rounded-xl text-slate-700 dark:text-stone-300 text-xs font-normal placeholder:text-slate-400 dark:placeholder:text-stone-500 focus:outline-none transition-all hover:bg-white/80 dark:hover:bg-stone-800/60 focus:bg-white dark:focus:bg-stone-900" />
          </div>

          <div className="flex bg-white/40 dark:bg-stone-900/40 backdrop-blur-md border border-white/60 dark:border-stone-700/50 rounded-xl p-1">
            {([
              { v: 'all'       as const, label: 'Todos' },
              { v: 'pendiente' as const, label: 'Con saldo' },
              { v: 'pagado'    as const, label: 'Sin saldo' },
            ]).map(opt => (
              <button key={opt.v} onClick={() => setFilter(opt.v)}
                className={`px-3 py-1.5 text-[11px] rounded-lg transition-all ${filter === opt.v ? 'bg-orange-500 text-white' : 'text-slate-500 dark:text-stone-400 hover:text-orange-500'}`}>
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Stats */}
      {!loading && filtered.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 px-1">
          <div className="bg-white/80 dark:bg-stone-900 backdrop-blur-md border border-white/60 dark:border-stone-700/50 rounded-2xl p-6 hover:border-emerald-500/30 transition-all">
            <span className="text-[11px] text-slate-400 dark:text-stone-500 font-normal uppercase tracking-wider">Total del mes</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-normal text-slate-800 dark:text-stone-100 font-display tracking-tight tabular-nums">{fmtCurrency(animMes)}</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mb-1.5" />
            </div>
          </div>
          <div className="bg-white/80 dark:bg-stone-900 backdrop-blur-md border border-white/60 dark:border-stone-700/50 rounded-2xl p-6 hover:border-amber-500/30 transition-all">
            <span className="text-[11px] text-slate-400 dark:text-stone-500 font-normal uppercase tracking-wider">Saldo pendiente</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-normal text-amber-600 dark:text-amber-500 font-display tracking-tight tabular-nums">{fmtCurrency(animPendiente)}</span>
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mb-1.5" />
            </div>
          </div>
          <div className="bg-white/80 dark:bg-stone-900 backdrop-blur-md border border-white/60 dark:border-stone-700/50 rounded-2xl p-6 hover:border-blue-500/30 transition-all">
            <span className="text-[11px] text-slate-400 dark:text-stone-500 font-normal uppercase tracking-wider">Efectivo retenido</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-normal text-blue-600 dark:text-blue-400 font-display tracking-tight tabular-nums">{fmtCurrency(animRetenido)}</span>
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mb-1.5" />
            </div>
          </div>
          <div className="bg-white/80 dark:bg-stone-900 backdrop-blur-md border border-white/60 dark:border-stone-700/50 rounded-2xl p-6">
            <span className="text-[11px] text-slate-400 dark:text-stone-500 font-normal uppercase tracking-wider">Por cobrar</span>
            <div className="flex items-center gap-3 mt-1">
              <span className={`text-2xl font-normal font-display tracking-tight tabular-nums ${stats.numPendientes > 0 ? 'text-amber-600' : 'text-emerald-500'}`}>{animNumPendientes}</span>
              {stats.numPendientes > 0 && (
                <span className="inline-flex items-center gap-1.5 text-[10px] font-normal text-amber-600 dark:text-amber-400 px-2 py-0.5 bg-amber-50 dark:bg-amber-900/20 rounded-full border border-amber-100 dark:border-amber-800/10">
                  <Clock size={10} /> Por abonar
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tabla */}
      <div className="px-1">
        {loading ? (
          <LoadingSpinner />
        ) : filtered.length === 0 ? (
          <div className="bg-white/80 dark:bg-stone-900 backdrop-blur-md border border-dashed border-stone-200 dark:border-stone-700/50 rounded-3xl p-20 flex flex-col items-center gap-4 text-center soft-shadow">
            <div className="w-16 h-16 bg-stone-50 dark:bg-stone-800 rounded-2xl flex items-center justify-center text-slate-300 dark:text-stone-600">
              <Banknote size={32} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-700 dark:text-stone-200">Sin actividad ni saldo en {fmtMonthYear(period)}</h3>
              <p className="text-xs text-slate-400 dark:text-stone-500 mt-1 max-w-xs">
                No hay trabajadores con servicios, entregas, incidencias ni saldo pendiente para mostrar.
              </p>
            </div>
          </div>
        ) : (
          <div className="bg-white/80 dark:bg-stone-900 backdrop-blur-md border border-white/60 dark:border-stone-700/50 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto overflow-y-hidden">
              <table className="w-full text-left border-collapse min-w-[800px]">
                <thead>
                  <tr className="border-b border-stone-100 dark:border-stone-800 bg-stone-50/30 dark:bg-stone-800/20">
                    <th className="px-8 py-5 text-xs font-normal text-slate-400 dark:text-stone-500">Trabajador</th>
                    <th className="px-8 py-5 text-xs font-normal text-slate-400 dark:text-stone-500 capitalize">{fmtMonthYear(period)}</th>
                    <th className="px-8 py-5 text-xs font-normal text-slate-400 dark:text-stone-500 text-right">Total mes</th>
                    <th className="px-8 py-5 text-xs font-normal text-slate-400 dark:text-stone-500 text-right">Saldo pendiente</th>
                    <th className="px-8 py-5 text-xs font-normal text-slate-400 dark:text-stone-500 text-right">Retenido</th>
                    <th className="px-8 py-5 text-xs font-normal text-slate-400 dark:text-stone-500 text-center">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
                  {filtered.map(s => {
                    const w = s.worker;
                    const tienePendiente = w.pending_balance > 0;
                    return (
                      <tr key={s.workerId}
                        onClick={() => setSelected(s.workerId)}
                        className="group transition-colors hover:bg-stone-100/50 dark:hover:bg-stone-700/30 cursor-pointer">
                        <td className="px-8 py-5">
                          <div className="flex items-center gap-3">
                            <div className="w-7 h-7 rounded-full overflow-hidden shrink-0 bg-white dark:bg-stone-800 soft-shadow">
                              {w.photo_url ? (
                                <img src={w.photo_url} alt={w.full_name} className="w-full h-full object-cover" />
                              ) : (
                                <span className="w-full h-full flex items-center justify-center text-xs font-normal text-slate-500 dark:text-stone-400">
                                  {w.full_name.charAt(0)}
                                </span>
                              )}
                            </div>
                            <div>
                              <span className="block text-sm font-normal text-slate-800 dark:text-stone-200">{w.full_name}</span>
                              <span className="text-xs text-slate-400 dark:text-stone-500 font-mono tracking-tighter">{w.dni || ''}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-8 py-5">
                          <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-stone-400">
                            <Calculator size={11} className="text-slate-300" />
                            {s.numReservations} res · {s.numKilometers.toFixed(0)} km · {s.reservaHours.toFixed(1)} h
                            {s.extraHours > 0 && <span className="text-amber-600 dark:text-amber-400"> ({s.extraHours.toFixed(1)} extra)</span>}
                            {s.manitasHours > 0 && <span> · {s.manitasHours.toFixed(1)} h manitas</span>}
                            {s.numLinenServices > 0 && <span> · {s.numLinenServices} sáb</span>}
                            {s.numIncidents > 0 && <span> · {s.numIncidents} inc</span>}
                          </div>
                        </td>
                        <td className="px-8 py-5 text-right">
                          <span className="text-sm text-slate-700 dark:text-stone-200 tabular-nums font-medium">{fmtCurrency(s.total)}</span>
                        </td>
                        <td className="px-8 py-5 text-right">
                          <span className={`text-sm tabular-nums font-medium ${tienePendiente ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                            {fmtCurrency(w.pending_balance)}
                          </span>
                        </td>
                        <td className="px-8 py-5 text-right">
                          <span className="text-sm tabular-nums text-slate-600 dark:text-stone-300">{fmtCurrency(s.efectivoRetenidoMes)}</span>
                        </td>
                        <td className="px-8 py-5 text-center">
                          {tienePendiente ? (
                            <span className="inline-flex items-center gap-1.5 text-[11px] font-normal text-amber-600 dark:text-amber-500">
                              <Clock size={11} /> Pendiente
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-[11px] font-normal text-emerald-600 dark:text-emerald-400">
                              <CheckCircle2 size={11} /> Saldado
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="px-6 py-3 border-t border-stone-100 dark:border-stone-800/50 bg-stone-50/30 dark:bg-stone-900/30">
              <span className="text-[10px] text-slate-400 dark:text-stone-500">Mostrando {filtered.length} registros</span>
            </div>
          </div>
        )}
      </div>

      {/* Modal detalle individual */}
      {selectedSummary && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in"
             onClick={() => setSelected(null)}>
          <div className="bg-white dark:bg-stone-900 w-full max-w-2xl max-h-[90vh] flex flex-col rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95"
               onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-5 border-b border-stone-100 dark:border-stone-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-orange-50 dark:bg-orange-900/20 flex items-center justify-center">
                  <Wallet size={18} className="text-orange-600 dark:text-orange-400" />
                </div>
                <div>
                  <h2 className="text-sm font-medium text-slate-800 dark:text-stone-100">{selectedSummary.worker.full_name}</h2>
                  <p className="text-xs text-slate-400 dark:text-stone-500 capitalize">{fmtMonthYear(period)}</p>
                </div>
              </div>
              <button onClick={() => setSelected(null)} className="p-2 rounded-xl hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors">
                <X size={16} className="text-slate-500 dark:text-stone-400" />
              </button>
            </div>

            <div className="overflow-y-auto p-6 space-y-4">
              <section>
                <h3 className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-stone-500 mb-3">Actividad del mes</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <DetalleStat label="Reservas"           value={selectedSummary.numReservations} />
                  <DetalleStat label="Kilómetros"         value={`${selectedSummary.numKilometers.toFixed(1)} km`} />
                  <DetalleStat label="Horas reserva"      value={`${selectedSummary.reservaHours.toFixed(1)} h`} />
                  <DetalleStat label="Horas extra"        value={`${selectedSummary.extraHours.toFixed(1)} h`} />
                  <DetalleStat label="Horas manitas"      value={`${selectedSummary.manitasHours.toFixed(1)} h`} />
                  <DetalleStat label="Incidencias"        value={selectedSummary.numIncidents} />
                  <DetalleStat label="Sábanas/toallas"    value={selectedSummary.numLinenServices} />
                </div>
              </section>

              <section>
                <h3 className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-stone-500 mb-3">Desglose económico</h3>
                <div className="space-y-1">
                  <ExpandableDetalleLinea
                    label={`Reservas (${selectedSummary.numReservations} × ${fmtCurrency(selectedSummary.worker.pay_per_reservation)})`}
                    value={selectedSummary.montoReservas}
                    details={selectedDesglose?.reservas ?? []}
                  />
                  <ExpandableDetalleLinea
                    label={`Horas extra (${selectedSummary.extraHours.toFixed(1)} h × ${fmtCurrency(EXTRA_HOUR_RATE)})`}
                    value={selectedSummary.montoExtras}
                    details={selectedDesglose?.extras ?? []}
                  />
                  <ExpandableDetalleLinea
                    label={`Manitas (${selectedSummary.manitasHours.toFixed(1)} h × ${fmtCurrency(EXTRA_HOUR_RATE)})`}
                    value={selectedSummary.montoManitas}
                    details={selectedDesglose?.manitas ?? []}
                  />
                  <ExpandableDetalleLinea
                    label={`Kilometraje (${selectedSummary.numKilometers.toFixed(1)} km × ${fmtCurrency(selectedSummary.worker.price_per_km)})`}
                    value={selectedSummary.montoKm}
                    details={selectedDesglose?.km ?? []}
                  />
                  <ExpandableDetalleLinea
                    label={`Sábanas/toallas (${selectedSummary.numLinenServices} × ${fmtCurrency(selectedSummary.worker.pay_per_linen_service)})`}
                    value={selectedSummary.montoSabanas}
                    details={selectedDesglose?.sabanas ?? []}
                  />
                  <ExpandableDetalleLinea
                    label={`Incidencias (${selectedSummary.numIncidents} × ${fmtCurrency(selectedSummary.worker.pay_per_incident)})`}
                    value={selectedSummary.montoIncidencias}
                    details={selectedDesglose?.incidencias ?? []}
                  />
                  <div className="flex items-center justify-between pt-3 mt-2 border-t border-stone-100 dark:border-stone-800">
                    <span className="text-sm font-medium text-slate-700 dark:text-stone-200">Total del mes</span>
                    <span className="text-base font-semibold text-slate-800 dark:text-stone-100 tabular-nums">{fmtCurrency(selectedSummary.total)}</span>
                  </div>
                </div>
              </section>

              <section>
                <h3 className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-stone-500 mb-3">Estado en cuenta</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-amber-50/50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30 rounded-2xl p-4">
                    <span className="text-[10px] uppercase tracking-wider text-amber-600 dark:text-amber-400">Saldo pendiente</span>
                    <p className="text-xl font-medium text-amber-700 dark:text-amber-300 tabular-nums mt-1">{fmtCurrency(selectedSummary.worker.pending_balance)}</p>
                  </div>
                  <div className="bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 rounded-2xl p-4">
                    <span className="text-[10px] uppercase tracking-wider text-blue-600 dark:text-blue-400">Efectivo retenido (mes)</span>
                    <p className="text-xl font-medium text-blue-700 dark:text-blue-300 tabular-nums mt-1">{fmtCurrency(selectedSummary.efectivoRetenidoMes)}</p>
                  </div>
                </div>
              </section>
            </div>

            {canEdit && (
              <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-stone-100 dark:border-stone-800 bg-stone-50/50 dark:bg-stone-900/50">
                {selectedSummary.total > 0 && (
                  <button onClick={() => handleAddToPending(selectedSummary.workerId, selectedSummary.total)}
                    disabled={savingWorkerId === selectedSummary.workerId}
                    className="flex items-center gap-2 px-4 py-2 bg-stone-100 dark:bg-stone-800 text-slate-700 dark:text-stone-200 text-xs font-medium rounded-xl hover:bg-stone-200 dark:hover:bg-stone-700 transition-all disabled:opacity-50">
                    Añadir total del mes al pendiente
                  </button>
                )}
                {selectedSummary.worker.pending_balance > 0 && (
                  <button onClick={() => handleMarcarPagado(selectedSummary.workerId)}
                    disabled={savingWorkerId === selectedSummary.workerId}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-xs font-medium rounded-xl hover:bg-emerald-700 transition-all disabled:opacity-50">
                    <CheckCircle2 size={14} /> Marcar como pagado
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const DetalleStat: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div className="bg-stone-50 dark:bg-stone-800/40 rounded-2xl p-3">
    <span className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-stone-500">{label}</span>
    <p className="text-sm font-medium text-slate-800 dark:text-stone-100 tabular-nums mt-1">{value}</p>
  </div>
);

const fmtShortDate = (d: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
  return new Date(d + 'T00:00:00').toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
};

const ExpandableDetalleLinea: React.FC<{
  label: string;
  value: number;
  details: DesgloseFila[];
}> = ({ label, value, details }) => {
  const [open, setOpen] = useState(false);
  const has = details.length > 0;
  return (
    <div>
      <button
        type="button"
        onClick={() => has && setOpen(o => !o)}
        disabled={!has}
        className={`w-full flex items-center justify-between py-1.5 px-1 -mx-1 rounded-lg transition-colors ${has ? 'hover:bg-stone-50 dark:hover:bg-stone-800/40 cursor-pointer' : 'cursor-default'}`}
      >
        <span className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-stone-400 text-left">
          {has ? (
            <ChevronRight
              size={11}
              className={`shrink-0 text-slate-400 dark:text-stone-500 transition-transform ${open ? 'rotate-90' : ''}`}
            />
          ) : (
            <span className="w-[11px] shrink-0" />
          )}
          {label}
        </span>
        <span className="text-sm tabular-nums text-slate-700 dark:text-stone-200">{fmtCurrency(value)}</span>
      </button>
      {open && has && (
        <div className="mt-1 mb-2 ml-[14px] pl-3 border-l-2 border-stone-200 dark:border-stone-700 space-y-0.5 animate-in fade-in slide-in-from-top-1 duration-200">
          {details.map(d => (
            <div key={d.id} className="flex items-center justify-between gap-2 py-1 text-[11px]">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <span className="tabular-nums text-slate-400 dark:text-stone-500 shrink-0">{fmtShortDate(d.date)}</span>
                <span className="text-slate-700 dark:text-stone-200 truncate">{d.concept}</span>
                {d.sub && <span className="text-slate-400 dark:text-stone-500 truncate hidden sm:inline">· {d.sub}</span>}
              </div>
              <span className="tabular-nums text-slate-600 dark:text-stone-300 shrink-0">{fmtCurrency(d.monto)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Pagos;
