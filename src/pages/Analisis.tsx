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
import { computeWorkerEarningsInRange } from '../utils/payments';


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
    // Workers Ranking (derived from computeWorkerEarningsInRange)
    const workerRankings = workers
      .map(w => {
        const earnings = computeWorkerEarningsInRange(
          w, normalCleans, initialCleans, handymanRecords, [],
          period, customDesde, customHasta
        );
        return {
          id: w.id,
          name: w.fullName,
          value: earnings.cleanCount,
          secondaryValue: `${earnings.cleanCount} trabajos`,
          photo: w.photo
        };
      })
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    // Filter Helper for Accommodations
    const isDateInPeriod = (dateStr: string) => {
      if (!dateStr) return false;
      const recordDate = new Date(dateStr.split(' ')[0].split('T')[0]);
      recordDate.setHours(0,0,0,0);
      
      const today = new Date();
      today.setHours(0,0,0,0);

      let startDate = new Date(today);
      let endDate = new Date(today);

      if (period === 'semanal') {
        startDate.setDate(today.getDate() - 7);
      } else if (period === 'mensual') {
        startDate.setDate(today.getDate() - 30);
      } else if (period === 'trimestral') {
        startDate.setDate(today.getDate() - 90);
      } else if (period === 'personalizado' && customDesde && customHasta) {
        startDate = new Date(customDesde);
        endDate = new Date(customHasta);
        startDate.setHours(0,0,0,0);
        endDate.setHours(0,0,0,0);
      }

      return recordDate >= startDate && recordDate <= endDate;
    };

    // Accommodations Ranking (derived from real records)
    const accCounts: Record<string, number> = {};
    
    normalCleans.forEach(r => {
      if (isDateInPeriod(r.checkinFecha)) {
        accCounts[r.apartamento] = (accCounts[r.apartamento] || 0) + 1;
      }
    });
    initialCleans.forEach(r => {
      if (isDateInPeriod(r.checkinFecha)) {
        accCounts[r.apartamento] = (accCounts[r.apartamento] || 0) + 1;
      }
    });
    handymanRecords.forEach(r => {
      if (isDateInPeriod(r.fechaLlegada)) {
        accCounts[r.alojamiento] = (accCounts[r.alojamiento] || 0) + 1;
      }
    });

    const accommodationRankings = Object.entries(accCounts)
      .map(([name, count]) => ({
        id: name,
        name: name,
        value: count,
        secondaryValue: `${count} trabajos`
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    // If no checkins for rankings, fill with accommodations list (fallback)
    if (accommodationRankings.length === 0) {
        accommodations.slice(0, 5).forEach(a => {
            accommodationRankings.push({
                id: a.id,
                name: a.name,
                value: 0,
                secondaryValue: `0 trabajos`
            });
        });
        accommodationRankings.sort((a,b) => b.value - a.value);
    }

    return { workerRankings, accommodationRankings };
  }, [workers, accommodations, normalCleans, initialCleans, handymanRecords, period, customDesde, customHasta]);

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
