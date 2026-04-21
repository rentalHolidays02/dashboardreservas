import React from 'react';
import { X, CheckCircle2, CreditCard, Smartphone, Banknote, RotateCcw } from 'lucide-react';

export interface WorkerFilters {
  tipoPago: 'all' | 'bizum' | 'tarjeta' | 'efectivo';
  minCleans: number;
  maxCleans: number;
  minKms: number;
  maxKms: number;
}

interface WorkerFilterModalProps {
  isOpen: boolean;
  onClose: () => void;
  filters: WorkerFilters;
  onApply: (filters: WorkerFilters) => void;
}

const WorkerFilterModal: React.FC<WorkerFilterModalProps> = ({ isOpen, onClose, filters, onApply }) => {
  const updateFilters = (updates: Partial<WorkerFilters>) => {
    onApply({ ...filters, ...updates });
  };

  const clearFilters = () => {
    onApply({
      tipoPago: 'all',
      minCleans: 0,
      maxCleans: 50,
      minKms: 0,
      maxKms: 2000
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
          <h2 className="text-base font-normal text-slate-800 dark:text-stone-200 font-display tracking-tight">Filtros de Personal</h2>
          <button 
            onClick={onClose}
            className="p-1.5 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-lg transition-colors text-slate-400 hover:text-slate-600 dark:hover:text-stone-200"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-6 space-y-8">
          
          {/* Section 1: Tipo de Pago */}
          <div className="space-y-3">
            <p className="text-[11px] font-normal text-slate-400 dark:text-stone-500 uppercase tracking-widest text-left">Método de Pago</p>
            <div className="grid grid-cols-2 gap-2">
              {(['all', 'bizum', 'tarjeta', 'efectivo'] as const).map(type => {
                const isActive = filters.tipoPago === type;
                return (
                  <button
                    key={type}
                    onClick={() => updateFilters({ tipoPago: type })}
                    className={`px-3 py-2.5 rounded-xl text-xs transition-all flex items-center gap-2 active:scale-[0.98] border ${
                      isActive
                        ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-800/50 font-normal'
                        : 'bg-white dark:bg-stone-800 text-slate-500 dark:text-stone-400 border-stone-100 dark:border-stone-700/50 hover:bg-stone-50 dark:hover:bg-stone-700/50'
                    }`}
                  >
                    <span className="capitalize">{type === 'all' ? 'Todos' : type}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="h-px bg-stone-100 dark:bg-stone-800/50" />

          {/* Section 2: Limpiezas Realizadas */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-normal text-slate-400 dark:text-stone-500 uppercase tracking-widest text-left">Limpiezas / mes</p>
              <div className="px-2 py-0.5 bg-stone-50 dark:bg-stone-800/50 border border-stone-100 dark:border-stone-700/50 rounded-lg text-[11px] font-normal text-slate-600 dark:text-stone-300 tabular-nums">
                {filters.minCleans} - {filters.maxCleans}
              </div>
            </div>
            
            <div className="relative h-6 flex items-center px-1">
              <div className="absolute inset-x-1 h-1 bg-stone-100 dark:bg-stone-800 rounded-full" />
              <div 
                className="absolute h-1 bg-orange-500 rounded-full transition-all duration-75"
                style={{
                  left: `${(filters.minCleans / 50) * 100}%`,
                  right: `${100 - (filters.maxCleans / 50) * 100}%`
                }}
              />
              <input
                type="range"
                min="0"
                max="50"
                step="1"
                value={filters.minCleans}
                onChange={(e) => {
                  const val = Math.min(Number(e.target.value), filters.maxCleans - 1);
                  updateFilters({ minCleans: val });
                }}
                className="absolute inset-x-0 w-full appearance-none bg-transparent pointer-events-none custom-range-slider h-1 z-[1]"
              />
              <input
                type="range"
                min="0"
                max="50"
                step="1"
                value={filters.maxCleans}
                onChange={(e) => {
                  const val = Math.max(Number(e.target.value), filters.minCleans + 1);
                  updateFilters({ maxCleans: val });
                }}
                className="absolute inset-x-0 w-full appearance-none bg-transparent pointer-events-none custom-range-slider h-1 z-[2]"
              />
            </div>
            
            <div className="flex justify-between px-1">
              <span className="text-[10px] text-slate-400 dark:text-stone-500 font-normal">0</span>
              <span className="text-[10px] text-slate-400 dark:text-stone-500 font-normal">50+</span>
            </div>
          </div>

          <div className="h-px bg-stone-100 dark:bg-stone-800/50" />

          {/* Section 3: Kilómetros */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-normal text-slate-400 dark:text-stone-500 uppercase tracking-widest text-left">Distancia (km)</p>
              <div className="px-2 py-0.5 bg-stone-50 dark:bg-stone-800/50 border border-stone-100 dark:border-stone-700/50 rounded-lg text-[11px] font-normal text-slate-600 dark:text-stone-300 tabular-nums">
                {filters.minKms}km - {filters.maxKms}km
              </div>
            </div>
            
            <div className="relative h-6 flex items-center px-1">
              <div className="absolute inset-x-1 h-1 bg-stone-100 dark:bg-stone-800 rounded-full" />
              <div 
                className="absolute h-1 bg-orange-500 rounded-full transition-all duration-75"
                style={{
                  left: `${(filters.minKms / 2000) * 100}%`,
                  right: `${100 - (filters.maxKms / 2000) * 100}%`
                }}
              />
              <input
                type="range"
                min="0"
                max="2000"
                step="50"
                value={filters.minKms}
                onChange={(e) => {
                  const val = Math.min(Number(e.target.value), filters.maxKms - 100);
                  updateFilters({ minKms: val });
                }}
                className="absolute inset-x-0 w-full appearance-none bg-transparent pointer-events-none custom-range-slider h-1 z-[1]"
              />
              <input
                type="range"
                min="0"
                max="2000"
                step="50"
                value={filters.maxKms}
                onChange={(e) => {
                  const val = Math.max(Number(e.target.value), filters.minKms + 100);
                  updateFilters({ maxKms: val });
                }}
                className="absolute inset-x-0 w-full appearance-none bg-transparent pointer-events-none custom-range-slider h-1 z-[2]"
              />
            </div>
            
            <div className="flex justify-between px-1">
              <span className="text-[10px] text-slate-400 dark:text-stone-500 font-normal">0km</span>
              <span className="text-[10px] text-slate-400 dark:text-stone-500 font-normal">2000km+</span>
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

export default WorkerFilterModal;
