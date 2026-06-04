import React, { useEffect, useState } from 'react';
import type { User } from '../services/mockData';
import { Sparkles, Key, AlertTriangle, MessageCircle, ChevronRight, type LucideIcon } from 'lucide-react';
import ServiceFormModal from '../components/workers/ServiceFormModal';
import EntregaLlavesFormModal from '../components/workers/EntregaLlavesFormModal';
import IncidenciaFormModal from '../components/workers/IncidenciaFormModal';
import SugerenciaFormModal from '../components/sugerencias/SugerenciaFormModal';
import { getWorkerDraftFlags } from '../utils/workerFormDrafts';
import { workerDraftEmptyChecks } from '../utils/workerDraftValidators';

interface WorkerPanelProps {
  user: User;
}

interface ActionConfig {
  icon: LucideIcon;
  label: string;
  iconWrap: string;
  iconColor: string;
  draftKey?: 'servicio' | 'entrega-llaves' | 'incidencia';
  onClick: () => void;
}

const WorkerPanel: React.FC<WorkerPanelProps> = ({ user }) => {
  const userId = user.id ?? user.email;
  const firstName = (user.name || 'trabajador').split(' ')[0];
  const [isServiceFormOpen, setIsServiceFormOpen] = useState(false);
  const [isLlavesFormOpen, setIsLlavesFormOpen] = useState(false);
  const [isIncidenciaFormOpen, setIsIncidenciaFormOpen] = useState(false);
  const [isSugerenciaFormOpen, setIsSugerenciaFormOpen] = useState(false);
  const [draftFlags, setDraftFlags] = useState(() =>
    getWorkerDraftFlags(userId, workerDraftEmptyChecks)
  );

  useEffect(() => {
    const refresh = () => setDraftFlags(getWorkerDraftFlags(userId, workerDraftEmptyChecks));
    refresh();
    window.addEventListener('rh-worker-draft-change', refresh);
    return () => window.removeEventListener('rh-worker-draft-change', refresh);
  }, [userId]);

  const actions: ActionConfig[] = [
    {
      icon: Sparkles,
      label: 'Realizar servicios',
      iconWrap: 'bg-orange-100 dark:bg-orange-400/10',
      iconColor: 'text-orange-600 dark:text-orange-400',
      draftKey: 'servicio',
      onClick: () => setIsServiceFormOpen(true),
    },
    {
      icon: Key,
      label: 'Entrega de llaves',
      iconWrap: 'bg-blue-100 dark:bg-blue-400/10',
      iconColor: 'text-blue-600 dark:text-blue-400',
      draftKey: 'entrega-llaves',
      onClick: () => setIsLlavesFormOpen(true),
    },
    {
      icon: AlertTriangle,
      label: 'Solucionar incidencias',
      iconWrap: 'bg-red-100 dark:bg-red-400/10',
      iconColor: 'text-red-600 dark:text-red-400',
      draftKey: 'incidencia',
      onClick: () => setIsIncidenciaFormOpen(true),
    },
  ];

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
        {actions.map(({ icon: Icon, label, iconWrap, iconColor, draftKey, onClick }) => (
          <button
            key={label}
            onClick={onClick}
            className="w-full flex items-center gap-4 px-5 py-5 rounded-3xl bg-white/80 dark:bg-stone-900/60 backdrop-blur-md border border-white/60 dark:border-stone-800/50 shadow-sm hover:shadow-md active:scale-[0.98] transition-all group"
          >
            <div className={`p-3 rounded-2xl ${iconWrap} ${iconColor} shrink-0 relative`}>
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
          className="w-full flex items-center justify-center gap-2 px-6 py-4 rounded-2xl bg-stone-100 dark:bg-stone-800/40 border border-stone-200 dark:border-stone-700/40 text-slate-600 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-700/40 active:scale-[0.98] transition-all relative"
        >
          <MessageCircle size={18} />
          <span className="text-sm font-medium">Enviar sugerencia</span>
        </button>
      </div>

      <ServiceFormModal
        isOpen={isServiceFormOpen}
        onClose={() => setIsServiceFormOpen(false)}
        userId={userId}
      />
      <EntregaLlavesFormModal
        isOpen={isLlavesFormOpen}
        onClose={() => setIsLlavesFormOpen(false)}
        userId={userId}
      />
      <IncidenciaFormModal
        isOpen={isIncidenciaFormOpen}
        onClose={() => setIsIncidenciaFormOpen(false)}
        userId={userId}
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
