import React from 'react';
import { X, ArrowUpDown, Calendar, User, Home, Navigation, SortAsc, SortDesc } from 'lucide-react';

export type SortField = 'fecha' | 'nombre' | 'apartamento' | 'km';
export type SortDirection = 'asc' | 'desc';

export interface SortConfig {
  field: SortField;
  direction: SortDirection;
}

interface CleanSortModalProps {
  isOpen: boolean;
  onClose: () => void;
  sortConfig: SortConfig;
  onApply: (config: SortConfig) => void;
}

const CleanSortModal: React.FC<CleanSortModalProps> = ({ isOpen, onClose, sortConfig, onApply }) => {
  const updateSort = (updates: Partial<SortConfig>) => {
    onApply({ ...sortConfig, ...updates });
  };

  const fields = [
    { id: 'fecha' as const, label: 'Fecha', icon: <Calendar size={14} /> },
    { id: 'nombre' as const, label: 'Trabajador', icon: <User size={14} /> },
    { id: 'apartamento' as const, label: 'Apartamento', icon: <Home size={14} /> },
    { id: 'km' as const, label: 'Kilómetros', icon: <Navigation size={14} /> },
  ];

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
          <h2 className="text-base font-normal text-slate-800 dark:text-stone-200 font-display tracking-tight">Ordenar Registros</h2>
          <button 
            onClick={onClose}
            className="p-1.5 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-lg transition-colors text-slate-400 hover:text-slate-600 dark:hover:text-stone-200"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-6">
          
          {/* Section 1: Criterio */}
          <div className="space-y-3">
            <p className="text-[11px] font-normal text-slate-400 dark:text-stone-500 uppercase tracking-widest text-left">Ordenar por</p>
            <div className="grid grid-cols-1 gap-2">
              {fields.map(field => {
                const isActive = sortConfig.field === field.id;
                return (
                  <button
                    key={field.id}
                    onClick={() => updateSort({ field: field.id })}
                    className={`flex items-center justify-between px-4 py-3 rounded-xl text-xs transition-all active:scale-[0.98] border ${
                      isActive
                        ? 'bg-orange-100/50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 border-orange-200/50 dark:border-orange-800/50 font-medium'
                        : 'bg-white dark:bg-stone-800/50 text-slate-500 dark:text-stone-400 border-stone-100 dark:border-stone-700/50 hover:bg-stone-50 dark:hover:bg-stone-700/50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={isActive ? 'text-orange-500' : 'text-slate-400'}>
                        {field.icon}
                      </span>
                      <span>{field.label}</span>
                    </div>
                    {isActive && (
                      <div className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="h-px bg-stone-100 dark:bg-stone-800/50" />

          {/* Section 2: Dirección */}
          <div className="space-y-3">
            <p className="text-[11px] font-normal text-slate-400 dark:text-stone-500 uppercase tracking-widest text-left">Dirección</p>
            <div className="flex p-1 bg-stone-100/50 dark:bg-stone-800/50 rounded-xl border border-stone-200/20 dark:border-stone-700/30">
              <button
                onClick={() => updateSort({ direction: 'asc' })}
                className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs rounded-lg transition-all ${
                  sortConfig.direction === 'asc'
                    ? 'bg-white dark:bg-stone-700 text-orange-500 shadow-sm border border-stone-200/50 dark:border-stone-600/50 font-medium'
                    : 'text-slate-400 dark:text-stone-500 hover:text-slate-600 dark:hover:text-stone-300'
                }`}
              >
                <SortAsc size={14} />
                <span>Ascendente</span>
              </button>
              <button
                onClick={() => updateSort({ direction: 'desc' })}
                className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs rounded-lg transition-all ${
                  sortConfig.direction === 'desc'
                    ? 'bg-white dark:bg-stone-700 text-orange-500 shadow-sm border border-stone-200/50 dark:border-stone-600/50 font-medium'
                    : 'text-slate-400 dark:text-stone-500 hover:text-slate-600 dark:hover:text-stone-300'
                }`}
              >
                <SortDesc size={14} />
                <span>Descendente</span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-stone-50/50 dark:bg-stone-800/20 border-t border-stone-100 dark:border-stone-800/50 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-8 py-2.5 bg-slate-900 dark:bg-stone-700 text-white rounded-xl text-xs font-normal hover:bg-slate-800 dark:hover:bg-stone-600 transition-all active:scale-[0.98]"
          >
            Listo
          </button>
        </div>
      </div>
    </>
  );
};

export default CleanSortModal;
