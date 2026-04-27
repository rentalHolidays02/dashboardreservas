import React from 'react';
import { X, Calendar, CheckCircle2, XCircle, RotateCcw } from 'lucide-react';

export interface CleanFilters {
  startDate: string;
  endDate: string;
  apartment: string;
  timeStatus: 'all' | 'verified' | 'unverified';
  extraHours: 'all' | 'with_extra' | 'without_extra';
  keysStatus: 'all' | 'delivered' | 'not_delivered';
  guestTiming: 'all' | 'on_time' | 'late';
}

interface CleanFilterModalProps {
  isOpen: boolean;
  onClose: () => void;
  filters: CleanFilters;
  activeTab: 'normal' | 'initial' | 'handyman';
  onApply: (filters: CleanFilters) => void;
}

const CleanFilterModal: React.FC<CleanFilterModalProps> = ({ isOpen, onClose, filters, activeTab, onApply }) => {
  const updateFilters = (updates: Partial<CleanFilters>) => {
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
      apartment: '',
      timeStatus: 'all',
      extraHours: 'all',
      keysStatus: 'all',
      guestTiming: 'all'
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
      <div className={`absolute top-full right-0 mt-3 z-[110] bg-white/90 dark:bg-stone-900/95 backdrop-blur-xl w-[360px] rounded-2xl overflow-hidden border border-white/60 dark:border-stone-800/50 soft-shadow transition-all duration-300 ease-out origin-top-right ${
        isOpen 
          ? 'opacity-100 scale-100 translate-y-0 pointer-events-auto' 
          : 'opacity-0 scale-95 -translate-y-2 pointer-events-none'
      }`}>
        
        {/* Header */}
        <div className="px-5 py-4 flex items-center justify-between border-b border-stone-100 dark:border-stone-800/50">
          <h2 className="text-base font-normal text-slate-800 dark:text-stone-200 font-display tracking-tight">Filtros de Registros</h2>
          <button 
            onClick={onClose}
            className="p-1.5 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-lg transition-colors text-slate-400 hover:text-slate-600 dark:hover:text-stone-200"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-5">
          
          {/* Section 1: Periodo */}
          <div className="space-y-2.5">
            <p className="text-[11px] font-normal text-slate-400 dark:text-stone-500 uppercase tracking-widest text-left">Filtrar por periodo</p>
            <div className="flex gap-2">
              <button
                onClick={() => handlePresetDate(7)}
                className="flex-1 py-1.5 px-3 bg-white dark:bg-stone-800 border border-stone-100 dark:border-stone-700/50 rounded-xl text-xs text-slate-600 dark:text-stone-400 hover:border-orange-200 dark:hover:border-orange-900/50 hover:bg-orange-50/30 dark:hover:bg-orange-900/10 transition-all font-normal active:scale-[0.98]"
              >
                Esta semana
              </button>
              <button
                onClick={() => handlePresetDate(30)}
                className="flex-1 py-1.5 px-3 bg-white dark:bg-stone-800 border border-stone-100 dark:border-stone-700/50 rounded-xl text-xs text-slate-600 dark:text-stone-400 hover:border-orange-200 dark:hover:border-orange-900/50 hover:bg-orange-50/30 dark:hover:bg-orange-900/10 transition-all font-normal active:scale-[0.98]"
              >
                Último mes
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="relative">
                <Calendar size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-stone-500" />
                <input
                  type="date"
                  value={filters.startDate}
                  onChange={e => updateFilters({ startDate: e.target.value })}
                  className="w-full pl-9 pr-3 py-2 bg-white dark:bg-stone-800/50 border border-stone-100 dark:border-stone-700/50 rounded-xl text-xs text-slate-700 dark:text-stone-300 focus:outline-none focus:ring-1 focus:ring-orange-400/50 transition-all"
                />
              </div>
              <div className="relative">
                <Calendar size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-stone-500" />
                <input
                  type="date"
                  value={filters.endDate}
                  onChange={e => updateFilters({ endDate: e.target.value })}
                  className="w-full pl-9 pr-3 py-2 bg-white dark:bg-stone-800/50 border border-stone-100 dark:border-stone-700/50 rounded-xl text-xs text-slate-700 dark:text-stone-300 focus:outline-none focus:ring-1 focus:ring-orange-400/50 transition-all"
                />
              </div>
            </div>
          </div>

          <div className="h-px bg-stone-100 dark:bg-stone-800/50" />

          {/* Section 2: Verificación */}
          <div className="space-y-2.5">
            <p className="text-[11px] font-normal text-slate-400 dark:text-stone-500 uppercase tracking-widest text-left">Hora</p>
            <div className="flex flex-wrap gap-2">
              {(['all', 'verified', 'unverified'] as const).map(s => {
                const isActive = filters.timeStatus === s;
                return (
                  <button
                    key={s}
                    onClick={() => updateFilters({ timeStatus: s })}
                    className={`px-4 py-2 rounded-xl text-xs transition-all flex items-center justify-center active:scale-[0.98] border ${
                      isActive
                        ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-800/50 font-normal'
                        : 'bg-white dark:bg-stone-800 text-slate-500 dark:text-stone-400 border-stone-100 dark:border-stone-700/50 hover:bg-stone-50 dark:hover:bg-stone-700/50'
                    }`}
                  >
                    {s === 'all' ? 'Cualquiera' : s === 'verified' ? 'Verificada' : 'Sin Verificar'}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="h-px bg-stone-100 dark:bg-stone-800/50" />

          {/* Section 4: Llaves (solo limpieza normal) */}
          {activeTab === 'normal' && (
            <>
              <div className="h-px bg-stone-100 dark:bg-stone-800/50" />
              <div className="space-y-2.5">
                <p className="text-[11px] font-normal text-slate-400 dark:text-stone-500 uppercase tracking-widest text-left">Llaves</p>
                <div className="flex flex-wrap gap-2">
                  {(['all', 'delivered', 'not_delivered'] as const).map(s => {
                    const isActive = filters.keysStatus === s;
                    return (
                      <button
                        key={s}
                        onClick={() => updateFilters({ keysStatus: s })}
                        className={`px-4 py-2 rounded-xl text-xs transition-all flex items-center gap-2 active:scale-[0.98] border ${
                          isActive
                            ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-800/50 font-normal'
                            : 'bg-white dark:bg-stone-800 text-slate-500 dark:text-stone-400 border-stone-100 dark:border-stone-700/50 hover:bg-stone-50 dark:hover:bg-stone-700/50'
                        }`}
                      >
                        {s === 'all' ? 'Cualquiera' : s === 'delivered' ? 'Entregadas' : 'No entregadas'}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="h-px bg-stone-100 dark:bg-stone-800/50" />
              <div className="space-y-2.5">
                <p className="text-[11px] font-normal text-slate-400 dark:text-stone-500 uppercase tracking-widest text-left">Huésped</p>
                <div className="flex flex-wrap gap-2">
                  {(['all', 'on_time', 'late'] as const).map(s => {
                    const isActive = filters.guestTiming === s;
                    return (
                      <button
                        key={s}
                        onClick={() => updateFilters({ guestTiming: s })}
                        className={`px-4 py-2 rounded-xl text-xs transition-all flex items-center gap-2 active:scale-[0.98] border ${
                          isActive
                            ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-800/50 font-normal'
                            : 'bg-white dark:bg-stone-800 text-slate-500 dark:text-stone-400 border-stone-100 dark:border-stone-700/50 hover:bg-stone-50 dark:hover:bg-stone-700/50'
                        }`}
                      >
                        {s === 'all' ? 'Cualquiera' : s === 'on_time' ? 'A tiempo' : 'Salió tarde'}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="h-px bg-stone-100 dark:bg-stone-800/50" />
              {/* Section 5: Horas extra (solo limpieza normal) */}
              <div className="space-y-2.5">
                <p className="text-[11px] font-normal text-slate-400 dark:text-stone-500 uppercase tracking-widest text-left">Horas extra</p>
                <div className="flex flex-wrap gap-2">
                  {(['all', 'with_extra', 'without_extra'] as const).map(s => {
                    const isActive = filters.extraHours === s;
                    return (
                      <button
                        key={s}
                        onClick={() => updateFilters({ extraHours: s })}
                        className={`px-4 py-2 rounded-xl text-xs transition-all flex items-center gap-2 active:scale-[0.98] border ${
                          isActive
                            ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-800/50 font-normal'
                            : 'bg-white dark:bg-stone-800 text-slate-500 dark:text-stone-400 border-stone-100 dark:border-stone-700/50 hover:bg-stone-50 dark:hover:bg-stone-700/50'
                        }`}
                      >
                        {s === 'all' ? 'Cualquiera' : s === 'with_extra' ? 'Con horas extra' : 'Sin horas extra'}
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}
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

export default CleanFilterModal;
