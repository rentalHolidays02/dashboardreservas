import React, { useState, useEffect, useMemo } from 'react';
import { X, Check, Loader2, Users as UsersIcon, AlertCircle } from 'lucide-react';

const fmtCurrency = (n: number) =>
  n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });

export interface QuickBulkRow {
  workerId: string;
  workerName: string;
  workerPhoto?: string;
  monto: number;
  itemKeys: string[];
  currentBalance: number;
}

export interface QuickBulkConfirmModalProps {
  isOpen: boolean;
  periodLabel: string;
  rows: QuickBulkRow[];
  onClose(): void;
  onConfirm(selected: QuickBulkRow[]): Promise<void>;
}

const QuickBulkConfirmModal: React.FC<QuickBulkConfirmModalProps> = ({
  isOpen, periodLabel, rows, onClose, onConfirm,
}) => {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    // Pre-seleccionar trabajadores con monto > 0
    setSelected(new Set(rows.filter(r => r.monto > 0).map(r => r.workerId)));
  }, [isOpen, rows]);

  const visibleRows = useMemo(() => rows.filter(r => r.monto > 0), [rows]);
  const total = useMemo(
    () => visibleRows.filter(r => selected.has(r.workerId)).reduce((s, r) => s + r.monto, 0),
    [visibleRows, selected]
  );

  const allSelected = visibleRows.length > 0 && visibleRows.every(r => selected.has(r.workerId));

  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(visibleRows.map(r => r.workerId)));
  };

  const toggleOne = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };

  const handleConfirm = async () => {
    const picked = visibleRows.filter(r => selected.has(r.workerId));
    if (picked.length === 0) return;
    setSaving(true);
    try {
      await onConfirm(picked);
      onClose();
    } catch (e: any) {
      console.error('Error confirmando pago bulk:', e);
      alert(`Error: ${e?.message || e}`);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-stone-900 w-full max-w-3xl max-h-[90vh] flex flex-col rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-stone-100 dark:border-stone-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-orange-50 dark:bg-orange-900/20 flex items-center justify-center">
              <UsersIcon size={18} className="text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <h2 className="text-sm font-medium text-slate-800 dark:text-stone-100">Confirmar cobros · <span className="capitalize">{periodLabel}</span></h2>
              <p className="text-xs text-slate-400 dark:text-stone-500">Revisa, ajusta y confirma la suma al saldo pendiente</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors">
            <X size={16} className="text-slate-500 dark:text-stone-400" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1">
          {visibleRows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400 dark:text-stone-500">
              <AlertCircle size={32} className="mb-3 opacity-50" />
              <p className="text-sm">Sin actividad cobrable en este periodo</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-stone-50 dark:bg-stone-900 border-b border-stone-100 dark:border-stone-800 z-10">
                <tr>
                  <th className="w-10 px-4 py-3 text-center">
                    <input type="checkbox" checked={allSelected} onChange={toggleAll}
                      className="accent-orange-500 w-3.5 h-3.5" aria-label="Seleccionar todos" />
                  </th>
                  <th className="px-2 py-3 text-[10px] uppercase tracking-wider text-slate-400 dark:text-stone-500 font-normal">Trabajador</th>
                  <th className="px-2 py-3 text-[10px] uppercase tracking-wider text-slate-400 dark:text-stone-500 font-normal text-center">Items</th>
                  <th className="px-2 py-3 text-[10px] uppercase tracking-wider text-slate-400 dark:text-stone-500 font-normal text-right">Saldo actual</th>
                  <th className="px-2 py-3 text-[10px] uppercase tracking-wider text-slate-400 dark:text-stone-500 font-normal text-right">A sumar</th>
                  <th className="px-4 py-3 text-[10px] uppercase tracking-wider text-slate-400 dark:text-stone-500 font-normal text-right">Nuevo saldo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
                {visibleRows.map(r => {
                  const isSel = selected.has(r.workerId);
                  const next = r.currentBalance + (isSel ? r.monto : 0);
                  return (
                    <tr key={r.workerId} onClick={() => toggleOne(r.workerId)}
                      className={`cursor-pointer transition-colors ${isSel ? 'bg-orange-50/40 dark:bg-orange-900/10' : 'hover:bg-stone-50 dark:hover:bg-stone-800/40'}`}>
                      <td className="w-10 px-4 py-3 text-center" onClick={e => e.stopPropagation()}>
                        <input type="checkbox" checked={isSel} onChange={() => toggleOne(r.workerId)}
                          className="accent-orange-500 w-3.5 h-3.5" />
                      </td>
                      <td className="px-2 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-6 h-6 rounded-full overflow-hidden shrink-0 bg-stone-100 dark:bg-stone-800">
                            {r.workerPhoto ? <img src={r.workerPhoto} alt={r.workerName} className="w-full h-full object-cover" />
                                            : <span className="w-full h-full flex items-center justify-center text-[10px] text-slate-500">{r.workerName.charAt(0)}</span>}
                          </div>
                          <span className="text-xs text-slate-700 dark:text-stone-200">{r.workerName}</span>
                        </div>
                      </td>
                      <td className="px-2 py-3 text-center text-xs text-slate-500 dark:text-stone-400 tabular-nums">{r.itemKeys.length}</td>
                      <td className="px-2 py-3 text-right text-xs tabular-nums text-slate-600 dark:text-stone-300">{fmtCurrency(r.currentBalance)}</td>
                      <td className="px-2 py-3 text-right text-xs tabular-nums font-medium text-orange-600 dark:text-orange-400">+{fmtCurrency(r.monto)}</td>
                      <td className="px-4 py-3 text-right text-xs tabular-nums font-semibold text-amber-600 dark:text-amber-400">{fmtCurrency(next)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="px-6 py-4 border-t border-stone-100 dark:border-stone-800 bg-stone-50/50 dark:bg-stone-900/50">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div className="text-xs text-slate-600 dark:text-stone-300">
              <strong className="tabular-nums">{selected.size}</strong> trabajadores ·{' '}
              <strong className="text-orange-600 dark:text-orange-400 tabular-nums">{fmtCurrency(total)}</strong> a sumar
            </div>
            <div className="flex items-center gap-2">
              <button onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-slate-500 dark:text-stone-400 hover:text-slate-700 dark:hover:text-stone-200 transition-colors">
                Cancelar
              </button>
              <button onClick={handleConfirm}
                disabled={saving || selected.size === 0}
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

export default QuickBulkConfirmModal;
