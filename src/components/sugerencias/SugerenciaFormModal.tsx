import React, { useEffect, useMemo, useState } from 'react';
import { X, MessageCircle, Loader2, Send, AlertCircle, Sparkles, HelpCircle } from 'lucide-react';
import type { User } from '../../services/mockData';
import { appsScriptApi } from '../../services/api';
import { inputCls, labelCls } from '../workers/serviceFormHelpers';

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

const TIPO_OPTIONS: { id: FeedbackTipo; label: string; icon: React.ReactNode; hint: string }[] = [
  { id: 'fallo', label: 'Reportar fallo', icon: <AlertCircle size={16} />, hint: 'Algo no funciona bien en la app' },
  { id: 'sugerencia', label: 'Sugerencia', icon: <Sparkles size={16} />, hint: 'Ideas para mejorar el servicio' },
  { id: 'otro', label: 'Otro', icon: <HelpCircle size={16} />, hint: 'Cualquier otro comentario' },
];

function splitName(full: string): { nombre: string; apellidos: string } {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { nombre: '', apellidos: '' };
  if (parts.length === 1) return { nombre: parts[0], apellidos: '' };
  return { nombre: parts[0], apellidos: parts.slice(1).join(' ') };
}

const SugerenciaFormModal: React.FC<SugerenciaFormModalProps> = ({ isOpen, onClose, user }) => {
  const [form, setForm] = useState<FormState>({ tipo: 'sugerencia', descripcion: '', telefono: user.telefono ?? '' });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { nombre, apellidos } = useMemo(() => splitName(user.name || ''), [user.name]);

  useEffect(() => {
    if (!isOpen) return;
    setForm({ tipo: 'sugerencia', descripcion: '', telefono: user.telefono ?? '' });
    setSending(false);
    setSent(false);
    setError(null);
  }, [isOpen, user.telefono]);

  const isValid = form.descripcion.trim().length >= 10 && !!user.email;

  const handleSubmit = async () => {
    if (!isValid || sending) return;
    setSending(true);
    setError(null);

    const ok = await appsScriptApi.sendAppFeedback({
      nombre,
      apellidos,
      email: user.email,
      telefono: form.telefono.trim(),
      tipo: form.tipo,
      descripcion: form.descripcion.trim(),
    });

    setSending(false);
    if (ok) {
      setSent(true);
      return;
    }
    setError('No se pudo enviar la sugerencia. Comprueba la conexión o inténtalo más tarde.');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-lg max-h-[95vh] sm:max-h-[90vh] flex flex-col bg-white dark:bg-stone-900 sm:rounded-3xl rounded-t-3xl shadow-2xl border border-white/60 dark:border-stone-800/50 animate-in zoom-in-95 slide-in-from-bottom-4 duration-300">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-stone-800/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-stone-100 dark:bg-stone-800/60 text-orange-600 dark:text-orange-400">
              <MessageCircle size={18} />
            </div>
            <div>
              <h2 className="text-base font-medium text-slate-800 dark:text-stone-100 font-display">
                Enviar sugerencia
              </h2>
              <p className="text-xs text-slate-400 dark:text-stone-500 font-light">
                Tu mensaje llegará al equipo de Rental Holidays
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

        {sent ? (
          <div className="px-6 py-10 flex flex-col items-center text-center gap-4">
            <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <Send size={22} />
            </div>
            <div>
              <p className="text-base font-medium text-slate-800 dark:text-stone-100">Sugerencia enviada</p>
              <p className="text-sm text-slate-400 dark:text-stone-500 mt-1">
                Gracias por tu feedback. Lo revisaremos lo antes posible.
              </p>
            </div>
            <button
              onClick={onClose}
              className="mt-2 px-6 py-3 rounded-2xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium transition-all active:scale-[0.98]"
            >
              Cerrar
            </button>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              <div className="rounded-2xl bg-stone-50 dark:bg-stone-800/40 border border-stone-100 dark:border-stone-700/50 px-4 py-3 space-y-1">
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
                  onChange={(e) => setForm((prev) => ({ ...prev, telefono: e.target.value }))}
                  placeholder="+34 612 34 56 78"
                  className={inputCls}
                />
              </div>

              <div>
                <label className={labelCls}>
                  Tipo de mensaje <span className="text-orange-500">*</span>
                </label>
                <div className="space-y-2">
                  {TIPO_OPTIONS.map((opt) => {
                    const active = form.tipo === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setForm((prev) => ({ ...prev, tipo: opt.id }))}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl border text-left transition-all active:scale-[0.99] ${
                          active
                            ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800/50 text-orange-700 dark:text-orange-300'
                            : 'bg-stone-50 dark:bg-stone-800/50 border-slate-100 dark:border-stone-700/50 text-slate-700 dark:text-stone-300 hover:border-orange-200 dark:hover:border-orange-800/40'
                        }`}
                      >
                        <span className={active ? 'text-orange-500' : 'text-slate-400 dark:text-stone-500'}>
                          {opt.icon}
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="block text-sm font-medium">{opt.label}</span>
                          <span className="block text-[11px] text-slate-400 dark:text-stone-500 mt-0.5">{opt.hint}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className={labelCls}>
                  Descripción <span className="text-orange-500">*</span>
                </label>
                <textarea
                  rows={5}
                  value={form.descripcion}
                  onChange={(e) => setForm((prev) => ({ ...prev, descripcion: e.target.value }))}
                  className={inputCls}
                  placeholder="Cuéntanos qué ha pasado o qué te gustaría mejorar…"
                />
                <p className="mt-1.5 text-[10px] text-slate-400 dark:text-stone-500">
                  Mínimo 10 caracteres · {form.descripcion.trim().length} escritos
                </p>
              </div>

              {error && (
                <div className="rounded-2xl bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/40 px-4 py-3 text-xs text-red-600 dark:text-red-400">
                  {error}
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-slate-100 dark:border-stone-800/60 shrink-0 bg-white/80 dark:bg-stone-900/80 backdrop-blur-sm rounded-b-3xl">
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={sending}
                  className="px-5 py-3 rounded-2xl bg-stone-100 dark:bg-stone-800/40 border border-stone-200 dark:border-stone-700/40 text-slate-600 dark:text-stone-300 text-sm font-medium hover:bg-stone-50 dark:hover:bg-stone-700/40 transition-all active:scale-[0.98] disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={!isValid || sending}
                  className="px-5 py-3 rounded-2xl bg-orange-500 hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium shadow-sm transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                >
                  {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                  Enviar
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default SugerenciaFormModal;
