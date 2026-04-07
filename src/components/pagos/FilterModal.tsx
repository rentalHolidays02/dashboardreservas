import React from 'react';
import { X, Calendar, CheckCircle2, Clock, RotateCcw } from 'lucide-react';

export interface PagosFilters {
  status: 'all' | 'pagado' | 'pendiente';
  startDate: string;
  endDate: string;
  minAmount: number;
  maxAmount: number;
}

interface FilterModalProps {
  isOpen: boolean;
  onClose: () => void;
  filters: PagosFilters;
  onApply: (filters: PagosFilters) => void;
}

const FilterModal: React.FC<FilterModalProps> = ({ isOpen, onClose, filters, onApply }) => {
  const updateFilters = (updates: Partial<PagosFilters>) => {
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
      status: 'all',
      startDate: '',
      endDate: '',
      minAmount: 0,
      maxAmount: 2000
    });
  };

  return (
    <>
      {/* Backdrop for clicking outside - Smooth fade */}
      <div 
        className={`fixed inset-0 z-[105] transition-opacity duration-300 ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      {/* Popover Content - Smooth fade/scale/slide */}
      <div className={`absolute top-full right-0 mt-3 z-[110] bg-white/90 dark:bg-stone-900/95 backdrop-blur-xl w-[380px] rounded-2xl overflow-hidden border border-white/60 dark:border-stone-800/50 soft-shadow transition-all duration-300 ease-out origin-top-right ${
        isOpen 
          ? 'opacity-100 scale-100 translate-y-0 pointer-events-auto' 
          : 'opacity-0 scale-95 -translate-y-2 pointer-events-none'
      }`}>
        
        {/* Header */}
        <div className="px-5 py-4 flex items-center justify-between border-b border-stone-100 dark:border-stone-800/50">
          <h2 className="text-base font-normal text-slate-800 dark:text-stone-200 font-display tracking-tight">Filtros</h2>
          <button 
            onClick={onClose}
            className="p-1.5 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-lg transition-colors text-slate-400 hover:text-slate-600 dark:hover:text-stone-200"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-6 space-y-8">
          
          {/* Section 1: Pre-ajustes de fecha */}
          <div className="space-y-3">
            <p className="text-[11px] font-normal text-slate-400 dark:text-stone-500 uppercase tracking-widest">Filtrar por periodo</p>
            <div className="flex gap-2">
              <button
                onClick={() => handlePresetDate(30)}
                className="flex-1 py-2 px-3 bg-white dark:bg-stone-800 border border-stone-100 dark:border-stone-700/50 rounded-xl text-xs text-slate-600 dark:text-stone-400 hover:border-orange-200 dark:hover:border-orange-900/50 hover:bg-orange-50/30 dark:hover:bg-orange-900/10 transition-all font-normal active:scale-[0.98]"
              >
                Últimos 30 días
              </button>
              <button
                onClick={() => handlePresetDate(180)}
                className="flex-1 py-2 px-3 bg-white dark:bg-stone-800 border border-stone-100 dark:border-stone-700/50 rounded-xl text-xs text-slate-600 dark:text-stone-400 hover:border-orange-200 dark:hover:border-orange-900/50 hover:bg-orange-50/30 dark:hover:bg-orange-900/10 transition-all font-normal active:scale-[0.98]"
              >
                Últimos 6 meses
              </button>
            </div>
          </div>

          <div className="h-px bg-stone-100 dark:bg-stone-800/50" />

          {/* Section 2: Rango personalizado */}
          <div className="space-y-3">
            <p className="text-[11px] font-normal text-slate-400 dark:text-stone-500 uppercase tracking-widest">Rango personalizado</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="relative">
                <Calendar size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-stone-500" />
                <input
                  type="date"
                  value={filters.startDate}
                  onChange={e => updateFilters({ startDate: e.target.value })}
                  className="w-full pl-9 pr-3 py-2.5 bg-white dark:bg-stone-800/50 border border-stone-100 dark:border-stone-700/50 rounded-xl text-xs text-slate-700 dark:text-stone-300 focus:outline-none focus:ring-1 focus:ring-orange-400/50 transition-all"
                  placeholder="Desde"
                />
              </div>
              <div className="relative">
                <Calendar size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-stone-500" />
                <input
                  type="date"
                  value={filters.endDate}
                  onChange={e => updateFilters({ endDate: e.target.value })}
                  className="w-full pl-9 pr-3 py-2.5 bg-white dark:bg-stone-800/50 border border-stone-100 dark:border-stone-700/50 rounded-xl text-xs text-slate-700 dark:text-stone-300 focus:outline-none focus:ring-1 focus:ring-orange-400/50 transition-all"
                  placeholder="Hasta"
                />
              </div>
            </div>
          </div>

          <div className="h-px bg-stone-100 dark:bg-stone-800/50" />

          {/* Section: Rango de Importe (Doble Slider) */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-normal text-slate-400 dark:text-stone-500 uppercase tracking-widest text-left">Importe total</p>
              <div className="px-2 py-0.5 bg-stone-50 dark:bg-stone-800/50 border border-stone-100 dark:border-stone-700/50 rounded-lg text-[11px] font-normal text-slate-600 dark:text-stone-300 tabular-nums">
                {filters.minAmount}€ - {filters.maxAmount}€
              </div>
            </div>
            
            <div className="relative h-6 flex items-center px-1">
              {/* Background Track */}
              <div className="absolute inset-x-1 h-1 bg-stone-100 dark:bg-stone-800 rounded-full" />
              
              {/* Active Fill Track */}
              <div 
                className="absolute h-1 bg-orange-500 rounded-full transition-all duration-75"
                style={{
                  left: `${(filters.minAmount / 2000) * 100}%`,
                  right: `${100 - (filters.maxAmount / 2000) * 100}%`
                }}
              />
              
              {/* Range Inputs Overlaid */}
              <input
                type="range"
                min="0"
                max="2000"
                step="10"
                value={filters.minAmount}
                onChange={(e) => {
                  const val = Math.min(Number(e.target.value), filters.maxAmount - 50);
                  updateFilters({ minAmount: val });
                }}
                className="absolute inset-x-0 w-full appearance-none bg-transparent pointer-events-none custom-range-slider h-1 z-1"
              />
              <input
                type="range"
                min="0"
                max="2000"
                step="10"
                value={filters.maxAmount}
                onChange={(e) => {
                  const val = Math.max(Number(e.target.value), filters.minAmount + 50);
                  updateFilters({ maxAmount: val });
                }}
                className="absolute inset-x-0 w-full appearance-none bg-transparent pointer-events-none custom-range-slider h-1 z-2"
              />
            </div>
            
            <div className="flex justify-between px-1">
              <span className="text-[10px] text-slate-400 dark:text-stone-500 font-normal">0€</span>
              <span className="text-[10px] text-slate-400 dark:text-stone-500 font-normal">2.000€+</span>
            </div>
          </div>

          <div className="h-px bg-stone-100 dark:bg-stone-800/50" />

          {/* Section 3: Estado */}
          <div className="space-y-3">
            <p className="text-[11px] font-normal text-slate-400 dark:text-stone-500 uppercase tracking-widest">Estado de Pago</p>
            <div className="flex flex-wrap gap-2">
              {(['all', 'pagado', 'pendiente'] as const).map(s => {
                const isActive = filters.status === s;
                return (
                  <button
                    key={s}
                    onClick={() => updateFilters({ status: s })}
                    className={`px-4 py-2 rounded-xl text-xs transition-all flex items-center gap-2 active:scale-[0.98] ${
                      isActive
                        ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 border border-orange-200 dark:border-orange-800/50 font-normal'
                        : 'bg-white dark:bg-stone-800 text-slate-500 dark:text-stone-400 border border-stone-100 dark:border-stone-700/50 hover:bg-stone-50 dark:hover:bg-stone-700/50'
                    }`}
                  >
                    {s === 'pagado' && <CheckCircle2 size={12} />}
                    {s === 'pendiente' && <Clock size={12} />}
                    {s === 'all' ? 'Todos' : s === 'pagado' ? 'Pagado' : 'Pendiente'}
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

export default FilterModal;
