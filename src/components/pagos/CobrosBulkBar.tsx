import React, { useState, useMemo } from 'react';
import { Wallet, CalendarDays, History, Loader2 } from 'lucide-react';
import { appsScriptApi, activityLogApi } from '../../services/api';
import {
  Worker, NormalCleanRecord, InitialCleanRecord, HandymanRecord,
  EntregaLlaves, Incidencia, User as AppUser
} from '../../services/mockData';
import {
  buildPayableItems, PayableItem, ymOfCurrentMonth, ymOfLastMonth, ymLabel
} from '../../utils/paymentItems';
import { supabase } from '../../services/supabaseClient';
import ItemSelectorModal from './ItemSelectorModal';
import QuickBulkConfirmModal, { QuickBulkRow } from './QuickBulkConfirmModal';

interface DataBundle {
  workers: Worker[];
  normalCleans: NormalCleanRecord[];
  initialCleans: InitialCleanRecord[];
  handymanRecords: HandymanRecord[];
  entregaLlaves: EntregaLlaves[];
  incidencias: Incidencia[];
}

interface CobrosBulkBarProps {
  user?: AppUser;
  disabled?: boolean;
  onAfterApply?: () => void;
  workerId?: string;
}

const CobrosBulkBar: React.FC<CobrosBulkBarProps> = ({ user, disabled, onAfterApply, workerId }) => {
  const [data, setData] = useState<DataBundle | null>(null);
  const [openDetailed, setOpenDetailed] = useState(false);
  const [openQuick, setOpenQuick] = useState<null | 'this' | 'last'>(null);
  const [loading, setLoading] = useState(false);

  const ensureData = async (): Promise<DataBundle> => {
    if (data) return data;
    setLoading(true);
    try {
      const [workers, nc, ic, hm, el, inc] = await Promise.all([
        appsScriptApi.getWorkers().catch(() => [] as Worker[]),
        appsScriptApi.getNormalCleans().catch(() => [] as NormalCleanRecord[]),
        appsScriptApi.getInitialCleans().catch(() => [] as InitialCleanRecord[]),
        appsScriptApi.getHandymanRecords().catch(() => [] as HandymanRecord[]),
        appsScriptApi.getEntregaLlaves().catch(() => [] as EntregaLlaves[]),
        appsScriptApi.getRecentIncidencias(500).catch(() => [] as Incidencia[]),
      ]);
      const d: DataBundle = {
        workers,
        normalCleans: nc,
        initialCleans: ic,
        handymanRecords: hm,
        entregaLlaves: el,
        incidencias: inc,
      };
      setData(d);
      return d;
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDetailed = async () => {
    await ensureData();
    setOpenDetailed(true);
  };

  const handleOpenQuick = async (which: 'this' | 'last') => {
    await ensureData();
    setOpenQuick(which);
  };

  const allItems = useMemo<PayableItem[]>(() => {
    if (!data) return [];
    const items = buildPayableItems(
      data.workers, data.normalCleans, data.initialCleans,
      data.handymanRecords, data.entregaLlaves, data.incidencias
    );
    return workerId ? items.filter((it) => it.workerId === workerId) : items;
  }, [data, workerId]);

  const selectableWorkers = useMemo<Worker[]>(
    () => (data ? (workerId ? data.workers.filter((w) => w.id === workerId) : data.workers) : []),
    [data, workerId]
  );

  const quickRows = useMemo<QuickBulkRow[]>(() => {
    if (!data || !openQuick) return [];
    const targetYm = openQuick === 'this' ? ymOfCurrentMonth() : ymOfLastMonth();
    const byWorker = new Map<string, { monto: number; itemKeys: string[]; worker: Worker }>();
    for (const it of allItems) {
      if (it.yearMonth !== targetYm) continue;
      const cur = byWorker.get(it.workerId);
      if (cur) { cur.monto += it.monto; cur.itemKeys.push(it.key); }
      else {
        const w = data.workers.find(x => x.id === it.workerId);
        if (!w) continue;
        byWorker.set(it.workerId, { monto: it.monto, itemKeys: [it.key], worker: w });
      }
    }
    return [...byWorker.values()].map(({ monto, itemKeys, worker }) => ({
      workerId: worker.id,
      workerName: worker.fullName,
      workerPhoto: worker.photo,
      monto: Math.round(monto * 100) / 100,
      itemKeys,
      currentBalance: worker.owedMoney ?? 0,
    }));
  }, [allItems, data, openQuick]);

  const applyToWorkers = async (
    perWorker: Map<string, { addAmount: number; itemCount: number }>,
    contextLabel: string,
    actionType: string,
  ) => {
    if (!data) return;
    const updatedIds: string[] = [];
    for (const [workerId, { addAmount, itemCount }] of perWorker) {
      const w = data.workers.find(x => x.id === workerId);
      if (!w) continue;
      const current = w.owedMoney ?? 0;
      const next = Math.round((current + addAmount) * 100) / 100;
      const { error } = await supabase
        .from('workers')
        .update({ pending_balance: next })
        .eq('id', workerId);
      if (error) throw error;
      w.owedMoney = next;
      updatedIds.push(workerId);
      await activityLogApi.log(
        user?.id || null,
        user?.name || 'Sistema',
        `Sumó ${addAmount.toFixed(2)}€ (${itemCount} items) al pendiente de ${w.fullName} · ${contextLabel}`,
        actionType
      );
    }
    if (updatedIds.length > 0) {
      setData({ ...data });
      onAfterApply?.();
    }
  };

  const handleDetailedConfirm = async (items: PayableItem[]) => {
    const perWorker = new Map<string, { addAmount: number; itemCount: number }>();
    for (const it of items) {
      const e = perWorker.get(it.workerId) ?? { addAmount: 0, itemCount: 0 };
      e.addAmount += it.monto; e.itemCount += 1;
      perWorker.set(it.workerId, e);
    }
    await applyToWorkers(perWorker, 'selección manual de items', 'asignar_cobro_detallado');
  };

  const handleQuickConfirm = async (selected: QuickBulkRow[]) => {
    const perWorker = new Map<string, { addAmount: number; itemCount: number }>();
    for (const r of selected) {
      perWorker.set(r.workerId, { addAmount: r.monto, itemCount: r.itemKeys.length });
    }
    const label = openQuick === 'this' ? 'pago de este mes' : 'pago del mes pasado';
    const type = openQuick === 'this' ? 'asignar_cobro_mes_actual' : 'asignar_cobro_mes_anterior';
    await applyToWorkers(perWorker, label, type);
  };

  const quickPeriodLabel = openQuick === 'this'
    ? ymLabel(ymOfCurrentMonth())
    : openQuick === 'last' ? ymLabel(ymOfLastMonth()) : '';

  const btnBase = "flex items-center justify-center gap-2 px-3 py-2.5 text-xs font-medium rounded-xl transition-all active:scale-[0.98] disabled:opacity-50";
  const btnPrimary = `${btnBase} bg-orange-600 text-white hover:bg-orange-700 shadow-lg shadow-orange-500/20`;
  const btnSecondary = `${btnBase} bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-slate-700 dark:text-stone-200 hover:border-orange-400 hover:text-orange-600`;

  return (
    <>
      <div className="flex items-center gap-2">
        <button onClick={handleOpenDetailed} disabled={disabled || loading} className={btnPrimary} title="Selección manual de items">
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Wallet size={14} />}
          <span className="hidden sm:inline">Asignar cobros</span>
        </button>
        <button onClick={() => handleOpenQuick('this')} disabled={disabled || loading} className={btnSecondary} title="Pago de este mes">
          <CalendarDays size={14} />
          <span className="hidden sm:inline">Pago este mes</span>
        </button>
        <button onClick={() => handleOpenQuick('last')} disabled={disabled || loading} className={btnSecondary} title="Pago del mes pasado">
          <History size={14} />
          <span className="hidden sm:inline">Pago mes pasado</span>
        </button>
      </div>

      {data && (
        <>
          <ItemSelectorModal
            isOpen={openDetailed}
            mode="bulk"
            items={allItems}
            workers={selectableWorkers}
            initialPeriod="this"
            preselectAll={true}
            onClose={() => setOpenDetailed(false)}
            onConfirm={handleDetailedConfirm}
          />
          <QuickBulkConfirmModal
            isOpen={openQuick !== null}
            periodLabel={quickPeriodLabel}
            rows={quickRows}
            onClose={() => setOpenQuick(null)}
            onConfirm={handleQuickConfirm}
          />
        </>
      )}
    </>
  );
};

export default CobrosBulkBar;
