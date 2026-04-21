import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { HelpCircle, TrendingUp, CalendarRange, X, Pencil } from 'lucide-react';
import { CheckInOut, Worker, NormalCleanRecord, InitialCleanRecord, HandymanRecord } from '../../services/mockData';
import { useTheme } from '../../context/ThemeContext';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer
} from 'recharts';
import { useAnimatedNumber } from '../../hooks/useAnimatedNumber';
import { formatName } from '../../utils/formatters';
import { aggregateDailyData } from '../../utils/analytics';

interface AnalyticsCardsProps {
  checkIns: CheckInOut[];
  selectedWorker?: Worker | null;
  onWorkerSelect?: (worker: Worker | null) => void;
  workers?: Worker[];
  period: Period;
  customDesde: string;
  customHasta: string;
  normalCleans?: NormalCleanRecord[];
  initialCleans?: InitialCleanRecord[];
  handymanRecords?: HandymanRecord[];
  activeNormalCheckins?: NormalCleanRecord[];
  activeInitialCheckins?: InitialCleanRecord[];
  activeHandymanCheckins?: HandymanRecord[];
  onCheckoutRequested?: (type: 'normal' | 'initial' | 'handyman', record: NormalCleanRecord | InitialCleanRecord | HandymanRecord) => void;
}

export type Period = 'semanal' | 'mensual' | 'trimestral' | 'personalizado';

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

type ChartPoint = { label: string; valor: number };

const PERIOD_OPTIONS: { id: Period; label: string }[] = [
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
    <div className="bg-white dark:bg-stone-800 border-2 border-white dark:border-stone-700 rounded-xl px-3 py-2 text-xs soft-shadow">
      <p className="text-slate-400 dark:text-stone-500 mb-0.5">{label}</p>
      <p className="font-medium text-slate-800 dark:text-stone-200">{fmtEur(payload[0].value)}</p>
    </div>
  );
};


