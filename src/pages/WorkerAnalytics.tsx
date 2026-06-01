import React, { useEffect, useState, useMemo, useRef } from 'react';
import type { User, Worker, NormalCleanRecord, InitialCleanRecord, HandymanRecord, Accommodation } from '../services/mockData';
import { appsScriptApi } from '../services/api';
import { 
  Banknote,
  TrendingUp,
  User as UserIcon,
  CalendarRange,
  X,
  Clock,
  MapPin,
  Filter,
  Home,
  Wrench,
  Sparkles,
  Building2,
  ChevronRight,
  Route
} from 'lucide-react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts';
import { aggregateDailyData } from '../utils/analytics';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { formatName } from '../utils/formatters';
import { useAnimatedNumber } from '../hooks/useAnimatedNumber';
import { useTheme } from '../context/ThemeContext';
import DashboardFilterModal, { Period, Metric } from '../components/dashboard/DashboardFilterModal';
import { filterRecordsByPeriod, matchesWorkerByPhone, cleanPhone, computeCleanPay, computeHoursPay } from '../utils/payments';

interface WorkerAnalyticsProps {
  user: User;
}

const fmtEur = (v: number) =>
  v.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

const PulseDot: React.FC<{
  cx?: number; cy?: number;
  value?: number; index?: number;
}> = ({ cx, cy }) => {
  if (cx == null || cy == null) return null;
  return (
    <g>
      <circle cx={cx} cy={cy} r={4} fill="none" stroke="#f97316" strokeWidth={1}>
        <animate attributeName="r"       from="4"   to="12"  dur="0.55s" fill="freeze" />
        <animate attributeName="opacity" from="0.5" to="0"   dur="0.55s" fill="freeze" />
      </circle>
      <circle cx={cx} cy={cy} r={3.5} fill="#f97316" stroke="#fff" strokeWidth={2} />
    </g>
  );
};

const CustomTooltip: React.FC<{
  active?: boolean;
  payload?: { value: number; name: string }[];
  label?: string;
  activeTab: Metric;
}> = ({ active, payload, label, activeTab }) => {
  if (!active || !payload?.length) return null;
  const value = payload[0].value;
  const formatted =
    activeTab === 'dinero'
      ? fmtEur(value)
      : activeTab === 'km'
        ? `${value.toFixed(1)} km`
        : `${value} ${value === 1 ? 'servicio' : 'servicios'}`;
  return (
    <div className="bg-white dark:bg-stone-800 border border-slate-100 dark:border-stone-700 rounded-xl px-3 py-2 text-xs soft-shadow">
      <p className="text-slate-400 dark:text-stone-500 mb-0.5">{label}</p>
      <p className="font-medium text-slate-800 dark:text-stone-200">{formatted}</p>
    </div>
  );
};

