import React, { useEffect, useState } from 'react';
import type { User, Worker, NormalCleanRecord, InitialCleanRecord, HandymanRecord } from '../services/mockData';
import { appsScriptApi } from '../services/api';
import { 
  Calendar, 
  MapPin, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  Banknote,
  Search,
  History,
  TrendingUp,
  LayoutDashboard,
  CheckCircle,
  ArrowRight
} from 'lucide-react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts';
import { aggregateDailyData } from '../utils/analytics';
import LoadingSpinner from '../components/ui/LoadingSpinner';

interface WorkerPanelProps {
  user: User;
}

const WorkerPanel: React.FC<WorkerPanelProps> = ({ user }) => {
  const [loading, setLoading] = useState(true);
  const [workerData, setWorkerData] = useState<Worker | null>(null);
  
  const [history, setHistory] = useState<{
    normal: NormalCleanRecord[];
    initial: InitialCleanRecord[];
    handyman: HandymanRecord[];
  }>({
    normal: [],
    initial: [],
    handyman: [],
  });

  const [activeTab, setActiveTab] = useState<'all' | 'normal' | 'initial' | 'handyman'>('all');

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [workers, normal, initial, handyman] = await Promise.all([
          appsScriptApi.getWorkers(),
          appsScriptApi.getNormalCleans(),
          appsScriptApi.getInitialCleans(),
          appsScriptApi.getHandymanRecords()
        ]);
        
        const foundWorker = workers.find(w => 
          w.fullName.toLowerCase().includes(user.name.toLowerCase()) || 
          (w.email && w.email.toLowerCase() === user.email.toLowerCase())
        );

        if (foundWorker) {
          setWorkerData(foundWorker);
          const phone = foundWorker.telefono || '';
          const filterByPhone = (recs: any[]) => recs.filter(r => r.telefono === phone);
          
          setHistory({
            normal: filterByPhone(normal),
            initial: filterByPhone(initial),
            handyman: filterByPhone(handyman),
          });
        }
      } catch (error) {
        console.error('Error fetching worker panel data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user]);

  if (loading) {
    return <LoadingSpinner message="Preparando tu historial..." />;
  }

  const allRecords = [
    ...history.normal.map(r => ({ ...r, type: 'Normal' })),
    ...history.initial.map(r => ({ ...r, type: 'Inicial' })),
    ...history.handyman.map(r => ({ ...r, type: 'Manitas', apartamento: r.alojamiento, checkoutFecha: r.fechaFin }))
  ].sort((a, b) => new Date(b.checkoutFecha || 0).getTime() - new Date(a.checkoutFecha || 0).getTime());

  const stats = [
    { label: 'Saldo Pendiente', value: `${workerData?.owedMoney?.toFixed(2) || '0.00'}€`, icon: Banknote, color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-950/30' },
    { label: 'Limpiezas Mes', value: workerData?.cleansCountMonth || 0, icon: CheckCircle, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-950/30' },
    { label: 'Kilómetros', value: `${workerData?.kmsMonth?.toFixed(1) || '0.0'} km`, icon: TrendingUp, color: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-950/30' },
  ];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 px-1 mb-2">
        <div className="flex flex-col">
          <h1 className="text-xl font-normal text-slate-800 dark:text-stone-200 tracking-tight font-display shrink-0">
            Hola, {(workerData?.fullName || user.name).split(' ')[0]} 👋
          </h1>
          <p className="text-[11px] text-slate-400 dark:text-stone-500 font-light mt-0.5">
            Resumen de tu actividad y pagos recientes
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 items-center">
          <div className="flex bg-white/40 dark:bg-stone-900/40 p-1 rounded-xl border border-white/60 dark:border-stone-700/50 backdrop-blur-md">
             {['all', 'normal', 'initial', 'handyman'].map((tab) => (
                <button
                   key={tab}
                   onClick={() => setActiveTab(tab as any)}
                   className={`px-3 py-1.5 rounded-lg text-[9px] font-medium transition-all ${
                     activeTab === tab 
                      ? 'bg-white dark:bg-stone-700 text-orange-600 dark:text-orange-400 shadow-sm' 
                      : 'text-slate-400 dark:text-stone-500 hover:text-slate-800 dark:hover:text-stone-200'
                   }`}
                >
                   {tab === 'all' ? 'Todo' : tab === 'normal' ? 'Normal' : tab === 'initial' ? 'Inicial' : 'Manitas'}
                </button>
             ))}
          </div>
        </div>
      </header>

      <div className="space-y-8 animate-in fade-in duration-500">
        {/* Stats Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {stats.map((stat, i) => (
            <div key={i} className="group bg-white/60 dark:bg-stone-900/40 backdrop-blur-md p-6 rounded-[24px] border border-white/60 dark:border-stone-800/50 shadow-sm transition-all hover:shadow-lg hover:shadow-orange-500/5 hover:-translate-y-1">
              <div className="flex items-center justify-between mb-4">
                <div className={`p-3 rounded-2xl ${stat.bg} ${stat.color} transition-transform duration-300 group-hover:scale-110`}>
                  <stat.icon size={20} />
                </div>
                <span className="text-[10px] font-semibold text-slate-300 dark:text-stone-700 uppercase tracking-widest">{stat.label}</span>
              </div>
              <p className="text-2xl font-normal text-slate-800 dark:text-stone-100 tracking-tight font-display">
                {stat.value}
              </p>
            </div>
          ))}
        </div>

        {/* History List */}
        <section className="space-y-4">
          <div className="px-1 mb-1 flex items-center justify-between">
            <span className="text-[10px] font-semibold text-slate-400 dark:text-stone-500 uppercase tracking-wider">Actividad Reciente</span>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {allRecords
              .filter(r => activeTab === 'all' || r.type.toLowerCase().includes(activeTab))
              .map((record: any, idx) => (
              <div 
                key={idx}
                className={`group bg-white/80 dark:bg-stone-900 backdrop-blur-md border border-white/60 dark:border-stone-700/50 rounded-2xl px-6 py-4 flex items-center justify-between transition-all duration-300 hover:bg-white dark:hover:bg-stone-900/80 hover:shadow-lg hover:shadow-orange-500/5 ${
                  record.checked ? 'opacity-60 hover:opacity-100' : 'opacity-100'
                }`}
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div className="flex flex-col items-center justify-center w-10 h-10 rounded-xl bg-stone-50 dark:bg-stone-800 border border-stone-100 dark:border-stone-800 shrink-0 soft-shadow">
                    <span className="text-[8px] font-bold text-slate-400 dark:text-stone-500 uppercase leading-none">
                      {new Date(record.checkoutFecha || 0).toLocaleDateString('es-ES', { month: 'short' })}
                    </span>
                    <span className="text-sm font-bold text-slate-700 dark:text-stone-300">
                      {new Date(record.checkoutFecha || 0).getDate()}
                    </span>
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className={`px-2 py-0.5 rounded-md text-[8px] font-bold uppercase tracking-widest ${
                        record.type === 'Normal' ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400' : 
                        record.type === 'Inicial' ? 'bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400' : 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400'
                      }`}>
                        {record.type}
                      </span>
                      <span className="text-[10px] text-slate-400 dark:text-stone-500 tabular-nums">
                        {new Date(record.checkoutFecha || 0).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <h3 className="text-sm font-medium text-slate-700 dark:text-stone-200 truncate group-hover:text-orange-500 transition-colors">
                      {record.apartamento || 'Sin especificar'}
                    </h3>
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-400 dark:text-stone-500 mt-0.5">
                      <MapPin size={10} className="text-orange-400/80" />
                      <span className="truncate">{record.checkoutUbicacion || 'Ubicación registrada'} • {record.km || 0} km</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                   <div className="hidden sm:block text-right">
                      <p className="text-[10px] font-bold text-slate-700 dark:text-stone-300">
                        {record.checked ? 'Verificado' : 'En revisión'}
                      </p>
                      <p className="text-[9px] text-slate-400 dark:text-stone-500">
                        {record.checked ? 'Pago procesado' : 'Pendiente de validar'}
                      </p>
                   </div>
                   <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                      record.checked 
                        ? 'bg-green-50 dark:bg-green-900/20 text-green-500' 
                        : 'bg-amber-50 dark:bg-amber-900/20 text-amber-500'
                   }`}>
                      {record.checked ? <CheckCircle2 size={16} /> : <Clock size={16} />}
                   </div>
                </div>
              </div>
            ))}

            {allRecords.length === 0 && (
              <div className="flex flex-col items-center justify-center p-12 bg-white/30 dark:bg-stone-900/30 rounded-3xl border-2 border-dashed border-slate-200 dark:border-stone-800">
                <Search size={40} className="text-slate-300 dark:text-stone-700 mb-3" />
                <p className="text-slate-500 dark:text-stone-400 font-medium">No se encontraron registros</p>
                <p className="text-xs text-slate-400 dark:text-stone-500">Tu actividad aparecerá aquí una vez que se registre.</p>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

export default WorkerPanel;
