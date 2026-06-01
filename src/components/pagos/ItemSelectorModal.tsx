import React, { useState, useMemo, useEffect } from 'react';
import { X, Check, Search, Loader2, AlertCircle, Wallet, Users as UsersIcon, Calendar, Home, Wrench, Bed } from 'lucide-react';
import { Worker } from '../../services/mockData';
import { PayableItem, ItemType, ymOfCurrentMonth, ymOfLastMonth, ymLabel } from '../../utils/paymentItems';

const fmtCurrency = (n: number) =>
  n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });

const fmtShortDate = (d: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
  return new Date(d + 'T00:00:00').toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
};

type PeriodShortcut = 'this' | 'last' | 'all' | 'custom';
type TypeFilter = 'all' | ItemType;

const TYPE_META: Record<ItemType, { label: string; icon: React.ReactNode; chip: string }> = {
  reserva:    { label: 'Reservas',    icon: <Home size={11} />,   chip: 'bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400' },
  entrega:    { label: 'Entregas',    icon: <Bed size={11} />,    chip: 'bg-blue-50   dark:bg-blue-900/20   text-blue-600   dark:text-blue-400' },
  incidencia: { label: 'Incidencias', icon: <Wrench size={11} />, chip: 'bg-amber-50  dark:bg-amber-900/20  text-amber-600  dark:text-amber-400' },
};

export interface ItemSelectorModalProps {
  isOpen: boolean;
  mode: 'single' | 'bulk';
  workerName?: string;
  currentBalance?: number;
  items: PayableItem[];
  initialPeriod?: PeriodShortcut;
  preselectAll?: boolean;
  workers?: Worker[];
  onClose(): void;
  onConfirm(selected: PayableItem[]): Promise<void>;
}

