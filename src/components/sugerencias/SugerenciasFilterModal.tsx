import React from 'react';
import { X, Calendar, RotateCcw, Filter, Star, Eye, EyeOff, AlertCircle, Sparkles, HelpCircle } from 'lucide-react';

export interface SugerenciasFilters {
  startDate: string;
  endDate: string;
  readStatus: 'all' | 'read' | 'unread';
  category: 'all' | 'fallo' | 'sugerencia' | 'otro';
  importance: 'all' | 'important' | 'normal';
}

interface SugerenciasFilterModalProps {
  isOpen: boolean;
  onClose: () => void;
  filters: SugerenciasFilters;
  onApply: (filters: SugerenciasFilters) => void;
}

const SugerenciasFilterModal: React.FC<SugerenciasFilterModalProps> = ({ isOpen, onClose, filters, onApply }) => {
  const updateFilters = (updates: Partial<SugerenciasFilters>) => {
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
      readStatus: 'all',
      category: 'all',
      importance: 'all'
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
          <h2 className="text-base font-normal text-slate-800 dark:text-stone-200 font-display tracking-tight">Filtros de Sugerencias</h2>
          <button 
            onClick={onClose}
            className="p-1.5 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-lg transition-colors text-slate-400 hover:text-slate-600 dark:hover:text-stone-200"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-5">
          
          {/* Section 2: Importancia */}
          <div className="space-y-2.5">
            <p className="text-[11px] font-normal text-slate-400 dark:text-stone-500 uppercase tracking-widest text-left">Importancia</p>
            <div className="flex flex-wrap gap-2">
              {(['all', 'important', 'normal'] as const).map(s => {
                const isActive = filters.importance === s;
                return (
                  <button
                    key={s}
                    onClick={() => updateFilters({ importance: s })}
                    className={`px-4 py-2 rounded-xl text-xs transition-all flex items-center justify-center gap-2 active:scale-[0.98] border ${
                      isActive
                        ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-800/50 font-normal'
                        : 'bg-white dark:bg-stone-800 text-slate-500 dark:text-stone-400 border-stone-100 dark:border-stone-700/50 hover:bg-stone-50 dark:hover:bg-stone-700/50'
                    }`}
                  >
                    {s === 'important' && <Star size={12} fill={isActive ? "currentColor" : "none"} />}
                    {s === 'all' ? 'Cualquiera' : s === 'important' ? 'Destacados' : 'Normales'}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="h-px bg-stone-100 dark:bg-stone-800/50" />

          {/* Section 3: Lectura */}
          <div className="space-y-2.5">
            <p className="text-[11px] font-normal text-slate-400 dark:text-stone-500 uppercase tracking-widest text-left">Estado</p>
            <div className="flex flex-wrap gap-2">
              {(['all', 'unread', 'read'] as const).map(s => {
                const isActive = filters.readStatus === s;
                return (
                  <button
                    key={s}
                    onClick={() => updateFilters({ readStatus: s })}
                    className={`px-4 py-2 rounded-xl text-xs transition-all flex items-center justify-center gap-2 active:scale-[0.98] border ${
                      isActive
                        ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-800/50 font-normal'
                        : 'bg-white dark:bg-stone-800 text-slate-500 dark:text-stone-400 border-stone-100 dark:border-stone-700/50 hover:bg-stone-50 dark:hover:bg-stone-700/50'
                    }`}
                  >
                    {s === 'unread' ? <EyeOff size={12} /> : s === 'read' ? <Eye size={12} /> : null}
                    {s === 'all' ? 'Cualquiera' : s === 'unread' ? 'No leídos' : 'Leídos'}
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

export default SugerenciasFilterModal;
