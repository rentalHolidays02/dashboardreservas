import React, { useEffect, useState } from 'react';
import type { User, Worker, NormalCleanRecord, InitialCleanRecord, HandymanRecord } from '../services/mockData';
import { appsScriptApi } from '../services/api';
import { 
  Banknote,
  TrendingUp,
  User as UserIcon
} from 'lucide-react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts';
import { aggregateDailyData } from '../utils/analytics';
import LoadingSpinner from '../components/ui/LoadingSpinner';

interface WorkerAnalyticsProps {
  user: User;
}

const WorkerAnalytics: React.FC<WorkerAnalyticsProps> = ({ user }) => {
  const [loading, setLoading] = useState(true);
  const [workerData, setWorkerData] = useState<Worker | null>(null);
  const [allWorkers, setAllWorkers] = useState<Worker[]>([]);
  const [selectedWorkerId, setSelectedWorkerId] = useState<string | null>(null);
  
  const [globalRecords, setGlobalRecords] = useState<{
    normal: NormalCleanRecord[];
    initial: InitialCleanRecord[];
    handyman: HandymanRecord[];
  }>({
    normal: [],
    initial: [],
    handyman: [],
  });

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
        
        setAllWorkers(workers);
        setGlobalRecords({ normal, initial, handyman });

        const foundWorker = workers.find(w => 
          w.fullName.toLowerCase().includes(user.name.toLowerCase()) || 
          (w.email && w.email.toLowerCase() === user.email.toLowerCase())
        ) || workers[0];

        if (foundWorker && !selectedWorkerId) {
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
  }, [selectedWorkerId, allWorkers]);

  if (loading) {
    return <LoadingSpinner message="Preparando tus analíticas..." />;
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <header className="px-1 mb-2">
        <h1 className="text-xl font-normal text-slate-800 dark:text-stone-200 tracking-tight font-display shrink-0">
          Tus Analíticas
        </h1>
        <p className="text-[11px] text-slate-400 dark:text-stone-500 font-light mt-0.5">
          Visualiza tu rendimiento y crecimiento en tiempo real
        </p>
      </header>

      <div className="space-y-6 animate-in fade-in zoom-in-95 duration-500">
        {/* Worker Selector (Simulated - Admin Only) */}
        {user.role !== 'trabajador' && (
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-white/60 dark:bg-stone-900/40 backdrop-blur-md p-6 rounded-[32px] border border-white/60 dark:border-stone-800/50 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-orange-100 dark:bg-orange-950/30 flex items-center justify-center text-orange-600 dark:text-orange-400">
                <UserIcon size={24} />
              </div>
              <div>
                <p className="text-[10px] font-semibold text-slate-400 dark:text-stone-500 uppercase tracking-widest">Trabajador seleccionado</p>
                <h3 className="text-lg font-medium text-slate-800 dark:text-stone-100">{workerData?.fullName}</h3>
              </div>
            </div>
            
            <div className="flex items-center gap-3 w-full md:w-auto">
              <span className="text-[10px] font-medium text-slate-400 dark:text-stone-500 hidden sm:block">Simular como:</span>
              <select 
                value={selectedWorkerId || ''} 
                onChange={(e) => setSelectedWorkerId(e.target.value)}
                className="flex-1 md:w-64 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl px-4 py-2.5 text-xs text-slate-700 dark:text-stone-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 transition-all cursor-pointer"
              >
                {allWorkers.map(w => (
                  <option key={w.id} value={w.id}>{w.fullName}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Analytics Chart Card */}
        <div className="bg-white/60 dark:bg-stone-900/40 backdrop-blur-md p-8 rounded-[32px] border border-white/60 dark:border-stone-800/50 shadow-sm">
           <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-orange-500 text-white shadow-lg shadow-orange-500/20">
                  <TrendingUp size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-medium text-slate-800 dark:text-stone-100 tracking-tight">Ingresos diarios</h2>
                  <p className="text-[10px] text-slate-400 dark:text-stone-500">Últimos 30 días de actividad</p>
                </div>
              </div>
              <div className="text-right">
                 <p className="text-[10px] font-semibold text-slate-400 dark:text-stone-500 uppercase tracking-widest mb-1">Total Periodo</p>
                 <p className="text-2xl font-normal text-slate-800 dark:text-stone-100 tracking-tight font-display">
                    {workerData?.netMoneyMonth?.toFixed(2)}€
                 </p>
              </div>
           </div>

           <div className="h-[350px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                 <LineChart 
                    data={aggregateDailyData(
                      allWorkers, 
                      globalRecords.normal, 
                      globalRecords.initial, 
                      globalRecords.handyman, 
                      'mensual', 
                      '', '', 
                      selectedWorkerId
                    ).map(d => ({ label: d.label, valor: d.dinero }))}
                    margin={{ top: 5, right: 10, left: 0, bottom: 0 }}
                 >
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.03)" vertical={false} />
                    <XAxis 
                      dataKey="label" 
                      tick={{ fontSize: 10, fill: '#94a3b8' }} 
                      axisLine={false} 
                      tickLine={false}
                      dy={10}
                    />
                    <YAxis 
                      tick={{ fontSize: 10, fill: '#94a3b8' }} 
                      axisLine={false} 
                      tickLine={false}
                      tickFormatter={(v) => `${v}€`}
                      width={40}
                    />
                    <Tooltip 
                      content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="bg-white dark:bg-stone-800 border-2 border-white dark:border-stone-700 rounded-xl px-3 py-2 text-xs soft-shadow">
                              <p className="text-slate-400 dark:text-stone-500 mb-0.5">{label}</p>
                              <p className="font-medium text-orange-600 dark:text-orange-400">{payload[0].value.toFixed(2)}€</p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="valor" 
                      stroke="#f97316" 
                      strokeWidth={4} 
                      dot={false}
                      activeDot={{ r: 6, fill: '#f97316', stroke: '#fff', strokeWidth: 3 }}
                    />
                 </LineChart>
              </ResponsiveContainer>
           </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
           <div className="bg-blue-50/50 dark:bg-blue-900/10 backdrop-blur-sm p-6 rounded-[28px] border border-blue-100/50 dark:border-blue-800/30">
              <h4 className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-4">Estimación de Cobro</h4>
              <div className="flex items-end justify-between">
                 <div className="space-y-1">
                    <p className="text-2xl font-normal text-slate-800 dark:text-stone-100 tracking-tight font-display">{workerData?.netMoneyMonth?.toFixed(2)}€</p>
                    <p className="text-[10px] text-slate-400 dark:text-stone-500">Pendiente de transferencia</p>
                 </div>
                 <div className="p-3 rounded-2xl bg-blue-500 text-white shadow-lg shadow-blue-500/20">
                    <Banknote size={20} />
                 </div>
              </div>
           </div>
           
           <div className="bg-green-50/50 dark:bg-green-900/10 backdrop-blur-sm p-6 rounded-[28px] border border-green-100/50 dark:border-green-800/30">
              <h4 className="text-[10px] font-bold text-green-600 dark:text-green-400 uppercase tracking-widest mb-4">Kilómetros Acumulados</h4>
              <div className="flex items-end justify-between">
                 <div className="space-y-1">
                    <p className="text-2xl font-normal text-slate-800 dark:text-stone-100 tracking-tight font-display">{workerData?.kmsMonth?.toFixed(1)} km</p>
                    <p className="text-[10px] text-slate-400 dark:text-stone-500">Compensación según tarifa</p>
                 </div>
                 <div className="p-3 rounded-2xl bg-green-500 text-white shadow-lg shadow-green-500/20">
                    <TrendingUp size={20} />
                 </div>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};

export default WorkerAnalytics;
