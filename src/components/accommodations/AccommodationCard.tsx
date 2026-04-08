import React from 'react';
import { MapPin, Edit2, Building2, Users } from 'lucide-react';
import { Accommodation } from '../../services/mockData';

interface AccommodationCardProps {
  accommodation: Accommodation;
  assignedWorkersCount: number;
  onEdit: (accommodation: Accommodation) => void;
}

const toTitleCase = (str: string) =>
  str.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());

const AccommodationCard: React.FC<AccommodationCardProps> = ({ accommodation, assignedWorkersCount, onEdit }) => {
  return (
    <div className={`group bg-white dark:bg-stone-900 rounded-2xl border border-stone-100 dark:border-stone-800 hover:scale-[0.98] hover:opacity-80 transition-all duration-300 overflow-hidden ${!accommodation.active ? 'opacity-40 grayscale-[0.5]' : ''}`}>

      {/* Header */}
      <div className="p-5 flex items-start justify-between">
        <div className="flex items-center gap-3.5">
          {/* Icon/Avatar — solo si hay imagen */}
          {accommodation.image && (
            <div className="w-11 h-11 rounded-xl flex-shrink-0 overflow-hidden">
              <img
                src={accommodation.image}
                alt={accommodation.name}
                className="w-full h-full object-cover"
              />
            </div>
          )}

          <div>
            <h3 className="text-sm font-normal text-slate-900 dark:text-stone-100 leading-tight transition-colors">
              {toTitleCase(accommodation.name)}
            </h3>
            <span className="flex items-center gap-1 text-[11px] text-slate-400 dark:text-stone-500 mt-2">
              <MapPin size={10} className="flex-shrink-0 text-orange-500" />
              {toTitleCase(accommodation.city)}
            </span>
          </div>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onEdit(accommodation); }}
          className="p-1.5 rounded-lg text-slate-300 dark:text-stone-600 hover:text-orange-500 dark:hover:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-all active:scale-90"
          title="Editar alojamiento"
        >
          <Edit2 size={15} />
        </button>
      </div>

      {/* Info strip */}
      <div className="mx-5 mb-4 grid grid-cols-2 divide-x divide-stone-100 dark:divide-stone-800 bg-stone-50 dark:bg-stone-800/50 rounded-xl overflow-hidden">
        <div className="px-4 py-2.5 flex flex-col justify-center">
          <div className="text-[10px] text-slate-400 dark:text-stone-500 uppercase tracking-widest">
            Trabajadores
          </div>
          <div className="text-xs font-normal mt-0.5 flex items-center gap-1.5 text-slate-700 dark:text-stone-200">
            <Users size={12} className="text-orange-500" />
            {assignedWorkersCount} {assignedWorkersCount === 1 ? 'asignado' : 'asignados'}
          </div>
        </div>
        <div className="px-4 py-2.5 text-center flex flex-col justify-center">
          <div className="text-[10px] text-slate-400 dark:text-stone-500 uppercase tracking-wider">
            CP
          </div>
          <div className="text-sm font-normal text-slate-700 dark:text-stone-200 tabular-nums">
            {accommodation.zipCode}
          </div>
        </div>
      </div>

      {/* Address */}
      <div className="px-5 pb-5 flex items-start gap-1 min-w-0">
        <Building2 size={10} className="text-orange-500 mt-0.5 flex-shrink-0" />
        <span className="text-[11px] text-slate-400 dark:text-stone-500 line-clamp-1">
          {toTitleCase(accommodation.address)}
        </span>
      </div>
    </div>
  );
};

export default AccommodationCard;
