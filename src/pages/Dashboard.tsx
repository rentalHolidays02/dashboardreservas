import React, { useEffect, useState } from 'react';
import AnalyticsCards from '../components/dashboard/AnalyticsCards';
import WorkersTable from '../components/dashboard/WorkersTable';
import { appsScriptApi } from '../services/api';
import { Worker } from '../services/mockData';
import { Loader2 } from 'lucide-react';

const Dashboard: React.FC = () => {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [analytics, setAnalytics] = useState({ totalMoney: 0, totalCleans: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [workersData, analyticsData] = await Promise.all([
          appsScriptApi.getWorkers(),
          appsScriptApi.getAnalytics()
        ]);
        setWorkers(workersData);
        setAnalytics(analyticsData);
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
      <header>
        <h1 className="text-3xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-slate-500 mt-1">Resumen general de pagos y limpiezas del mes actual.</p>
      </header>

      {/* Bloque A: Analíticas */}
      <AnalyticsCards 
        totalMoney={analytics.totalMoney} 
        totalCleans={analytics.totalCleans} 
      />

      {/* Bloque B: Tabla de Trabajadores */}
      <section>
        <WorkersTable workers={workers} />
      </section>
    </div>
  );
};

export default Dashboard;
