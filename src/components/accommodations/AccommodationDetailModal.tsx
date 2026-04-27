import React from 'react';
import { 
  X, MapPin, Building2, Users, Home, 
  Hash, FileText, Info, Plus
} from 'lucide-react';
import { Accommodation, Worker, WorkerAccommodationDetails } from '../../services/mockData';
import defaultAccImage from '../../assets/default_accommodation.png';

interface AccommodationDetailModalProps {
  accommodation: Accommodation | null;
  isOpen: boolean;
  onClose: () => void;
  assignedWorkers: Worker[];
  onManageWorkers?: () => void;
  isReadOnly?: boolean;
}

const toTitleCase = (str: string) =>
  str.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());

const AccommodationDetailModal: React.FC<AccommodationDetailModalProps> = ({ 
  accommodation, 
  isOpen, 
  onClose, 
  assignedWorkers,
  onManageWorkers,
  isReadOnly
}) => {
  const [showNotes, setShowNotes] = React.useState(false);
  const [shouldRender, setShouldRender] = React.useState(isOpen);
  const [isAnimating, setIsAnimating] = React.useState(false);

  React.useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      // Small delay to ensure the DOM is ready before starting animation
      const timer = setTimeout(() => setIsAnimating(true), 10);
      return () => clearTimeout(timer);
    } else {
      setIsAnimating(false);
      // Wait for animation to finish before unmounting (500ms match duration-500)
      const timer = setTimeout(() => setShouldRender(false), 500);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  if (!shouldRender || !accommodation) return null;

  const notesCount = accommodation.notes?.trim() ? 1 : 0;

  return (
    <div 
      className={`fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 overflow-hidden ${
        shouldRender ? 'pointer-events-auto' : 'pointer-events-none'
      }`}
    >
      {/* Backdrop (Static blur, transition opacity to avoid snapping) */}
      <div 
        className={`fixed inset-0 bg-white/20 dark:bg-stone-950/40 backdrop-blur-sm transition-opacity duration-700 ease-in-out ${
          isAnimating ? 'opacity-100' : 'opacity-0'
        }`} 
        onClick={onClose} 
      />

      {/* Modal Content (Simple Fade) */}
      <div 
        className={`relative bg-white dark:bg-stone-900 w-full max-w-4xl rounded-[32px] overflow-hidden shadow-2xl flex flex-col max-h-[90vh] border border-stone-100 dark:border-stone-800/50 transition-opacity duration-700 ease-in-out ${
          isAnimating ? 'opacity-100' : 'opacity-0'
        }`}
      >
        
        {/* Close Button (Floating) */}
        <button 
          onClick={onClose}
          className="absolute top-6 right-6 z-10 p-2 bg-white/80 dark:bg-stone-900/80 backdrop-blur-md border border-stone-100 dark:border-stone-800 rounded-full text-slate-500 hover:text-slate-800 dark:hover:text-stone-200 transition-all shadow-sm"
        >
          <X size={18} />
        </button>

        <div className="overflow-y-auto flex-1 custom-scrollbar">
          {/* Hero ImageSection */}
          <div className="aspect-[21/9] w-full relative bg-stone-100 dark:bg-stone-800">
            <img 
              src={accommodation.image || defaultAccImage} 
              alt={accommodation.name} 
              className="w-full h-full object-cover" 
            />
            {!accommodation.active && (
              <div className="absolute inset-0 bg-white/40 dark:bg-black/40 backdrop-blur-[1px] flex items-center justify-center">
                <span className="px-4 py-2 bg-white dark:bg-stone-900 rounded-full text-[10px] font-normal text-slate-600 dark:text-stone-300 shadow-xl">
                  Inactivo
                </span>
              </div>
            )}
            <div className="absolute top-6 left-6 px-3 py-1 bg-white/90 dark:bg-stone-900/90 backdrop-blur-md rounded-lg text-[9px] font-normal text-slate-500 shadow-sm border border-stone-100 dark:border-stone-800">
              REF: {accommodation.ref || 'S/R'}
            </div>
          </div>

          <div className="p-8 space-y-7">
            {/* Header Info */}
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
              <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                <div className="flex items-center gap-3">
                  <h2 className="text-xl font-normal text-slate-800 dark:text-stone-100 tracking-tight leading-tight truncate">
                    {toTitleCase(accommodation.name)}
                  </h2>
                  
                  {/* Minimalist Notes Trigger */}
                  <button 
                    onClick={() => setShowNotes(!showNotes)}
                    className={`relative p-1 transition-colors ${showNotes ? 'text-orange-500' : 'text-slate-400 hover:text-orange-500'}`}
                  >
                    <FileText size={16} />
                    {notesCount > 0 && (
                      <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-orange-500 text-white text-[8px] font-normal flex items-center justify-center rounded-full border border-white dark:border-stone-900 shadow-sm">
                        {notesCount}
                      </span>
                    )}
                  </button>
                </div>

                <div className="flex items-center gap-2 text-slate-400 dark:text-stone-500">
                  <MapPin size={13} className="text-orange-500 shrink-0" />
                  <span className="text-[11.5px] font-light truncate">
                    {toTitleCase(accommodation.city)} ({accommodation.zipCode || 'S/CP'}) • {toTitleCase(accommodation.address)}
                  </span>
                </div>
              </div>
              
              {/* Workers Preview in Header */}
              <div className="flex flex-col items-start md:items-end gap-2 shrink-0">
                <h3 className="text-[11px] font-normal text-slate-400 dark:text-stone-500 px-1">
                  Limpiadores asignados
                </h3>
                
                <div className="flex items-center flex-wrap gap-1 md:justify-end">
                  {assignedWorkers.length === 0 ? (
                    !isReadOnly ? (
                      <button 
                        onClick={onManageWorkers}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-stone-100 dark:bg-stone-800 text-slate-500 dark:text-stone-400 border border-stone-200/50 dark:border-stone-700/50 text-[10px] font-normal hover:bg-orange-500 hover:text-white dark:hover:bg-orange-600 transition-all active:scale-95 group"
                      >
                        <Plus size={10} className="group-hover:rotate-90 transition-transform" />
                        <span>Asignar limpiador</span>
                      </button>
                    ) : (
                      <span className="text-[10px] text-slate-400 dark:text-stone-500 px-3 py-1.5 bg-stone-100/50 dark:bg-stone-800/30 rounded-full border border-dashed border-stone-200 dark:border-stone-700">Sin asignaciones</span>
                    )
                  ) : (
                    <>
                      {assignedWorkers.slice(0, 4).map((worker) => (
                        <div 
                          key={worker.id} 
                          className="px-2.5 py-1 rounded-full bg-stone-50 dark:bg-stone-800/40 border border-stone-100 dark:border-stone-800 text-[10px] text-slate-600 dark:text-stone-300 whitespace-nowrap"
                        >
                          {toTitleCase(worker.fullName.split(' ')[0])}
                        </div>
                      ))}
                      {assignedWorkers.length > 4 && (
                        <div className="px-2.5 py-1 rounded-full bg-orange-50 dark:bg-orange-900/20 border border-orange-100 dark:border-orange-800 text-[10px] text-orange-600 dark:text-orange-400 font-normal whitespace-nowrap">
                          +{assignedWorkers.length - 4}
                        </div>
                      )}
                      {!isReadOnly && (
                        <button 
                          onClick={onManageWorkers}
                          className="ml-1 p-1 bg-stone-50 dark:bg-stone-800 text-slate-400 hover:text-orange-500 rounded-full transition-colors flex items-center justify-center"
                          title="Gestionar limpiadores"
                        >
                          <Plus size={12} />
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Assigned workers with price/linen details */}
            {assignedWorkers.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-[10px] font-semibold text-slate-400 dark:text-stone-500 uppercase tracking-widest flex items-center justify-between">
                  <span>Limpiadores y condiciones</span>
                  {!isReadOnly && (
                    <button onClick={onManageWorkers} className="text-orange-500 hover:text-orange-600 normal-case tracking-normal font-normal text-[10px]">
                      Gestionar
                    </button>
                  )}
                </h3>
                {assignedWorkers.map(worker => {
                  const detail: WorkerAccommodationDetails | undefined = (worker.accommodationDetails || []).find(
                    d => d.accommodationName === accommodation.name
                  );
                  return (
                    <div key={worker.id} className="flex items-center gap-3 bg-stone-50 dark:bg-stone-800/50 rounded-xl border border-stone-100 dark:border-stone-800 px-3 py-2.5">
                      {/* Avatar */}
                      <div className="w-7 h-7 rounded-full bg-stone-200 dark:bg-stone-700 overflow-hidden shrink-0">
                        {worker.photo ? (
                          <img src={worker.photo} alt={worker.fullName} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-400 dark:text-stone-500 text-[10px] font-medium">
                            {worker.fullName[0]?.toUpperCase()}
                          </div>
                        )}
                      </div>
                      {/* Name */}
                      <span className="text-xs font-normal text-slate-700 dark:text-stone-200 flex-1 truncate">
                        {toTitleCase(worker.fullName)}
                      </span>
                      {/* Details badges */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        {detail && detail.precio > 0 && (
                          <span className="px-2 py-0.5 bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 border border-orange-100 dark:border-orange-800 rounded-full text-[10px] font-normal tabular-nums">
                            {detail.precio.toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} €
                          </span>
                        )}
                        {detail?.sabanasIncluidas && (
                          <span className="px-2 py-0.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-800 rounded-full text-[10px]">
                            🛏 Sábanas
                          </span>
                        )}
                        {detail?.toallasIncluidas && (
                          <span className="px-2 py-0.5 bg-teal-50 dark:bg-teal-900/20 text-teal-600 dark:text-teal-400 border border-teal-100 dark:border-teal-800 rounded-full text-[10px]">
                            🛁 Toallas
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Expanded Notes Content Transition (Accordion style) */}
            <div 
              className={`grid transition-all duration-300 ease-in-out ${
                showNotes ? 'grid-rows-[1fr] opacity-100 pt-6 border-t border-stone-100 dark:border-stone-800/40' : 'grid-rows-[0fr] opacity-0'
              }`}
            >
              <div className="overflow-hidden">
                <div className="p-5 rounded-2xl bg-stone-50/30 dark:bg-stone-800/20 border border-stone-100 dark:border-stone-800/30">
                  <p className="text-[11px] text-slate-500 dark:text-stone-400 leading-relaxed font-light italic">
                    {accommodation.notes || 'No hay notas adicionales registradas.'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AccommodationDetailModal;
