import React, { useState, useEffect } from 'react';
import { Banknote, CalendarRange, CheckCircle2, Clock, Loader2 } from 'lucide-react';
import { appsScriptApi } from '../services/api';
import { PagoRecord } from '../services/mockData';

type PeriodType = 'week' | 'month' | 'prev-month' | 'custom';

const pad = (n: number) => String(n).padStart(2, '0');
const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const getDateRange = (period: PeriodType, desde: string, hasta: string) => {
  const today = new Date();
  if (period === 'week') {
    const d = new Date(today);
    d.setDate(today.getDate() - 6);
    return { desde: fmt(d), hasta: fmt(today) };
  }
  if (period === 'month') {
    return {
      desde: fmt(new Date(today.getFullYear(), today.getMonth(), 1)),
      hasta: fmt(new Date(today.getFullYear(), today.getMonth() + 1, 0)),
    };
  }
  if (period === 'prev-month') {
    return {
      desde: fmt(new Date(today.getFullYear(), today.getMonth() - 1, 1)),
      hasta: fmt(new Date(today.getFullYear(), today.getMonth(), 0)),
    };
  }
  return { desde, hasta };
};

const fmtCurrency = (n: number) =>
  n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });

const fmtDate = (s: string) =>
  new Date(s + 'T00:00:00').toLocaleDateString('es-ES', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });

const initials = (name: string) =>
  name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);

const PERIODS = [
  { id: 'week' as PeriodType,       label: 'Esta semana' },
  { id: 'month' as PeriodType,      label: 'Este mes' },
  { id: 'prev-month' as PeriodType, label: 'Mes anterior' },
  { id: 'custom' as PeriodType,     label: 'Personalizado' },
];

