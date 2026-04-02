import React, { useEffect, useState } from 'react';
import AnalyticsCards from '../components/dashboard/AnalyticsCards';
import WorkersTable from '../components/dashboard/WorkersTable';
import { appsScriptApi } from '../services/api';
import { Worker, CheckInOut } from '../services/mockData';
import { Loader2 } from 'lucide-react';

const Dashboard: React.FC = () => {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [checkIns, setCheckIns] = useState<CheckInOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedWorker, setSelectedWorker] = useState<Worker | null>(null);

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

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <Loader2 className="animate-spin text-orange-600" size={32} />
        <p className="text-slate-500 font-medium">Cargando datos del dashboard...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header className="mb-6">
        <h1 className="text-xl font-normal tracking-tight text-slate-600 dark:text-stone-400 font-display">Dashboard</h1>
      </header>

      {/* Bloque A: Gráfica + Actividad */}
      <AnalyticsCards 
        checkIns={checkIns} 
        selectedWorker={selectedWorker} 
        onWorkerSelect={setSelectedWorker}
      />

      {/* Bloque B: Tabla de Trabajadores */}
      <section>
        <WorkersTable
          workers={workers}
          selectedWorker={selectedWorker}
          onWorkerSelect={setSelectedWorker}
        />
      </section>
    </div>
  );
};

export default Dashboard;
