import React, { useState, useEffect, useRef, useMemo } from 'react';
import { HelpCircle, TrendingUp, CalendarRange, X } from 'lucide-react';
import { CheckInOut, Worker } from '../../services/mockData';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer
} from 'recharts';

interface AnalyticsCardsProps {
  checkIns: CheckInOut[];
  selectedWorker?: Worker | null;
  onWorkerSelect?: (worker: Worker | null) => void;
}

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

const fmtEur = (v: number) =>
  v.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

const WorkingBadge: React.FC = () => {
  const [step, setStep] = useState(1);
  useEffect(() => {
    const id = setInterval(() => setStep(s => (s === 3 ? 1 : s + 1)), 500);
    return () => clearInterval(id);
  }, []);
  return (
    <span className="inline-flex items-center text-[11px]">
      <span className="working-badge font-medium">
        Trabajando
        <span style={{ opacity: step >= 1 ? 1 : 0 }}>.</span>
        <span style={{ opacity: step >= 2 ? 1 : 0 }}>.</span>
        <span style={{ opacity: step >= 3 ? 1 : 0 }}>.</span>
      </span>
    </span>
  );
};

const PulseDot: React.FC<{
  cx?: number; cy?: number;
  value?: number; index?: number;
}> = ({ cx, cy }) => {
  if (cx == null || cy == null) return null;
  return (
    <g>
      <circle cx={cx} cy={cy} r={5} fill="none" stroke="#f97316" strokeWidth={1.5}>
        <animate attributeName="r"       from="5"   to="16"  dur="0.55s" fill="freeze" />
        <animate attributeName="opacity" from="0.5" to="0"   dur="0.55s" fill="freeze" />
      </circle>
      <circle cx={cx} cy={cy} r={5} fill="none" stroke="#f97316" strokeWidth={1}>
        <animate attributeName="r"       from="5"   to="22"  begin="0.1s" dur="0.55s" fill="freeze" />
        <animate attributeName="opacity" from="0.25" to="0"  begin="0.1s" dur="0.55s" fill="freeze" />
      </circle>
      <circle cx={cx} cy={cy} r={4.5} fill="#f97316" stroke="#fff" strokeWidth={2.5} />
    </g>
  );
};

const useAnimatedNumber = (target: number, duration = 600) => {
  const [display, setDisplay] = useState(target);
  const prev = useRef(target);
  const raf  = useRef<number>(0);

  useEffect(() => {
    const from  = prev.current;
    const delta = target - from;
    if (delta === 0) return;

    const start = performance.now();
    const tick  = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      const ease = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(from + delta * ease));
      if (t < 1) raf.current = requestAnimationFrame(tick);
      else prev.current = target;
    };

    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [target, duration]);

  return display;
};

type Period = 'semanal' | 'mensual' | 'trimestral' | 'personalizado';

type ChartPoint = { label: string; valor: number };

// Baseline mensual de referencia para escalar datos por trabajador
const BASELINE_MONTHLY = 1250;

const generateBaseData = (period: Exclude<Period, 'personalizado'>): ChartPoint[] => {
  const today = new Date('2026-03-31');

  if (period === 'semanal') {
    const labels = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
    const vals   = [820, 940, 1010, 1090, 1180, 980, 1050];
    return labels.map((label, i) => ({ label, valor: vals[i] }));
  }

  if (period === 'mensual') {
    const base = [780, 810, 830, 870, 850, 900, 920, 880, 940, 960,
                  930, 970, 1000, 990, 1020, 1050, 1030, 1080, 1100, 1070,
                  1110, 1090, 1140, 1160, 1130, 1180, 1210, 1190, 1230, 1250];
    const result: ChartPoint[] = [];
    for (let i = 29; i >= 0; i--) {
      const d   = new Date(today);
      d.setDate(today.getDate() - i);
      const day = d.getDate();
      const mon = d.toLocaleString('es-ES', { month: 'short' });
      result.push({ label: `${day} ${mon}`, valor: base[29 - i] });
    }
    return result;
  }

  // Trimestral
  const vals = [640, 700, 720, 780, 760, 820, 850, 900, 880, 950, 980, 1040, 1090];
  const result: ChartPoint[] = [];
  for (let i = 12; i >= 0; i--) {
    const d   = new Date(today);
    d.setDate(today.getDate() - i * 7);
    const day = d.getDate();
    const mon = d.toLocaleString('es-ES', { month: 'short' });
    result.push({ label: `${day} ${mon}`, valor: vals[12 - i] });
  }
  return result;
};

