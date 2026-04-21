import React from 'react';
import { X, CheckCircle2, MapPin, Activity, RotateCcw } from 'lucide-react';

export interface AccommodationFilters {
  city: string; // 'all' o el nombre de la ciudad
  status: 'all' | 'active' | 'inactive';
}

interface AccommodationFilterModalProps {
  isOpen: boolean;
  onClose: () => void;
  filters: AccommodationFilters;
  onApply: (filters: AccommodationFilters) => void;
  availableCities: string[];
}

const AccommodationFilterModal: React.FC<AccommodationFilterModalProps> = ({ 
  isOpen, 
  onClose, 
  filters, 
  onApply,
  availableCities
}) => {
  const updateFilters = (updates: Partial<AccommodationFilters>) => {
    onApply({ ...filters, ...updates });
  };

  const clearFilters = () => {
    onApply({
      city: 'all',
      status: 'all'
    });
  };

  return (
    <>
      {/* Backdrop */}
      <div 
        className={`fixed inset-0 z-[105] transition-opacity duration-300 ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      {/* Popover Content */}
      <div className={`absolute top-full right-0 mt-3 z-[110] bg-white/90 dark:bg-stone-900/95 backdrop-blur-xl w-[320px] rounded-2xl overflow-hidden border border-white/60 dark:border-stone-800/50 soft-shadow transition-all duration-300 ease-out origin-top-right ${
        isOpen 
          ? 'opacity-100 scale-100 translate-y-0 pointer-events-auto' 
          : 'opacity-0 scale-95 -translate-y-2 pointer-events-none'
      }`}>
        
        {/* Header */}
        <div className="px-5 py-4 flex items-center justify-between border-b border-stone-100 dark:border-stone-800/50">
          <h2 className="text-base font-normal text-slate-800 dark:text-stone-200 font-display tracking-tight">Filtros de Alojamientos</h2>
          <button 
            onClick={onClose}
            className="p-1.5 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-lg transition-colors text-slate-400 hover:text-slate-600 dark:hover:text-stone-200"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          
          {/* Section 1: Ciudad */}
          <div className="space-y-3">
            <p className="text-[11px] font-normal text-slate-400 dark:text-stone-500 uppercase tracking-widest text-left">Ciudad</p>
            <div className="flex flex-col gap-2 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
              {['all', ...availableCities].map(city => {
                const isActive = filters.city === city;
                return (
                  <button
                    key={city}
                    onClick={() => updateFilters({ city })}
                    className={`px-3 py-2 rounded-xl text-xs transition-all flex items-center justify-center active:scale-[0.98] border text-center ${
                      isActive
                        ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-800/50 font-normal'
                        : 'bg-white dark:bg-stone-800 text-slate-500 dark:text-stone-400 border-stone-100 dark:border-stone-700/50 hover:bg-stone-50 dark:hover:bg-stone-700/50'
                    }`}
                  >
                    <span className="capitalize whitespace-nowrap overflow-hidden text-ellipsis">
                      {city === 'all' ? 'Todas las ciudades' : city}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="h-px bg-stone-100 dark:bg-stone-800/50" />

          {/* Section 2: Estado */}
          <div className="space-y-3">
            <p className="text-[11px] font-normal text-slate-400 dark:text-stone-500 uppercase tracking-widest text-left">Estado</p>
            <div className="flex flex-col gap-2">
              {(['all', 'active', 'inactive'] as const).map(status => {
                const isActive = filters.status === status;
                return (
                  <button
                    key={status}
                    onClick={() => updateFilters({ status })}
                    className={`px-3 py-2 rounded-xl text-xs transition-all flex items-center justify-center active:scale-[0.98] border ${
                      isActive
                        ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-800/50 font-normal'
                        : 'bg-white dark:bg-stone-800 text-slate-500 dark:text-stone-400 border-stone-100 dark:border-stone-700/50 hover:bg-stone-50 dark:hover:bg-stone-700/50'
                    }`}
                  >
                    <span className="capitalize">{status === 'all' ? 'Todos los estados' : status === 'active' ? 'Activo' : 'Inactivo'}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-stone-50/50 dark:bg-stone-800/20 border-t border-stone-100 dark:border-stone-800/50 flex items-center justify-between">
          <button
            onClick={clearFilters}
            className="flex items-center gap-2 text-xs text-slate-400 dark:text-stone-500 hover:text-slate-600 dark:hover:text-stone-300 transition-colors"
          >
            <RotateCcw size={12} />
            Restablecer
          </button>
          <button
            onClick={onClose}
            className="px-6 py-2 bg-stone-800 dark:bg-stone-700 text-white rounded-xl text-xs font-normal hover:bg-stone-900 dark:hover:bg-stone-600 transition-all active:scale-[0.98]"
          >
            Listo
          </button>
        </div>
      </div>
    </>
  );
};

export default AccommodationFilterModal;
