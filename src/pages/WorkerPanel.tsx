import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { User } from '../services/mockData';
import {
  Sparkles,
  Key,
  KeyRound,
  Briefcase,
  AlertTriangle,
  AlertCircle,
  Home,
  Wrench,
  Clock,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import ServiceFormModal from '../components/workers/ServiceFormModal';
import ServiceTypePickerSheet, { type ServiceType } from '../components/workers/ServiceTypePickerSheet';
import EntregaLlavesFormModal from '../components/workers/EntregaLlavesFormModal';
import IncidenciaFormModal from '../components/workers/IncidenciaFormModal';
import SugerenciaFormModal from '../components/sugerencias/SugerenciaFormModal';
import PullToRefreshIndicator from '../components/workers/PullToRefreshIndicator';
import WorkerTour, { useShouldShowTour } from '../components/workers/WorkerTour';
import { listDrafts, type DraftRow } from '../services/reportsApi';
import { useWorkerMonthStats } from '../hooks/useWorkerMonthStats';
import { usePullToRefresh } from '../hooks/usePullToRefresh';
import { formatName } from '../utils/formatters';

interface WorkerPanelProps {
  user: User;
}

interface ActionConfig {
  icon: LucideIcon;
  label: string;
  iconWrap: string;
  iconColor: string;
  onClick: () => void;
}

// Etiqueta visible + icono según kind y payload.
// Título = nombre del alojamiento (informativo); subtítulo = tipo · fecha de creación.
const getDraftMeta = (
  draft: DraftRow
): { title: string; typeLabel: string; fecha: string; Icon: LucideIcon; iconWrap: string; iconColor: string } => {
  const apartamento = String((draft.payload as any)?.apartamento ?? '').trim();
  const fecha = new Date(draft.createdAt).toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'short',
  });

  let typeLabel: string;
  let Icon: LucideIcon;
  let iconWrap: string;
  let iconColor: string;

  if (draft.kind === 'service') {
    const tipo = (draft.payload as any)?.tipo as 'reserva' | 'manitas' | undefined;
    if (tipo === 'manitas') {
      typeLabel = 'Manitas';
      Icon = Wrench;
    } else {
      typeLabel = 'Limpieza de reserva';
      Icon = Home;
    }
    iconWrap = 'bg-orange-100 dark:bg-orange-400/10';
    iconColor = 'text-orange-600 dark:text-orange-400';
  } else if (draft.kind === 'key_delivery') {
    typeLabel = 'Entrega de llaves';
    Icon = Key;
    iconWrap = 'bg-blue-100 dark:bg-blue-400/10';
    iconColor = 'text-blue-600 dark:text-blue-400';
  } else {
    typeLabel = 'Incidencia';
    Icon = AlertTriangle;
    iconWrap = 'bg-red-100 dark:bg-red-400/10';
    iconColor = 'text-red-600 dark:text-red-400';
  }

  return {
    title: apartamento ? formatName(apartamento) : typeLabel,
    typeLabel,
    fecha,
    Icon,
    iconWrap,
    iconColor,
  };
};

