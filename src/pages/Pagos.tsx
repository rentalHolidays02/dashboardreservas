import React, { useState, useEffect, useMemo } from 'react';
import { Banknote, Clock, ChevronLeft, ChevronRight, Search, PlusCircle, Loader2, CheckCircle2, Calculator } from 'lucide-react';
import { appsScriptApi, monthlyPaymentsApi, MonthlyPaymentInput } from '../services/api';
import { MonthlyPayment, Worker } from '../services/mockData';
import { useAnimatedNumber } from '../hooks/useAnimatedNumber';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import MonthlyPaymentDetailModal from '../components/pagos/MonthlyPaymentDetailModal';

const fmtCurrency = (n: number) =>
  n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });

const fmtMonthYear = (period: string) => {
  const d = new Date(period + 'T00:00:00');
  return d.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
};

// "YYYY-MM-01" del primer día del mes actual
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

interface PagosProps {
  userRole?: 'admin' | 'editor' | 'viewer' | 'trabajador';
}

type ReporteFilter = 'all' | 'PENDIENTE' | 'PAGO';

const Pagos: React.FC<PagosProps> = ({ userRole }) => {
  const [payments, setPayments] = useState<MonthlyPayment[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const [period, setPeriod] = useState<string>(periodOfMonth(new Date()));
  const [searchTerm, setSearchTerm] = useState('');
  const [reporteFilter, setReporteFilter] = useState<ReporteFilter>('all');

  const [selected, setSelected] = useState<MonthlyPayment | null>(null);

  const canEdit = userRole === 'admin' || userRole === 'editor';

  const workerMap = useMemo(() => {
    const map: Record<string, Worker> = {};
    workers.forEach(w => { map[w.id] = w; });
    return map;
  }, [workers]);

  const refresh = async (p: string) => {
    setLoading(true);
    try {
      const data = await monthlyPaymentsApi.list({ period: p });
      setPayments(data);
    } catch (e) {
      console.error('Error cargando pagos:', e);
      setPayments([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    appsScriptApi.getWorkers().then(setWorkers).catch(e => console.error(e));
  }, []);

  useEffect(() => { refresh(period); }, [period]);

  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return payments.filter(p => {
      const w = workerMap[p.workerId];
      const name = (w?.fullName || '').toLowerCase();
      if (q && !name.includes(q)) return false;
      if (reporteFilter !== 'all' && p.reporte !== reporteFilter) return false;
      return true;
    });
  }, [payments, workerMap, searchTerm, reporteFilter]);

  const stats = useMemo(() => {
    const totalPagado = filtered.filter(p => p.reporte === 'PAGO').reduce((s, p) => s + p.total, 0);
    const totalPendiente = filtered.filter(p => p.reporte === 'PENDIENTE').reduce((s, p) => s + p.saldoPendienteAPagar, 0);
    const registros = filtered.length;
    const pendientes = filtered.filter(p => p.reporte === 'PENDIENTE').length;
    return { totalPagado, totalPendiente, registros, pendientes };
  }, [filtered]);

  const animPagado = useAnimatedNumber(stats.totalPagado);
  const animPendiente = useAnimatedNumber(stats.totalPendiente);
  const animRegistros = useAnimatedNumber(stats.registros);
  const animPendientes = useAnimatedNumber(stats.pendientes);

  const handleGenerate = async () => {
    if (!canEdit) return;
    setGenerating(true);
    try {
      const res = await monthlyPaymentsApi.bulkGenerateForMonth(period);
      await refresh(period);
      alert(`Generadas ${res.created} nóminas nuevas. ${res.skipped} ya existían.`);
    } catch (e: any) {
      console.error(e);
      alert(`Error generando nóminas: ${e?.message || e}`);
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = async (input: MonthlyPaymentInput) => {
    await monthlyPaymentsApi.upsert(input);
    await refresh(period);
  };

  const handleDelete = async (id: string) => {
    await monthlyPaymentsApi.delete(id);
    await refresh(period);
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-700">

      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 px-1 mb-2">
        <h1 className="text-xl font-normal text-slate-800 dark:text-stone-200 tracking-tight font-display shrink-0">
          Nóminas mensuales
        </h1>

        <div className="flex flex-col md:flex-row gap-3 justify-end items-stretch md:items-center flex-1">

          {/* Selector de mes */}
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

          {/* Búsqueda */}
          <div className="relative w-full md:w-56">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-stone-500 pointer-events-none" size={14} />
            <input type="text" placeholder="Buscar trabajador..." value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-white/40 dark:bg-stone-900/40 backdrop-blur-md border border-white/60 dark:border-stone-700/50 rounded-xl text-slate-700 dark:text-stone-300 text-xs font-normal placeholder:text-slate-400 dark:placeholder:text-stone-500 focus:outline-none transition-all hover:bg-white/80 dark:hover:bg-stone-800/60 focus:bg-white dark:focus:bg-stone-900" />
          </div>

          {/* Toggle reporte */}
          <div className="flex bg-white/40 dark:bg-stone-900/40 backdrop-blur-md border border-white/60 dark:border-stone-700/50 rounded-xl p-1">
            {(['all', 'PENDIENTE', 'PAGO'] as const).map(opt => (
              <button key={opt} onClick={() => setReporteFilter(opt)}
                className={`px-3 py-1.5 text-[11px] rounded-lg transition-all ${reporteFilter === opt ? 'bg-orange-500 text-white' : 'text-slate-500 dark:text-stone-400 hover:text-orange-500'}`}>
                {opt === 'all' ? 'Todos' : opt === 'PAGO' ? 'Pagado' : 'Pendiente'}
              </button>
            ))}
          </div>

          {/* Generar nóminas */}
          {canEdit && (
            <button onClick={handleGenerate} disabled={generating}
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-orange-600 text-white text-xs font-medium rounded-xl hover:bg-orange-700 active:scale-[0.98] transition-all disabled:opacity-50 shadow-lg shadow-orange-500/20">
              {generating ? <Loader2 className="animate-spin" size={14} /> : <PlusCircle size={14} />}
              Generar nóminas
            </button>
          )}
        </div>
      </header>

      {/* Stats */}
      {!loading && filtered.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 px-1">
          <div className="bg-white/80 dark:bg-stone-900 backdrop-blur-md border border-white/60 dark:border-stone-700/50 rounded-2xl p-6 hover:border-emerald-500/30 transition-all">
            <span className="text-[11px] text-slate-400 dark:text-stone-500 font-normal uppercase tracking-wider">Total pagado</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-normal text-slate-800 dark:text-stone-100 font-display tracking-tight tabular-nums">{fmtCurrency(animPagado)}</span>
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
          <div className="bg-white/80 dark:bg-stone-900 backdrop-blur-md border border-white/60 dark:border-stone-700/50 rounded-2xl p-6">
            <span className="text-[11px] text-slate-400 dark:text-stone-500 font-normal uppercase tracking-wider">Registros</span>
            <p className="text-2xl font-normal text-slate-800 dark:text-stone-100 font-display tracking-tight tabular-nums mt-1">{animRegistros}</p>
          </div>
          <div className="bg-white/80 dark:bg-stone-900 backdrop-blur-md border border-white/60 dark:border-stone-700/50 rounded-2xl p-6">
            <span className="text-[11px] text-slate-400 dark:text-stone-500 font-normal uppercase tracking-wider">Pendientes</span>
            <div className="flex items-center gap-3 mt-1">
              <span className={`text-2xl font-normal font-display tracking-tight tabular-nums ${stats.pendientes > 0 ? 'text-amber-600' : 'text-emerald-500'}`}>{animPendientes}</span>
              {stats.pendientes > 0 && (
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
              <h3 className="text-sm font-semibold text-slate-700 dark:text-stone-200">No hay nóminas para {fmtMonthYear(period)}</h3>
              <p className="text-xs text-slate-400 dark:text-stone-500 mt-1 max-w-xs">
                {canEdit ? 'Pulsa "Generar nóminas" para crear una fila por trabajador activo del mes.' : 'Ningún registro disponible.'}
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
                    <th className="px-8 py-5 text-xs font-normal text-slate-400 dark:text-stone-500 text-center">Reporte</th>
                    <th className="px-8 py-5 text-xs font-normal text-slate-400 dark:text-stone-500"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
                  {filtered.map(p => {
                    const w = workerMap[p.workerId];
                    const name = w?.fullName || '—';
                    return (
                      <tr key={p.id}
                        onClick={() => canEdit && setSelected(p)}
                        className={`group transition-colors ${canEdit ? 'hover:bg-stone-100/50 dark:hover:bg-stone-700/30 cursor-pointer' : ''}`}>
                        <td className="px-8 py-5">
                          <div className="flex items-center gap-3">
                            <div className="w-7 h-7 rounded-full overflow-hidden shrink-0 bg-white dark:bg-stone-800 soft-shadow">
                              {w?.photo ? (
                                <img src={w.photo} alt={name} className="w-full h-full object-cover" />
                              ) : (
                                <span className="w-full h-full flex items-center justify-center text-xs font-normal text-slate-500 dark:text-stone-400">
                                  {name.charAt(0)}
                                </span>
                              )}
                            </div>
                            <div>
                              <span className="block text-sm font-normal text-slate-800 dark:text-stone-200">{name}</span>
                              <span className="text-xs text-slate-400 dark:text-stone-500 font-mono tracking-tighter">{w?.dni || ''}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-8 py-5">
                          <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-stone-400">
                            <Calculator size={11} className="text-slate-300" />
                            {p.numReservations} res · {p.numKilometers.toFixed(0)} km · {p.numOvertimeHours.toFixed(1)} h
                          </div>
                        </td>
                        <td className="px-8 py-5 text-right">
                          <span className="text-sm text-slate-700 dark:text-stone-200 tabular-nums font-medium">{fmtCurrency(p.total)}</span>
                        </td>
                        <td className="px-8 py-5 text-right">
                          <span className={`text-sm tabular-nums font-medium ${p.saldoPendienteAPagar > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                            {fmtCurrency(p.saldoPendienteAPagar)}
                          </span>
                        </td>
                        <td className="px-8 py-5 text-center">
                          {p.reporte === 'PAGO' ? (
                            <span className="inline-flex items-center gap-1.5 text-[11px] font-normal text-emerald-600 dark:text-emerald-400">
                              <CheckCircle2 size={11} /> Pagado
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-[11px] font-normal text-amber-600 dark:text-amber-500">
                              <Clock size={11} /> Pendiente
                            </span>
                          )}
                        </td>
                        <td className="px-8 py-5 text-right">
                          {canEdit && (
                            <button className="p-1 text-slate-400 dark:text-stone-500 hover:text-orange-500 transition-colors opacity-0 group-hover:opacity-100" aria-label="Editar">
                              <ChevronRight size={14} />
                            </button>
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

      <MonthlyPaymentDetailModal
        isOpen={selected !== null}
        payment={selected}
        workerName={selected ? (workerMap[selected.workerId]?.fullName || '—') : ''}
        onClose={() => setSelected(null)}
        onSave={handleSave}
        onDelete={handleDelete}
      />
    </div>
  );
};

export default Pagos;
