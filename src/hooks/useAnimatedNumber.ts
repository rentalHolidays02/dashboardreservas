import { useState, useEffect, useRef } from 'react';

/**
 * Hook to animate a number from its current value to a target value.
 * Uses requestAnimationFrame for a smooth "count-up" or "count-down" effect.
 * 
 * @param target The final number to reach.
 * @param duration Duration of the animation in milliseconds.
 * @returns The current animated value (rounded to integer).
 */
export const useAnimatedNumber = (target: number, duration = 600) => {
  const [display, setDisplay] = useState(target);
  // prev sigue al valor REALMENTE pintado, no al último target.
  // Sin esto, si el rAF se cancela a mitad por cambio de target rápido,
  // prev queda obsoleto y un siguiente target == prev hace que el delta sea 0
  // y la animación se salte, dejando el display congelado a mitad.
  const prev = useRef(target);
  const raf  = useRef<number>(0);

  useEffect(() => {
    const from  = prev.current;
    const delta = target - from;

    if (delta === 0) {
      // Mismo valor: forzamos sincronizar el display por si veníamos de un
      // tick cancelado mostrando otro número.
      setDisplay(target);
      return;
    }

    const start = performance.now();

    const tick = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);

      const current = Math.round(from + delta * ease);
      setDisplay(current);
      prev.current = current; // siempre actualiza al valor pintado

      if (progress < 1) {
        raf.current = requestAnimationFrame(tick);
      } else {
        prev.current = target;
      }
    };

    raf.current = requestAnimationFrame(tick);

    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [target, duration]);

  return display;
};
