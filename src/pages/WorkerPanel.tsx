import React, { useCallback, useEffect, useState } from 'react';
import type { User } from '../services/mockData';
import {
  Sparkles,
  Key,
  AlertTriangle,
  MessageCircle,
  ChevronRight,
  Trash2,
  FileText,
  Home,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import ServiceFormModal from '../components/workers/ServiceFormModal';
import EntregaLlavesFormModal from '../components/workers/EntregaLlavesFormModal';
import IncidenciaFormModal from '../components/workers/IncidenciaFormModal';
import SugerenciaFormModal from '../components/sugerencias/SugerenciaFormModal';
import { deleteDraft, listDrafts, type DraftRow } from '../services/reportsApi';

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
const getDraftMeta = (
  draft: DraftRow
): { title: string; Icon: LucideIcon; iconWrap: string; iconColor: string } => {
  if (draft.kind === 'service') {
    const tipo = (draft.payload as any)?.tipo as 'reserva' | 'manitas' | undefined;
    if (tipo === 'manitas') {
      return {
        title: 'Manitas',
        Icon: Wrench,
        iconWrap: 'bg-orange-100 dark:bg-orange-400/10',
        iconColor: 'text-orange-600 dark:text-orange-400',
      };
    }
    return {
      title: 'Limpieza de reserva',
      Icon: Home,
      iconWrap: 'bg-orange-100 dark:bg-orange-400/10',
      iconColor: 'text-orange-600 dark:text-orange-400',
    };
  }
  if (draft.kind === 'key_delivery') {
    return {
      title: 'Entrega de llaves',
      Icon: Key,
      iconWrap: 'bg-blue-100 dark:bg-blue-400/10',
      iconColor: 'text-blue-600 dark:text-blue-400',
    };
  }
  return {
    title: 'Incidencia',
    Icon: AlertTriangle,
    iconWrap: 'bg-red-100 dark:bg-red-400/10',
    iconColor: 'text-red-600 dark:text-red-400',
  };
};

const formatRelative = (iso: string): string => {
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return 'ahora mismo';
  if (mins < 60) return `hace ${mins} min`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.round(hours / 24);
  if (days < 7) return `hace ${days} día${days === 1 ? '' : 's'}`;
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
};

const WorkerPanel: React.FC<WorkerPanelProps> = ({ user }) => {
  const firstName = (user.name || 'trabajador').split(' ')[0];
  const [isServiceFormOpen, setIsServiceFormOpen] = useState(false);
  const [isLlavesFormOpen, setIsLlavesFormOpen] = useState(false);
  const [isIncidenciaFormOpen, setIsIncidenciaFormOpen] = useState(false);
  const [isSugerenciaFormOpen, setIsSugerenciaFormOpen] = useState(false);

  const [drafts, setDrafts] = useState<DraftRow[]>([]);
  const [editingDraft, setEditingDraft] = useState<DraftRow | null>(null);

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

  const handleDeleteDraft = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await deleteDraft(id);
      await refreshDrafts();
    } catch (err) {
      console.error(err);
    }
  };

  const actions: ActionConfig[] = [
    {
      icon: Sparkles,
      label: 'Realizar servicios',
      iconWrap: 'bg-orange-100 dark:bg-orange-400/10',
      iconColor: 'text-orange-600 dark:text-orange-400',
      onClick: () => {
        setEditingDraft(null);
        setIsServiceFormOpen(true);
      },
    },
    {
      icon: Key,
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
      label: 'Solucionar incidencias',
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

  return (
    <div className="space-y-8 pb-24 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <header className="flex flex-col items-center lg:items-start justify-center lg:justify-start text-center lg:text-left gap-2 pt-8 pb-2">
        <h1 className="text-2xl font-normal text-slate-800 dark:text-stone-200 tracking-tight font-display">
          Hola, {firstName} 👋
        </h1>
        <p className="text-sm text-slate-400 dark:text-stone-500 font-light">
          Rellenar informe
        </p>
      </header>

      <div className="space-y-3 max-w-xl mx-auto lg:mx-0">
        {actions.map(({ icon: Icon, label, iconWrap, iconColor, onClick }) => (
          <button
            key={label}
            onClick={onClick}
            className="w-full flex items-center gap-4 px-5 py-5 rounded-3xl bg-white/80 dark:bg-stone-900/60 backdrop-blur-md border border-white/60 dark:border-stone-800/50 shadow-sm hover:shadow-md active:scale-[0.98] transition-all group"
          >
            <div className={`p-3 rounded-2xl ${iconWrap} ${iconColor} shrink-0`}>
              <Icon size={22} />
            </div>
            <span className="flex-1 text-left text-base font-medium text-slate-800 dark:text-stone-100">
              {label}
            </span>
            <ChevronRight size={18} className="text-slate-400 dark:text-stone-500 group-hover:text-orange-500 transition-colors" />
          </button>
        ))}
      </div>

      <div className="pt-2 max-w-xl mx-auto lg:mx-0">
        <button
          onClick={() => setIsSugerenciaFormOpen(true)}
          className="w-full flex items-center justify-center gap-2 px-6 py-4 rounded-2xl bg-stone-100 dark:bg-stone-800/40 border border-stone-200 dark:border-stone-700/40 text-slate-600 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-700/40 active:scale-[0.98] transition-all"
        >
          <MessageCircle size={18} />
          <span className="text-sm font-medium">Enviar sugerencia</span>
        </button>
      </div>

      {drafts.length > 0 && (
        <div className="max-w-xl mx-auto lg:mx-0 pt-2 space-y-3 animate-in fade-in duration-500">
          <div className="flex items-center gap-2 px-1">
            <FileText size={14} className="text-slate-400 dark:text-stone-500" />
            <h2 className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-stone-400">
              Mis borradores
            </h2>
            <span className="ml-auto text-[10px] text-slate-400 dark:text-stone-500">
              {drafts.length} {drafts.length === 1 ? 'pendiente' : 'pendientes'}
            </span>
          </div>
          <ul className="space-y-2">
            {drafts.map((d) => {
              const meta = getDraftMeta(d);
              const { Icon } = meta;
              return (
                <li key={d.id}>
                  <button
                    onClick={() => openDraft(d)}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl bg-amber-50/60 dark:bg-amber-900/10 border border-amber-200/70 dark:border-amber-800/40 hover:bg-amber-50 dark:hover:bg-amber-900/20 active:scale-[0.99] transition-all"
                  >
                    <div className={`p-2 rounded-xl ${meta.iconWrap} ${meta.iconColor} shrink-0`}>
                      <Icon size={16} />
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <p className="text-sm font-medium text-slate-800 dark:text-stone-100 truncate">
                        {meta.title}
                      </p>
                      <p className="text-[11px] text-slate-400 dark:text-stone-500">
                        Borrador · actualizado {formatRelative(d.updatedAt)}
                      </p>
                    </div>
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => handleDeleteDraft(e, d.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') handleDeleteDraft(e as any, d.id);
                      }}
                      className="p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                      title="Eliminar borrador"
                    >
                      <Trash2 size={14} />
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <ServiceFormModal
        isOpen={isServiceFormOpen}
        onClose={handleCloseModal(setIsServiceFormOpen)}
        draftId={draftIdFor('service')}
        draftPayload={draftPayloadFor('service')}
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
