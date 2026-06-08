import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check } from 'lucide-react';

export type ServiceType = 'reserva' | 'manitas';

interface ServiceTypePickerSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onContinue: (tipo: ServiceType) => void;
}

// Umbral de cierre (px) al arrastrar hacia abajo.
const CLOSE_THRESHOLD = 120;
// Duración del slide vertical (ms). Debe coincidir con CSS.
const ANIM_MS = 320;

const ServiceTypePickerSheet: React.FC<ServiceTypePickerSheetProps> = ({ isOpen, onClose, onContinue }) => {
  const [render, setRender] = useState(isOpen);
  const [visible, setVisible] = useState(false);
  const [tipo, setTipo] = useState<ServiceType | null>(null);
  const [dragY, setDragY] = useState(0);

  const sheetRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef(0);
  const draggingRef = useRef(false);

  // Mount/unmount con animación.
  useEffect(() => {
    if (isOpen) {
      setRender(true);
      setTipo(null);
      setDragY(0);
      // Frame para garantizar que la entrada anime desde translateY(100%).
      const id = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(id);
    } else if (render) {
      setVisible(false);
      const t = window.setTimeout(() => setRender(false), ANIM_MS);
      return () => window.clearTimeout(t);
    }
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // Bloqueo de scroll global mientras el sheet está montado.
  // Todo touchmove fuera del sheet se cancela → ni el pager ni la pane scrollean.
  useEffect(() => {
    if (!render) return;
    const block = (e: TouchEvent) => {
      const el = sheetRef.current;
      if (el && el.contains(e.target as Node)) return;
      e.preventDefault();
    };
    document.addEventListener('touchmove', block, { passive: false });
    return () => document.removeEventListener('touchmove', block);
  }, [render]);

  // Listeners nativos con passive:false para poder bloquear scroll global durante el drag.
  useEffect(() => {
    const el = sheetRef.current;
    if (!el || !render) return;

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      dragStartY.current = e.touches[0].clientY;
      draggingRef.current = true;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!draggingRef.current) return;
      e.preventDefault();
      const delta = e.touches[0].clientY - dragStartY.current;
      setDragY(delta > 0 ? delta : 0);
    };

    const onTouchEnd = () => {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      setDragY((current) => {
        if (current > CLOSE_THRESHOLD) {
          onClose();
          return current;
        }
        return 0;
      });
    };

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd);
    el.addEventListener('touchcancel', onTouchEnd);

    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [render, onClose]);

  if (!render) return null;

  // Soltar tras drag: snap suave. Mid-drag: sin transición.
  const animating = !draggingRef.current;
  const baseY = visible ? 0 : 100; // % oculto fuera de pantalla
  const transform = draggingRef.current
    ? `translateY(${dragY}px)`
    : `translateY(calc(${baseY}% + ${dragY}px))`;

  const handleContinue = () => {
    if (!tipo) return;
    onContinue(tipo);
  };

  return createPortal(
    <div className="fixed inset-0 z-[120] flex items-end justify-center touch-none" style={{ overscrollBehavior: 'contain' }}>
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity duration-300 touch-none"
        style={{ opacity: visible ? 1 : 0 }}
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        className="relative w-full sm:max-w-md bg-white dark:bg-stone-900 rounded-t-3xl shadow-2xl border-t border-white/60 dark:border-stone-800/50 pb-[calc(env(safe-area-inset-bottom)+1rem)] touch-none font-dm"
        style={{
          transform,
          transition: animating ? `transform ${ANIM_MS}ms cubic-bezier(0.4, 0, 0.2, 1)` : 'none',
          willChange: 'transform',
        }}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="h-1 w-10 rounded-full bg-stone-300 dark:bg-stone-700" />
        </div>

        <div className="px-6 pt-12 pb-14 text-center">
          <h2 className="text-2xl font-medium text-slate-800 dark:text-stone-100 font-dm tracking-tight leading-snug">
            ¿Vas a realizar un trabajo?
          </h2>
          <p className="text-sm text-slate-500 dark:text-stone-400 font-light font-dm mt-3">
            Selecciona qué tipo de servicio vas a hacer.
          </p>
        </div>

        <div className="px-6 pb-8 space-y-3">
          {([
            { id: 'reserva' as ServiceType, label: 'Limpieza de reserva' },
            { id: 'manitas' as ServiceType, label: 'Manitas' },
          ]).map(({ id, label }) => {
            const active = tipo === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setTipo(id)}
                className={`w-full flex items-center gap-3 px-5 py-6 rounded-2xl border transition-all active:scale-[0.99] ${
                  active
                    ? 'bg-stone-100 dark:bg-stone-800/70 border-stone-300 dark:border-stone-600 shadow-sm'
                    : 'bg-stone-50 dark:bg-stone-800/40 border-stone-200/70 dark:border-stone-700/50'
                }`}
              >
                <span className="flex-1 text-left text-[16px] font-medium text-slate-800 dark:text-stone-100 font-dm leading-tight">
                  {label}
                </span>
                <span
                  className={`shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                    active
                      ? 'bg-stone-900 border-stone-900 dark:bg-stone-100 dark:border-stone-100'
                      : 'bg-transparent border-stone-300 dark:border-stone-600'
                  }`}
                >
                  {active && <Check size={14} className="text-white dark:text-stone-900" strokeWidth={3} />}
                </span>
              </button>
            );
          })}
        </div>

        <div className="px-6 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-4 rounded-2xl text-sm font-medium text-slate-600 dark:text-stone-300 bg-stone-100 dark:bg-stone-800/60 hover:bg-stone-200 dark:hover:bg-stone-700/60 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleContinue}
            disabled={!tipo}
            className="w-full py-4 rounded-2xl text-sm font-medium text-white bg-stone-900 hover:bg-stone-800 dark:bg-stone-100 dark:hover:bg-white dark:text-stone-900 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Continuar
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ServiceTypePickerSheet;
