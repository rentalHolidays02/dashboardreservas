import React, { createContext, useContext, useRef, useState } from 'react';

interface NavigationGuardContextValue {
  registerGuard: (fn: (() => boolean) | null) => void;
  requestNavigate: (go: () => void) => void;
}

const NavigationGuardContext = createContext<NavigationGuardContextValue>({
  registerGuard: () => {},
  requestNavigate: (go) => go(),
});

export const useNavigationGuard = () => useContext(NavigationGuardContext);

interface PendingNav { go: () => void }

export const NavigationGuardProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const guardRef = useRef<(() => boolean) | null>(null);
  const [pending, setPending] = useState<PendingNav | null>(null);

  const registerGuard = (fn: (() => boolean) | null) => {
    guardRef.current = fn;
  };

  const requestNavigate = (go: () => void) => {
    if (guardRef.current && guardRef.current()) {
      // guard says "yes, block it" — show dialog
      setPending({ go });
    } else {
      go();
    }
  };

  const confirm = () => { pending?.go(); setPending(null); guardRef.current = null; };
  const cancel = () => setPending(null);

  return (
    <NavigationGuardContext.Provider value={{ registerGuard, requestNavigate }}>
      {children}

      {pending && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30 dark:bg-black/50 backdrop-blur-sm" onClick={cancel} />
          <div className="relative bg-white dark:bg-stone-900 rounded-2xl border border-stone-100 dark:border-stone-800 shadow-xl w-full max-w-sm p-6 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3 mb-5">
              <span className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0 text-amber-500">
                ⚠
              </span>
              <div>
                <p className="text-sm font-medium text-slate-800 dark:text-stone-100">Cambios sin guardar</p>
                <p className="text-xs text-slate-400 dark:text-stone-500 mt-0.5">Si continúas perderás las modificaciones realizadas.</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={cancel}
                className="flex-1 py-2.5 text-xs font-medium rounded-xl bg-stone-100 dark:bg-stone-800 text-slate-600 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700 transition-all"
              >
                Seguir editando
              </button>
              <button
                onClick={confirm}
                className="flex-1 py-2.5 text-xs font-medium rounded-xl bg-red-500 text-white hover:bg-red-600 transition-all"
              >
                Descartar cambios
              </button>
            </div>
          </div>
        </div>
      )}
    </NavigationGuardContext.Provider>
  );
};