const WorkerAnalytics: React.FC<WorkerAnalyticsProps> = ({ user }) => {
  const [loading, setLoading] = useState(true);
  const [workerData, setWorkerData] = useState<Worker | null>(null);
  const [allWorkers, setAllWorkers] = useState<Worker[]>([]);
  const [accommodations, setAccommodations] = useState<Accommodation[]>([]);
  const [selectedWorkerId, setSelectedWorkerId] = useState<string | null>(null);
  const { theme } = useTheme();
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [metric, setMetric] = useState<Metric>('dinero');
  
  const [globalRecords, setGlobalRecords] = useState<{
    normal: NormalCleanRecord[];
    initial: InitialCleanRecord[];
    handyman: HandymanRecord[];
  }>({
    normal: [],
    initial: [],
    handyman: [],
  });

  // Period state
  const [period, setPeriod] = useState<Period>('mensual');
  const [customDesde, setCustomDesde] = useState('');
  const [customHasta, setCustomHasta] = useState('');
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [chartKey, setChartKey] = useState(0);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [workers, normal, initial, handyman, accs] = await Promise.all([
          appsScriptApi.getWorkers(),
          appsScriptApi.getNormalCleans(),
          appsScriptApi.getInitialCleans(),
          appsScriptApi.getHandymanRecords(),
          appsScriptApi.getAccommodations()
        ]);
        
        setAllWorkers(workers);
        setAccommodations(accs);
        setGlobalRecords({ normal, initial, handyman });

        const foundWorker = workers.find(w => 
          (user.telefono && cleanPhone(w.telefono) === cleanPhone(user.telefono)) ||
          w.fullName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(user.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')) || 
          (w.email && w.email.toLowerCase() === user.email.toLowerCase())
        );

        if (foundWorker) {
          setWorkerData(foundWorker);
          setSelectedWorkerId(foundWorker.id);
        }
      } catch (error) {
        console.error('Error fetching worker analytics data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user]);

  useEffect(() => {
    if (!selectedWorkerId || allWorkers.length === 0) return;
    const worker = allWorkers.find(w => w.id === selectedWorkerId);
    if (worker) setWorkerData(worker);
    setChartKey(k => k + 1);
  }, [selectedWorkerId, allWorkers]);

  useEffect(() => {
    setChartKey(k => k + 1);
  }, [period, customDesde, customHasta, metric]);

  const chartData = useMemo(() => {
    const dailyData = aggregateDailyData(
      allWorkers,
      globalRecords.normal,
      globalRecords.initial,
      globalRecords.handyman,
      period,
      customDesde,
      customHasta,
      selectedWorkerId || undefined
    );
    return dailyData.map(d => ({
      label: d.label,
      valor: metric === 'dinero' ? d.dinero : metric === 'km' ? d.km : d.limpiezas
    }));
  }, [period, customDesde, customHasta, selectedWorkerId, allWorkers, globalRecords, metric]);

  const total = useMemo(() => chartData.reduce((acc, d) => acc + d.valor, 0), [chartData]);
  const animatedTotal = useAnimatedNumber(total);

  const periodLabel = useMemo(() => {
    if (period === 'semanal') return 'esta semana';
    if (period === 'mensual') return 'este mes';
    if (period === 'trimestral') return 'este trimestre';
    if (period === 'personalizado') {
      const formatDate = (s: string) => {
        if (!s) return '';
        const [y, m, d] = s.split('-');
        return `${d}/${m}`;
      };
      if (customDesde && customHasta) return `${formatDate(customDesde)} al ${formatDate(customHasta)}`;
      if (customDesde) return `desde ${formatDate(customDesde)}`;
      if (customHasta) return `hasta ${formatDate(customHasta)}`;
      return 'periodo personalizado';
    }
    return '';
  }, [period, customDesde, customHasta]);

  const topAccommodations = useMemo(() => {
    const stats: Record<string, { count: number; dinero: number; km: number }> = {};
    const filterByWorker = (r: any) => !workerData || matchesWorkerByPhone(r.telefono, workerData.telefono);

    const normal = globalRecords.normal.filter(filterByWorker).map(r => ({ ...r, accommodation: r.apartamento, date: r.checkoutFecha || r.checkinFecha, _type: 'normal' }));
    const initial = globalRecords.initial.filter(filterByWorker).map(r => ({ ...r, accommodation: r.apartamento, date: r.checkoutFecha || r.checkinFecha, _type: 'initial' }));
    const handyman = globalRecords.handyman.filter(filterByWorker).map(r => ({ ...r, accommodation: r.alojamiento, date: r.fechaFin || r.fechaLlegada, _type: 'handyman' }));

    const combined = [...normal, ...initial, ...handyman];
    const filtered = filterRecordsByPeriod(combined, period, customDesde, customHasta);

    filtered.forEach(r => {
      const name = r.accommodation;
      if (!name) return;
      if (!stats[name]) stats[name] = { count: 0, dinero: 0, km: 0 };
      
      const pagoPorReserva = workerData?.pagoPorReserva ?? 20;
      const precioPorKm = workerData?.precioPorKm ?? 0.19;

      stats[name].count += 1;

      if (r._type === 'handyman') {
        const qty = (r as any).cantidadMinutos || 0;
        stats[name].km += qty;
        const hp = computeHoursPay((r as any).horaInicioTarea, (r as any).horaFinTarea);
        stats[name].dinero += hp.pay + qty * precioPorKm;
      } else if (r._type === 'initial') {
        const qty = (r as any).km || 0;
        stats[name].km += qty;
        const hp = computeHoursPay((r as any).horaEntrada, (r as any).horaSalida);
        stats[name].dinero += hp.pay + qty * precioPorKm;
      } else {
        const qty = (r as any).km || 0;
        stats[name].km += qty;
        const pay = computeCleanPay(name, (r as any).horaEntrada, (r as any).horaSalida, pagoPorReserva);
        stats[name].dinero += pay.base + pay.extraPay + qty * precioPorKm;
      }
    });

    return Object.entries(stats)
      .map(([name, data]) => {
        const accInfo = accommodations.find(a => a.name.toLowerCase() === name.toLowerCase());
        return { 
          name, 
          count: data.count,
          dinero: data.dinero,
          km: data.km,
          location: accInfo?.city || 'Varios',
          image: accInfo?.image || `https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&q=80&w=200&h=200` 
        };
      })
      .sort((a, b) => metric === 'dinero' ? b.dinero - a.dinero : metric === 'km' ? b.km - a.km : b.count - a.count)
      .slice(0, 5);
  }, [globalRecords, workerData, period, customDesde, customHasta, accommodations, metric]);

  if (loading) {
    return <LoadingSpinner message="Preparando tu resumen..." />;
  }

  const activeFiltersCount = (period !== 'mensual' ? 1 : 0) + (customDesde || customHasta ? 1 : 0) + (metric !== 'dinero' ? 1 : 0);

  return (
    <div className="space-y-0 md:pb-20">
      {/* ── BLOQUE STICKY MÓVIL ── */}
      <div className="relative sticky top-0 z-30 pt-0 lg:pt-0 pb-0 lg:pb-0 mb-4 lg:mb-6 lg:static flex flex-col justify-center lg:justify-start gap-0 -mx-4 px-4 lg:mx-0 lg:px-0 bg-[#F5F4F2] dark:bg-[#1c1a18] lg:bg-transparent animate-in fade-in duration-700 min-h-[140px] lg:min-h-0">
        <header className="flex flex-col items-center lg:items-start justify-center lg:justify-start text-center lg:text-left gap-1.5 py-4 lg:py-0">
          <h1 className="text-xl font-normal text-slate-800 dark:text-stone-200 tracking-tight font-display">
            Resumen de limpiezas
          </h1>
          <p className="text-sm text-slate-400 dark:text-stone-500 font-light">
            Consulta tus métricas y rendimiento
          </p>
        </header>


        
        <DashboardFilterModal 
          isOpen={isFilterModalOpen}
          onClose={() => setIsFilterModalOpen(false)}
          period={period}
          metric={metric}
          customDesde={customDesde}
          customHasta={customHasta}
          onApply={(updates) => {
            if (updates.period) setPeriod(updates.period);
            if (updates.metric) setMetric(updates.metric);
            if (updates.customDesde !== undefined) setCustomDesde(updates.customDesde);
            if (updates.customHasta !== undefined) setCustomHasta(updates.customHasta);
          }}
        />

        {/* Gradient fade border */}
        <div className="absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-b from-transparent to-[#F5F4F2] dark:to-[#1c1a18] pointer-events-none lg:hidden" />
      </div>

      <div className="flex-1 w-full lg:overflow-visible pb-24 space-y-6 animate-in fade-in duration-500">

      <div className="w-full">
        {/* Chart Section */}
        <div className="bg-white/60 dark:bg-stone-900/40 backdrop-blur-md p-6 md:p-8 rounded-[28px] md:rounded-[32px] border border-white/60 dark:border-stone-800/50 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-6 md:mb-8">
            <div className="flex items-baseline gap-2">
              <span className="text-xl md:text-2xl font-normal text-slate-800 dark:text-stone-100 tracking-tight font-display tabular-nums">
                {metric === 'dinero'
                  ? fmtEur(animatedTotal)
                  : metric === 'km'
                    ? `${animatedTotal.toFixed(1)} km`
                    : `${Math.floor(animatedTotal)}`}
              </span>
              <span className="text-[10px] md:text-xs font-light text-slate-400 dark:text-stone-500 lowercase">
                {periodLabel}
              </span>
            </div>
            <div className="p-2 rounded-xl bg-orange-500 text-white shadow-lg shadow-orange-500/20">
              {metric === 'dinero' ? <TrendingUp size={18} /> : metric === 'km' ? <Route size={18} /> : <Sparkles size={18} />}
            </div>
          </div>

          {/* Selector de métrica visible */}
          <div className="grid grid-cols-3 gap-2 mb-4 md:mb-6">
            {([
              { id: 'dinero',    label: 'Dinero' },
              { id: 'limpiezas', label: 'Servicios' },
              { id: 'km',        label: 'Km' },
            ] as { id: Metric; label: string }[]).map(m => {
              const active = metric === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => setMetric(m.id)}
                  className={`flex items-center justify-center px-3 py-2 rounded-xl text-xs transition-all border active:scale-[0.98] ${
                    active
                      ? 'bg-orange-100 dark:bg-orange-400/10 text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-800/50 font-medium'
                      : 'bg-white/60 dark:bg-stone-800/40 text-slate-500 dark:text-stone-400 border-stone-100 dark:border-stone-700/50 hover:bg-stone-50 dark:hover:bg-stone-700/50'
                  }`}
                >
                  {m.label}
                </button>
              );
            })}
          </div>

          <div className="h-[220px] md:h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.03)" vertical={false} />
                <XAxis 
                  dataKey="label" 
                  tick={{ fontSize: 9, fill: '#94a3b8' }} 
                  axisLine={false} 
                  tickLine={false}
                  interval={isMobile ? (period === 'mensual' ? 6 : 1) : (period === 'mensual' ? 4 : 0)}
                  dy={10}
                />
                <YAxis 
                  tick={{ fontSize: 9, fill: '#94a3b8' }} 
                  axisLine={false} 
                  tickLine={false}
                  tickFormatter={(v) => metric === 'dinero' ? (v >= 1000 ? `${(v/1000).toFixed(1)}k` : `${v}`) : metric === 'km' ? `${v}` : `${v}`}
                  width={30}
                />
                <Tooltip content={<CustomTooltip activeTab={metric} />} cursor={{ stroke: '#e2e8f0', strokeWidth: 1 }} />
                <Line 
                  type="monotone" 
                  dataKey="valor" 
                  stroke="#f97316" 
                  strokeWidth={isMobile ? 1.5 : 2.5} 
                  dot={false}
                  activeDot={<PulseDot />}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* NEW SECTION: Top Accommodations */}
      <section className="space-y-6">
        <div className="px-1">
          <span className="text-sm font-semibold text-slate-800 dark:text-stone-200 tracking-tight">Estadística por alojamiento</span>
        </div>

        {topAccommodations.length === 0 ? (
          <div className="bg-white/40 dark:bg-stone-900/20 rounded-3xl p-12 text-center border border-dashed border-slate-200 dark:border-stone-800">
            <p className="text-sm text-slate-400">No hay datos suficientes para mostrar estadísticas</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {topAccommodations.map((acc, idx) => (
              <div 
                key={acc.name}
                className="group bg-white/80 dark:bg-stone-900/60 backdrop-blur-md border border-white/60 dark:border-stone-800/50 rounded-3xl p-4 flex items-center justify-between transition-all duration-300 hover:shadow-xl hover:shadow-orange-500/5 hover:-translate-y-1"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-14 h-14 rounded-2xl overflow-hidden bg-stone-100 dark:bg-stone-800 shrink-0 border border-white/50 dark:border-stone-700 shadow-inner">
                    <img 
                      src={acc.image} 
                      alt={acc.name}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-slate-800 dark:text-stone-100 truncate">{formatName(acc.name)}</p>
                    <div className="mt-1">
                      <span className="text-[10px] font-normal text-slate-400 dark:text-stone-500 truncate block capitalize">
                        {acc.location.toLowerCase()}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="text-right shrink-0 ml-4">
                  <div className="flex flex-col items-end bg-stone-50/50 dark:bg-stone-800/50 px-3 py-2 rounded-2xl border border-white/40 dark:border-stone-700/30">
                    <span className="text-base font-normal text-slate-800 dark:text-stone-100 tabular-nums leading-none">
                      {metric === 'dinero' ? fmtEur(acc.dinero) : metric === 'km' ? `${acc.km.toFixed(1)} km` : acc.count}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Floating filter button - mobile only */}
      <div className="fixed bottom-16 right-4 z-50 sm:hidden animate-in fade-in zoom-in duration-300">
        <button
          onClick={() => setIsFilterModalOpen(true)}
          className={`relative flex items-center justify-center w-[52px] h-[52px] rounded-full shadow-2xl transition-all active:scale-[0.92] border ${
            activeFiltersCount > 0
              ? 'bg-orange-500 border-orange-400'
              : 'bg-white dark:bg-stone-800 border-stone-200 dark:border-stone-700'
          }`}
        >
          <Filter size={20} className={activeFiltersCount > 0 ? 'text-white' : 'text-orange-500'} />
          {activeFiltersCount > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold flex items-center justify-center rounded-full border-2 border-white dark:border-stone-900">
              {activeFiltersCount}
            </span>
          )}
        </button>
      </div>
      </div>
    </div>
  );
};

export default WorkerAnalytics;
