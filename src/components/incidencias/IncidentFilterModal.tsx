import React from 'react';
import { X, Calendar, UserRound, Building2, Banknote, RotateCcw } from 'lucide-react';

export interface IncidentFilters {
  startDate: string;
  endDate: string;
  paidBy: 'all' | 'limpiador' | 'empresa';
  minCost: number;
  maxCost: number;
}

interface IncidentFilterModalProps {
  isOpen: boolean;
  onClose: () => void;
  filters: IncidentFilters;
  onApply: (filters: IncidentFilters) => void;
}

const IncidentFilterModal: React.FC<IncidentFilterModalProps> = ({ isOpen, onClose, filters, onApply }) => {
  const updateFilters = (updates: Partial<IncidentFilters>) => {
    onApply({ ...filters, ...updates });
  };

  const handlePresetDate = (days: number) => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - days);
    
    const fmt = (d: Date) => d.toISOString().split('T')[0];
    updateFilters({
      startDate: fmt(start),
      endDate: fmt(end)
    });
  };

  const clearFilters = () => {
    onApply({
      startDate: '',
      endDate: '',
      paidBy: 'all',
      minCost: 0,
      maxCost: 1000
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
      <div className={`absolute top-full right-0 mt-3 z-[110] bg-white/90 dark:bg-stone-900/95 backdrop-blur-xl w-[380px] rounded-2xl overflow-hidden border border-white/60 dark:border-stone-800/50 soft-shadow transition-all duration-300 ease-out origin-top-right ${
        isOpen 
          ? 'opacity-100 scale-100 translate-y-0 pointer-events-auto' 
          : 'opacity-0 scale-95 -translate-y-2 pointer-events-none'
      }`}>
        
        {/* Header */}
        <div className="px-5 py-4 flex items-center justify-between border-b border-stone-100 dark:border-stone-800/50">
          <h2 className="text-base font-normal text-slate-800 dark:text-stone-200 font-display tracking-tight">Filtros de Incidencias</h2>
          <button 
            onClick={onClose}
            className="p-1.5 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-lg transition-colors text-slate-400 hover:text-slate-600 dark:hover:text-stone-200"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-6 space-y-8">
          
          {/* Section 1: Periodo */}
          <div className="space-y-3">
            <p className="text-[11px] font-normal text-slate-400 dark:text-stone-500 uppercase tracking-widest text-left">Filtrar por periodo</p>
            <div className="flex gap-2">
              <button
                onClick={() => handlePresetDate(30)}
                className="flex-1 py-2 px-3 bg-white dark:bg-stone-800 border border-stone-100 dark:border-stone-700/50 rounded-xl text-xs text-slate-600 dark:text-stone-400 hover:border-orange-200 dark:hover:border-orange-900/50 hover:bg-orange-50/30 dark:hover:bg-orange-900/10 transition-all font-normal active:scale-[0.98]"
              >
                Último mes
              </button>
              <button
                onClick={() => handlePresetDate(365)}
                className="flex-1 py-2 px-3 bg-white dark:bg-stone-800 border border-stone-100 dark:border-stone-700/50 rounded-xl text-xs text-slate-600 dark:text-stone-400 hover:border-orange-200 dark:hover:border-orange-900/50 hover:bg-orange-50/30 dark:hover:bg-orange-900/10 transition-all font-normal active:scale-[0.98]"
              >
                Último año
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="relative">
                <Calendar size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-stone-500" />
                <input
                  type="date"
                  value={filters.startDate}
                  onChange={e => updateFilters({ startDate: e.target.value })}
                  className="w-full pl-9 pr-3 py-2.5 bg-white dark:bg-stone-800/50 border border-stone-100 dark:border-stone-700/50 rounded-xl text-xs text-slate-700 dark:text-stone-300 focus:outline-none focus:ring-1 focus:ring-orange-400/50 transition-all"
                />
              </div>
              <div className="relative">
                <Calendar size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-stone-500" />
                <input
                  type="date"
                  value={filters.endDate}
                  onChange={e => updateFilters({ endDate: e.target.value })}
                  className="w-full pl-9 pr-3 py-2.5 bg-white dark:bg-stone-800/50 border border-stone-100 dark:border-stone-700/50 rounded-xl text-xs text-slate-700 dark:text-stone-300 focus:outline-none focus:ring-1 focus:ring-orange-400/50 transition-all"
                />
              </div>
            </div>
          </div>

          <div className="h-px bg-stone-100 dark:bg-stone-800/50" />

          {/* Section 2: Pagado Por */}
          <div className="space-y-3">
            <p className="text-[11px] font-normal text-slate-400 dark:text-stone-500 uppercase tracking-widest text-left">Asumido por</p>
            <div className="flex flex-wrap gap-2">
              {(['all', 'limpiador', 'empresa'] as const).map(s => {
                const isActive = filters.paidBy === s;
                return (
                  <button
                    key={s}
                    onClick={() => updateFilters({ paidBy: s })}
                    className={`px-4 py-2 rounded-xl text-xs transition-all flex items-center gap-2 active:scale-[0.98] border ${
                      isActive
                        ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-800/50 font-normal'
                        : 'bg-white dark:bg-stone-800 text-slate-500 dark:text-stone-400 border border-stone-100 dark:border-stone-700/50 hover:bg-stone-50 dark:hover:bg-stone-700/50'
                    }`}
                  >
                    {s === 'limpiador' && <UserRound size={12} />}
                    {s === 'empresa' && <Building2 size={12} />}
                    {s === 'all' ? 'Todos' : s === 'limpiador' ? 'Limpiador' : 'Empresa'}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="h-px bg-stone-100 dark:bg-stone-800/50" />

          {/* Section 3: Rango de Coste */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-normal text-slate-400 dark:text-stone-500 uppercase tracking-widest text-left">Rango de Coste</p>
              <div className="px-2 py-0.5 bg-stone-50 dark:bg-stone-800/50 border border-stone-100 dark:border-stone-700/50 rounded-lg text-[11px] font-normal text-slate-600 dark:text-stone-300 tabular-nums">
                {filters.minCost}€ - {filters.maxCost}€
              </div>
            </div>
            
            <div className="relative h-6 flex items-center px-1">
              <div className="absolute inset-x-1 h-1 bg-stone-100 dark:bg-stone-800 rounded-full" />
              <div 
                className="absolute h-1 bg-orange-500 rounded-full transition-all duration-75"
                style={{
                  left: `${(filters.minCost / 1000) * 100}%`,
                  right: `${100 - (filters.maxCost / 1000) * 100}%`
                }}
              />
              <input
                type="range"
                min="0"
                max="1000"
                step="10"
                value={filters.minCost}
                onChange={(e) => {
                  const val = Math.min(Number(e.target.value), filters.maxCost - 50);
                  updateFilters({ minCost: val });
                }}
                className="absolute inset-x-0 w-full appearance-none bg-transparent pointer-events-none custom-range-slider h-1 z-[1]"
              />
              <input
                type="range"
                min="0"
                max="1000"
                step="10"
                value={filters.maxCost}
                onChange={(e) => {
                  const val = Math.max(Number(e.target.value), filters.minCost + 50);
                  updateFilters({ maxCost: val });
                }}
                className="absolute inset-x-0 w-full appearance-none bg-transparent pointer-events-none custom-range-slider h-1 z-[2]"
              />
            </div>
            
            <div className="flex justify-between px-1">
              <span className="text-[10px] text-slate-400 dark:text-stone-500 font-normal">0€</span>
              <span className="text-[10px] text-slate-400 dark:text-stone-500 font-normal">1000€+</span>
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

export default IncidentFilterModal;
