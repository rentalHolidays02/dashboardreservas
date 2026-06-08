import React, { useEffect, useMemo, useState } from 'react';
import type { User } from '../../services/mockData';
import { appsScriptApi } from '../../services/api';
import { inputCls, labelCls } from '../workers/serviceFormHelpers';
import WorkerFormSheet from '../workers/WorkerFormSheet';

export type FeedbackTipo = 'fallo' | 'sugerencia' | 'otro';

interface SugerenciaFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User;
}

interface FormState {
  tipo: FeedbackTipo;
  descripcion: string;
  telefono: string;
}

const TIPO_OPTIONS: { id: FeedbackTipo; label: string; hint: string }[] = [
  { id: 'fallo', label: 'Reportar fallo', hint: 'Algo no funciona bien en la app' },
  { id: 'sugerencia', label: 'Sugerencia', hint: 'Ideas para mejorar el servicio' },
  { id: 'otro', label: 'Otro', hint: 'Cualquier otro comentario' },
];

const ast = <span className="text-stone-400 dark:text-stone-500">*</span>;

function splitName(full: string): { nombre: string; apellidos: string } {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { nombre: '', apellidos: '' };
  if (parts.length === 1) return { nombre: parts[0], apellidos: '' };
  return { nombre: parts[0], apellidos: parts.slice(1).join(' ') };
}

const SugerenciaFormModal: React.FC<SugerenciaFormModalProps> = ({ isOpen, onClose, user }) => {
  const defaultTelefono = user.telefono ?? '';
  const emptyForm: FormState = { tipo: 'sugerencia', descripcion: '', telefono: defaultTelefono };

  const [form, setForm] = useState<FormState>(emptyForm);
  const [dirty, setDirty] = useState(false);

  const { nombre, apellidos } = useMemo(() => splitName(user.name || ''), [user.name]);

  useEffect(() => {
    if (isOpen) {
      setForm(emptyForm);
      setDirty(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const setF = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setDirty(true);
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const isValid = form.descripcion.trim().length >= 10 && !!user.email;

  const handleSubmit = async () => {
    const ok = await appsScriptApi.sendAppFeedback({
      nombre,
      apellidos,
      email: user.email,
      telefono: form.telefono.trim(),
      tipo: form.tipo,
      descripcion: form.descripcion.trim(),
    });
    if (!ok) throw new Error('No se pudo enviar. Comprueba la conexión o inténtalo más tarde.');
  };

  return (
    <WorkerFormSheet
      isOpen={isOpen}
      onClose={onClose}
      title="Tengo un problema"
      subtitle="Cuéntanos qué pasa. Lo leerá el equipo de Rental Holidays."
      hasChanges={dirty}
      isValid={isValid}
      onSubmit={handleSubmit}
      submitLabel="Enviar"
      helperIdle="Escribe al menos 10 caracteres."
      helperDraft="Faltan caracteres en la descripción."
      helperSend="Listo para enviar. Pulsa para enviar tu mensaje."
      successMessage="Gracias por tu feedback. Lo revisaremos pronto."
    >
      <div className="rounded-xl bg-transparent border-[1.5px] border-stone-200 dark:border-stone-700/60 px-4 py-3 space-y-1">
        <p className="text-xs text-slate-600 dark:text-stone-300">
          <span className="text-slate-400 dark:text-stone-500">De: </span>
          {[nombre, apellidos].filter(Boolean).join(' ') || 'Trabajador'}
        </p>
        <p className="text-xs text-slate-600 dark:text-stone-300">
          <span className="text-slate-400 dark:text-stone-500">Correo: </span>
          {user.email}
        </p>
      </div>

      <div>
        <label className={labelCls}>Teléfono de contacto</label>
        <input
          type="tel"
          value={form.telefono}
          onChange={(e) => setF('telefono', e.target.value)}
          placeholder="+34 612 34 56 78"
          className={inputCls}
        />
      </div>

      <div>
        <label className={labelCls}>Tipo de mensaje {ast}</label>
        <div className="space-y-2">
          {TIPO_OPTIONS.map((opt) => {
            const active = form.tipo === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setF('tipo', opt.id)}
                className={`w-full flex items-center gap-3 px-4 py-4 rounded-xl border-[1.5px] text-left transition-colors ${
                  active
                    ? 'bg-stone-900 dark:bg-stone-100 border-stone-900 dark:border-stone-100 text-white dark:text-stone-900'
                    : 'bg-transparent border-stone-200 dark:border-stone-700/60 text-slate-700 dark:text-stone-300'
                }`}
              >
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-medium">{opt.label}</span>
                  <span className={`block text-[11px] mt-0.5 ${active ? 'text-white/70 dark:text-stone-900/70' : 'text-slate-400 dark:text-stone-500'}`}>{opt.hint}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <label className={labelCls}>Descripción {ast}</label>
        <textarea
          rows={5}
          value={form.descripcion}
          onChange={(e) => setF('descripcion', e.target.value)}
          className={inputCls}
          placeholder="Cuéntanos qué ha pasado o qué te gustaría mejorar…"
        />
        <p className="mt-1.5 text-[10px] text-slate-400 dark:text-stone-500">
          Mínimo 10 caracteres · {form.descripcion.trim().length} escritos
        </p>
      </div>
    </WorkerFormSheet>
  );
};

export default SugerenciaFormModal;
