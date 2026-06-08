import { useCallback, useEffect, useRef, useState } from 'react';

export const PTR_THRESHOLD = 70;
export const PTR_MAX_PULL = 110;

// Gesto pull-to-refresh sobre el primer ancestro scrollable de `rootRef`.
// Damping asintótico → nunca hay tope brusco. Se activa solo en táctil/móvil.
export const usePullToRefresh = (onRefresh: () => Promise<void> | void) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const [pullY, setPullY] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [dragging, setDragging] = useState(false);

  const pullYRef = useRef(0);
  const draggingRef = useRef(false);
  const refreshingRef = useRef(false);

  const updatePull = useCallback((v: number) => {
    pullYRef.current = v;
    setPullY(v);
  }, []);
  const updateDragging = useCallback((v: boolean) => {
    draggingRef.current = v;
    setDragging(v);
  }, []);
  const updateRefreshing = useCallback((v: boolean) => {
    refreshingRef.current = v;
    setRefreshing(v);
  }, []);

  useEffect(() => {
    const isDesktop =
      typeof window !== 'undefined' && window.matchMedia('(min-width: 1280px)').matches;
    if (isDesktop) return;

    // Buscar contenedor scrollable padre.
    let node: HTMLElement | null = rootRef.current?.parentElement ?? null;
    let container: HTMLElement | null = null;
    while (node) {
      const oy = getComputedStyle(node).overflowY;
      if (oy === 'auto' || oy === 'scroll') { container = node; break; }
      node = node.parentElement;
    }
    if (!container) return;

    let startY = 0;

    const onTouchStart = (e: TouchEvent) => {
      if (refreshingRef.current) return;
      if (container!.scrollTop > 0) return;
      startY = e.touches[0].clientY;
      updateDragging(true);
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!draggingRef.current) return;
      if (container!.scrollTop > 0) {
        updateDragging(false);
        updatePull(0);
        return;
      }
      const delta = e.touches[0].clientY - startY;
      if (delta <= 0) {
        if (pullYRef.current !== 0) updatePull(0);
        return;
      }
      // Damping asintótico: nunca alcanza el tope → sin sensación de bloqueo.
      const damped = (delta * PTR_MAX_PULL) / (delta + PTR_MAX_PULL);
      updatePull(damped);
      if (e.cancelable) e.preventDefault();
    };

    const onTouchEnd = () => {
      if (!draggingRef.current) return;
      updateDragging(false);
      const reached = pullYRef.current >= PTR_THRESHOLD;
      if (reached && !refreshingRef.current) {
        updateRefreshing(true);
        updatePull(60);
        Promise.resolve(onRefresh()).finally(() => {
          updateRefreshing(false);
          updatePull(0);
        });
      } else {
        updatePull(0);
      }
    };

    container.addEventListener('touchstart', onTouchStart, { passive: true });
    container.addEventListener('touchmove', onTouchMove, { passive: false });
    container.addEventListener('touchend', onTouchEnd, { passive: true });
    container.addEventListener('touchcancel', onTouchEnd, { passive: true });
    return () => {
      container!.removeEventListener('touchstart', onTouchStart);
      container!.removeEventListener('touchmove', onTouchMove);
      container!.removeEventListener('touchend', onTouchEnd);
      container!.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [onRefresh, updateDragging, updatePull, updateRefreshing]);

  return { rootRef, pullY, refreshing, dragging };
};
