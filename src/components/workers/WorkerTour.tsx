import React, { useEffect, useState } from 'react';
import { X, ChevronRight, ChevronLeft } from 'lucide-react';

const TOUR_KEY = 'worker_tour_seen_v1';

const STEPS = [
  {
    title: '¡Bienvenido/a!',
    body: 'Aquí gestionas todo tu trabajo diario. En unos pasos te explico cómo funciona.',
    emoji: '👋',
  },
  {
    title: 'Realizar trabajo',
    body: 'Pulsa este botón para registrar una limpieza de reserva o un trabajo de manitas.',
    emoji: '💼',
  },
  {
    title: 'Entrega de llaves',
    body: 'Registra las entregas de llaves a huéspedes desde aquí.',
    emoji: '🔑',
  },
  {
    title: 'Solucionar incidencia',
    body: '¿Algo ha fallado? Reporta y documenta incidencias desde este botón.',
    emoji: '⚠️',
  },
  {
    title: 'Mis borradores',
    body: 'Si guardas un formulario sin enviar, aparece aquí. Puedes retomarlo cuando quieras.',
    emoji: '📝',
  },
  {
    title: 'Últimos trabajos',
    body: 'Ve un resumen de tus servicios recientes, horas y lo que tienes pendiente de cobro.',
    emoji: '📋',
  },
];

interface WorkerTourProps {
  /** Llamado cuando el tour se cierra (completado o descartado) */
  onDone: () => void;
}

const WorkerTour: React.FC<WorkerTourProps> = ({ onDone }) => {
  const [step, setStep] = useState(0);

  const finish = () => {
    localStorage.setItem(TOUR_KEY, '1');
    onDone();
  };

  const current = STEPS[step];

  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center">
      {/* backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={finish} />

      {/* card */}
      <div className="relative z-10 w-full max-w-sm mx-4 mb-8 sm:mb-0 bg-white dark:bg-stone-900 rounded-2xl shadow-2xl p-6 animate-in zoom-in-95 slide-in-from-bottom-4 duration-300">
        {/* close */}
        <button
          onClick={finish}
          className="absolute top-4 right-4 p-1.5 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
        >
          <X size={16} />
        </button>

        {/* step indicator */}
        <div className="flex gap-1.5 mb-5">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1 rounded-full flex-1 transition-colors duration-300 ${
                i <= step ? 'bg-orange-500' : 'bg-stone-200 dark:bg-stone-700'
              }`}
            />
          ))}
        </div>

        <div className="text-4xl mb-3">{current.emoji}</div>
        <h2 className="text-lg font-semibold text-slate-800 dark:text-stone-100 mb-2 font-dm">
          {current.title}
        </h2>
        <p className="text-sm text-slate-500 dark:text-stone-400 leading-relaxed font-gsf">
          {current.body}
        </p>

        {/* nav */}
        <div className="flex items-center justify-between mt-6 gap-3">
          <button
            onClick={() => setStep((s) => s - 1)}
            disabled={step === 0}
            className="flex items-center gap-1 text-sm text-slate-400 dark:text-stone-500 disabled:opacity-0 transition-opacity"
          >
            <ChevronLeft size={16} /> Anterior
          </button>

          {step < STEPS.length - 1 ? (
            <button
              onClick={() => setStep((s) => s + 1)}
              className="ml-auto flex items-center gap-1 px-4 py-2 rounded-xl bg-orange-500 text-white text-sm font-medium hover:bg-orange-600 active:scale-[0.97] transition-all"
            >
              Siguiente <ChevronRight size={16} />
            </button>
          ) : (
            <button
              onClick={finish}
              className="ml-auto px-4 py-2 rounded-xl bg-orange-500 text-white text-sm font-medium hover:bg-orange-600 active:scale-[0.97] transition-all"
            >
              ¡Listo!
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

/** Hook: true si hay que mostrar el tour (primer acceso) */
export const useShouldShowTour = () => !localStorage.getItem(TOUR_KEY);

export default WorkerTour;
