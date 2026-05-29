import React, { useState, useEffect } from 'react';
import { X, Save, Loader2, Trash2, Calculator, CheckCircle2, Clock } from 'lucide-react';
import { MonthlyPayment, PaymentReportStatus } from '../../services/mockData';
import { MonthlyPaymentInput } from '../../services/api';

interface Props {
  isOpen: boolean;
  payment: MonthlyPayment | null;
  workerName: string;
  onClose: () => void;
  onSave: (input: MonthlyPaymentInput) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
}

interface FormState {
  numReservations: number;
  numExtraReservations: number;
  numLinenServices: number;
  numOvertimeHours: number;
  numKilometers: number;
  numIncidents: number;
  rateReservation: number;
  rateExtraReservation: number;
  rateLinenService: number;
  rateKilometer: number;
  rateIncident: number;
  rateOvertime: number;
  otros: number;
  abonosRecogidos: number;
  saldoMesAnteriorPendiente: number;
  reporte: PaymentReportStatus;
  observaciones: string;
}

const emptyForm = (p: MonthlyPayment): FormState => ({
  numReservations: p.numReservations,
  numExtraReservations: p.numExtraReservations,
  numLinenServices: p.numLinenServices,
  numOvertimeHours: p.numOvertimeHours,
  numKilometers: p.numKilometers,
  numIncidents: p.numIncidents,
  rateReservation: p.rateReservation,
  rateExtraReservation: p.rateExtraReservation,
  rateLinenService: p.rateLinenService,
  rateKilometer: p.rateKilometer,
  rateIncident: p.rateIncident,
  rateOvertime: p.rateOvertime,
  otros: p.otros,
  abonosRecogidos: p.abonosRecogidos,
  saldoMesAnteriorPendiente: p.saldoMesAnteriorPendiente ?? 0,
  reporte: p.reporte,
  observaciones: p.observaciones,
});

const fmtCurrency = (n: number) => n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });
const fmtPeriod = (p: string) => {
  const d = new Date(p + 'T00:00:00');
  return d.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
};

const labelCls = 'block text-[10px] font-normal text-slate-400 dark:text-stone-500 tracking-widest mb-1.5 px-1 uppercase';
const inputCls = 'w-full px-3 py-2.5 bg-stone-50 dark:bg-stone-800/50 border border-slate-100 dark:border-stone-700/50 rounded-xl text-slate-700 dark:text-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500/40 transition-all font-light tabular-nums';
const computedCls = 'w-full px-3 py-2.5 bg-emerald-50/50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-900/40 rounded-xl text-emerald-700 dark:text-emerald-300 text-sm font-medium tabular-nums';

