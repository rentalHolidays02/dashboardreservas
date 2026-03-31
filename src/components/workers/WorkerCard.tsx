import React from 'react';
import { User, Wallet, Navigation, CheckCircle2, Edit2 } from 'lucide-react';
import { Worker } from '../../services/mockData';

interface WorkerCardProps {
  worker: Worker;
  onEdit: (worker: Worker) => void;
}

const WorkerCard: React.FC<WorkerCardProps> = ({ worker, onEdit }) => {
  // Generar un color de fondo basado en el ID para el avatar
  const bgColor = [
    'bg-blue-100 text-blue-600',
    'bg-purple-100 text-purple-600',
    'bg-emerald-100 text-emerald-600',
    'bg-amber-100 text-amber-600',
    'bg-rose-100 text-rose-600',
  ][parseInt(worker.id) % 5] || 'bg-slate-100 text-slate-600';

  const initials = worker.fullName
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .substring(0, 2);

  return (
    <div className="group bg-white rounded-2xl shadow-sm border border-slate-200 p-6 transition-all duration-300 hover:shadow-xl hover:shadow-blue-900/5 hover:-translate-y-1">
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center space-x-4">
          <div className={`w-14 h-14 rounded-2xl ${bgColor} flex items-center justify-center font-bold text-xl shadow-inner transition-transform group-hover:scale-105 duration-500`}>
            {initials}
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-lg group-hover:text-blue-600 transition-colors">
              {worker.fullName}
            </h3>
            <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-1 rounded-md">
              ID: #{worker.id.padStart(3, '0')}
            </span>
          </div>
        </div>
        <button 
          onClick={() => onEdit(worker)}
          className="p-2 bg-slate-50 rounded-xl text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-all active:scale-90"
          title="Editar trabajador"
        >
          <Edit2 size={20} />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-slate-50 rounded-xl p-3 border border-transparent group-hover:border-blue-100 transition-all">
          <div className="flex items-center text-slate-500 mb-1">
            <Wallet size={14} className="mr-1.5" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Neto</span>
          </div>
          <div className="text-sm font-bold text-slate-900 font-mono">
            {worker.netMoneyMonth.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
          </div>
        </div>

        <div className="bg-slate-50 rounded-xl p-3 border border-transparent group-hover:border-emerald-100 transition-all">
          <div className="flex items-center text-slate-500 mb-1">
            <CheckCircle2 size={14} className="mr-1.5" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Limpiezas</span>
          </div>
          <div className="text-sm font-bold text-slate-900 leading-none">
            {worker.cleansCountMonth}
          </div>
        </div>

        <div className="col-span-2 bg-slate-50 rounded-xl p-3 border border-transparent group-hover:border-amber-100 transition-all flex items-center justify-between">
          <div className="flex items-center">
            <Navigation size={14} className="text-slate-400 mr-2" />
            <span className="text-xs text-slate-600 font-medium">Distancia acumulada</span>
          </div>
          <div className="text-sm font-bold text-slate-900">
            {worker.kmsMonth} <span className="text-[10px] text-slate-400 font-normal">KM</span>
          </div>
        </div>
      </div>

      <button className="w-full mt-6 py-2.5 bg-slate-900 text-white rounded-xl font-semibold text-sm transition-all hover:bg-blue-600 hover:shadow-lg hover:shadow-blue-600/30">
        Ver Detalle Completo
      </button>
    </div>
  );
};

export default WorkerCard;
