import React from 'react';
import { Phone, MapPin, Edit2 } from 'lucide-react';
import { Worker } from '../../services/mockData';

interface WorkerCardProps {
  worker: Worker;
  onEdit: (worker: Worker) => void;
}

const PAGO_CONFIG: Record<string, string> = {
  bizum:    'Bizum',
  tarjeta:  'Tarjeta',
  efectivo: 'Efectivo',
};

function getInitials(fullName: string): string {
  return fullName
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

const WorkerCard: React.FC<WorkerCardProps> = ({ worker, onEdit }) => {
  const initials = getInitials(worker.fullName);

  return (
    <div className="group bg-white dark:bg-stone-900 rounded-2xl border border-stone-100 dark:border-stone-800 hover:scale-[0.99] hover:opacity-80 transition-all duration-300 overflow-hidden">

      {/* Header */}
      <div className="p-5 flex items-start justify-between">
        <div className="flex items-center gap-3.5">
          {/* Avatar */}
          <div className="w-11 h-11 rounded-xl flex-shrink-0 overflow-hidden">
            {worker.photo ? (
              <img
                src={worker.photo}
                alt={worker.fullName}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="w-full h-full flex items-center justify-center text-sm font-semibold tracking-wide bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300">
                {initials}
              </span>
            )}
          </div>

          <div>
            <h3 className="text-sm font-semibold text-slate-800 dark:text-stone-100 leading-tight group-hover:text-orange-500 transition-colors">
              {worker.fullName}
            </h3>
            <span className="flex items-center gap-1 text-[11px] text-slate-400 dark:text-stone-500 mt-0.5">
              <Phone size={10} className="flex-shrink-0" />
              {worker.telefono || '—'}
            </span>
          </div>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onEdit(worker); }}
          className="p-1.5 rounded-lg text-slate-300 dark:text-stone-600 hover:text-orange-500 dark:hover:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-all active:scale-90"
          title="Editar trabajador"
        >
          <Edit2 size={15} />
        </button>
      </div>

      {/* Stats strip */}
      <div className="mx-5 mb-4 grid grid-cols-2 divide-x divide-stone-100 dark:divide-stone-800 bg-stone-50 dark:bg-stone-800/50 rounded-xl overflow-hidden">
        <div className="px-4 py-2.5 flex flex-col justify-center">
          <div className="text-xs font-bold text-slate-700 dark:text-stone-200">
            {worker.tipoPago ? PAGO_CONFIG[worker.tipoPago] : '—'}
          </div>
          <div className="text-[10px] text-slate-400 dark:text-stone-500 mt-0.5 tabular-nums">
            {worker.pagoPorReserva != null ? `${worker.pagoPorReserva}€ por reserva` : '—'}
          </div>
        </div>
        <div className="px-4 py-2.5 text-center flex flex-col justify-center">
          <div className="text-sm font-bold text-orange-600 dark:text-orange-400 tabular-nums">
            {(worker.netMoneyMonth ?? 0).toLocaleString('es-ES', { maximumFractionDigits: 0 })}€
          </div>
          <div className="text-[10px] text-slate-400 dark:text-stone-500 mt-0.5">Por cobrar</div>
        </div>
      </div>

      {/* Footer */}
      {worker.accommodations && worker.accommodations.length > 0 && (
        <div className="px-5 pb-5 flex items-center gap-1 min-w-0">
          <MapPin size={10} className="text-slate-300 dark:text-stone-600 flex-shrink-0" />
          <span className="text-[11px] text-slate-400 dark:text-stone-500 truncate">
            {worker.accommodations.slice(0, 2).join(', ')}
            {worker.accommodations.length > 2 && (
              <span className="text-slate-300 dark:text-stone-600 ml-1">+{worker.accommodations.length - 2}</span>
            )}
          </span>
        </div>
      )}
    </div>
  );
};

export default WorkerCard;
