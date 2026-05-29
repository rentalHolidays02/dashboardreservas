import React from 'react';
import { createPortal } from 'react-dom';
import { X, Calendar, RotateCcw, Clock, BarChart3, PieChart, Banknote, Sparkles, Route } from 'lucide-react';

export type Period = 'semanal' | 'mensual' | 'trimestral' | 'personalizado';
export type Metric = 'dinero' | 'limpiezas' | 'km';

interface DashboardFilterModalProps {
  isOpen: boolean;
  onClose: () => void;
  period: Period;
  metric: Metric;
  customDesde: string;
  customHasta: string;
  onApply: (updates: { period?: Period; metric?: Metric; customDesde?: string; customHasta?: string }) => void;
}

const DashboardFilterModal: React.FC<DashboardFilterModalProps> = ({
  isOpen, onClose, period, metric, customDesde, customHasta, onApply
}) => {
  const periods = [
    { id: 'semanal',      label: 'Semanal',      icon: <Clock size={14} /> },
    { id: 'mensual',      label: 'Mensual',       icon: <BarChart3 size={14} /> },
    { id: 'trimestral',   label: 'Trimestral',    icon: <PieChart size={14} /> },
    { id: 'personalizado',label: 'Personalizado', icon: <Calendar size={14} /> },
  ];

  const metrics = [
    { id: 'dinero',    label: 'Dinero',    icon: <Banknote size={14} /> },
    { id: 'limpiezas', label: 'Servicios', icon: <Sparkles size={14} /> },
    { id: 'km',        label: 'Km',        icon: <Route size={14} /> },
  ];

  const clearFilters = () => {
    onApply({ period: 'mensual', metric: 'dinero', customDesde: '', customHasta: '' });
  };

  const modalContent = (
    <>
      <div className="px-5 py-4 pt-8 sm:pt-4 flex items-center justify-between border-b border-stone-100 dark:border-stone-800/50">
        <h2 className="text-xl sm:text-base font-normal text-slate-800 dark:text-stone-200 font-display tracking-tight">
          Filtros de análisis
        </h2>
        <button
          onClick={onClose}
          className="p-2 sm:p-1.5 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-lg transition-colors text-slate-400 hover:text-slate-600 dark:hover:text-stone-200 bg-stone-100 dark:bg-stone-800 sm:bg-transparent"
        >
          <X size={20} className="sm:w-4 sm:h-4" />
        </button>
      </div>

      <div className="p-5 space-y-6 flex-1 overflow-y-auto">
        {/* Metric Selection */}
        <div className="space-y-2.5">
          <p className="text-[11px] font-normal text-slate-400 dark:text-stone-500 uppercase tracking-widest">
            Métrica de visualización
          </p>
          <div className="grid grid-cols-3 gap-2">
            {metrics.map(m => {
              const isActive = metric === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => onApply({ metric: m.id as Metric })}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs transition-all border active:scale-[0.98] ${
                    isActive
                      ? 'bg-orange-100 dark:bg-orange-400/10 text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-800/50 font-medium'
                      : 'bg-white dark:bg-stone-800 text-slate-500 dark:text-stone-400 border-stone-100 dark:border-stone-700/50 hover:bg-stone-50 dark:hover:bg-stone-700/50'
                  }`}
                >
                  {m.icon}
                  {m.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="h-px bg-stone-100 dark:bg-stone-800/50" />

        {/* Presets */}
        <div className="space-y-2.5">
          <p className="text-[11px] font-normal text-slate-400 dark:text-stone-500 uppercase tracking-widest">
            Selecciona un periodo
          </p>
          <div className="grid grid-cols-2 gap-2">
            {periods.map(p => {
              const isActive = period === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => onApply({ period: p.id as Period })}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs transition-all border active:scale-[0.98] ${
                    isActive
                      ? 'bg-orange-100 dark:bg-orange-400/10 text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-800/50 font-medium'
                      : 'bg-white dark:bg-stone-800 text-slate-500 dark:text-stone-400 border-stone-100 dark:border-stone-700/50 hover:bg-stone-50 dark:hover:bg-stone-700/50'
                  }`}
                >
                  {p.icon}
                  {p.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Custom Range */}
        {period === 'personalizado' && (
          <div className="space-y-3 pt-3 border-t border-stone-100 dark:border-stone-800/50 animate-in fade-in duration-300">
            <p className="text-[11px] font-normal text-slate-400 dark:text-stone-500 uppercase tracking-widest">
              Rango de fechas
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="relative">
                <Calendar size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-stone-500" />
                <input
                  type="date"
                  value={customDesde}
                  onChange={e => onApply({ customDesde: e.target.value })}
                  className="w-full pl-8 pr-3 py-2 bg-white dark:bg-stone-800/50 border border-stone-100 dark:border-stone-700/50 rounded-xl text-xs text-slate-700 dark:text-stone-300 focus:outline-none focus:ring-1 focus:ring-orange-400/50 transition-all"
                />
              </div>
              <div className="relative">
                <Calendar size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-stone-500" />
                <input
                  type="date"
                  value={customHasta}
                  onChange={e => onApply({ customHasta: e.target.value })}
                  className="w-full pl-8 pr-3 py-2 bg-white dark:bg-stone-800/50 border border-stone-100 dark:border-stone-700/50 rounded-xl text-xs text-slate-700 dark:text-stone-300 focus:outline-none focus:ring-1 focus:ring-orange-400/50 transition-all"
                />
              </div>
            </div>
          </div>
        )}
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
      {/* ── DESKTOP (popover) ── */}
      <div className="hidden sm:block">
        <div
          className={`fixed inset-0 z-[105] transition-opacity duration-300 ${
            isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
          }`}
          onClick={onClose}
        />
        <div className={`absolute top-full right-0 mt-3 z-[110] bg-white/90 dark:bg-stone-900/95 backdrop-blur-xl w-[350px] rounded-2xl overflow-hidden border border-white/60 dark:border-stone-800/50 soft-shadow transition-all duration-300 ease-out origin-top-right ${
          isOpen ? 'opacity-100 scale-100 translate-y-0 pointer-events-auto' : 'opacity-0 scale-95 -translate-y-2 pointer-events-none'
        }`}>
          {modalContent}
        </div>
      </div>

      {/* ── MOBILE (portal full-screen) ── */}
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

export default DashboardFilterModal;