const WorkerPanel: React.FC<WorkerPanelProps> = ({ user }) => {
  const { loading: statsLoading, stats, recentJobs, totalJobs, refresh: refreshStats } = useWorkerMonthStats(user);
  const [isServiceFormOpen, setIsServiceFormOpen] = useState(false);
  const [isServiceTypePickerOpen, setIsServiceTypePickerOpen] = useState(false);
  const [pendingServiceTipo, setPendingServiceTipo] = useState<ServiceType | null>(null);
  const [isLlavesFormOpen, setIsLlavesFormOpen] = useState(false);
  const [isIncidenciaFormOpen, setIsIncidenciaFormOpen] = useState(false);
  const [isSugerenciaFormOpen, setIsSugerenciaFormOpen] = useState(false);

  const [drafts, setDrafts] = useState<DraftRow[]>([]);
  const [editingDraft, setEditingDraft] = useState<DraftRow | null>(null);
  const [draftsExpanded, setDraftsExpanded] = useState(false);
  const [tourOpen, setTourOpen] = useState(useShouldShowTour);

  // Carrusel de acciones: fade en bordes según posición de scroll.
  const carouselRef = useRef<HTMLDivElement>(null);
  const [carEdges, setCarEdges] = useState({ atStart: true, atEnd: true });

  useEffect(() => {
    const el = carouselRef.current;
    if (!el) return;
    const update = () => {
      const atStart = el.scrollLeft <= 1;
      const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 1;
      setCarEdges({ atStart, atEnd });
    };
    update();
    el.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      el.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, []);

  const refreshDrafts = useCallback(async () => {
    try {
      const list = await listDrafts();
      setDrafts(list);
    } catch {
      setDrafts([]);
    }
  }, []);

  useEffect(() => {
    refreshDrafts();
  }, [refreshDrafts]);

  const refreshAll = useCallback(async () => {
    await Promise.all([refreshStats(), refreshDrafts()]);
  }, [refreshStats, refreshDrafts]);

  const { rootRef, pullY, refreshing, dragging } = usePullToRefresh(refreshAll);

  // Al entrar en Inicio, forzar scroll al tope.
  useEffect(() => {
    let node: HTMLElement | null = rootRef.current?.parentElement ?? null;
    while (node) {
      const oy = getComputedStyle(node).overflowY;
      if (oy === 'auto' || oy === 'scroll') { node.scrollTop = 0; break; }
      node = node.parentElement;
    }
    window.scrollTo(0, 0);
  }, [rootRef]);

  const handleCloseModal = (setter: (v: boolean) => void) => () => {
    setter(false);
    setEditingDraft(null);
    refreshDrafts();
  };

  const openDraft = (d: DraftRow) => {
    setEditingDraft(d);
    if (d.kind === 'service') setIsServiceFormOpen(true);
    else if (d.kind === 'key_delivery') setIsLlavesFormOpen(true);
    else setIsIncidenciaFormOpen(true);
  };

  const actions: ActionConfig[] = [
    {
      icon: Briefcase,
      label: 'Realizar trabajo',
      iconWrap: 'bg-orange-100 dark:bg-orange-400/10',
      iconColor: 'text-orange-600 dark:text-orange-400',
      onClick: () => {
        // Selector previo de tipo (reserva / manitas) → al continuar abre form.
        setEditingDraft(null);
        setPendingServiceTipo(null);
        setIsServiceTypePickerOpen(true);
      },
    },
    {
      icon: KeyRound,
      label: 'Entrega de llaves',
      iconWrap: 'bg-blue-100 dark:bg-blue-400/10',
      iconColor: 'text-blue-600 dark:text-blue-400',
      onClick: () => {
        setEditingDraft(null);
        setIsLlavesFormOpen(true);
      },
    },
    {
      icon: AlertTriangle,
      label: 'Solucionar Incidencia',
      iconWrap: 'bg-red-100 dark:bg-red-400/10',
      iconColor: 'text-red-600 dark:text-red-400',
      onClick: () => {
        setEditingDraft(null);
        setIsIncidenciaFormOpen(true);
      },
    },
  ];

  // Payload pasado al modal sólo si su kind coincide con el draft editado.
  const draftIdFor = (kind: DraftRow['kind']): string | null =>
    editingDraft && editingDraft.kind === kind ? editingDraft.id : null;
  const draftPayloadFor = (kind: DraftRow['kind']): any =>
    editingDraft && editingDraft.kind === kind ? editingDraft.payload : null;

  // Máscara de fade: sin fade en el lado donde no hay más scroll (inicio/fin).
  const carouselMask = `linear-gradient(to right, ${carEdges.atStart ? 'black' : 'transparent'} 0, black 28px, black calc(100% - 28px), ${carEdges.atEnd ? 'black' : 'transparent'} 100%)`;

  const settling = !dragging && !refreshing;

  return (
    <div ref={rootRef} className="relative animate-in fade-in slide-in-from-bottom-4 duration-700">
      <PullToRefreshIndicator pullY={pullY} refreshing={refreshing} dragging={dragging} />
      <div
        style={{
          transform: `translateY(${pullY}px)`,
          transition: settling ? 'transform 360ms cubic-bezier(0.22,1,0.36,1)' : 'none',
        }}
      >
      <div className="px-6 pt-4 pb-10 space-y-8 lg:px-0 lg:pt-0 lg:pb-0">
      <header className="flex flex-col items-start text-left pt-2 pb-2 pr-8 font-dm relative">
        <button
          onClick={() => setTourOpen(true)}
          className="absolute top-2 right-0 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-stone-100 dark:bg-stone-800 text-slate-500 dark:text-stone-400 hover:text-slate-700 dark:hover:text-stone-200 transition-colors text-xs font-medium"
        >
          <span>?</span>
          <span>Ayuda</span>
        </button>
        <h1 className="text-3xl font-medium tracking-tight leading-snug text-[#bfb9b7] dark:text-stone-500">
          {stats !== null || statsLoading ? (
            <>
              Este mes llevas{' '}
              <Briefcase size={26} strokeWidth={2.5} className="inline align-middle relative -top-[2px] text-orange-500 mr-1.5" />
              {statsLoading || !stats ? (
                <span className="inline-block align-middle h-6 w-28 rounded-md bg-stone-200/70 dark:bg-stone-800/50 animate-pulse" />
              ) : (
                <span className="text-stone-800 dark:text-stone-200">{stats.cleanCount} servicios</span>
              )}{' '}
              y{' '}
              <Clock size={26} strokeWidth={2.5} className="inline align-middle relative -top-[2px] text-sky-500 mr-1.5" />
              {statsLoading || !stats ? (
                <span className="inline-block align-middle h-6 w-28 rounded-md bg-stone-200/70 dark:bg-stone-800/50 animate-pulse" />
              ) : (
                <span className="text-stone-800 dark:text-stone-200">{stats.hoursWorked.toFixed(1).replace('.', ',')} horas</span>
              )}{' '}
              trabajadas. Tienes{' '}
              <Wallet size={26} strokeWidth={2.5} className="inline align-middle relative -top-[2px] text-violet-500 mr-1.5" />
              {statsLoading || !stats ? (
                <span className="inline-block align-middle h-6 w-20 rounded-md bg-stone-200/70 dark:bg-stone-800/50 animate-pulse" />
              ) : (
                <span className="text-stone-800 dark:text-stone-200">{stats.totalOwed.toFixed(2).replace('.', ',')} €</span>
              )}{' '}
              pendientes.
            </>
          ) : null}
        </h1>
      </header>

      <div
        ref={carouselRef}
        className="flex gap-2 overflow-x-auto no-scrollbar snap-x snap-mandatory"
        style={{ maskImage: carouselMask, WebkitMaskImage: carouselMask }}
      >
        {actions.map(({ icon: Icon, label, onClick }) => (
          <button
            key={label}
            onClick={onClick}
            className="shrink-0 snap-start w-[130px] h-[130px] flex flex-col p-4 rounded-2xl bg-stone-50 dark:bg-stone-800/40 border border-stone-200/70 dark:border-stone-700/50 active:scale-[0.98] transition-all group"
          >
            <span className="flex-1 min-w-0 text-left text-[19px] font-medium text-slate-800 dark:text-stone-100 font-dm leading-tight break-words">
              {label}
            </span>
            <div className="flex items-center justify-between w-full">
              <Icon
                size={24}
                className={
                  label === 'Realizar trabajo'
                    ? 'text-blue-500'
                    : label === 'Entrega de llaves'
                      ? 'text-yellow-500'
                      : 'text-orange-500'
                }
              />
            </div>
          </button>
        ))}
      </div>

      {drafts.length > 0 && (
        <div className="max-w-xl mx-auto lg:mx-0 pt-2 space-y-3 animate-in fade-in duration-500 font-gsf">
          <div className="flex items-center gap-2 px-1">
            <h2 className="text-xs font-medium text-slate-500 dark:text-stone-400">
              Mis borradores
            </h2>
            <span className="ml-auto text-[11px] text-slate-400 dark:text-stone-500">
              {drafts.length} {drafts.length === 1 ? 'pendiente' : 'pendientes'}
            </span>
          </div>
          <ul className="space-y-2">
            {(draftsExpanded ? drafts : drafts.slice(0, 3)).map((d) => {
              const meta = getDraftMeta(d);
              return (
                <li key={d.id}>
                  <button
                    onClick={() => openDraft(d)}
                    className="w-full flex items-start justify-between gap-3 px-4 py-5 rounded-xl border border-dashed border-stone-200/70 dark:border-stone-700/40 hover:bg-stone-50 dark:hover:bg-stone-800/40 active:scale-[0.99] transition-all"
                  >
                    <div className="flex items-center min-w-0 flex-1 text-left">
                      <AlertCircle size={16} className="text-slate-400 dark:text-stone-500 shrink-0 mr-4" />
                      <div className="min-w-0 space-y-1">
                        <p className="text-sm font-medium text-slate-800 dark:text-stone-100 truncate">
                          {meta.title}
                        </p>
                        <p className="text-[11px] text-slate-400 dark:text-stone-500">
                          {meta.typeLabel}
                        </p>
                      </div>
                    </div>
                    <span className="text-[11px] text-slate-400 dark:text-stone-500 shrink-0">
                      {meta.fecha}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          {drafts.length > 3 && (
            <button
              onClick={() => setDraftsExpanded((v) => !v)}
              className="w-full text-center text-xs font-medium text-slate-500 dark:text-stone-400 hover:text-slate-700 dark:hover:text-stone-200 py-2 transition-colors"
            >
              {draftsExpanded ? 'Ver menos' : `Ver más (${drafts.length - 3})`}
            </button>
          )}
        </div>
      )}

      {/* Últimos trabajos — historial breve (máx 3). Un contenedor con items separados por divisores. */}
      <div className="max-w-xl mx-auto lg:mx-0 pt-2 space-y-3 font-gsf">
        <div className="flex items-center gap-2 px-1">
          <h2 className="text-xs font-medium text-slate-500 dark:text-stone-400">
            Últimos trabajos
          </h2>
          {recentJobs.length > 0 && (
            <span className="ml-auto text-[11px] text-slate-400 dark:text-stone-500">
              {recentJobs.length}
            </span>
          )}
        </div>
        {statsLoading ? (
          <div className="rounded-xl bg-stone-50/60 dark:bg-stone-800/25 border border-stone-200/70 dark:border-stone-700/50 divide-y divide-stone-200/60 dark:divide-stone-700/40">
            {[0, 1, 2].map((i) => (
              <div key={i} className="px-4 py-4 flex items-center gap-3">
                <div className="shrink-0 w-[52px] h-[52px] flex flex-col items-center justify-center gap-1.5">
                  <div className="h-4 w-6 rounded bg-stone-200/70 dark:bg-stone-800/50 animate-pulse" />
                  <div className="h-2.5 w-7 rounded bg-stone-200/60 dark:bg-stone-800/40 animate-pulse" />
                </div>
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="h-3.5 w-2/3 rounded bg-stone-200/70 dark:bg-stone-800/50 animate-pulse" />
                  <div className="h-3 w-1/3 rounded bg-stone-200/60 dark:bg-stone-800/40 animate-pulse" />
                </div>
                <div className="shrink-0 h-4 w-14 rounded bg-stone-200/70 dark:bg-stone-800/50 animate-pulse" />
              </div>
            ))}
          </div>
        ) : recentJobs.length > 0 ? (
          <>
            <div className="rounded-xl bg-stone-50/60 dark:bg-stone-800/25 border border-stone-200/70 dark:border-stone-700/50 divide-y divide-stone-200/60 dark:divide-stone-700/40">
              {recentJobs.map((j) => (
                <div key={j.id} className="px-4 py-4 flex items-center gap-3">
                  {/* Marcador-fecha 52×52 — sin fondo ni borde */}
                  <div className="shrink-0 w-[52px] h-[52px] flex flex-col items-center justify-center">
                    <span className="text-base font-medium text-slate-800 dark:text-stone-100 leading-none tabular-nums">
                      {j.date.getDate()}
                    </span>
                    <span className="text-[10px] uppercase tracking-wide text-slate-400 dark:text-stone-500 mt-0.5">
                      {j.date.toLocaleString('es-ES', { month: 'short' }).replace('.', '')}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="text-sm font-medium text-slate-800 dark:text-stone-100 truncate">
                      {formatName(j.name)}
                    </p>
                    <p className="text-[11px] text-slate-400 dark:text-stone-500">
                      {j.type} · {j.hours.toFixed(1).replace('.', ',')} h
                      {j.km > 0 ? ` · ${j.km} km` : ''}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-medium text-emerald-600 dark:text-emerald-400 tabular-nums">
                    {j.pay.toFixed(2).replace('.', ',')} €
                  </span>
                </div>
              ))}
            </div>
            {totalJobs > 3 && (
              <button
                onClick={() => window.dispatchEvent(new CustomEvent('worker-pane:goto', { detail: 1 }))}
                className="w-full text-center text-xs font-medium text-slate-500 dark:text-stone-400 hover:text-slate-700 dark:hover:text-stone-200 py-2 transition-colors"
              >
                Ver más ({totalJobs - 3})
              </button>
            )}
          </>
        ) : (
          <div className="px-4 py-6 rounded-xl border border-dashed border-stone-200/70 dark:border-stone-700/40 text-center">
            <p className="text-sm text-slate-400 dark:text-stone-500">
              Todavía no has realizado ningún trabajo.
            </p>
          </div>
        )}
      </div>

      <div className="pt-2 max-w-xl mx-auto lg:mx-0">
        <button
          onClick={() => setIsSugerenciaFormOpen(true)}
          className="w-full flex items-center justify-center px-6 py-4 rounded-xl bg-red-50/70 dark:bg-red-900/10 border border-red-200/60 dark:border-red-800/30 text-red-600/90 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 active:scale-[0.98] transition-all font-gsf">
          <span className="text-sm font-medium">Tengo un problema</span>
        </button>
      </div>
      </div>
      </div>

      {tourOpen && <WorkerTour onDone={() => setTourOpen(false)} />}

      <ServiceTypePickerSheet
        isOpen={isServiceTypePickerOpen}
        onClose={() => setIsServiceTypePickerOpen(false)}
        onContinue={(tipo) => {
          setPendingServiceTipo(tipo);
          setIsServiceTypePickerOpen(false);
          // Sale el picker y entra el form de forma seguida (sincronizado con su anim).
          window.setTimeout(() => setIsServiceFormOpen(true), 320);
        }}
      />
      <ServiceFormModal
        isOpen={isServiceFormOpen}
        onClose={handleCloseModal(setIsServiceFormOpen)}
        draftId={draftIdFor('service')}
        draftPayload={draftPayloadFor('service')}
        initialTipo={pendingServiceTipo}
      />
      <EntregaLlavesFormModal
        isOpen={isLlavesFormOpen}
        onClose={handleCloseModal(setIsLlavesFormOpen)}
        draftId={draftIdFor('key_delivery')}
        draftPayload={draftPayloadFor('key_delivery')}
      />
      <IncidenciaFormModal
        isOpen={isIncidenciaFormOpen}
        onClose={handleCloseModal(setIsIncidenciaFormOpen)}
        draftId={draftIdFor('incident')}
        draftPayload={draftPayloadFor('incident')}
      />
      <SugerenciaFormModal
        isOpen={isSugerenciaFormOpen}
        onClose={() => setIsSugerenciaFormOpen(false)}
        user={user}
      />
    </div>
  );
};

export default WorkerPanel;
