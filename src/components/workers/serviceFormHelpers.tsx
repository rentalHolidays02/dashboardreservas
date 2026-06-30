import React, { useEffect, useMemo, useState } from 'react';
import { appsScriptApi } from '../../services/api';
import type { Accommodation } from '../../services/mockData';

export type SiNo = 'Si' | 'No';
export type MetodoPago = 'Efectivo' | 'Tarjeta' | 'Bizum';

// text-base (16px) evita el auto-zoom de iOS Safari. min-w-0 + appearance-none anulan el
// min-width nativo de type=time/datetime-local que rompe los grids 50/50 en iPhone.
// min-h-[3.5rem] + leading-6: type=time vacío en iOS colapsa su alto sin esto.
export const inputCls =
  'w-full min-w-0 min-h-[3.5rem] appearance-none rounded-xl bg-transparent border-[1.5px] border-stone-200 dark:border-stone-700/60 px-4 py-4 text-base leading-6 text-slate-800 dark:text-stone-100 placeholder:text-stone-300 dark:placeholder:text-stone-600 focus:outline-none focus:border-stone-900 dark:focus:border-stone-100 transition-colors';

// Para datetime-local en grid de 2 columnas: font más pequeño y menos padding
// para que "dd/mm/aaaa hh:mm" quepa sin cortarse en móvil.
export const dateInputCls =
  'w-full min-w-0 min-h-[3.5rem] appearance-none rounded-xl bg-transparent border-[1.5px] border-stone-200 dark:border-stone-700/60 px-2 py-3 text-sm leading-6 text-slate-800 dark:text-stone-100 focus:outline-none focus:border-stone-900 dark:focus:border-stone-100 transition-colors';

export const labelCls =
  'block text-xs font-medium text-slate-600 dark:text-stone-300 mb-1.5';

export const parseHHMM = (s: string): number => {
  const m = s.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return 0;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
};

