import React, { createContext, useCallback, useContext, useState } from 'react';
import { X, Trash2, RotateCcw } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UndoToast {
  id: string;
  message: string;
  onUndo: () => Promise<void> | void;
}

interface UndoToastContextValue {
  showUndoToast: (
    messageOrOptions: string | { message: string; onUndo: () => Promise<void> | void },
    onUndo?: () => Promise<void> | void
  ) => void;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const UndoToastContext = createContext<UndoToastContextValue | null>(null);

export const useUndoToast = () => {
  const ctx = useContext(UndoToastContext);
  if (!ctx) throw new Error('useUndoToast must be used inside UndoToastProvider');
  return ctx;
};

// ─── Provider ─────────────────────────────────────────────────────────────────

export const UndoToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<UndoToast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const showUndoToast = useCallback((
    messageOrOptions: string | { message: string; onUndo: () => Promise<void> | void },
    onUndo?: () => Promise<void> | void
  ) => {
    const id = `undo_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    
    let message: string;
    let finalOnUndo: () => Promise<void> | void;

    if (typeof messageOrOptions === 'object') {
      message = messageOrOptions.message;
      finalOnUndo = messageOrOptions.onUndo;
    } else {
      message = messageOrOptions;
      finalOnUndo = onUndo || (() => {});
    }

    const toast: UndoToast = { id, message, onUndo: finalOnUndo };
    setToasts(prev => [...prev, toast]);
  }, []);

  const handleUndo = useCallback(async (toast: UndoToast) => {
    dismiss(toast.id);
    await toast.onUndo();
  }, [dismiss]);

  return (
    <UndoToastContext.Provider value={{ showUndoToast }}>
      {children}

      {/* Toast stack — top right */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 items-end pointer-events-none">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className="pointer-events-auto flex items-center gap-3 px-4 py-3 bg-white dark:bg-stone-900 text-slate-700 dark:text-stone-300 rounded-xl shadow-xl text-sm animate-in slide-in-from-top-2 fade-in duration-200 border border-slate-100 dark:border-stone-800"
          >
            <Trash2 size={14} className="shrink-0 text-red-400 dark:text-red-500" />
            <span className="leading-snug">{toast.message}</span>

            <button
              onClick={() => handleUndo(toast)}
              className="flex items-center gap-1 ml-1 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-stone-800 hover:bg-slate-200 dark:hover:bg-stone-700 text-slate-600 dark:text-stone-300 text-xs transition-colors whitespace-nowrap"
            >
              <RotateCcw size={11} />
              Deshacer
            </button>

            <button
              onClick={() => dismiss(toast.id)}
              className="ml-1 p-0.5 rounded-lg hover:bg-slate-100 dark:hover:bg-stone-800 transition-colors"
              aria-label="Cerrar"
            >
              <X size={13} className="text-slate-400 dark:text-stone-500" />
            </button>
          </div>
        ))}
      </div>
    </UndoToastContext.Provider>
  );
};
