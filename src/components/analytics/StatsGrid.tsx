import React from 'react';
import { Euro, Calendar, Ruler, TrendingUp } from 'lucide-react';

interface StatsGridProps {
  totalRevenue: number;
  totalCleans: number;
  totalKms: number;
  avgPerClean: number;
}

const StatsGrid: React.FC<StatsGridProps> = ({ totalRevenue, totalCleans, totalKms, avgPerClean }) => {
  const stats = [
    { label: 'Ingresos Totales', value: totalRevenue, icon: Euro, suffix: '€', color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-500/20' },
    { label: 'Limpiezas Realizadas', value: totalCleans, icon: Calendar, suffix: '', color: 'text-orange-500 dark:text-orange-500', bg: 'bg-orange-500/15' },
    { label: 'Kilómetros Totales', value: totalKms, icon: Ruler, suffix: ' km', color: 'text-orange-400 dark:text-orange-600', bg: 'bg-orange-500/10' },
    { label: 'Promedio por Limpieza', value: avgPerClean, icon: TrendingUp, suffix: '€', color: 'text-orange-500/80 dark:text-orange-400/80', bg: 'bg-orange-500/5' },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat, idx) => (
        <div key={idx} className="bg-white/40 dark:bg-stone-900/40 backdrop-blur-md border border-white/60 dark:border-stone-800/50 rounded-2xl p-5 flex items-center gap-4 group hover:bg-white/60 dark:hover:bg-stone-900/60 transition-all duration-300">
          <div className={`${stat.bg} ${stat.color} p-3 rounded-xl group-hover:scale-110 transition-transform duration-300`}>
            <stat.icon size={20} />
          </div>
          <div>
            <p className="text-[11px] font-normal text-slate-400 dark:text-stone-500 uppercase tracking-widest mb-0.5">{stat.label}</p>
            <p className="text-xl font-normal text-slate-800 dark:text-stone-200 tracking-tight font-display">
              {stat.value.toLocaleString('es-ES', { maximumFractionDigits: 1 })}{stat.suffix}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
};

export default StatsGrid;