// Convierte total de minutos → "HH:MM" (con padding). 0 → "" (vacío, para validación correcta).
const minutesToHHMM = (totalMin: number): string => {
  if (totalMin <= 0) return '';
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

// Entrada de duración: dos campos numéricos (Horas + Minutos).
// Mantiene el estado externo como string "HH:MM" para no romper payloads/parse.
export const DuracionInput: React.FC<{
  value: string;             // "HH:MM" o "0" o ""
  onChange: (v: string) => void;
  maxHours?: number;         // tope opcional (por defecto 23)
  hideTotal?: boolean;       // si true, no pinta el "Total: …" interno (se renderiza fuera)
}> = ({ value, onChange, maxHours = 23, hideTotal }) => {
  const total = parseHHMM(value);
  const h = Math.floor(total / 60);
  const m = total % 60;

  const setHoras = (rawH: string) => {
    const n = Math.max(0, Math.min(maxHours, parseInt(rawH || '0', 10) || 0));
    onChange(minutesToHHMM(n * 60 + m));
  };
  const setMinutos = (rawM: string) => {
    const n = Math.max(0, Math.min(59, parseInt(rawM || '0', 10) || 0));
    onChange(minutesToHHMM(h * 60 + n));
  };

  return (
    <div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            max={maxHours}
            step={1}
            value={h === 0 && m === 0 ? '' : h}
            onChange={(e) => setHoras(e.target.value)}
            className={`${inputCls} text-center`}
            placeholder="0"
          />
          <p className="mt-1 text-[10px] text-center text-slate-400 dark:text-stone-500">Horas</p>
        </div>
        <div>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            max={59}
            step={1}
            value={h === 0 && m === 0 ? '' : m}
            onChange={(e) => setMinutos(e.target.value)}
            className={`${inputCls} text-center`}
            placeholder="0"
          />
          <p className="mt-1 text-[10px] text-center text-slate-400 dark:text-stone-500">Minutos</p>
        </div>
      </div>
      {!hideTotal && (
        <p className="mt-2 text-[11px] text-center text-slate-500 dark:text-stone-400">
          Total: <span className="font-medium text-slate-700 dark:text-stone-200">
            {total === 0 ? '—' : `${h}h ${String(m).padStart(2, '0')}min`}
          </span>
        </p>
      )}
    </div>
  );
};

// Selector de hora HH:MM con dos <select> — evita el picker circular nativo de iOS/Android.
// Emite y recibe el mismo formato "HH:MM" que type=time.
const selectCls =
  'flex-1 min-w-0 min-h-[3.5rem] appearance-none rounded-xl bg-transparent border-[1.5px] border-stone-200 dark:border-stone-700/60 px-3 py-3 text-base text-center text-slate-800 dark:text-stone-100 focus:outline-none focus:border-stone-900 dark:focus:border-stone-100 transition-colors cursor-pointer';

export const TimeSelect: React.FC<{
  value: string;        // "HH:MM" o ""
  onChange: (v: string) => void;
  maxHours?: number;    // tope de horas (por defecto 23)
}> = ({ value, onChange, maxHours = 23 }) => {
  const match = value.match(/^(\d{1,2}):(\d{2})$/);
  const h = match ? parseInt(match[1], 10) : -1;
  const m = match ? parseInt(match[2], 10) : -1;

  const emit = (hh: number, mm: number) => {
    if (hh < 0 && mm < 0) { onChange(''); return; }
    onChange(`${String(hh >= 0 ? hh : 0).padStart(2, '0')}:${String(mm >= 0 ? mm : 0).padStart(2, '0')}`);
  };

  return (
    <div className="flex gap-2 items-center">
      <select
        value={h >= 0 ? h : ''}
        onChange={(e) => emit(e.target.value === '' ? -1 : parseInt(e.target.value, 10), m)}
        className={selectCls}
      >
        <option value="" disabled>hh</option>
        {Array.from({ length: maxHours + 1 }, (_, i) => (
          <option key={i} value={i}>{String(i).padStart(2, '0')}</option>
        ))}
      </select>
      <span className="text-lg font-medium text-slate-400 dark:text-stone-500 select-none">:</span>
      <select
        value={m >= 0 ? m : ''}
        onChange={(e) => emit(h, e.target.value === '' ? -1 : parseInt(e.target.value, 10))}
        className={selectCls}
      >
        <option value="" disabled>mm</option>
        {Array.from({ length: 60 }, (_, i) => (
          <option key={i} value={i}>{String(i).padStart(2, '0')}</option>
        ))}
      </select>
    </div>
  );
};

// Formatea total HH:MM → "Xh YYmin" para mostrar fuera del DuracionInput.
export const formatDuracionTotal = (raw: string): string => {
  const total = parseHHMM(raw);
  if (total === 0) return '—';
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${h}h ${String(m).padStart(2, '0')}min`;
};

// Formato móvil español 3-2-2-2 → "612 34 56 78"
export const formatBizumNumber = (value: string): string => {
  const digits = value.replace(/\D/g, '').slice(0, 9);
  const parts: string[] = [];
  if (digits.length > 0) parts.push(digits.slice(0, 3));
  if (digits.length > 3) parts.push(digits.slice(3, 5));
  if (digits.length > 5) parts.push(digits.slice(5, 7));
  if (digits.length > 7) parts.push(digits.slice(7, 9));
  return parts.join(' ');
};

// Devuelve el id del alojamiento cuyo nombre coincide exactamente (insensible a mayúsculas).
export const resolveAccommodationId = (
  name: string,
  options: Accommodation[]
): string | null => {
  const q = name.trim().toLowerCase();
  if (!q) return null;
  const exact = options.find((o) => o.name.trim().toLowerCase() === q);
  return exact?.id ?? null;
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
          className={`w-full py-4 rounded-2xl text-sm font-medium border transition-all active:scale-[0.98] ${
            active
              ? 'bg-stone-900 text-white border-stone-900 dark:bg-stone-100 dark:text-stone-900 dark:border-stone-100 shadow-sm'
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
          className={`w-full py-4 rounded-2xl text-xs font-medium border transition-all active:scale-[0.98] ${
            active
              ? 'bg-stone-900 text-white border-stone-900 dark:bg-stone-100 dark:text-stone-900 dark:border-stone-100 shadow-sm'
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
    if (!q) return options;
    return options.filter((o) => o.name.toLowerCase().includes(q));
  }, [value, options]);

  return (
    <div className="relative">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => setFocused(false), 150)}
        placeholder="Buscar alojamiento..."
        className={inputCls}
        autoComplete="off"
      />
      {focused && matches.length > 0 && (
        <div className="absolute z-10 mt-1 w-full rounded-xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700/60 shadow-lg overflow-hidden">
          <ul className="max-h-72 overflow-y-auto overscroll-contain">
            {matches.map((m) => (
              <li
                key={m.id}
                onMouseDown={(e) => {
                  e.preventDefault();
                  onChange(m.name);
                  setFocused(false);
                }}
                className="px-4 py-3 text-sm text-slate-700 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800/60 cursor-pointer truncate"
              >
                {m.name}
              </li>
            ))}
          </ul>
          <div className="px-4 py-2 text-[10px] text-slate-400 dark:text-stone-500 bg-stone-50 dark:bg-stone-800/40 border-t border-stone-200/70 dark:border-stone-700/50">
            {matches.length} {matches.length === 1 ? 'alojamiento' : 'alojamientos'} · desplaza para ver más
          </div>
        </div>
      )}
    </div>
  );
};

// Footer botón estándar: 3 estados (sin datos / borrador / enviar).
// `onCancel` es semánticamente "descartar y cerrar" (la X / backdrop guardan en local).
export const SubmitFooter: React.FC<{
  isValid: boolean;
  hasData: boolean;
  busy?: boolean;
  status?: { type: 'ok' | 'error'; message: string } | null;
  onCancel: () => void;
  onSubmit: () => void;
  onSaveDraft: () => void;
}> = ({ isValid, hasData, busy, status, onCancel, onSubmit, onSaveDraft }) => {
  // 3 estados:
  //   - !hasData   → botón gris disabled "Enviar informe"
  //   - hasData && !isValid → botón ámbar pulsable "Guardar en borrador" → onSaveDraft
  //   - isValid    → botón naranja "Enviar informe" → onSubmit
  const mode: 'idle' | 'draft' | 'send' = isValid ? 'send' : hasData ? 'draft' : 'idle';

  const handleClick = () => {
    if (busy) return;
    if (mode === 'send') onSubmit();
    else if (mode === 'draft') onSaveDraft();
  };

  const label =
    busy
      ? mode === 'draft' ? 'Guardando…' : 'Enviando…'
      : mode === 'send'
        ? 'Enviar informe'
        : mode === 'draft'
          ? 'Guardar en borrador'
          : 'Enviar informe';

  const btnCls =
    mode === 'send'
      ? 'bg-orange-500 hover:bg-orange-600 active:scale-[0.98] text-white'
      : mode === 'draft'
        ? 'bg-amber-500 hover:bg-amber-600 active:scale-[0.98] text-white'
        : 'bg-stone-200 dark:bg-stone-700 text-slate-400 dark:text-stone-500 cursor-not-allowed';

  return (
    <div className="px-6 py-4 border-t border-slate-100 dark:border-stone-800/60 shrink-0 bg-white/80 dark:bg-stone-900/80 backdrop-blur-sm rounded-b-3xl">
      {status && (
        <div className={`mb-2 px-3 py-2 rounded-xl text-[11px] font-medium text-center ${
          status.type === 'ok'
            ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50'
            : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800/50'
        }`}>
          {status.message}
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="px-5 py-3 rounded-2xl bg-stone-100 dark:bg-stone-800/40 border border-stone-200 dark:border-stone-700/40 text-slate-600 dark:text-stone-300 text-sm font-medium hover:bg-stone-50 dark:hover:bg-stone-700/40 transition-all active:scale-[0.98] disabled:opacity-50"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={handleClick}
          disabled={busy || mode === 'idle'}
          className={`px-5 py-3 rounded-2xl text-sm font-medium shadow-sm transition-all flex items-center justify-center gap-2 ${btnCls} ${busy ? 'opacity-60 cursor-wait' : ''}`}
        >
          {label}
        </button>
      </div>
      <p className="mt-2 text-[10px] text-center text-slate-400 dark:text-stone-500">
        {mode === 'send'
          ? 'Listo para enviar. Pulsa para enviar el informe.'
          : mode === 'draft'
            ? 'Faltan campos obligatorios. Se guardará como borrador.'
            : 'Rellena los campos para empezar.'}
      </p>
    </div>
  );
};