const ItemSelectorModal: React.FC<ItemSelectorModalProps> = ({
  isOpen, mode, workerName, currentBalance, items,
  initialPeriod = 'this', preselectAll = true, workers = [],
  onClose, onConfirm,
}) => {
  const [periodShortcut, setPeriodShortcut] = useState<PeriodShortcut>(initialPeriod);
  const [customYm, setCustomYm] = useState<string>(ymOfCurrentMonth());
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [workerFilter, setWorkerFilter] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const activeYm = useMemo(() => {
    if (periodShortcut === 'this')   return ymOfCurrentMonth();
    if (periodShortcut === 'last')   return ymOfLastMonth();
    if (periodShortcut === 'custom') return customYm;
    return null;
  }, [periodShortcut, customYm]);

  const visibleItems = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return items.filter(it => {
      if (activeYm && it.yearMonth !== activeYm) return false;
      if (typeFilter !== 'all' && it.type !== typeFilter) return false;
      if (mode === 'bulk' && workerFilter && it.workerId !== workerFilter) return false;
      if (q && !it.apartamento.toLowerCase().includes(q) &&
              !it.workerName.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [items, activeYm, typeFilter, workerFilter, searchTerm, mode]);

  // Recompute preselect cuando cambia el periodo o se abre el modal
  useEffect(() => {
    if (!isOpen) return;
    if (preselectAll) {
      setSelectedKeys(new Set(visibleItems.map(it => it.key)));
    } else {
      setSelectedKeys(new Set());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, periodShortcut, customYm]);

  const selectedItems = useMemo(
    () => visibleItems.filter(it => selectedKeys.has(it.key)),
    [visibleItems, selectedKeys]
  );

  const totalSelected = useMemo(
    () => selectedItems.reduce((s, it) => s + it.monto, 0),
    [selectedItems]
  );

  const workersAffected = useMemo(
    () => new Set(selectedItems.map(it => it.workerId)).size,
    [selectedItems]
  );

  const allVisibleSelected = visibleItems.length > 0 && visibleItems.every(it => selectedKeys.has(it.key));

  const toggleAll = () => {
    if (allVisibleSelected) {
      // Quitar todos los visibles
      const next = new Set(selectedKeys);
      for (const it of visibleItems) next.delete(it.key);
      setSelectedKeys(next);
    } else {
      // Añadir todos los visibles
      const next = new Set(selectedKeys);
      for (const it of visibleItems) next.add(it.key);
      setSelectedKeys(next);
    }
  };

  const toggleOne = (key: string) => {
    const next = new Set(selectedKeys);
    if (next.has(key)) next.delete(key); else next.add(key);
    setSelectedKeys(next);
  };

  const handleConfirm = async () => {
    if (selectedItems.length === 0) return;
    setSaving(true);
    try {
      await onConfirm(selectedItems);
      onClose();
    } catch (e: any) {
      console.error('Error confirmando cobros:', e);
      alert(`Error: ${e?.message || e}`);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  const nextBalance = (currentBalance ?? 0) + totalSelected;

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-stone-900 w-full max-w-4xl max-h-[92vh] flex flex-col rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95"
        onClick={e => e.stopPropagation()}
      >
        {/* Cabecera */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-stone-100 dark:border-stone-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-orange-50 dark:bg-orange-900/20 flex items-center justify-center">
              {mode === 'single' ? <Wallet size={18} className="text-orange-600 dark:text-orange-400" />
                                 : <UsersIcon size={18} className="text-orange-600 dark:text-orange-400" />}
            </div>
            <div>
              <h2 className="text-sm font-medium text-slate-800 dark:text-stone-100">
                {mode === 'single' ? `Asignar cobros · ${workerName || ''}` : 'Asignar cobros (varios trabajadores)'}
              </h2>
              <p className="text-xs text-slate-400 dark:text-stone-500">
                Selecciona los items a sumar al saldo pendiente
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors">
            <X size={16} className="text-slate-500 dark:text-stone-400" />
          </button>
        </div>

        {/* Toolbar */}
        <div className="px-6 py-4 border-b border-stone-100 dark:border-stone-800 bg-stone-50/30 dark:bg-stone-900/30 space-y-3">
          {/* Periodo */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-stone-500 mr-1">
              <Calendar size={11} className="inline mr-1" /> Periodo
            </span>
            {([
              { v: 'this' as const, label: 'Este mes' },
              { v: 'last' as const, label: 'Mes pasado' },
              { v: 'all'  as const, label: 'Todos' },
            ]).map(opt => (
              <button key={opt.v}
                onClick={() => setPeriodShortcut(opt.v)}
                className={`px-3 py-1.5 text-[11px] rounded-lg transition-all border ${
                  periodShortcut === opt.v
                    ? 'bg-orange-500 text-white border-orange-500'
                    : 'bg-white dark:bg-stone-800 border-stone-200 dark:border-stone-700 text-slate-600 dark:text-stone-300 hover:border-orange-300'
                }`}>
                {opt.label}
              </button>
            ))}
            <div className="flex items-center gap-1.5">
              <input
                type="month"
                value={customYm}
                onChange={(e) => { setCustomYm(e.target.value); setPeriodShortcut('custom'); }}
                className={`px-2 py-1.5 text-[11px] rounded-lg border bg-white dark:bg-stone-800 text-slate-600 dark:text-stone-300 ${
                  periodShortcut === 'custom' ? 'border-orange-400' : 'border-stone-200 dark:border-stone-700'
                }`}
              />
            </div>
            {activeYm && (
              <span className="text-[11px] text-slate-500 dark:text-stone-400 capitalize ml-1">
                · {ymLabel(activeYm)}
              </span>
            )}
          </div>

          {/* Tipo + búsqueda + worker filter */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg p-0.5">
              {([
                { v: 'all'        as const, label: 'Todo' },
                { v: 'reserva'    as const, label: 'Reservas' },
                { v: 'entrega'    as const, label: 'Entregas' },
                { v: 'incidencia' as const, label: 'Incidencias' },
              ]).map(opt => (
                <button key={opt.v} onClick={() => setTypeFilter(opt.v)}
                  className={`px-2.5 py-1 text-[11px] rounded-md transition-all ${
                    typeFilter === opt.v ? 'bg-orange-500 text-white' : 'text-slate-500 dark:text-stone-400 hover:text-orange-500'
                  }`}>
                  {opt.label}
                </button>
              ))}
            </div>

            <div className="relative flex-1 min-w-[140px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-stone-500 pointer-events-none" size={12} />
              <input
                type="text"
                placeholder={mode === 'bulk' ? 'Buscar apartamento o trabajador…' : 'Buscar apartamento…'}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-7 pr-3 py-1.5 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg text-[11px] text-slate-600 dark:text-stone-300 placeholder:text-slate-400 dark:placeholder:text-stone-500 focus:outline-none focus:border-orange-400"
              />
            </div>

            {mode === 'bulk' && (
              <select
                value={workerFilter}
                onChange={(e) => setWorkerFilter(e.target.value)}
                className="px-2 py-1.5 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg text-[11px] text-slate-600 dark:text-stone-300 focus:outline-none focus:border-orange-400 max-w-[180px]"
              >
                <option value="">Todos los trabajadores</option>
                {workers.map(w => (
                  <option key={w.id} value={w.id}>{w.fullName}</option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Lista */}
        <div className="overflow-y-auto flex-1">
          {visibleItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400 dark:text-stone-500">
              <AlertCircle size={32} className="mb-3 opacity-50" />
              <p className="text-sm">Sin items en este filtro</p>
              <p className="text-xs mt-1">Prueba a cambiar el periodo o el tipo</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-stone-50 dark:bg-stone-900 border-b border-stone-100 dark:border-stone-800 z-10">
                <tr>
                  <th className="w-10 px-4 py-3 text-center">
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={toggleAll}
                      className="accent-orange-500 w-3.5 h-3.5"
                      aria-label="Seleccionar todos"
                    />
                  </th>
                  <th className="px-2 py-3 text-[10px] uppercase tracking-wider text-slate-400 dark:text-stone-500 font-normal">Fecha</th>
                  {mode === 'bulk' && (
                    <th className="px-2 py-3 text-[10px] uppercase tracking-wider text-slate-400 dark:text-stone-500 font-normal">Trabajador</th>
                  )}
                  <th className="px-2 py-3 text-[10px] uppercase tracking-wider text-slate-400 dark:text-stone-500 font-normal">Tipo</th>
                  <th className="px-2 py-3 text-[10px] uppercase tracking-wider text-slate-400 dark:text-stone-500 font-normal">Concepto</th>
                  <th className="px-4 py-3 text-[10px] uppercase tracking-wider text-slate-400 dark:text-stone-500 font-normal text-right">Monto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
                {visibleItems.map(it => {
                  const isSelected = selectedKeys.has(it.key);
                  const meta = TYPE_META[it.type];
                  return (
                    <tr
                      key={it.key}
                      onClick={() => toggleOne(it.key)}
                      className={`cursor-pointer transition-colors ${
                        isSelected ? 'bg-orange-50/40 dark:bg-orange-900/10' : 'hover:bg-stone-50 dark:hover:bg-stone-800/40'
                      }`}
                    >
                      <td className="w-10 px-4 py-3 text-center" onClick={e => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleOne(it.key)}
                          className="accent-orange-500 w-3.5 h-3.5"
                        />
                      </td>
                      <td className="px-2 py-3 text-xs text-slate-600 dark:text-stone-300 tabular-nums">{fmtShortDate(it.date)}</td>
                      {mode === 'bulk' && (
                        <td className="px-2 py-3 text-xs text-slate-700 dark:text-stone-200 truncate max-w-[140px]">{it.workerName}</td>
                      )}
                      <td className="px-2 py-3">
                        <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full ${meta.chip}`}>
                          {meta.icon} {meta.label}
                        </span>
                      </td>
                      <td className="px-2 py-3">
                        <div className="text-xs text-slate-700 dark:text-stone-200 truncate max-w-[260px]">{it.apartamento}</div>
                        {it.subtitle && (
                          <div className="text-[10px] text-slate-400 dark:text-stone-500 truncate max-w-[260px]">{it.subtitle}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-xs tabular-nums font-medium text-slate-800 dark:text-stone-100">
                        {fmtCurrency(it.monto)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Pie */}
        <div className="px-6 py-4 border-t border-stone-100 dark:border-stone-800 bg-stone-50/50 dark:bg-stone-900/50">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div className="text-xs text-slate-600 dark:text-stone-300 space-y-0.5">
              <div>
                <strong className="tabular-nums">{selectedItems.length}</strong> seleccionados
                {mode === 'bulk' && (
                  <span className="text-slate-400 dark:text-stone-500"> · {workersAffected} trabajador{workersAffected !== 1 ? 'es' : ''}</span>
                )}
                <span className="ml-2 text-slate-400 dark:text-stone-500">·</span>
                <strong className="ml-2 text-orange-600 dark:text-orange-400 tabular-nums">{fmtCurrency(totalSelected)}</strong>
              </div>
              {mode === 'single' && (
                <div className="text-[11px] text-slate-500 dark:text-stone-400">
                  Saldo actual <strong className="tabular-nums">{fmtCurrency(currentBalance ?? 0)}</strong>
                  {' → '}
                  Nuevo <strong className="tabular-nums text-amber-600 dark:text-amber-400">{fmtCurrency(nextBalance)}</strong>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-slate-500 dark:text-stone-400 hover:text-slate-700 dark:hover:text-stone-200 transition-colors">
                Cancelar
              </button>
              <button onClick={handleConfirm}
                disabled={saving || selectedItems.length === 0}
                className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white text-xs font-medium rounded-xl hover:bg-orange-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                Confirmar y sumar
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ItemSelectorModal;