const Pagos: React.FC = () => {
  const [period, setPeriod] = useState<PeriodType>('month');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [pagos, setPagos] = useState<PagoRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (period === 'custom' && (!desde || !hasta || desde > hasta)) return;
    const range = getDateRange(period, desde, hasta);
    setLoading(true);
    appsScriptApi.getPagos(range.desde, range.hasta).then(data => {
      setPagos(data);
      setLoading(false);
    });
  }, [period, desde, hasta]);

  const total = pagos.reduce((acc, p) => acc + p.importe, 0);
  const pendientes = pagos.filter(p => p.estado === 'pendiente').length;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header className="pb-6 border-b border-slate-200 dark:border-stone-800">
        <div className="flex items-center gap-3">
          <Banknote size={24} className="text-slate-800 dark:text-stone-300" />
          <h1 className="text-3xl font-medium tracking-tight text-slate-900 dark:text-stone-100 font-display">Pagos</h1>
        </div>
      </header>

      {/* Filtro de periodo */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex bg-slate-100 dark:bg-stone-800 p-1 rounded-xl gap-1">
          {PERIODS.map(p => (
            <button
              key={p.id}
              onClick={() => setPeriod(p.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                period === p.id
                  ? 'bg-white dark:bg-stone-700 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-slate-500 dark:text-stone-400 hover:text-slate-700 dark:hover:text-stone-200'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {period === 'custom' && (
          <div className="flex items-center gap-2 bg-white dark:bg-stone-800 border border-slate-200 dark:border-stone-700 rounded-xl px-4 py-2 shadow-sm">
            <CalendarRange size={16} className="text-slate-400 dark:text-stone-500 shrink-0" />
            <input
              type="date"
              value={desde}
              onChange={e => setDesde(e.target.value)}
              className="text-sm text-slate-700 dark:text-stone-300 focus:outline-none bg-transparent"
            />
            <span className="text-slate-400 dark:text-stone-600 text-sm">—</span>
            <input
              type="date"
              value={hasta}
              min={desde}
              onChange={e => setHasta(e.target.value)}
              className="text-sm text-slate-700 dark:text-stone-300 focus:outline-none bg-transparent"
            />
          </div>
        )}
      </div>

      {/* Tarjetas resumen */}
      {!loading && pagos.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-stone-950 border border-slate-200 dark:border-stone-700/50 rounded-2xl p-5">
            <p className="text-xs text-slate-500 dark:text-stone-500 uppercase tracking-wider mb-1">Total importe</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-stone-100 font-mono">{fmtCurrency(total)}</p>
          </div>
          <div className="bg-white dark:bg-stone-950 border border-slate-200 dark:border-stone-700/50 rounded-2xl p-5">
            <p className="text-xs text-slate-500 dark:text-stone-500 uppercase tracking-wider mb-1">Registros</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-stone-100">{pagos.length}</p>
          </div>
          <div className="bg-white dark:bg-stone-950 border border-slate-200 dark:border-stone-700/50 rounded-2xl p-5">
            <p className="text-xs text-slate-500 dark:text-stone-500 uppercase tracking-wider mb-1">Pendientes</p>
            <p className={`text-2xl font-bold ${pendientes > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
              {pendientes}
            </p>
          </div>
        </div>
      )}

      {/* Tabla */}
      {loading ? (
        <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4">
          <Loader2 className="animate-spin text-blue-600" size={40} />
          <p className="text-slate-500 dark:text-stone-400 font-medium">Cargando pagos...</p>
        </div>
      ) : period === 'custom' && (!desde || !hasta) ? (
        <div className="bg-white dark:bg-stone-950 border border-dashed border-slate-300 dark:border-stone-700 rounded-2xl p-12 flex flex-col items-center gap-3">
          <CalendarRange size={32} className="text-slate-300 dark:text-stone-700" />
          <p className="text-slate-400 dark:text-stone-500 text-sm">Selecciona un rango de fechas para ver los pagos</p>
        </div>
      ) : pagos.length === 0 ? (
        <div className="bg-white dark:bg-stone-950 border border-dashed border-slate-300 dark:border-stone-700 rounded-2xl p-12 flex flex-col items-center gap-3">
          <Banknote size={32} className="text-slate-300 dark:text-stone-700" />
          <p className="text-slate-400 dark:text-stone-500 text-sm">No hay pagos para el periodo seleccionado</p>
        </div>
      ) : (
        <div className="bg-white/60 dark:bg-stone-950 backdrop-blur-md border border-white dark:border-stone-800 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[1000px]">
              <thead>
                <tr className="bg-slate-50/70 dark:bg-stone-800/50 border-b border-stone-100 dark:border-stone-800">
                  <th className="px-8 py-6 text-xs font-normal text-slate-500 dark:text-stone-500 uppercase">Trabajador</th>
                  <th className="px-8 py-6 text-xs font-normal text-slate-500 dark:text-stone-500 uppercase">Teléfono</th>
                  <th className="px-8 py-6 text-xs font-normal text-slate-500 dark:text-stone-500 uppercase">DNI</th>
                  <th className="px-8 py-6 text-xs font-normal text-slate-500 dark:text-stone-500 uppercase">Email</th>
                  <th className="px-8 py-6 text-xs font-normal text-slate-500 dark:text-stone-500 uppercase">Fecha</th>
                  <th className="px-8 py-6 text-xs font-normal text-slate-500 dark:text-stone-500 uppercase">Concepto</th>
                  <th className="px-8 py-6 text-xs font-normal text-slate-500 dark:text-stone-500 uppercase text-center">Limpiezas</th>
                  <th className="px-8 py-6 text-xs font-normal text-slate-500 dark:text-stone-500 uppercase">Km</th>
                  <th className="px-8 py-6 text-xs font-normal text-slate-500 dark:text-stone-500 uppercase text-right">Importe</th>
                  <th className="px-8 py-6 text-xs font-normal text-slate-500 dark:text-stone-500 uppercase text-center">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
                {pagos.map(pago => (
                  <tr key={pago.id} className="hover:bg-stone-100/50 dark:hover:bg-stone-700/30 transition-colors text-sm">
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-xs shrink-0">
                          {initials(pago.workerName)}
                        </div>
                        <span className="font-medium text-slate-900 dark:text-stone-100 whitespace-nowrap">{pago.workerName}</span>
                      </div>
                    </td>
                    <td className="px-8 py-6 text-slate-600 dark:text-stone-400 whitespace-nowrap">{pago.telefono}</td>
                    <td className="px-8 py-6 text-slate-600 dark:text-stone-400 font-mono text-xs">{pago.dni}</td>
                    <td className="px-8 py-6 text-slate-500 dark:text-stone-500 text-xs">{pago.email}</td>
                    <td className="px-8 py-6 text-slate-600 dark:text-stone-400 whitespace-nowrap">{fmtDate(pago.fecha)}</td>
                    <td className="px-8 py-6 text-slate-600 dark:text-stone-400 whitespace-nowrap">{pago.concepto}</td>
                    <td className="px-8 py-6 text-slate-600 dark:text-stone-400 text-center">{pago.limpiezas}</td>
                    <td className="px-8 py-6 text-slate-600 dark:text-stone-400 whitespace-nowrap">{pago.km} km</td>
                    <td className="px-8 py-6 text-right font-bold text-slate-900 dark:text-stone-100 font-mono whitespace-nowrap">
                      {fmtCurrency(pago.importe)}
                    </td>
                    <td className="px-8 py-6 text-center">
                      {pago.estado === 'pagado' ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-normal uppercase tracking-wider bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800/50 rounded-md px-2 py-0.5 whitespace-nowrap">
                          <CheckCircle2 size={10} />
                          Pagado
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-normal uppercase tracking-wider bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-800/50 rounded-md px-2 py-0.5 whitespace-nowrap">
                          <Clock size={10} />
                          Pendiente
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default Pagos;
