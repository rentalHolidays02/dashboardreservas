import React, { useEffect, useState } from 'react';
import { X, AlertTriangle } from 'lucide-react';
import {
  ApartamentoAutocomplete,
  SubmitFooter,
  inputCls,
  labelCls,
  useAccommodations,
} from './serviceFormHelpers';

interface IncidenciaFormModalProps {
  isOpen: boolean;
  onClose: () => void;
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

const IncidenciaFormModal: React.FC<IncidenciaFormModalProps> = ({ isOpen, onClose }) => {
  const [form, setForm] = useState<FormState>(emptyForm);
  const accommodations = useAccommodations(isOpen);

  useEffect(() => {
    if (!isOpen) setForm(emptyForm);
  }, [isOpen]);

  const setF = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const isValid =
    !!form.apartamento.trim() && !!form.duracion && !!form.detalles.trim();

  const hasData =
    form.apartamento.trim().length > 0 ||
    form.duracion.length > 0 ||
    form.detalles.trim().length > 0;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
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
            onClick={onClose}
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

        <SubmitFooter isValid={isValid} hasData={hasData} onCancel={onClose} />
      </div>
    </div>
  );
};

export default IncidenciaFormModal;
