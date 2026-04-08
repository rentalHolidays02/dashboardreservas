import React, { useEffect, useState } from 'react';
import AnalyticsCards from '../components/dashboard/AnalyticsCards';
import WorkersTable from '../components/dashboard/WorkersTable';
import { appsScriptApi } from '../services/api';
import { Worker, CheckInOut } from '../services/mockData';
import { Loader2, Search, Filter } from 'lucide-react';
import DashboardFilterModal, { Period } from '../components/dashboard/DashboardFilterModal';
import LoadingSpinner from '../components/ui/LoadingSpinner';

const Dashboard: React.FC = () => {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [checkIns, setCheckIns] = useState<CheckInOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedWorker, setSelectedWorker] = useState<Worker | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Period state
  const [period, setPeriod] = useState<Period>('semanal');
  const [customDesde, setCustomDesde] = useState('');
  const [customHasta, setCustomHasta] = useState('');
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [workersData, checkInsData] = await Promise.all([
          appsScriptApi.getWorkers(),
          appsScriptApi.getRecentCheckIns(),
        ]);
        setWorkers(workersData);
        setCheckIns(checkInsData);
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const activeFiltersCount = React.useMemo(() => {
    let count = 0;
    if (period !== 'semanal') count++;
    if (customDesde || customHasta) count++;
    return count;
  }, [period, customDesde, customHasta]);

  const filteredWorkers = React.useMemo(() => {
    return workers.filter(w => 
      w.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      w.accommodations.some(a => a.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [workers, searchTerm]);

  if (loading) {
    return <LoadingSpinner message="Cargando datos del dashboard..." />;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      {/* Header & Toolbar unificados */}
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 px-1 mb-2">
        <h1 className="text-xl font-normal text-slate-800 dark:text-stone-200 tracking-tight font-display shrink-0">
          Dashboard
        </h1>

        <div className="flex flex-col md:flex-row gap-3 justify-end items-center flex-1">
          <div className="relative w-full md:w-72">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-stone-500 pointer-events-none" size={14} />
            <input
              type="text"
              placeholder="Buscar trabajador o apto..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-white/40 dark:bg-stone-900/40 backdrop-blur-md border border-white/60 dark:border-stone-700/50 rounded-xl text-slate-700 dark:text-stone-300 text-xs font-normal placeholder:text-slate-400 dark:placeholder:text-stone-500 focus:outline-none transition-all hover:bg-white/80 dark:hover:bg-stone-800/60 focus:bg-white dark:focus:bg-stone-900"
            />
          </div>
          
          <div className="relative">
            <button 
              onClick={() => setIsFilterModalOpen(true)}
              className={`flex items-center justify-center gap-2 px-6 py-2.5 bg-white dark:bg-stone-900 backdrop-blur-md border border-white/60 dark:border-stone-700/50 rounded-xl text-xs font-normal transition-all active:scale-[0.98] relative ${
                activeFiltersCount > 0 ? 'text-orange-600 dark:text-orange-400 font-medium bg-white/90 dark:bg-stone-800/90' : 'text-orange-500/80 dark:text-orange-500/70 hover:text-orange-500 dark:hover:text-orange-400 hover:bg-white/80 dark:hover:bg-stone-800/60'
              }`}
            >
              <Filter size={12} className="text-orange-500" />
              <span>Periodo</span>
              {activeFiltersCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-orange-600 text-white text-[10px] flex items-center justify-center rounded-full animate-in zoom-in-50">
                  {activeFiltersCount}
                </span>
              )}
            </button>

            <DashboardFilterModal 
              isOpen={isFilterModalOpen}
              onClose={() => setIsFilterModalOpen(false)}
              period={period}
              customDesde={customDesde}
              customHasta={customHasta}
              onApply={(updates) => {
                if (updates.period) setPeriod(updates.period);
                if (updates.customDesde !== undefined) setCustomDesde(updates.customDesde);
                if (updates.customHasta !== undefined) setCustomHasta(updates.customHasta);
              }}
            />
          </div>
        </div>
      </header>

      {/* Bloque A: Gráfica + Actividad */}
      <AnalyticsCards
        checkIns={checkIns}
        selectedWorker={selectedWorker}
        onWorkerSelect={setSelectedWorker}
        workers={workers}
        period={period}
        customDesde={customDesde}
        customHasta={customHasta}
      />

      {/* Bloque B: Tabla de Trabajadores */}
      <section>
        <WorkersTable
          workers={filteredWorkers}
          selectedWorker={selectedWorker}
          onWorkerSelect={setSelectedWorker}
        />
      </section>
    </div>
  );
};

export default Dashboard;