const MonthlyPaymentDetailModal: React.FC<Props> = ({ isOpen, payment, workerName, onClose, onSave, onDelete }) => {
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (payment) setForm(emptyForm(payment));
  }, [payment]);

  if (!isOpen || !payment || !form) return null;

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm(prev => prev ? { ...prev, [k]: v } : prev);
  const setNum = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) =>
    set(k, (e.target.value === '' ? 0 : parseFloat(e.target.value)) as FormState[typeof k]);

  // Computed live (mirroring Postgres GENERATED columns)
  const montoReservas = form.numReservations * form.rateReservation + form.numExtraReservations * form.rateExtraReservation;
  const montoSabanas = form.numLinenServices * form.rateLinenService;
  const montoHorasExtra = form.numOvertimeHours * form.rateOvertime;
  const montoKm = form.numKilometers * form.rateKilometer;
  const montoIncidencias = form.numIncidents * form.rateIncident;
  const total = montoReservas + montoSabanas + montoHorasExtra + montoKm + montoIncidencias + form.otros;
  const saldoPendiente = form.saldoMesAnteriorPendiente + total - form.abonosRecogidos;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave({
        workerId: payment.workerId,
        period: payment.period,
        ...form,
        saldoMesAnteriorPendiente: form.saldoMesAnteriorPendiente,
      });
      onClose();
    } catch (err) {
      console.error('Error guardando pago:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    if (!confirm('¿Eliminar esta fila? No se puede deshacer.')) return;
    setDeleting(true);
    try {
      await onDelete(payment.id);
      onClose();
    } catch (err) {
      console.error('Error eliminando pago:', err);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-white/20 dark:bg-stone-950/40 backdrop-blur-sm animate-in fade-in duration-300" onClick={onClose} />

      <div className="relative bg-white dark:bg-stone-900 w-full max-w-4xl rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 slide-in-from-bottom-4 duration-300 max-h-[92vh] flex flex-col">
        <header className="px-6 py-5 border-b border-stone-100 dark:border-stone-800/50 flex items-center justify-between bg-white/50 dark:bg-stone-900/50 backdrop-blur-md shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 rounded-xl">
              <Calculator size={20} />
            </div>
            <div>
              <h2 className="text-lg font-normal text-slate-800 dark:text-stone-200 tracking-tight font-display capitalize">
                {workerName} · {fmtPeriod(payment.period)}
              </h2>
              <p className="text-[11px] text-slate-400 dark:text-stone-500">Editar nómina mensual</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-xl transition-colors text-slate-400">
            <X size={20} />
          </button>
        </header>

        <div className="overflow-y-auto flex-1">
          <form id="payment-detail-form" onSubmit={handleSubmit} className="p-6 space-y-7">

            {/* Cantidades */}
            <section className="space-y-3">
              <h3 className="text-[11px] font-bold uppercase tracking-widest text-orange-600 dark:text-orange-400 px-1">Cantidades</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div><label className={labelCls}># Reservas</label><input type="number" step="1" min="0" className={inputCls} value={form.numReservations} onChange={setNum('numReservations')} /></div>
                <div><label className={labelCls}># Reservas adicional</label><input type="number" step="1" min="0" className={inputCls} value={form.numExtraReservations} onChange={setNum('numExtraReservations')} /></div>
                <div><label className={labelCls}># Sábanas y toallas</label><input type="number" step="1" min="0" className={inputCls} value={form.numLinenServices} onChange={setNum('numLinenServices')} /></div>
                <div><label className={labelCls}>Nº horas extra</label><input type="number" step="0.25" min="0" className={inputCls} value={form.numOvertimeHours} onChange={setNum('numOvertimeHours')} /></div>
                <div><label className={labelCls}>Nº kilómetros</label><input type="number" step="0.1" min="0" className={inputCls} value={form.numKilometers} onChange={setNum('numKilometers')} /></div>
                <div><label className={labelCls}>Nº incidencias</label><input type="number" step="1" min="0" className={inputCls} value={form.numIncidents} onChange={setNum('numIncidents')} /></div>
              </div>
            </section>

            {/* Precios unitarios */}
            <section className="space-y-3">
              <h3 className="text-[11px] font-bold uppercase tracking-widest text-orange-600 dark:text-orange-400 px-1">Precios unitarios (€)</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div><label className={labelCls}>€ reserva</label><input type="number" step="0.01" min="0" className={inputCls} value={form.rateReservation} onChange={setNum('rateReservation')} /></div>
                <div><label className={labelCls}>€ reserva adicional</label><input type="number" step="0.01" min="0" className={inputCls} value={form.rateExtraReservation} onChange={setNum('rateExtraReservation')} /></div>
                <div><label className={labelCls}>€ sábanas y toallas</label><input type="number" step="0.01" min="0" className={inputCls} value={form.rateLinenService} onChange={setNum('rateLinenService')} /></div>
                <div><label className={labelCls}>€ hora extra</label><input type="number" step="0.01" min="0" className={inputCls} value={form.rateOvertime} onChange={setNum('rateOvertime')} /></div>
                <div><label className={labelCls}>€ kilometraje</label><input type="number" step="0.01" min="0" className={inputCls} value={form.rateKilometer} onChange={setNum('rateKilometer')} /></div>
                <div><label className={labelCls}>€ incidencia</label><input type="number" step="0.01" min="0" className={inputCls} value={form.rateIncident} onChange={setNum('rateIncident')} /></div>
              </div>
            </section>

            {/* Montos calculados (read-only en vivo) */}
            <section className="space-y-3">
              <h3 className="text-[11px] font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400 px-1 flex items-center gap-2">
                <Calculator size={11} /> Montos calculados
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div><label className={labelCls}>Monto reservas</label><div className={computedCls}>{fmtCurrency(montoReservas)}</div></div>
                <div><label className={labelCls}>Monto sábanas y toallas</label><div className={computedCls}>{fmtCurrency(montoSabanas)}</div></div>
                <div><label className={labelCls}>Monto horas extra</label><div className={computedCls}>{fmtCurrency(montoHorasExtra)}</div></div>
                <div><label className={labelCls}>Monto kilometraje</label><div className={computedCls}>{fmtCurrency(montoKm)}</div></div>
                <div><label className={labelCls}>Monto incidencias</label><div className={computedCls}>{fmtCurrency(montoIncidencias)}</div></div>
                <div><label className={labelCls}>€ Otros</label><input type="number" step="0.01" className={inputCls} value={form.otros} onChange={setNum('otros')} /></div>
              </div>
            </section>

            {/* Saldos */}
            <section className="space-y-3">
              <h3 className="text-[11px] font-bold uppercase tracking-widest text-orange-600 dark:text-orange-400 px-1">Saldos</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Saldo mes anterior pendiente</label>
                  <input type="number" step="0.01" className={inputCls} value={form.saldoMesAnteriorPendiente} onChange={setNum('saldoMesAnteriorPendiente')} />
                  <p className="text-[10px] text-slate-400 dark:text-stone-500 mt-1 px-1 italic">Auto-rellenado por trigger si dejas el original (override si lo cambias)</p>
                </div>
                <div>
                  <label className={labelCls}>Abonos recogidos</label>
                  <input type="number" step="0.01" min="0" className={inputCls} value={form.abonosRecogidos} onChange={setNum('abonosRecogidos')} />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                <div className="bg-stone-50 dark:bg-stone-800/50 border border-stone-100 dark:border-stone-700/50 rounded-2xl px-4 py-3">
                  <p className="text-[10px] uppercase tracking-widest text-slate-400 dark:text-stone-500">Total mes</p>
                  <p className="text-2xl font-display text-slate-800 dark:text-stone-100 tabular-nums">{fmtCurrency(total)}</p>
                </div>
                <div className={`rounded-2xl px-4 py-3 border ${saldoPendiente > 0 ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-100 dark:border-amber-900/40' : 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-900/40'}`}>
                  <p className="text-[10px] uppercase tracking-widest text-slate-400 dark:text-stone-500">Saldo pendiente a pagar</p>
                  <p className={`text-2xl font-display tabular-nums ${saldoPendiente > 0 ? 'text-amber-700 dark:text-amber-400' : 'text-emerald-700 dark:text-emerald-400'}`}>{fmtCurrency(saldoPendiente)}</p>
                </div>
              </div>
            </section>

            {/* Reporte + observaciones */}
            <section className="space-y-3">
              <h3 className="text-[11px] font-bold uppercase tracking-widest text-orange-600 dark:text-orange-400 px-1">Estado</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Reporte</label>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => set('reporte', 'PENDIENTE')}
                      className={`flex-1 py-3 px-4 rounded-2xl border transition-all flex items-center justify-center gap-2 text-xs ${form.reporte === 'PENDIENTE' ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-100 dark:border-amber-900/40 text-amber-700 dark:text-amber-400 shadow-sm' : 'border-transparent text-slate-400 hover:bg-stone-50 dark:hover:bg-stone-800/50'}`}>
                      <Clock size={14} /> Pendiente
                    </button>
                    <button type="button" onClick={() => set('reporte', 'PAGO')}
                      className={`flex-1 py-3 px-4 rounded-2xl border transition-all flex items-center justify-center gap-2 text-xs ${form.reporte === 'PAGO' ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-900/40 text-emerald-700 dark:text-emerald-400 shadow-sm' : 'border-transparent text-slate-400 hover:bg-stone-50 dark:hover:bg-stone-800/50'}`}>
                      <CheckCircle2 size={14} /> Pagado
                    </button>
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Observaciones</label>
                  <textarea rows={3} value={form.observaciones} onChange={e => set('observaciones', e.target.value)}
                    className={`${inputCls} resize-none`} placeholder="Notas, ajustes..." />
                </div>
              </div>
            </section>

          </form>
        </div>

        <div className="p-6 border-t border-stone-100 dark:border-stone-800/50 bg-stone-50/50 dark:bg-stone-900/50 shrink-0 flex gap-3">
          {onDelete && (
            <button type="button" onClick={handleDelete} disabled={deleting || saving}
              className="py-3 px-4 bg-white dark:bg-stone-800 text-red-500 dark:text-red-400 font-medium rounded-2xl border border-red-100 dark:border-red-900/30 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all active:scale-95 disabled:opacity-50 text-xs flex items-center gap-2">
              {deleting ? <Loader2 className="animate-spin" size={14} /> : <Trash2 size={14} />}
              Eliminar
            </button>
          )}
          <button type="button" onClick={onClose}
            className="flex-1 py-3 px-6 bg-white dark:bg-stone-800 text-slate-600 dark:text-stone-300 font-medium rounded-2xl border border-slate-200 dark:border-stone-700 hover:bg-slate-50 dark:hover:bg-stone-700 transition-all active:scale-95 text-xs">
            Cancelar
          </button>
          <button form="payment-detail-form" type="submit" disabled={saving || deleting}
            className="flex-[2] py-3 px-6 bg-orange-600 text-white font-bold rounded-2xl hover:bg-orange-700 transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50 text-xs shadow-lg shadow-orange-500/20">
            {saving ? <><Loader2 className="animate-spin" size={16} /> Guardando...</> : <><Save size={16} /> Guardar cambios</>}
          </button>
        </div>
      </div>
    </div>
  );
};

export default MonthlyPaymentDetailModal;
