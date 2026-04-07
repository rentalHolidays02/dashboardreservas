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
  const prev = useRef(target);
  const raf  = useRef<number>(0);

  useEffect(() => {
    const from  = prev.current;
    const delta = target - from;
    
    // If target value hasn't changed relative to previous frame or if it's the 
    // initial mount where from === target, we skip the animation.
    if (delta === 0) return;

    const start = performance.now();
    
    const tick = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      
      // Easing function: Cubic out (ease-out-cubic)
      // Makes the animation fast at the start and slow at the end
      const ease = 1 - Math.pow(1 - progress, 3);
      
      const current = Math.round(from + delta * ease);
      setDisplay(current);

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
