import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

// Shell compartido para los formularios de trabajador (ServiceFormModal,
// EntregaLlavesFormModal, IncidenciaFormModal, SugerenciaFormModal).
// Encapsula:
//   - Bottom sheet con animación slide-up + fade idéntica al picker.
//   - Header centrado (font-dm, título + subtítulo).
//   - Body scrolleable (children).
//   - Footer neutral (3 estados: idle / draft / send) con texto explicativo.
//   - Popup "¿Descartar los cambios?" al cancelar con datos.
//   - Popup informativo "Tu informe NO se ha enviado" tras guardar borrador.
//
// El padre conserva la lógica de validación y persistencia; este shell sólo gestiona
// presentación + flujo de cierre.

interface WorkerFormSheetProps {
  isOpen: boolean;
  onClose: () => void;

  title: string;
  subtitle?: string;

  // Habilita el botón "Guardar en borrador". Si false, el botón sale gris/disabled.
  hasChanges: boolean;
  // Habilita el botón principal "Enviar".
  isValid: boolean;

  onSubmit: () => Promise<void>;
  // Si se omite, no hay opción "Guardar en borrador" (botón disabled mientras !isValid).
  onSaveDraft?: () => Promise<void>;
  // Si se omite, "Cancelar" sin cambios simplemente cierra; con cambios sigue saliendo el popup.
  onDiscard?: () => Promise<void>;

  // Labels customizables.
  submitLabel?: string;          // default: "Enviar informe"
  draftLabel?: string;           // default: "Guardar en borrador"
  helperIdle?: string;           // default: "Rellena los campos para empezar."
  helperDraft?: string;          // default: "Faltan campos obligatorios. Se guardará como borrador."
  helperSend?: string;           // default: "Listo para enviar. Pulsa para enviar el informe."

  // Texto del popup informativo tras guardar borrador.
  draftSavedTitle?: string;      // default: "Atención: tu informe NO se ha enviado"
  draftSavedBody?: React.ReactNode;

  // Mensaje tras envío correcto. Si truthy, lo muestra en el footer ~900ms antes de cerrar.
  successMessage?: string;       // default: "Informe enviado correctamente."

  children: React.ReactNode;
}

const ANIM_MS = 320;

