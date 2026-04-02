import React from 'react';
import { User, Wallet, Navigation, CheckCircle2, Edit2 } from 'lucide-react';
import { Worker } from '../../services/mockData';

interface WorkerCardProps {
  worker: Worker;
  onEdit: (worker: Worker) => void;
}

const WorkerCard: React.FC<WorkerCardProps> = ({ worker, onEdit }) => {
  const bgColor = [
    'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400',
    'bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400',
    'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400',
    'bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400',
    'bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400',
  ][parseInt(worker.id) % 5] || 'bg-slate-100 dark:bg-stone-800 text-slate-600 dark:text-stone-400';

  const initials = worker.fullName
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .substring(0, 2);

  return (
    <div className="group bg-white dark:bg-stone-950 rounded-2xl shadow-sm border border-slate-200 dark:border-stone-700/50 p-6 transition-all duration-300 hover:shadow-xl hover:shadow-blue-900/5 hover:-translate-y-1">
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center space-x-4">
          <div className={`w-14 h-14 rounded-2xl ${bgColor} flex items-center justify-center font-bold text-xl shadow-inner transition-transform group-hover:scale-105 duration-500`}>
            {initials}
          </div>
          <div>
            <h3 className="font-bold text-slate-900 dark:text-stone-100 text-lg group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
              {worker.fullName}
            </h3>
            <span className="text-xs font-medium text-slate-500 dark:text-stone-400 bg-slate-100 dark:bg-stone-800 px-2 py-1 rounded-md">
              ID: #{worker.id.padStart(3, '0')}
            </span>
          </div>
        </div>
        <button
          onClick={() => onEdit(worker)}
          className="p-2 bg-slate-50 dark:bg-stone-800 rounded-xl text-slate-400 dark:text-stone-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-all active:scale-90"
          title="Editar trabajador"
        >
          <Edit2 size={20} />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-slate-50 dark:bg-stone-800 rounded-xl p-3 border border-transparent group-hover:border-blue-100 dark:group-hover:border-blue-800/50 transition-all">
          <div className="flex items-center text-slate-500 dark:text-stone-400 mb-1">
            <Wallet size={14} className="mr-1.5" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Neto</span>
          </div>
          <div className="text-sm font-bold text-slate-900 dark:text-stone-100 font-mono">
            {worker.netMoneyMonth.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
          </div>
        </div>

        <div className="bg-slate-50 dark:bg-stone-800 rounded-xl p-3 border border-transparent group-hover:border-emerald-100 dark:group-hover:border-emerald-800/50 transition-all">
          <div className="flex items-center text-slate-500 dark:text-stone-400 mb-1">
            <CheckCircle2 size={14} className="mr-1.5" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Limpiezas</span>
          </div>
          <div className="text-sm font-bold text-slate-900 dark:text-stone-100 leading-none">
            {worker.cleansCountMonth}
          </div>
        </div>

        <div className="col-span-2 bg-slate-50 dark:bg-stone-800 rounded-xl p-3 border border-transparent group-hover:border-amber-100 dark:group-hover:border-amber-800/50 transition-all flex items-center justify-between">
          <div className="flex items-center">
            <Navigation size={14} className="text-slate-400 dark:text-stone-500 mr-2" />
            <span className="text-xs text-slate-600 dark:text-stone-400 font-medium">Distancia acumulada</span>
          </div>
          <div className="text-sm font-bold text-slate-900 dark:text-stone-100">
            {worker.kmsMonth} <span className="text-[10px] text-slate-400 dark:text-stone-500 font-normal">KM</span>
          </div>
        </div>
      </div>

      <button className="w-full mt-6 py-2.5 bg-slate-900 dark:bg-stone-700 text-white rounded-xl font-semibold text-sm transition-all hover:bg-blue-600 hover:shadow-lg hover:shadow-blue-600/30">
        Ver Detalle Completo
      </button>
    </div>
  );
};

export default WorkerCard;
