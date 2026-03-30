import React, { useEffect, useState } from 'react';
import AnalyticsCards from '../components/dashboard/AnalyticsCards';
import WorkersTable from '../components/dashboard/WorkersTable';
import { appsScriptApi } from '../services/api';
import { Worker, CheckInOut, Incidencia } from '../services/mockData';
import { Loader2 } from 'lucide-react';

const Dashboard: React.FC = () => {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [checkIns, setCheckIns] = useState<CheckInOut[]>([]);
  const [incidencias, setIncidencias] = useState<Incidencia[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [workersData, checkInsData, incidenciasData] = await Promise.all([
          appsScriptApi.getWorkers(),
          appsScriptApi.getRecentCheckIns(),
          appsScriptApi.getRecentIncidencias()
        ]);
        setWorkers(workersData);
        setCheckIns(checkInsData);
        setIncidencias(incidenciasData);
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
        <Loader2 className="animate-spin text-blue-600" size={40} />
        <p className="text-slate-500 font-medium">Cargando datos del dashboard...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header className="mb-10 pb-6 border-b border-slate-200">
        <h1 className="text-3xl font-medium tracking-tight text-slate-900 font-display">Dashboard</h1>
      </header>

      {/* Bloque A: Módulos de analítica */}
      <AnalyticsCards checkIns={checkIns} incidencias={incidencias} />

      {/* Bloque B: Tabla de Trabajadores */}
      <section>
        <WorkersTable workers={workers} />
      </section>
    </div>
  );
};

export default Dashboard;