const useSheetAnim = (open: boolean) => {
  const [render, setRender] = useState(false);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (open) {
      setRender(true);
      const id = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(id);
    } else if (render) {
      setVisible(false);
      const t = window.setTimeout(() => setRender(false), ANIM_MS);
      return () => window.clearTimeout(t);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  return { render, visible };
};

const WorkerFormSheet: React.FC<WorkerFormSheetProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  hasChanges,
  isValid,
  onSubmit,
  onSaveDraft,
  onDiscard,
  submitLabel = 'Enviar informe',
  draftLabel = 'Guardar en borrador',
  helperIdle = 'Rellena los campos para empezar.',
  helperDraft = 'Faltan campos obligatorios. Se guardará como borrador.',
  helperSend = 'Listo para enviar. Pulsa para enviar el informe.',
  draftSavedTitle = 'Atención: tu informe NO se ha enviado',
  draftSavedBody,
  successMessage = 'Informe enviado correctamente.',
  children,
}) => {
  const sheet = useSheetAnim(isOpen);

  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ type: 'ok' | 'error'; message: string } | null>(null);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const confirm = useSheetAnim(confirmOpen);

  const [draftSavedOpen, setDraftSavedOpen] = useState(false);
  const draftSaved = useSheetAnim(draftSavedOpen);

  // Reset interno al abrir.
  useEffect(() => {
    if (isOpen) {
      setBusy(false);
      setStatus(null);
      setConfirmOpen(false);
      setDraftSavedOpen(false);
    }
  }, [isOpen]);

  // Modo del botón principal.
  const mode: 'idle' | 'draft' | 'send' = isValid ? 'send' : (onSaveDraft && hasChanges) ? 'draft' : 'idle';
  const primaryLabel = busy
    ? mode === 'draft' ? 'Guardando…' : 'Enviando…'
    : mode === 'send' ? submitLabel : mode === 'draft' ? draftLabel : submitLabel;
  const helper = mode === 'send' ? helperSend : mode === 'draft' ? helperDraft : helperIdle;

  const handlePrimary = async () => {
    if (busy) return;
    if (mode === 'send') {
      setBusy(true); setStatus(null);
      try {
        await onSubmit();
        setStatus({ type: 'ok', message: successMessage });
        window.setTimeout(onClose, 900);
      } catch (e: any) {
        setStatus({ type: 'error', message: e?.message || 'Error al enviar.' });
      } finally {
        setBusy(false);
      }
    } else if (mode === 'draft' && onSaveDraft) {
      setBusy(true); setStatus(null);
      try {
        await onSaveDraft();
        setDraftSavedOpen(true);
      } catch (e: any) {
        setStatus({ type: 'error', message: e?.message || 'Error al guardar.' });
      } finally {
        setBusy(false);
      }
    }
  };

  const handleCancelClick = () => {
    if (hasChanges) {
      setConfirmOpen(true);
    } else {
      // Sin cambios: cierra directo (no toca borrador ni local).
      onClose();
    }
  };

  const handleConfirmDiscard = async () => {
    setConfirmOpen(false);
    if (!onDiscard) {
      onClose();
      return;
    }
    setBusy(true); setStatus(null);
    try {
      await onDiscard();
      onClose();
    } catch (e: any) {
      setStatus({ type: 'error', message: e?.message || 'Error al descartar.' });
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmSaveDraft = async () => {
    setConfirmOpen(false);
    if (!onSaveDraft) return;
    setBusy(true); setStatus(null);
    try {
      await onSaveDraft();
      setDraftSavedOpen(true);
    } catch (e: any) {
      setStatus({ type: 'error', message: e?.message || 'Error al guardar.' });
    } finally {
      setBusy(false);
    }
  };

  if (!sheet.render) return null;

  return createPortal(
    <div className="fixed inset-0 z-[120] flex items-end justify-center">
      {/* Backdrop (no click-to-close: la única salida es el botón Cancelar). */}
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity duration-300"
        style={{ opacity: sheet.visible ? 1 : 0 }}
      />

      {/* Sheet */}
      <div
        className="relative w-full sm:max-w-md h-[92vh] flex flex-col bg-white/95 dark:bg-stone-900/95 backdrop-blur-2xl rounded-t-3xl shadow-2xl border-t border-white/70 dark:border-stone-800/60 font-dm"
        style={{
          transform: sheet.visible ? 'translateY(0)' : 'translateY(100%)',
          transition: `transform ${ANIM_MS}ms cubic-bezier(0.4, 0, 0.2, 1)`,
          willChange: 'transform',
        }}
      >
        {/* Header centrado, estilo picker. */}
        <div className="px-6 pt-6 pb-6 text-center shrink-0">
          <h2 className="text-2xl font-medium text-slate-800 dark:text-stone-100 font-dm tracking-tight leading-snug">
            {title}
          </h2>
          {subtitle && (
            <p className="text-sm text-slate-500 dark:text-stone-400 font-light font-dm mt-2">
              {subtitle}
            </p>
          )}
        </div>

        {/* Scrollable */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden px-6 py-4 space-y-5">
          {children}
        </div>

        {/* Footer */}
        <div className="px-6 pt-3 pb-[calc(env(safe-area-inset-bottom)+1rem)] border-t border-slate-100 dark:border-stone-800/60 shrink-0 bg-white/80 dark:bg-stone-900/80 backdrop-blur-sm">
          {status && (
            <div className={`mb-2 px-3 py-2 rounded-xl text-[11px] font-medium text-center border ${
              status.type === 'ok'
                ? 'bg-stone-50 dark:bg-stone-800/40 text-slate-700 dark:text-stone-200 border-stone-200 dark:border-stone-700/50'
                : 'bg-stone-100 dark:bg-stone-800/60 text-slate-800 dark:text-stone-100 border-stone-300 dark:border-stone-600'
            }`}>
              {status.message}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={handleCancelClick}
              disabled={busy}
              className="w-full py-4 rounded-2xl text-sm font-medium text-slate-600 dark:text-stone-300 bg-stone-100 dark:bg-stone-800/60 hover:bg-stone-200 dark:hover:bg-stone-700/60 transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handlePrimary}
              disabled={busy || mode === 'idle'}
              className={`w-full py-4 rounded-2xl text-sm font-medium transition-colors disabled:cursor-not-allowed ${
                mode === 'idle'
                  ? 'bg-stone-200 dark:bg-stone-800/60 text-slate-400 dark:text-stone-500'
                  : 'bg-stone-900 hover:bg-stone-800 dark:bg-stone-100 dark:hover:bg-white text-white dark:text-stone-900'
              } ${busy ? 'opacity-60 cursor-wait' : ''}`}
            >
              {primaryLabel}
            </button>
          </div>
          <p className="mt-2 text-[11px] text-center text-slate-400 dark:text-stone-500">{helper}</p>
        </div>

        {/* Popup confirmar descartar. */}
        {confirm.render && (
          <div className="absolute inset-0 z-10 flex items-end justify-center">
            <div
              onClick={() => setConfirmOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity duration-300"
              style={{ opacity: confirm.visible ? 1 : 0 }}
            />
            <div
              className="relative w-full sm:max-w-md bg-white dark:bg-stone-900 rounded-t-3xl shadow-2xl border-t border-white/60 dark:border-stone-800/50 pb-[calc(env(safe-area-inset-bottom)+1rem)] font-dm"
              style={{
                transform: confirm.visible ? 'translateY(0)' : 'translateY(100%)',
                transition: `transform ${ANIM_MS}ms cubic-bezier(0.4, 0, 0.2, 1)`,
                willChange: 'transform',
              }}
            >
              <div className="px-6 pt-12 pb-14 text-center">
                <h2 className="text-2xl font-medium text-slate-800 dark:text-stone-100 font-dm tracking-tight leading-snug">
                  ¿Descartar los cambios?
                </h2>
                <p className="text-sm text-slate-500 dark:text-stone-400 font-light font-dm mt-3">
                  {onSaveDraft
                    ? 'Puedes guardar lo que llevas como borrador y seguir luego.'
                    : 'Perderás lo que has escrito hasta ahora.'}
                </p>
              </div>
              <div className={`px-6 grid ${onSaveDraft ? 'grid-cols-2' : 'grid-cols-1'} gap-3`}>
                <button
                  type="button"
                  onClick={handleConfirmDiscard}
                  disabled={busy}
                  className="w-full py-4 rounded-2xl text-sm font-medium text-slate-600 dark:text-stone-300 bg-stone-100 dark:bg-stone-800/60 hover:bg-stone-200 dark:hover:bg-stone-700/60 transition-colors disabled:opacity-50"
                >
                  Descartar
                </button>
                {onSaveDraft && (
                  <button
                    type="button"
                    onClick={handleConfirmSaveDraft}
                    disabled={busy}
                    className="w-full py-4 rounded-2xl text-sm font-medium text-white bg-stone-900 hover:bg-stone-800 dark:bg-stone-100 dark:hover:bg-white dark:text-stone-900 transition-colors disabled:opacity-50"
                  >
                    Guardar borrador
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Popup informativo tras guardar borrador. */}
        {draftSaved.render && (
          <div className="absolute inset-0 z-20 flex items-end justify-center">
            <div
              className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm transition-opacity duration-300"
              style={{ opacity: draftSaved.visible ? 1 : 0 }}
            />
            <div
              className="relative w-full sm:max-w-md bg-white dark:bg-stone-900 rounded-t-3xl shadow-2xl border-t border-white/60 dark:border-stone-800/50 pb-[calc(env(safe-area-inset-bottom)+1rem)] font-dm"
              style={{
                transform: draftSaved.visible ? 'translateY(0)' : 'translateY(100%)',
                transition: `transform ${ANIM_MS}ms cubic-bezier(0.4, 0, 0.2, 1)`,
                willChange: 'transform',
              }}
            >
              <div className="px-6 pt-12 pb-10 text-center">
                <h2 className="text-2xl font-medium text-slate-800 dark:text-stone-100 font-dm tracking-tight leading-snug">
                  {draftSavedTitle}
                </h2>
                {draftSavedBody ?? (
                  <>
                    <p className="text-sm text-slate-600 dark:text-stone-300 font-light font-dm mt-4 leading-relaxed">
                      Lo hemos guardado como <span className="font-medium text-slate-800 dark:text-stone-100">borrador</span> para que no pierdas lo que llevas escrito.
                    </p>
                    <p className="text-sm text-slate-600 dark:text-stone-300 font-light font-dm mt-3 leading-relaxed">
                      Para enviarlo de verdad tienes que volver a abrirlo desde <span className="font-medium text-slate-800 dark:text-stone-100">"Mis borradores"</span>, rellenar los campos que faltan y pulsar <span className="font-medium text-slate-800 dark:text-stone-100">"Enviar informe"</span>.
                    </p>
                  </>
                )}
              </div>
              <div className="px-6">
                <button
                  type="button"
                  onClick={() => {
                    setDraftSavedOpen(false);
                    window.setTimeout(onClose, ANIM_MS);
                  }}
                  className="w-full py-4 rounded-2xl text-sm font-medium text-white bg-stone-900 hover:bg-stone-800 dark:bg-stone-100 dark:hover:bg-white dark:text-stone-900 transition-colors"
                >
                  Entendido
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};

export default WorkerFormSheet;
