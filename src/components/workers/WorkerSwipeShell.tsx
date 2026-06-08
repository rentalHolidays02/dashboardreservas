import React, { useEffect, useRef, useState } from 'react';
import { User as UserIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { User } from '../../services/mockData';
import WorkerPanel from '../../pages/WorkerPanel';
import WorkerRecords from '../../pages/WorkerRecords';
import Profile from '../../pages/Profile';

interface WorkerSwipeShellProps {
  user: User;
  onLogout: () => void;
  initialIndex: 0 | 1 | 2;
}

const PATHS = ['/dashboard', '/registros', '/perfil'] as const;

const activeTabClass =
  'px-3 py-1.5 rounded-full text-sm font-medium transition-colors bg-stone-100 dark:bg-stone-800/60 border border-stone-200/70 dark:border-stone-700/50 text-slate-700 dark:text-stone-200';
const inactiveTabClass =
  'px-3 py-1 rounded-full text-sm font-medium transition-colors text-slate-400 dark:text-stone-500';

// Pager deslizable Inicio ↔ Historial ↔ Perfil.
// Móvil: scroll-snap horizontal nativo (drag con el dedo + snap). Desktop: vista directa.
const WorkerSwipeShell: React.FC<WorkerSwipeShellProps> = ({ user, onLogout, initialIndex }) => {
  const navigate = useNavigate();

  const pagerRef = useRef<HTMLDivElement>(null);
  const pane0Ref = useRef<HTMLDivElement>(null);
  const pane1Ref = useRef<HTMLDivElement>(null);
  const pane2Ref = useRef<HTMLDivElement>(null);

  const [index, setIndex] = useState<0 | 1 | 2>(initialIndex);
  const [isDesktop, setIsDesktop] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(min-width: 1280px)').matches
  );
  const [headerHidden, setHeaderHidden] = useState(false);
  const [headerArmed, setHeaderArmed] = useState(false);

  // Watcher desktop/móvil.
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1280px)');
    const on = () => setIsDesktop(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);

  // Posicionar el pager en el pane inicial al montar (sin smooth).
  useEffect(() => {
    if (isDesktop) return;
    const el = pagerRef.current;
    if (!el) return;
    el.scrollLeft = initialIndex * el.clientWidth;
  }, [isDesktop, initialIndex]);

  // Detectar pane activo y sincronizar URL (replaceState → sin remount).
  useEffect(() => {
    if (isDesktop) return;
    const el = pagerRef.current;
    if (!el) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const w = el.clientWidth || 1;
        const raw = Math.round(el.scrollLeft / w);
        const i = (raw < 0 ? 0 : raw > 2 ? 2 : raw) as 0 | 1 | 2;
        setIndex((prev) => {
          if (i !== prev) {
            window.history.replaceState(null, '', PATHS[i]);
          }
          return i;
        });
      });
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      el.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(raf);
    };
  }, [isDesktop]);

  // Pop-out del header según el scroll vertical del pane activo.
  useEffect(() => {
    if (isDesktop) return;
    const el = index === 0 ? pane0Ref.current : index === 1 ? pane1Ref.current : pane2Ref.current;
    if (!el) return;
    const read = () => {
      setHeaderHidden((prev) => {
        const next = el.scrollTop > 60;
        if (next !== prev) setHeaderArmed(true);
        return next;
      });
    };
    read();
    el.addEventListener('scroll', read, { passive: true });
    return () => el.removeEventListener('scroll', read);
  }, [index, isDesktop]);

  const scrollToPane = (i: 0 | 1 | 2) => {
    const el = pagerRef.current;
    if (!el) {
      navigate(PATHS[i]);
      return;
    }
    el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' });
  };

  // Permite a hijos pedir cambio de pane sin prop drilling (p.ej. botón "Ver más" en Inicio).
  useEffect(() => {
    if (isDesktop) return;
    const on = (ev: Event) => {
      const i = (ev as CustomEvent<number>).detail;
      if (i === 0 || i === 1 || i === 2) scrollToPane(i);
    };
    window.addEventListener('worker-pane:goto', on);
    return () => window.removeEventListener('worker-pane:goto', on);
  }, [isDesktop]);

  // Desktop: vista directa, sin pager ni tabs (la navegación va por el sidebar).
  if (isDesktop) {
    if (index === 0) return <WorkerPanel user={user} />;
    if (index === 1) return <WorkerRecords user={user} />;
    return <Profile user={user} onLogout={onLogout} />;
  }

  const headerAnimClass = headerArmed ? (headerHidden ? 'header-pop-out' : 'header-pop-in') : '';

  return (
    <div className="flex-1 min-h-0 flex flex-col relative">
      {/* Topbar — OVERLAY (z-30, absolute top:0): bg con fade, contenido nítido encima */}
      {/* Fondo con mask de fade — sólo el bg, los hijos no */}
      <div
        aria-hidden
        className="absolute top-0 left-0 right-0 z-30 pointer-events-none bg-mobile-app"
        style={{
          height: 'calc(env(safe-area-inset-top) + 5.5rem)',
          maskImage: 'linear-gradient(to bottom, black 0, black 20%, transparent 75%)',
          WebkitMaskImage: 'linear-gradient(to bottom, black 0, black 20%, transparent 75%)',
        }}
      />
      <div
        className={`absolute top-0 left-0 right-0 z-30 flex items-center justify-between px-6 pb-6 pt-[calc(env(safe-area-inset-top)+0.5rem)] ${
          headerHidden ? 'pointer-events-none' : ''
        }`}
      >
        <div className={`flex items-center gap-1 font-gsf origin-center ${headerAnimClass}`}>
          <button onClick={() => scrollToPane(0)} className={index === 0 ? activeTabClass : inactiveTabClass}>
            Inicio
          </button>
          <button onClick={() => scrollToPane(1)} className={index === 1 ? activeTabClass : inactiveTabClass}>
            Historial
          </button>
        </div>
        <button
          onClick={() => scrollToPane(2)}
          aria-label="Perfil"
          className={`rounded-full border text-slate-700 dark:text-stone-200 active:scale-95 transition origin-center overflow-hidden ${headerAnimClass} ${
            user.avatar_url ? 'p-0' : 'p-2'
          } ${
            index === 2
              ? 'bg-stone-100 dark:bg-stone-800/60 border-stone-200/70 dark:border-stone-700/50'
              : 'bg-transparent border-transparent'
          }`}
        >
          {user.avatar_url ? (
            <img
              src={user.avatar_url}
              alt=""
              className="w-8 h-8 object-cover rounded-full"
            />
          ) : (
            <UserIcon size={16} />
          )}
        </button>
      </div>

      {/* Pager horizontal con snap nativo. Sin touch-action: el navegador enruta por eje
          entre scrollers anidados (pager horizontal / pane vertical / carrusel horizontal). */}
      <div
        ref={pagerRef}
        className="flex-1 min-h-0 flex overflow-x-auto overflow-y-hidden snap-x snap-mandatory no-scrollbar"
      >
        <div
          ref={pane0Ref}
          className="w-full shrink-0 snap-center snap-always overflow-y-auto no-scrollbar h-full bg-mobile-app pt-[calc(env(safe-area-inset-top)+3.5rem)]"
        >
          <WorkerPanel user={user} />
        </div>
        <div
          ref={pane1Ref}
          className="w-full shrink-0 snap-center snap-always overflow-y-auto overflow-x-hidden no-scrollbar h-full bg-mobile-app pt-[calc(env(safe-area-inset-top)+3.5rem)]"
        >
          <WorkerRecords user={user} />
        </div>
        <div
          ref={pane2Ref}
          className="w-full shrink-0 snap-center snap-always overflow-y-auto overflow-x-hidden no-scrollbar h-full bg-mobile-app pt-[calc(env(safe-area-inset-top)+3.5rem)]"
        >
          <Profile user={user} onLogout={onLogout} />
        </div>
      </div>
    </div>
  );
};

export default WorkerSwipeShell;
