import React from 'react';
import { createPortal } from 'react-dom';
import { X, Calendar, RotateCcw } from 'lucide-react';
import { RecordType } from '../../pages/WorkerRecords';

export interface WorkerRecordsFilters {
  startDate: string;
  endDate: string;
  type: 'all' | RecordType;
}

interface WorkerRecordsFilterModalProps {
  isOpen: boolean;
  onClose: () => void;
  filters: WorkerRecordsFilters;
  onApply: (filters: WorkerRecordsFilters) => void;
}

const WorkerRecordsFilterModal: React.FC<WorkerRecordsFilterModalProps> = ({ isOpen, onClose, filters, onApply }) => {
  const updateFilters = (updates: Partial<WorkerRecordsFilters>) => {
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
      type: 'all'
    });
  };

  const modalContent = (
    <>
        <div className="px-5 py-4 pt-8 sm:pt-4 flex items-center justify-between border-b border-stone-100 dark:border-stone-800/50">
          <h2 className="text-xl sm:text-base font-normal text-slate-800 dark:text-stone-200 font-display tracking-tight">Filtros de Registros</h2>
          <button 
            onClick={onClose}
            className="p-2 sm:p-1.5 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-lg transition-colors text-slate-400 hover:text-slate-600 dark:hover:text-stone-200 bg-stone-100 dark:bg-stone-800 sm:bg-transparent"
          >
            <X size={20} className="sm:w-4 sm:h-4" />
          </button>
        </div>

        <div className="p-5 sm:p-5 space-y-6 sm:space-y-5 flex-1 overflow-y-auto">
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

          <div className="space-y-2.5">
            <p className="text-[11px] font-normal text-slate-400 dark:text-stone-500 uppercase tracking-widest text-left">Tipo de Servicio</p>
            <div className="flex flex-wrap gap-2">
              {([
                { value: 'all',        label: 'Cualquiera', color: '' },
                { value: 'Normal',     label: 'Limpieza',   color: '' },
                { value: 'Manitas',    label: 'Manitas',    color: '' },
                { value: 'Incidencia', label: 'Incidencia', color: 'incidencia' },
                { value: 'Llaves',     label: 'Llaves',     color: 'llaves' },
              ] as const).map(({ value: s, label, color }) => {
                const isActive = filters.type === s;
                const activeClass = color === 'incidencia'
                  ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800/50 font-normal'
                  : color === 'llaves'
                  ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800/50 font-normal'
                  : 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-800/50 font-normal';
                return (
                  <button
                    key={s}
                    onClick={() => updateFilters({ type: s })}
                    className={`px-4 py-2 rounded-xl text-xs transition-all flex items-center justify-center active:scale-[0.98] border ${
                      isActive
                        ? activeClass
                        : 'bg-white dark:bg-stone-800 text-slate-500 dark:text-stone-400 border-stone-100 dark:border-stone-700/50 hover:bg-stone-50 dark:hover:bg-stone-700/50'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

        </div>

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
    </>
  );

  return (
    <>
      {/* ── DESKTOP (In-DOM) ── */}
      <div className="hidden sm:block">
        <div 
          className={`fixed inset-0 z-[105] transition-opacity duration-300 ${
            isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
          }`}
          onClick={onClose}
        />
        <div className={`absolute top-full right-0 mt-3 z-[110] bg-white/90 dark:bg-stone-900/95 backdrop-blur-xl w-[360px] rounded-2xl overflow-hidden border border-white/60 dark:border-stone-800/50 soft-shadow transition-all duration-300 ease-out origin-top-right ${
          isOpen ? 'opacity-100 scale-100 translate-y-0 pointer-events-auto' : 'opacity-0 scale-95 -translate-y-2 pointer-events-none'
        }`}>
          {modalContent}
        </div>
      </div>

      {/* ── MOBILE (PORTAL) ── */}
      {typeof document !== 'undefined' && createPortal(
        <div className="sm:hidden">
          <div 
            className={`fixed inset-0 z-[9998] transition-opacity duration-300 bg-stone-900/40 backdrop-blur-sm ${
              isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
            }`}
            onClick={onClose}
          />
          <div className={`fixed inset-0 z-[9999] bg-white/95 dark:bg-stone-950/95 backdrop-blur-xl flex flex-col overflow-hidden transition-all duration-300 ease-out origin-bottom ${
            isOpen ? 'opacity-100 scale-100 translate-y-0 pointer-events-auto' : 'opacity-0 scale-95 translate-y-8 pointer-events-none'
          }`}>
            {modalContent}
          </div>
        </div>,
        document.body
      )}
    </>
  );
};

export default WorkerRecordsFilterModal;
