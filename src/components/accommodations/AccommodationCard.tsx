import React from 'react';
import { MapPin, Pencil, Building2, Users } from 'lucide-react';
import { Accommodation } from '../../services/mockData';
import defaultAccImage from '../../assets/default_accommodation.png';

interface AccommodationCardProps {
  accommodation: Accommodation;
  assignedWorkersCount: number;
  onEdit: (accommodation: Accommodation) => void;
}

const toTitleCase = (str: string) =>
  str.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());

const AccommodationCard: React.FC<AccommodationCardProps> = ({ accommodation, assignedWorkersCount, onEdit }) => {
  return (
    <div className={`group flex flex-col gap-3 transition-opacity duration-300 ${!accommodation.active ? 'opacity-40 grayscale-[0.5]' : ''}`}>
      {/* Image Container (Airbnb Style) */}
      <div className="aspect-square w-full rounded-2xl overflow-hidden relative bg-stone-100 dark:bg-stone-800 border border-stone-100 dark:border-stone-800/50 shadow-sm">
        <img 
          src={accommodation.image || defaultAccImage} 
          alt={accommodation.name} 
          className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-110" 
        />
        
        {/* Top Badges */}
        <div className="absolute top-3 left-3 right-3 flex items-start justify-between">
          {/* Reference Badge */}
          <div className="px-2 py-1 bg-white/90 dark:bg-stone-900/90 backdrop-blur-md rounded-lg text-[9px] font-medium text-slate-700 dark:text-stone-300 shadow-sm border border-stone-100 dark:border-stone-800">
            {accommodation.ref || 'S/R'}
          </div>

          {/* Edit Button (Pencil) */}
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(accommodation); }}
            className="p-2 bg-white/90 dark:bg-stone-900/90 backdrop-blur-md rounded-full text-slate-500 dark:text-stone-400 hover:text-orange-500 hover:scale-110 transition-all border border-stone-100 dark:border-stone-800 shadow-sm"
          >
            <Pencil size={12} />
          </button>
        </div>

        {/* Workers Count Badge (Bottom Left) */}
        <div className="absolute bottom-3 left-3 px-2.5 py-1.5 bg-slate-900/80 dark:bg-black/80 backdrop-blur-md rounded-xl text-[10px] font-normal text-white flex items-center gap-1.5 shadow-lg">
          <Users size={10} className="text-orange-400" />
          <span>{assignedWorkersCount} {assignedWorkersCount === 1 ? 'Operario' : 'Operarios'}</span>
        </div>
      </div>
      
      {/* Details */}
      <div className="flex flex-col gap-0.5 px-0.5">
        <div className="flex items-center justify-between gap-2">
          <h4 className="text-sm font-normal text-slate-800 dark:text-stone-200 truncate group-hover:text-orange-600 transition-colors">
            {toTitleCase(accommodation.name)}
          </h4>
          <div className="flex items-center gap-1 text-[10px] text-slate-400 dark:text-stone-500 whitespace-nowrap">
            <Building2 size={10} />
            {accommodation.zipCode || '-'}
          </div>
        </div>
        <p className="text-[11px] text-slate-500 dark:text-stone-400 font-light truncate">
          {toTitleCase(accommodation.city)} • <span className="text-[10px] opacity-70">{toTitleCase(accommodation.address)}</span>
        </p>
      </div>
    </div>
  );
};

export default AccommodationCard;