const generateCustomData = (desde: string, hasta: string): ChartPoint[] => {
  if (!desde || !hasta || desde > hasta) return [];
  const start = new Date(desde + 'T00:00:00');
  const end   = new Date(hasta + 'T00:00:00');
  const days  = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
  if (days <= 0) return [];

  const result: ChartPoint[] = [];
  // Patrón determinista basado en la fecha de inicio
  const seed = start.getDate() + start.getMonth() * 31;
  for (let i = 0; i < Math.min(days, 90); i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const valor = Math.round(800 + 250 * Math.sin(i * 0.4 + seed) + 150 * Math.sin(i * 0.9 + seed * 0.5));
    const day = d.getDate();
    const mon = d.toLocaleString('es-ES', { month: 'short' });
    result.push({ label: `${day} ${mon}`, valor: Math.abs(valor) });
  }
  return result;
};

const BASE_DATA: Record<Exclude<Period, 'personalizado'>, ChartPoint[]> = {
  semanal:    generateBaseData('semanal'),
  mensual:    generateBaseData('mensual'),
  trimestral: generateBaseData('trimestral'),
};

const PERIODS: { id: Period; label: string }[] = [
  { id: 'semanal',       label: 'Semanal' },
  { id: 'mensual',       label: 'Mensual' },
  { id: 'trimestral',    label: 'Trimestral' },
  { id: 'personalizado', label: 'Personalizado' },
];

const CustomTooltip: React.FC<{
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
}> = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border-2 border-white rounded-xl px-3 py-2 text-xs soft-shadow">
      <p className="text-slate-400 mb-0.5">{label}</p>
      <p className="font-medium text-slate-800">{fmtEur(payload[0].value)}</p>
    </div>
  );
};


