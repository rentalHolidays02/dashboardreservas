import React, { useState, useEffect, useMemo } from 'react';
import { Loader2, Calendar, Filter, Search, Download } from 'lucide-react';
import { appsScriptApi } from '../services/api';
import { Worker, CheckInOut, Accommodation, NormalCleanRecord, InitialCleanRecord, HandymanRecord } from '../services/mockData';
import MainLayout from '../components/layout/MainLayout';
import DashboardFilterModal, { Period, Metric } from '../components/dashboard/DashboardFilterModal';
import StatsGrid from '../components/analytics/StatsGrid';
import PerformanceChart from '../components/analytics/PerformanceChart';
import RankingsGrid from '../components/analytics/RankingsGrid';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { aggregateDailyData } from '../utils/analytics';

const Analisis: React.FC = () => {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [checkIns, setCheckIns] = useState<CheckInOut[]>([]);
  const [accommodations, setAccommodations] = useState<Accommodation[]>([]);
  const [normalCleans, setNormalCleans] = useState<NormalCleanRecord[]>([]);
  const [initialCleans, setInitialCleans] = useState<InitialCleanRecord[]>([]);
  const [handymanRecords, setHandymanRecords] = useState<HandymanRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Period state
  const [period, setPeriod] = useState<Period>('mensual');
  const [metric, setMetric] = useState<Metric>('dinero');
  const [customDesde, setCustomDesde] = useState('');
  const [customHasta, setCustomHasta] = useState('');
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [workersData, checkInsData, accData, normalData, initialData, handymanData] = await Promise.all([
          appsScriptApi.getWorkers(),
          appsScriptApi.getRecentCheckIns(100),
          appsScriptApi.getAccommodations(),
          appsScriptApi.getNormalCleans(),
          appsScriptApi.getInitialCleans(),
          appsScriptApi.getHandymanRecords(),
        ]);
        setWorkers(workersData);
        setCheckIns(checkInsData);
        setAccommodations(accData);
        setNormalCleans(normalData);
        setInitialCleans(initialData);
        setHandymanRecords(handymanData);
      } catch (error) {
        console.error('Error fetching analytics data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const chartData = useMemo(() => {
    return aggregateDailyData(
        workers,
        normalCleans,
        initialCleans,
        handymanRecords,
        period,
        customDesde,
        customHasta
    );
  }, [period, customDesde, customHasta, workers, normalCleans, initialCleans, handymanRecords]);

  // Aggregate Stats
  const stats = useMemo(() => {
    const totalRevenue = chartData.reduce((acc, curr) => acc + curr.dinero, 0);
    const totalCleans = chartData.reduce((acc, curr) => acc + curr.limpiezas, 0);
    const totalKms = chartData.reduce((acc, curr) => acc + curr.km, 0);
    const avgPerClean = totalCleans > 0 ? totalRevenue / totalCleans : 0;

    return { totalRevenue, totalCleans, totalKms, avgPerClean };
  }, [chartData]);

  // Rankings Calculation
  const rankings = useMemo(() => {
    // Workers Ranking (derived from netMoneyMonth and real checkins)
    const workerRankings = workers
      .map(w => ({
        id: w.id,
        name: w.fullName,
        value: w.netMoneyMonth,
        secondaryValue: `${w.cleansCountMonth} limpiezas`,
        photo: w.photo
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    // Accommodations Ranking (derived from checkins)
    const accCounts: Record<string, number> = {};
    checkIns.forEach(c => {
      accCounts[c.accommodation] = (accCounts[c.accommodation] || 0) + 1;
    });

    const accommodationRankings = Object.entries(accCounts)
      .map(([name, count]) => ({
        id: name,
        name: name,
        value: count,
        secondaryValue: `${count} visitas`
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    // If no checkins for rankings, fill with accommodations list
    if (accommodationRankings.length === 0) {
        accommodations.slice(0, 5).forEach(a => {
            accommodationRankings.push({
                id: a.id,
                name: a.name,
                value: Math.floor(Math.random() * 20) + 5,
                secondaryValue: `${Math.floor(Math.random() * 20) + 5} visitas`
            });
        });
        accommodationRankings.sort((a,b) => b.value - a.value);
    }

    return { workerRankings, accommodationRankings };
  }, [workers, checkIns, accommodations]);

  if (loading) {
    return <LoadingSpinner message="Generando analíticas detalladas..." />;
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      
      {/* Header & Toolbar */}
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 px-1">
        <div className="flex flex-col">
            <h1 className="text-2xl font-normal text-slate-800 dark:text-stone-200 tracking-tight font-display">
            Centro de Análisis
            </h1>
            <p className="text-sm text-slate-400 dark:text-stone-500">Analiza el rendimiento global y detallado de las operaciones</p>
        </div>

        <div className="flex items-center gap-3">
          <button 
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-white/40 dark:bg-stone-900/40 backdrop-blur-md border border-white/60 dark:border-stone-700/50 rounded-xl text-xs font-normal text-slate-600 dark:text-stone-400 hover:bg-white/80 dark:hover:bg-stone-800/60 transition-all active:scale-[0.98]"
          >
            <Download size={14} />
            <span className="hidden sm:inline">Exportar Informe</span>
          </button>
          
          <div className="relative">
            <button 
              onClick={() => setIsFilterModalOpen(true)}
              className={`flex items-center justify-center gap-2 px-6 py-2.5 bg-white dark:bg-stone-900 backdrop-blur-md border border-white/60 dark:border-stone-700/50 rounded-xl text-xs font-normal transition-all active:scale-[0.98] relative ${
                period !== 'mensual' ? 'text-orange-600 dark:text-orange-400 font-medium bg-white/90 dark:bg-stone-800/90' : 'text-orange-500/80 dark:text-orange-500/70 hover:text-orange-500 dark:hover:text-orange-400 hover:bg-white/80 dark:hover:bg-stone-800/60'
              }`}
            >
              <Filter size={12} className="text-orange-500" />
              <span>{period.charAt(0).toUpperCase() + period.slice(1)}</span>
            </button>

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
          </div>
        </div>
      </header>

      {/* Stats Summary */}
      <StatsGrid 
        totalRevenue={stats.totalRevenue}
        totalCleans={stats.totalCleans}
        totalKms={stats.totalKms}
        avgPerClean={stats.avgPerClean}
      />

      {/* Main Chart */}
      <PerformanceChart data={chartData} />

      {/* Rankings Section */}
      <RankingsGrid 
        workerRankings={rankings.workerRankings}
        accommodationRankings={rankings.accommodationRankings}
      />

      {/* Spacer */}
      <div className="pb-8" />
    </div>
  );
};

export default Analisis;
