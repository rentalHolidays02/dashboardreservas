import React, { useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { appsScriptApi } from '../../services/api';
import type { Accommodation } from '../../services/mockData';

export type SiNo = 'Si' | 'No';
export type MetodoPago = 'Efectivo' | 'Tarjeta' | 'Bizum';

export const inputCls =
  'w-full rounded-2xl bg-stone-50 dark:bg-stone-800/50 border border-slate-100 dark:border-stone-700/50 px-4 py-3 text-sm text-slate-800 dark:text-stone-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-300 transition-all';

export const labelCls =
  'block text-xs font-medium text-slate-600 dark:text-stone-300 mb-1.5';

export const parseHHMM = (s: string): number => {
  const m = s.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return 0;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
};

export const SiNoToggle: React.FC<{
  value: SiNo;
  onChange: (v: SiNo) => void;
}> = ({ value, onChange }) => (
  <div className="grid grid-cols-2 gap-2">
    {(['Si', 'No'] as SiNo[]).map((opt) => {
      const active = value === opt;
      return (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          className={`px-4 py-2.5 rounded-2xl text-sm font-medium border transition-all active:scale-[0.98] ${
            active
              ? 'bg-orange-500 text-white border-orange-500 shadow-sm'
              : 'bg-stone-50 dark:bg-stone-800/50 text-slate-600 dark:text-stone-300 border-slate-100 dark:border-stone-700/50 hover:bg-stone-100 dark:hover:bg-stone-700/50'
          }`}
        >
          {opt === 'Si' ? 'Sí' : 'No'}
        </button>
      );
    })}
  </div>
);

export const PagoSelector: React.FC<{
  value: MetodoPago | '';
  onChange: (v: MetodoPago) => void;
}> = ({ value, onChange }) => (
  <div className="grid grid-cols-3 gap-2">
    {(['Efectivo', 'Tarjeta', 'Bizum'] as MetodoPago[]).map((opt) => {
      const active = value === opt;
      return (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          className={`px-3 py-2.5 rounded-2xl text-xs font-medium border transition-all active:scale-[0.98] ${
            active
              ? 'bg-orange-500 text-white border-orange-500 shadow-sm'
              : 'bg-stone-50 dark:bg-stone-800/50 text-slate-600 dark:text-stone-300 border-slate-100 dark:border-stone-700/50 hover:bg-stone-100 dark:hover:bg-stone-700/50'
          }`}
        >
          {opt}
        </button>
      );
    })}
  </div>
);

export const useAccommodations = (isOpen: boolean): Accommodation[] => {
  const [list, setList] = useState<Accommodation[]>([]);
  useEffect(() => {
    if (!isOpen) return;
    appsScriptApi
      .getAccommodations()
      .then(setList)
      .catch(() => setList([]));
  }, [isOpen]);
  return list;
};

export const ApartamentoAutocomplete: React.FC<{
  value: string;
  onChange: (v: string) => void;
  options: Accommodation[];
}> = ({ value, onChange, options }) => {
  const [focused, setFocused] = useState(false);
  const matches = useMemo(() => {
    const q = value.trim().toLowerCase();
    if (!q) return options.slice(0, 8);
    return options.filter((o) => o.name.toLowerCase().includes(q)).slice(0, 8);
  }, [value, options]);

  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 size-4" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => setFocused(false), 150)}
        placeholder="Buscar alojamiento..."
        className={`${inputCls} pl-10`}
        autoComplete="off"
      />
      {focused && matches.length > 0 && (
        <ul className="absolute z-10 mt-1 w-full max-h-56 overflow-y-auto rounded-2xl bg-white dark:bg-stone-900 border border-slate-100 dark:border-stone-700/50 shadow-lg">
          {matches.map((m) => (
            <li
              key={m.id}
              onMouseDown={(e) => {
                e.preventDefault();
                onChange(m.name);
                setFocused(false);
              }}
              className="px-4 py-2.5 text-sm text-slate-700 dark:text-stone-200 hover:bg-orange-50 dark:hover:bg-orange-400/10 cursor-pointer truncate"
            >
              {m.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

// Footer botón estándar: 3 estados (sin datos / borrador / enviar).
export const SubmitFooter: React.FC<{
  isValid: boolean;
  hasData: boolean;
  onCancel: () => void;
}> = ({ isValid, hasData, onCancel }) => (
  <div className="px-6 py-4 border-t border-slate-100 dark:border-stone-800/60 shrink-0 bg-white/80 dark:bg-stone-900/80 backdrop-blur-sm rounded-b-3xl">
    <div className="grid grid-cols-2 gap-3">
      <button
        type="button"
        onClick={onCancel}
        className="px-5 py-3 rounded-2xl bg-stone-100 dark:bg-stone-800/40 border border-stone-200 dark:border-stone-700/40 text-slate-600 dark:text-stone-300 text-sm font-medium hover:bg-stone-50 dark:hover:bg-stone-700/40 transition-all active:scale-[0.98]"
      >
        Cancelar
      </button>
      <button
        type="button"
        disabled
        title="Pendiente: persistencia en Supabase"
        className={`px-5 py-3 rounded-2xl text-sm font-medium shadow-sm transition-all flex items-center justify-center gap-2 cursor-not-allowed ${
          isValid
            ? 'bg-orange-500/40 text-white'
            : hasData
              ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/50'
              : 'bg-stone-200 dark:bg-stone-700 text-slate-400 dark:text-stone-500'
        }`}
      >
        {isValid ? 'Enviar informe' : hasData ? 'Guardar en borrador' : 'Enviar informe'}
      </button>
    </div>
    <p className="mt-2 text-[10px] text-center text-slate-400 dark:text-stone-500">
      {isValid
        ? 'Listo para enviar. (Persistencia Supabase pendiente)'
        : hasData
          ? 'Faltan campos obligatorios. Se guardará como borrador.'
          : 'Rellena los campos para empezar.'}
    </p>
  </div>
);