const AnalyticsCards: React.FC<AnalyticsCardsProps> = ({ checkIns, selectedWorker, onWorkerSelect }) => {
  const [period, setPeriod]         = useState<Period>('semanal');
  const [customDesde, setCustomDesde] = useState('');
  const [customHasta, setCustomHasta] = useState('');
  const [chartKey, setChartKey]     = useState(0);

  const handlePeriod = (p: Period) => {
    if (p === period) return;
    setPeriod(p);
    setChartKey(k => k + 1);
  };

  // Re-animar cuando cambia el trabajador seleccionado
  const prevWorkerId = useRef(selectedWorker?.id);
  useEffect(() => {
    if (prevWorkerId.current !== selectedWorker?.id) {
      prevWorkerId.current = selectedWorker?.id;
      setChartKey(k => k + 1);
    }
  }, [selectedWorker?.id]);

  const chartData = useMemo<ChartPoint[]>(() => {
    const base: ChartPoint[] =
      period === 'personalizado'
        ? generateCustomData(customDesde, customHasta)
        : BASE_DATA[period];

    if (!selectedWorker) return base;
    const scale = selectedWorker.netMoneyMonth / BASELINE_MONTHLY;
    return base.map(d => ({ ...d, valor: Math.round(d.valor * scale) }));
  }, [period, customDesde, customHasta, selectedWorker]);

  // Re-animar cuando cambian las fechas personalizadas (con datos)
  const prevCustom = useRef('');
  useEffect(() => {
    if (period !== 'personalizado') return;
    const key = customDesde + customHasta;
    if (key !== prevCustom.current && customDesde && customHasta) {
      prevCustom.current = key;
      setChartKey(k => k + 1);
    }
  }, [customDesde, customHasta, period]);

  const xInterval = period === 'mensual' ? 4 : period === 'trimestral' ? 1 : period === 'personalizado' && chartData.length > 30 ? Math.floor(chartData.length / 10) : 0;
  const total          = chartData.reduce((acc, d) => acc + d.valor, 0);
  const animatedTotal  = useAnimatedNumber(total);

  const periodLabel = period === 'personalizado' && customDesde && customHasta
    ? `${customDesde} — ${customHasta}`
    : PERIODS.find(p => p.id === period)?.label.toLowerCase() ?? '';

  return (
    <div className="grid grid-cols-1 md:grid-cols-[7fr_3fr] gap-6 items-stretch">

      {/* Módulo 1: Gráfica dinero × días */}
      <div className="flex flex-col">
        <div className="flex items-center justify-between mb-3 px-1">
          <div className="flex items-baseline gap-3 min-w-0">
            <span className="text-xl font-normal text-slate-800 tracking-tight tabular-nums font-display">
              {fmtEur(animatedTotal)}
            </span>
            <span className="text-xs text-slate-400 font-normal">
              total {periodLabel}
            </span>
            {selectedWorker && (
              <button
                onClick={() => onWorkerSelect && onWorkerSelect(null)}
                className="inline-flex items-center gap-1.5 text-[11px] bg-orange-50/50 text-orange-600 border border-orange-200/50 rounded-lg px-2 py-1 transition-all hover:bg-orange-100/50 group"
              >
                <span className="font-medium">{selectedWorker.fullName}</span>
                <X size={12} className="text-orange-400 group-hover:text-orange-600" />
              </button>
            )}
          </div>

          <div className="flex items-center bg-white/40 backdrop-blur-md border border-white/60 rounded-lg p-0.5 gap-0.5 flex-shrink-0">
            {PERIODS.map(p => (
              <button
                key={p.id}
                onClick={() => handlePeriod(p.id)}
                className={`text-xs px-2.5 py-1 rounded-md font-normal transition-all duration-200 ${
                  period === p.id
                    ? 'bg-white/90 text-orange-600 border border-white'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-white/40'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Selector de fechas personalizadas */}
        {period === 'personalizado' && (
          <div className="flex items-center gap-2 mb-3 px-1 animate-in fade-in slide-in-from-top-1 duration-200">
            <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-1.5">
              <CalendarRange size={13} className="text-slate-400 flex-shrink-0" />
              <input
                type="date"
                value={customDesde}
                onChange={e => setCustomDesde(e.target.value)}
                className="text-xs text-slate-700 focus:outline-none bg-transparent"
              />
              <span className="text-slate-300 text-xs">—</span>
              <input
                type="date"
                value={customHasta}
                min={customDesde}
                onChange={e => setCustomHasta(e.target.value)}
                className="text-xs text-slate-700 focus:outline-none bg-transparent"
              />
            </div>
            {(customDesde || customHasta) && (
              <button
                onClick={() => { setCustomDesde(''); setCustomHasta(''); }}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X size={13} />
              </button>
            )}
          </div>
        )}

        <div className="flex flex-col flex-1 min-h-0 px-1">

          {/* Gráfica */}
          {period === 'personalizado' && (!customDesde || !customHasta) ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-300 gap-2">
              <CalendarRange size={28} />
              <p className="text-xs text-slate-400">Selecciona un rango de fechas</p>
            </div>
          ) : (
            <div key={chartKey} className="chart-enter flex-1 min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.03)" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 10, fill: '#94a3b8' }}
                    axisLine={false}
                    tickLine={false}
                    interval={xInterval}
                    dy={4}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: '#94a3b8' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v: number) =>
                      v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${v}`
                    }
                    width={36}
                    domain={[(dataMin: number) => Math.floor(dataMin * 0.9), (dataMax: number) => Math.ceil(dataMax * 1.15)]}
                  />
                  <Tooltip
                    content={<CustomTooltip />}
                    cursor={{ stroke: '#e2e8f0', strokeWidth: 1 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="valor"
                    stroke="#f97316"
                    strokeWidth={2.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    dot={false}
                    activeDot={<PulseDot />}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* Módulo 2: Actividad de limpiadores */}
      <div className="flex flex-col gap-2 min-h-0">
        {checkIns.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <span className="text-xs text-slate-400">Sin actividad registrada</span>
          </div>
        ) : (
          checkIns.slice(0, 4).map(entry => {
            const isFinished = entry.type === 'check-out';
            return (
              <div
                key={entry.id}
                className={`bg-white/80 backdrop-blur-sm border border-white/60 rounded-xl px-4 py-3 flex items-center justify-between transition-colors hover:bg-white ${
                  isFinished ? 'opacity-30' : 'opacity-100'
                }`}
              >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-7 h-7 rounded-full bg-white flex items-center justify-center text-xs text-slate-500 font-medium flex-shrink-0 soft-shadow">
                  {entry.cleanerName.charAt(0)}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-slate-700 truncate">{entry.cleanerName}</p>
                  <p className="text-[11px] text-slate-400 truncate">{entry.accommodation}</p>
                </div>
              </div>
              <div className="flex flex-col items-end gap-0.5 flex-shrink-0 pl-2">
                <span className="text-[11px] text-slate-400 tabular-nums">{fmtTime(entry.timestamp)}</span>
                <span className="text-xs">
                  {entry.type === 'check-in'
                    ? <WorkingBadge />
                    : <span className="text-[11px] text-slate-400">Finalizado</span>
                  }
                </span>
                </div>
              </div>
            );
          })
        )}

        <button className="text-xs text-slate-400 hover:text-slate-600 transition-colors text-center py-1 cursor-not-allowed select-none">
          Mostrar más
        </button>
      </div>

    </div>
  );
};

export default AnalyticsCards;
