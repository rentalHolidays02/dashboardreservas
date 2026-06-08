import React, { useEffect, useState } from 'react';
import {
  ApartamentoAutocomplete,
  DuracionInput,
  formatDuracionTotal,
  inputCls,
  labelCls,
  resolveAccommodationId,
  useAccommodations,
} from './serviceFormHelpers';
import { saveDraft, submitIncidentReport } from '../../services/reportsApi';
import { localDrafts } from '../../utils/localDrafts';
import WorkerFormSheet from './WorkerFormSheet';

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

const ast = <span className="text-stone-400 dark:text-stone-500">*</span>;

const IncidenciaFormModal: React.FC<IncidenciaFormModalProps> = ({
  isOpen,
  onClose,
  draftId,
  draftPayload,
}) => {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [dirty, setDirty] = useState(false);
  const accommodations = useAccommodations(isOpen);

  useEffect(() => {
    if (!isOpen) {
      setForm(emptyForm);
      setDirty(false);
    } else if (draftPayload) {
      setForm({ ...emptyForm, ...draftPayload });
    } else {
      const local = localDrafts.load<Partial<FormState>>('incident');
      if (local) setForm({ ...emptyForm, ...local });
    }
  }, [isOpen, draftPayload]);

  const setF = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setDirty(true);
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const isValid =
    !!form.apartamento.trim() && !!form.duracion && !!form.detalles.trim();

  const handleSubmit = async () => {
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
    localDrafts.clear('incident');
  };

  const handleSaveDraft = async () => {
    await saveDraft('incident', form, draftId ?? undefined);
    localDrafts.clear('incident');
  };

  const handleDiscard = async () => {
    if (draftId) {
      const { deleteDraft } = await import('../../services/reportsApi');
      await deleteDraft(draftId).catch(() => {});
    }
    localDrafts.clear('incident');
    setForm(emptyForm);
    setDirty(false);
  };

  return (
    <WorkerFormSheet
      isOpen={isOpen}
      onClose={onClose}
      title="Solucionar incidencia"
      subtitle="Cuéntanos qué ha pasado en el alojamiento."
      hasChanges={dirty}
      isValid={isValid}
      onSubmit={handleSubmit}
      onSaveDraft={handleSaveDraft}
      onDiscard={handleDiscard}
      successMessage="Incidencia enviada correctamente."
    >
      <div>
        <label className={labelCls}>Apartamento {ast}</label>
        <ApartamentoAutocomplete
          value={form.apartamento}
          onChange={(v) => setF('apartamento', v)}
          options={accommodations}
        />
      </div>

      <div>
        <div className="flex items-baseline justify-between mb-1.5">
          <label className="block text-xs font-medium text-slate-600 dark:text-stone-300">
            Duración de la incidencia {ast}
          </label>
          <span className="text-[11px] text-slate-500 dark:text-stone-400">
            Total: <span className="font-medium text-slate-700 dark:text-stone-200">{formatDuracionTotal(form.duracion)}</span>
          </span>
        </div>
        <DuracionInput hideTotal value={form.duracion} onChange={(v) => setF('duracion', v)} />
      </div>

      <div>
        <label className={labelCls}>Detalles de la incidencia {ast}</label>
        <textarea
          rows={5}
          value={form.detalles}
          onChange={(e) => setF('detalles', e.target.value)}
          className={inputCls}
          placeholder="Ej: persiana rota en habitación principal…"
        />
      </div>
    </WorkerFormSheet>
  );
};

export default IncidenciaFormModal;
