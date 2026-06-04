import React, { useEffect, useState } from 'react';
import { X, AlertTriangle } from 'lucide-react';
import {
  ApartamentoAutocomplete,
  SubmitFooter,
  inputCls,
  labelCls,
  resolveAccommodationId,
  useAccommodations,
} from './serviceFormHelpers';
import { saveDraft, submitIncidentReport } from '../../services/reportsApi';

interface IncidenciaFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  draftId?: string | null;
  draftPayload?: Partial<FormState> | null;
}

interface FormState {
  apartamento: string;
  duracion: string; // HH:MM
  detalles: string;
}

const emptyForm: FormState = {
  apartamento: '',
  duracion: '',
  detalles: '',
};

const IncidenciaFormModal: React.FC<IncidenciaFormModalProps> = ({
  isOpen,
  onClose,
  draftId,
  draftPayload,
}) => {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ type: 'ok' | 'error'; message: string } | null>(null);
  const accommodations = useAccommodations(isOpen);

  useEffect(() => {
    if (!isOpen) {
      setForm(emptyForm);
      setStatus(null);
    } else if (draftPayload) {
      setForm({ ...emptyForm, ...draftPayload });
    }
  }, [isOpen, draftPayload]);

  const setF = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const isValid =
    !!form.apartamento.trim() && !!form.duracion && !!form.detalles.trim();

  const hasData =
    form.apartamento.trim().length > 0 ||
    form.duracion.length > 0 ||
    form.detalles.trim().length > 0;

  const handleSubmit = async () => {
    setBusy(true);
    setStatus(null);
    try {
      await submitIncidentReport({
        accommodationId: resolveAccommodationId(form.apartamento, accommodations),
        accommodationName: form.apartamento,
        duracion: form.duracion,
        detalles: form.detalles,
      });
      if (draftId) {
        const { deleteDraft } = await import('../../services/reportsApi');
        await deleteDraft(draftId).catch(() => {});
      }
      setStatus({ type: 'ok', message: 'Incidencia enviada correctamente.' });
      setTimeout(onClose, 900);
    } catch (e: any) {
      setStatus({ type: 'error', message: e?.message || 'Error al enviar la incidencia.' });
    } finally {
      setBusy(false);
    }
  };

  const handleSaveDraft = async () => {
    setBusy(true);
    setStatus(null);
    try {
      await saveDraft('incident', form, draftId ?? undefined);
      setStatus({ type: 'ok', message: 'Datos guardados.' });
      setTimeout(onClose, 900);
    } catch (e: any) {
      setStatus({ type: 'error', message: e?.message || 'Error al guardar.' });
    } finally {
      setBusy(false);
    }
  };

  const handleCancelOrClose = () => {
    if (hasData && status?.type !== 'ok') {
      saveDraft('incident', form, draftId ?? undefined).catch(console.error);
    }
    onClose();
  };

  const handleDiscardDraft = async () => {
    setBusy(true);
    setStatus(null);
    try {
      if (draftId) {
        const { deleteDraft } = await import('../../services/reportsApi');
        await deleteDraft(draftId);
      }
      setForm(emptyForm);
      setStatus({ type: 'ok', message: 'Datos descartados.' });
      setTimeout(onClose, 900);
    } catch (e: any) {
      setStatus({ type: 'error', message: e?.message || 'Error al descartar datos.' });
    } finally {
      setBusy(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={handleCancelOrClose} />
      <div className="relative w-full sm:max-w-lg max-h-[95vh] sm:max-h-[90vh] flex flex-col bg-white dark:bg-stone-900 sm:rounded-3xl rounded-t-3xl shadow-2xl border border-white/60 dark:border-stone-800/50 animate-in zoom-in-95 slide-in-from-bottom-4 duration-300">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-stone-800/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-red-100 dark:bg-red-400/10 text-red-600 dark:text-red-400">
              <AlertTriangle size={18} />
            </div>
            <div>
              <h2 className="text-base font-medium text-slate-800 dark:text-stone-100 font-display">
                Reportar incidencia
              </h2>
              <p className="text-xs text-slate-400 dark:text-stone-500 font-light">
                Informa de un problema en el alojamiento
              </p>
            </div>
          </div>
          <button
            onClick={handleCancelOrClose}
            className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-stone-800/60 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          <div>
            <label className={labelCls}>
              Apartamento <span className="text-orange-500">*</span>
            </label>
            <ApartamentoAutocomplete
              value={form.apartamento}
              onChange={(v) => setF('apartamento', v)}
              options={accommodations}
            />
          </div>

          <div>
            <label className={labelCls}>
              Duración de la incidencia (HH:MM) <span className="text-orange-500">*</span>
            </label>
            <input
              type="time"
              value={form.duracion}
              onChange={(e) => setF('duracion', e.target.value)}
              className={inputCls}
              placeholder="00:00"
            />
          </div>

          <div>
            <label className={labelCls}>
              Detalles de la incidencia <span className="text-orange-500">*</span>
            </label>
            <textarea
              rows={5}
              value={form.detalles}
              onChange={(e) => setF('detalles', e.target.value)}
              className={inputCls}
              placeholder="Ej: persiana rota en habitación principal…"
            />
          </div>
        </div>

        <SubmitFooter
          isValid={isValid}
          hasData={hasData}
          busy={busy}
          status={status}
          onCancel={handleCancelOrClose}
          onSubmit={handleSubmit}
          onSaveDraft={handleSaveDraft}
          onDiscardDraft={handleDiscardDraft}
        />
      </div>
    </div>
  );
};

export default IncidenciaFormModal;