const AnalyticsCards: React.FC<AnalyticsCardsProps> = ({ 
  checkIns, selectedWorker, onWorkerSelect, workers = [], period, customDesde, customHasta,
  normalCleans = [], initialCleans = [], handymanRecords = [],
  activeNormalCheckins = [], activeInitialCheckins = [], activeHandymanCheckins = [],
  onCheckoutRequested
}) => {
  const navigate = useNavigate();
  const photoMap = useMemo(() => {
    const map: Record<string, string> = {};
    workers?.forEach(w => { 
      if (w.photo) map[formatName(w.fullName)] = w.photo; 
    });
    return map;
  }, [workers]);
  
  const [chartKey, setChartKey]     = useState(0);
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const activeTabStyle: React.CSSProperties = isDark
    ? { backgroundColor: '#000', borderColor: '#000', borderWidth: 1, borderStyle: 'solid' }
    : { backgroundColor: '#f5f5f4', borderColor: '#fff', borderWidth: 1, borderStyle: 'solid' };

  const handlePeriod = (p: Period) => {
    setChartKey(k => k + 1);
  };

  useEffect(() => {
    setChartKey(k => k + 1);
  }, [period, customDesde, customHasta]);

  const prevWorkerId = useRef(selectedWorker?.id);
  useEffect(() => {
    if (prevWorkerId.current !== selectedWorker?.id) {
      prevWorkerId.current = selectedWorker?.id;
      setChartKey(k => k + 1);
    }
  }, [selectedWorker?.id]);

  const chartData = useMemo(() => {
    const dailyData = aggregateDailyData(
      workers,
      normalCleans,
      initialCleans,
      handymanRecords,
      period,
      customDesde,
      customHasta,
      selectedWorker?.id
    );

    // Mapear al formato esperado por el gráfico de AnalyticsCards (valor)
    return dailyData.map(d => ({ label: d.label, valor: d.dinero }));
  }, [period, customDesde, customHasta, selectedWorker, workers, normalCleans, initialCleans, handymanRecords]);

  const prevCustom = useRef('');
  useEffect(() => {
    if (period !== 'personalizado') return;
    const key = customDesde + customHasta;
    if (key !== prevCustom.current && customDesde && customHasta) {
      prevCustom.current = key;
      setChartKey(k => k + 1);
    }
  }, [customDesde, customHasta, period]);

  const combinedActivity = useMemo(() => {
    const activity: any[] = [];

    // 1. Trabajando (Checkins activos)
    activeNormalCheckins.forEach(r => {
      activity.push({
        id: r.id,
        cleanerName: `${r.nombre} ${r.apellidos}`,
        accommodation: r.apartamento,
        timestamp: r.checkinFecha,
        isFinished: false,
        type: 'Limpieza Normal',
        tabType: 'normal',
        originalRecord: r
      });
    });
    activeInitialCheckins.forEach(r => {
      activity.push({
        id: r.id,
        cleanerName: `${r.nombre} ${r.apellidos}`,
        accommodation: r.apartamento,
        timestamp: r.checkinFecha,
        isFinished: false,
        type: 'Limpieza Inicial',
        tabType: 'initial',
        originalRecord: r
      });
    });
    activeHandymanCheckins.forEach(r => {
      activity.push({
        id: r.id,
        cleanerName: `${r.nombre} ${r.apellidos}`,
        accommodation: r.alojamiento,
        timestamp: r.fechaLlegada,
        isFinished: false,
        type: 'Manitas',
        tabType: 'handyman',
        originalRecord: r
      });
    });

    // 2. Finalizado (Checkouts)
    normalCleans.forEach(r => {
      activity.push({
        id: r.id,
        cleanerName: `${r.nombre} ${r.apellidos}`,
        accommodation: r.apartamento,
        timestamp: r.checkoutFecha || r.checkinFecha,
        isFinished: true,
        type: 'Limpieza Normal'
      });
    });

    initialCleans.forEach(r => {
      activity.push({
        id: r.id,
        cleanerName: `${r.nombre} ${r.apellidos}`,
        accommodation: r.apartamento,
        timestamp: r.checkoutFecha || r.checkinFecha,
        isFinished: true,
        type: 'Limpieza Inicial'
      });
    });

    handymanRecords.forEach(r => {
      activity.push({
        id: r.id,
        cleanerName: `${r.nombre} ${r.apellidos}`,
        accommodation: r.alojamiento,
        timestamp: r.fechaFin || r.fechaLlegada,
        isFinished: true,
        type: 'Manitas'
      });
    });

    // Ordenar por timestamp descendente
    return activity.sort((a, b) => {
        const timeA = new Date(a.timestamp).getTime();
        const timeB = new Date(b.timestamp).getTime();
        if (isNaN(timeA) || isNaN(timeB)) return 0;
        return timeB - timeA;
    });
  }, [normalCleans, initialCleans, handymanRecords, activeNormalCheckins, activeInitialCheckins, activeHandymanCheckins]);

  const xInterval = period === 'mensual' ? 4 : period === 'trimestral' ? 1 : period === 'personalizado' && chartData.length > 30 ? Math.floor(chartData.length / 10) : 0;
  const total          = chartData.reduce((acc, d) => acc + d.valor, 0);
  const animatedTotal  = useAnimatedNumber(total);

  const periodLabel = period === 'personalizado' && customDesde && customHasta
    ? `${customDesde} — ${customHasta}`
    : PERIOD_OPTIONS.find(p => p.id === period)?.label.toLowerCase() ?? '';

  return (
    <div className="grid grid-cols-1 md:grid-cols-[7fr_3fr] gap-6 items-stretch">

      {/* Módulo 1: Gráfica dinero × días */}
      <div className="flex flex-col">
        <div className="flex items-center justify-between mb-3 px-1">
          <div className="flex items-baseline gap-3 min-w-0">
            <span className="text-xl font-normal text-slate-800 dark:text-stone-200 tracking-tight tabular-nums font-display">
              {fmtEur(animatedTotal)}
            </span>
            <span className="text-xs text-slate-400 dark:text-stone-500 font-normal">
              total {periodLabel}
            </span>
            {selectedWorker && (
              <button
                onClick={() => onWorkerSelect && onWorkerSelect(null)}
                className="inline-flex items-center gap-1.5 text-[11px] bg-orange-50/50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 border border-orange-200/50 dark:border-orange-800/50 rounded-lg px-2 py-1 transition-all hover:bg-orange-100/50 dark:hover:bg-orange-900/50 group"
              >
                <span className="font-medium">{formatName(selectedWorker.fullName)}</span>
                <X size={12} className="text-orange-400 group-hover:text-orange-600" />
              </button>
            )}
          </div>
        </div>


        <div className="flex flex-col flex-1 min-h-0 px-1">
          {period === 'personalizado' && (!customDesde || !customHasta) ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-300 dark:text-stone-700 gap-2">
              <CalendarRange size={28} />
              <p className="text-xs text-slate-400 dark:text-stone-500">Selecciona un rango de fechas</p>
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

      {/* Módulo 2: Actividad (Limpieza normal, inicial y manitas) */}
      <div className="flex flex-col gap-2 min-h-0">
        <div className="px-1 mb-1 flex items-center justify-between">
          <span className="text-[10px] font-semibold text-slate-400 dark:text-stone-500 uppercase tracking-wider">Actividad Reciente</span>
        </div>
        
        {combinedActivity.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <span className="text-xs text-slate-400 dark:text-stone-500">Sin actividad registrada</span>
          </div>
        ) : (
          combinedActivity.slice(0, 4).map(entry => {
            const formattedCleanerName = formatName(entry.cleanerName);
            return (
              <div
                key={entry.id}
                className={`group bg-white/80 dark:bg-stone-900 backdrop-blur-sm border border-white/60 dark:border-stone-700/50 rounded-xl px-4 py-3 flex items-center justify-between transition-all duration-300 hover:bg-white dark:hover:bg-stone-900/80 hover:shadow-lg hover:shadow-orange-500/5 ${
                  entry.isFinished ? 'opacity-50' : 'opacity-100'
                }`}
              >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-7 h-7 rounded-full bg-white dark:bg-stone-800 flex-shrink-0 overflow-hidden soft-shadow">
                  {photoMap[formattedCleanerName] ? (
                    <img src={photoMap[formattedCleanerName]} alt={formattedCleanerName} className="w-full h-full object-cover" />
                  ) : (
                    <span className="w-full h-full flex items-center justify-center text-xs text-slate-500 dark:text-stone-400 font-medium">
                      {formattedCleanerName.charAt(0)}
                    </span>
                  )}
                </div>
                <div className="min-w-0 pr-2">
                  <p className="text-xs font-semibold text-slate-700 dark:text-stone-300 truncate">{formattedCleanerName}</p>
                  <a 
                    href={entry.checkinUbicacion ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(entry.checkinUbicacion)}` : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(entry.accommodation)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] text-slate-400 dark:text-stone-500 hover:text-orange-500 dark:hover:text-orange-400 transition-colors block truncate max-w-[140px]"
                    title={entry.accommodation}
                  >
                    {entry.accommodation}
                  </a>
                </div>
              </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0 pl-2">
                  <span className="text-[10px] text-slate-400 dark:text-stone-500 tabular-nums">
                    {new Date(entry.timestamp).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <div className="flex items-center h-5">
                    {!entry.isFinished
                      ? (
                        <div className="flex items-center transition-all duration-300">
                          <div className="transform transition-transform duration-300 group-hover:-translate-x-1">
                            <WorkingBadge />
                          </div>
                          <div className="max-w-0 opacity-0 group-hover:max-w-[40px] group-hover:opacity-100 transition-all duration-500 ease-out overflow-hidden flex items-center">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onCheckoutRequested?.(entry.tabType, entry.originalRecord);
                              }}
                              className="p-1 ml-1 rounded-lg text-orange-500 hover:bg-orange-500/10 dark:hover:bg-orange-500/20 transition-colors"
                              title="Gestionar"
                            >
                              <Pencil size={12} />
                            </button>
                          </div>
                        </div>
                      )
                      : <span className="text-[10px] text-slate-400 dark:text-stone-500 font-medium">Finalizado</span>
                    }
                  </div>
                </div>
              </div>
            );
          })
        )}

        <button 
          onClick={() => navigate('/cleans')}
          className="text-xs text-slate-400 dark:text-stone-500 hover:text-slate-600 dark:hover:text-stone-300 transition-colors text-center py-2"
        >
          Mostrar más
        </button>
      </div>

    </div>
  );
};

export default AnalyticsCards;
