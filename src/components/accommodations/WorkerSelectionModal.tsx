import React, { useState, useMemo } from 'react';
import { X, Search, Users, Check, Save, ArrowLeft } from 'lucide-react';
import { Worker, WorkerAccommodationDetails } from '../../services/mockData';

export interface WorkerAssignmentDetail {
  workerName: string;
  precio: number;
  sabanasIncluidas: boolean;
  toallasIncluidas: boolean;
}

interface WorkerSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  allWorkers: Worker[];
  currentWorkerNames: string[];
  onSave: (details: WorkerAssignmentDetail[]) => Promise<void>;
  accommodationName: string;
}

const toTitleCase = (str: string) =>
  str.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());

const WorkerSelectionModal: React.FC<WorkerSelectionModalProps> = ({
  isOpen,
  onClose,
  allWorkers,
  currentWorkerNames,
  onSave,
  accommodationName
}) => {
  const [step, setStep] = useState<1 | 2>(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedNames, setSelectedNames] = useState<Set<string>>(new Set(currentWorkerNames));
  const [detailsMap, setDetailsMap] = useState<Map<string, { precio: number; sabanasIncluidas: boolean; toallasIncluidas: boolean }>>(new Map());
  const [isSaving, setIsSaving] = useState(false);

  // Sync on open
  React.useEffect(() => {
    if (isOpen) {
      setStep(1);
      setSearchTerm('');
      const names = new Set(currentWorkerNames);
      setSelectedNames(names);
      // Pre-load existing details from workers
      const map = new Map<string, { precio: number; sabanasIncluidas: boolean; toallasIncluidas: boolean }>();
      allWorkers.forEach(w => {
        const existing = (w.accommodationDetails || []).find(
          (d: WorkerAccommodationDetails) => d.accommodationName === accommodationName
        );
        if (existing) {
          map.set(w.fullName, {
            precio: existing.precio,
            sabanasIncluidas: existing.sabanasIncluidas,
            toallasIncluidas: existing.toallasIncluidas,
          });
        }
      });
      setDetailsMap(map);
    }
  }, [isOpen, currentWorkerNames, allWorkers, accommodationName]);

  const filteredWorkers = useMemo(() => {
    const search = searchTerm.toLowerCase();
    return allWorkers
      .filter(w => 
        w.fullName.toLowerCase().includes(search) || 
        (w.telefono || '').includes(search)
      )
      .sort((a, b) => {
        const aSel = selectedNames.has(a.fullName);
        const bSel = selectedNames.has(b.fullName);
        if (aSel && !bSel) return -1;
        if (!aSel && bSel) return 1;
        return a.fullName.localeCompare(b.fullName);
      });
  }, [allWorkers, searchTerm, selectedNames]);

  const selectedWorkers = useMemo(
    () => allWorkers.filter(w => selectedNames.has(w.fullName)),
    [allWorkers, selectedNames]
  );

  if (!isOpen) return null;

  const toggleWorker = (name: string) => {
    const next = new Set(selectedNames);
    if (next.has(name)) {
      next.delete(name);
    } else {
      next.add(name);
      // Init details if not present
      if (!detailsMap.has(name)) {
        setDetailsMap(prev => new Map(prev).set(name, { precio: 0, sabanasIncluidas: false, toallasIncluidas: false }));
      }
    }
    setSelectedNames(next);
  };

  const updateDetail = (name: string, field: 'precio' | 'sabanasIncluidas' | 'toallasIncluidas', value: number | boolean) => {
    setDetailsMap(prev => {
      const next = new Map(prev);
      const current = next.get(name) || { precio: 0, sabanasIncluidas: false, toallasIncluidas: false };
      next.set(name, { ...current, [field]: value });
      return next;
    });
  };

  const getDetail = (name: string) =>
    detailsMap.get(name) || { precio: 0, sabanasIncluidas: false, toallasIncluidas: false };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const details: WorkerAssignmentDetail[] = Array.from(selectedNames).map(name => ({
        workerName: name,
        ...getDetail(name),
      }));
      await onSave(details);
      onClose();
    } catch (error) {
      console.error('Error saving worker assignments:', error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-300">
      <div className="absolute inset-0 bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-white dark:bg-stone-900 w-full max-w-md rounded-[24px] shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-300">

        {/* Header */}
        <div className="p-6 border-b border-stone-100 dark:border-stone-800 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {step === 2 && (
                <button onClick={() => setStep(1)} className="p-1.5 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-lg transition-colors text-slate-400">
                  <ArrowLeft size={16} />
                </button>
              )}
              <div className="p-2 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 rounded-xl">
                <Users size={18} />
              </div>
              <div>
                <h3 className="text-sm font-normal text-slate-800 dark:text-stone-200">
                  {step === 1 ? 'Asignar Trabajadores' : 'Detalles por Trabajador'}
                </h3>
                <p className="text-[10px] text-slate-400 dark:text-stone-500 font-light truncate max-w-[200px]">
                  {toTitleCase(accommodationName)}
                </p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-full transition-colors text-slate-400">
              <X size={18} />
            </button>
          </div>

          {/* Step indicator */}
          <div className="flex gap-2">
            {[1, 2].map(s => (
              <div key={s} className={`h-1 flex-1 rounded-full transition-colors ${step >= s ? 'bg-orange-500' : 'bg-stone-100 dark:bg-stone-800'}`} />
            ))}
          </div>

          {step === 1 && (
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-stone-500" size={14} />
              <input
                type="text"
                placeholder="Buscar trabajador..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-stone-50 dark:bg-stone-800/50 border border-stone-100 dark:border-stone-800 rounded-xl text-xs text-slate-700 dark:text-stone-300 focus:outline-none focus:bg-white dark:focus:bg-stone-800 transition-all placeholder:text-stone-400"
              />
            </div>
          )}
        </div>

        {/* Step 1 — Select workers */}
        {step === 1 && (
          <div className="flex-1 overflow-y-auto p-4 space-y-1 custom-scrollbar">
            {filteredWorkers.map(worker => {
              const isSelected = selectedNames.has(worker.fullName);
              return (
                <button
                  key={worker.id}
                  onClick={() => toggleWorker(worker.fullName)}
                  className={`w-full flex items-center justify-between p-3 rounded-xl transition-all duration-200 ${
                    isSelected
                      ? 'bg-orange-50/50 dark:bg-orange-900/10 border border-orange-100 dark:border-orange-900/30'
                      : 'hover:bg-stone-50 dark:hover:bg-stone-800/40 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-stone-100 dark:bg-stone-800 border border-stone-100 dark:border-stone-800 overflow-hidden">
                      {worker.photo ? (
                        <img src={worker.photo} alt={worker.fullName} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-300 dark:text-stone-600">
                          <Users size={14} />
                        </div>
                      )}
                    </div>
                    <div className="text-left">
                      <p className={`text-xs font-normal ${isSelected ? 'text-orange-700 dark:text-orange-400' : 'text-slate-700 dark:text-stone-200'}`}>
                        {toTitleCase(worker.fullName)}
                      </p>
                      <p className="text-[10px] text-slate-400 dark:text-stone-500 font-light">{worker.telefono}</p>
                    </div>
                  </div>
                  {isSelected && (
                    <div className="w-5 h-5 bg-orange-600 text-white rounded-full flex items-center justify-center scale-90 animate-in zoom-in-50">
                      <Check size={12} strokeWidth={3} />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Step 2 — Configure details */}
        {step === 2 && (
          <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
            {selectedWorkers.length === 0 && (
              <p className="text-center text-xs text-slate-400 dark:text-stone-500 py-8">No hay trabajadores seleccionados</p>
            )}
            {selectedWorkers.map(worker => {
              const detail = getDetail(worker.fullName);
              return (
                <div key={worker.id} className="bg-stone-50 dark:bg-stone-800/50 rounded-xl border border-stone-100 dark:border-stone-800 p-3">
                  {/* Worker name */}
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-7 h-7 rounded-full bg-stone-200 dark:bg-stone-700 overflow-hidden shrink-0">
                      {worker.photo ? (
                        <img src={worker.photo} alt={worker.fullName} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-400 dark:text-stone-500">
                          <Users size={12} />
                        </div>
                      )}
                    </div>
                    <p className="text-xs font-normal text-slate-700 dark:text-stone-200">{toTitleCase(worker.fullName)}</p>
                  </div>
                  {/* Fields */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Precio */}
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-slate-400 dark:text-stone-500">€ Precio</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={detail.precio}
                        onChange={e => updateDetail(worker.fullName, 'precio', parseFloat(e.target.value) || 0)}
                        className="w-20 px-2 py-1 text-xs bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-lg text-slate-700 dark:text-stone-300 focus:outline-none focus:ring-1 focus:ring-orange-300 tabular-nums"
                      />
                    </div>
                    {/* Sábanas */}
                    <button
                      type="button"
                      onClick={() => updateDetail(worker.fullName, 'sabanasIncluidas', !detail.sabanasIncluidas)}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-normal border transition-all ${
                        detail.sabanasIncluidas
                          ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800'
                          : 'bg-white dark:bg-stone-900 text-slate-400 dark:text-stone-500 border-stone-200 dark:border-stone-700'
                      }`}
                    >
                      <span>🛏</span> Sábanas {detail.sabanasIncluidas ? '✓' : '—'}
                    </button>
                    {/* Toallas */}
                    <button
                      type="button"
                      onClick={() => updateDetail(worker.fullName, 'toallasIncluidas', !detail.toallasIncluidas)}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-normal border transition-all ${
                        detail.toallasIncluidas
                          ? 'bg-teal-50 dark:bg-teal-900/20 text-teal-600 dark:text-teal-400 border-teal-200 dark:border-teal-800'
                          : 'bg-white dark:bg-stone-900 text-slate-400 dark:text-stone-500 border-stone-200 dark:border-stone-700'
                      }`}
                    >
                      <span>🛁</span> Toallas {detail.toallasIncluidas ? '✓' : '—'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Footer */}
        <div className="p-6 border-t border-stone-100 dark:border-stone-800">
          {step === 1 ? (
            <button
              onClick={() => setStep(2)}
              className="w-full py-3 bg-orange-600 text-white rounded-xl text-xs font-medium hover:bg-orange-700 transition-all active:scale-[0.98] flex items-center justify-center gap-2 shadow-lg shadow-orange-600/20"
            >
              <span>Siguiente — {selectedNames.size} seleccionados</span>
            </button>
          ) : (
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="w-full py-3 bg-orange-600 text-white rounded-xl text-xs font-medium hover:bg-orange-700 transition-all active:scale-[0.98] flex items-center justify-center gap-2 shadow-lg shadow-orange-600/20 disabled:opacity-50"
            >
              <Save size={14} />
              <span>Confirmar {selectedNames.size} Trabajadores</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default WorkerSelectionModal;
