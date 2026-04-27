import React, { useState, useMemo } from 'react';
import {
  X, Search, MapPin, Home,
  Save, ArrowLeft
} from 'lucide-react';
import { Accommodation, WorkerAccommodationDetails } from '../../services/mockData';
import defaultAccImage from '../../assets/default_accommodation.png';

const toTitleCase = (str: string) =>
  str.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());

interface AccommodationAssignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  allAccommodations: Accommodation[];
  selectedAccommodationDetails: WorkerAccommodationDetails[];
  onSave: (details: WorkerAccommodationDetails[]) => void;
  workerName: string;
}

const AccommodationAssignmentModal: React.FC<AccommodationAssignmentModalProps> = ({
  isOpen,
  onClose,
  allAccommodations,
  selectedAccommodationDetails,
  onSave,
  workerName
}) => {
  const [step, setStep] = useState<1 | 2>(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedNames, setSelectedNames] = useState<Set<string>>(
    new Set(selectedAccommodationDetails.map(d => d.accommodationName))
  );
  const [detailsMap, setDetailsMap] = useState<Map<string, { precio: number; sabanasIncluidas: boolean; toallasIncluidas: boolean }>>(
    new Map(selectedAccommodationDetails.map(d => [d.accommodationName, { precio: d.precio, sabanasIncluidas: d.sabanasIncluidas, toallasIncluidas: d.toallasIncluidas }]))
  );

  // Sync when modal opens
  React.useEffect(() => {
    if (isOpen) {
      setStep(1);
      setSearchTerm('');
      const names = new Set(selectedAccommodationDetails.map(d => d.accommodationName));
      setSelectedNames(names);
      setDetailsMap(new Map(
        selectedAccommodationDetails.map(d => [d.accommodationName, { precio: d.precio, sabanasIncluidas: d.sabanasIncluidas, toallasIncluidas: d.toallasIncluidas }])
      ));
    }
  }, [isOpen, selectedAccommodationDetails]);

  // useMemo must be before any early return (Rules of Hooks)
  const selectedAccommodations = useMemo(
    () => allAccommodations.filter(a => selectedNames.has(a.name)),
    [allAccommodations, selectedNames]
  );

  if (!isOpen) return null;

  const filteredAccommodations = allAccommodations.filter(acc =>
    acc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    acc.city.toLowerCase().includes(searchTerm.toLowerCase()) ||
    acc.address.toLowerCase().includes(searchTerm.toLowerCase())
  ).sort((a, b) => {
    const aSelected = selectedNames.has(a.name);
    const bSelected = selectedNames.has(b.name);
    if (aSelected && !bSelected) return -1;
    if (!aSelected && bSelected) return 1;
    return a.name.localeCompare(b.name);
  });

  const toggleSelection = (name: string) => {
    setSelectedNames(prev => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
        if (!detailsMap.has(name)) {
          setDetailsMap(dm => new Map(dm).set(name, { precio: 0, sabanasIncluidas: false, toallasIncluidas: false }));
        }
      }
      return next;
    });
  };

  const getDetail = (name: string) =>
    detailsMap.get(name) || { precio: 0, sabanasIncluidas: false, toallasIncluidas: false };

  const updateDetail = (name: string, field: 'precio' | 'sabanasIncluidas' | 'toallasIncluidas', value: number | boolean) => {
    setDetailsMap(prev => {
      const next = new Map(prev);
      const current = next.get(name) || { precio: 0, sabanasIncluidas: false, toallasIncluidas: false };
      next.set(name, { ...current, [field]: value });
      return next;
    });
  };

  const handleSave = () => {
    const details: WorkerAccommodationDetails[] = Array.from(selectedNames).map(name => ({
      accommodationName: name,
      ...getDetail(name),
    }));
    onSave(details);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-300">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-white/20 dark:bg-stone-950/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal Content */}
      <div className="relative bg-white dark:bg-stone-900 w-full max-w-xl rounded-3xl overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col max-h-[85vh]">

        {/* Header */}
        <div className="px-8 py-6 border-b border-stone-100 dark:border-stone-800">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              {step === 2 && (
                <button onClick={() => setStep(1)} className="p-1.5 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-lg transition-colors text-slate-400">
                  <ArrowLeft size={16} />
                </button>
              )}
              <div className="w-10 h-10 rounded-xl bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center text-orange-600 dark:text-orange-400">
                <Home size={20} />
              </div>
              <div>
                <h2 className="text-lg font-normal text-slate-800 dark:text-stone-100">
                  {step === 1 ? 'Asignar Alojamientos' : 'Detalles por Alojamiento'}
                </h2>
                <p className="text-[10px] text-slate-400 dark:text-stone-500 tracking-wide mt-0.5 font-light">
                  Operario: {workerName}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-xl text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Step indicator */}
          <div className="flex gap-2 mb-4">
            {[1, 2].map(s => (
              <div key={s} className={`h-1 flex-1 rounded-full transition-colors ${step >= s ? 'bg-orange-500' : 'bg-stone-100 dark:bg-stone-800'}`} />
            ))}
          </div>

          {/* Search (step 1 only) */}
          {step === 1 && (
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-stone-500 pointer-events-none" size={14} />
              <input
                type="text"
                placeholder="Buscar por nombre, dirección o ciudad..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 bg-white/30 dark:bg-stone-900/40 backdrop-blur-md border border-white dark:border-stone-700 rounded-xl text-slate-700 dark:text-stone-300 text-xs font-normal placeholder:text-slate-400 dark:placeholder:text-stone-500 focus:outline-none transition-all hover:bg-white/50 dark:hover:bg-stone-800/60 focus:bg-white/80 dark:focus:bg-stone-900"
              />
            </div>
          )}
        </div>

        {/* Step 1 — Grid selection */}
        {step === 1 && (
          <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
            {filteredAccommodations.length === 0 ? (
              <div className="py-20 flex flex-col items-center justify-center text-slate-300 dark:text-stone-700 gap-3">
                <Search size={40} />
                <p className="text-sm">No se encontraron alojamientos</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
                {filteredAccommodations.map(acc => {
                  const isSelected = selectedNames.has(acc.name);
                  return (
                    <button
                      key={acc.id}
                      onClick={() => toggleSelection(acc.name)}
                      className="group flex flex-col gap-3 text-left transition-all duration-300 active:scale-95 hover:scale-[0.96]"
                    >
                      <div className={`aspect-square w-full rounded-2xl overflow-hidden relative bg-stone-50 dark:bg-stone-800 border-2 transition-all duration-300 ${
                        isSelected ? 'border-orange-500' : 'border-transparent'
                      }`}>
                        <img
                          src={acc.image || defaultAccImage}
                          alt={acc.name}
                          className="w-full h-full object-cover"
                        />
                        {isSelected && <div className="absolute inset-0 bg-orange-500/5" />}
                        <div className="absolute top-2.5 left-2.5 px-2 py-0.5 bg-white/90 dark:bg-stone-900/90 backdrop-blur-md rounded-lg text-[9px] font-medium text-slate-500 dark:text-stone-400 border border-stone-100 dark:border-stone-800 shadow-sm">
                          {acc.ref || 'S/R'}
                        </div>
                      </div>
                      <div className="flex flex-col gap-0.5 px-0.5">
                        <h4 className={`text-xs font-normal truncate transition-colors ${
                          isSelected ? 'text-orange-600 dark:text-orange-400' : 'text-slate-700 dark:text-stone-200'
                        }`}>
                          {toTitleCase(acc.name)}
                        </h4>
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-400 dark:text-stone-500">
                          <MapPin size={10} className={isSelected ? 'text-orange-400' : ''} />
                          <span className="truncate font-light">{toTitleCase(acc.city)}</span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Step 2 — Details per accommodation */}
        {step === 2 && (
          <div className="flex-1 overflow-y-auto p-6 space-y-3 custom-scrollbar">
            {selectedAccommodations.length === 0 && (
              <p className="text-center text-xs text-slate-400 dark:text-stone-500 py-8">No hay alojamientos seleccionados</p>
            )}
            {selectedAccommodations.map(acc => {
              const detail = getDetail(acc.name);
              return (
                <div key={acc.id} className="bg-stone-50 dark:bg-stone-800/50 rounded-xl border border-stone-100 dark:border-stone-800 p-3">
                  {/* Accommodation name */}
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-lg overflow-hidden shrink-0 bg-stone-200 dark:bg-stone-700">
                      <img src={acc.image || defaultAccImage} alt={acc.name} className="w-full h-full object-cover" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-normal text-slate-700 dark:text-stone-200 truncate">{toTitleCase(acc.name)}</p>
                      <p className="text-[10px] text-slate-400 dark:text-stone-500 font-light">{toTitleCase(acc.city)}</p>
                    </div>
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
                        onChange={e => updateDetail(acc.name, 'precio', parseFloat(e.target.value) || 0)}
                        className="w-20 px-2 py-1 text-xs bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-lg text-slate-700 dark:text-stone-300 focus:outline-none focus:ring-1 focus:ring-orange-300 tabular-nums"
                      />
                    </div>
                    {/* Sábanas */}
                    <button
                      type="button"
                      onClick={() => updateDetail(acc.name, 'sabanasIncluidas', !detail.sabanasIncluidas)}
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
                      onClick={() => updateDetail(acc.name, 'toallasIncluidas', !detail.toallasIncluidas)}
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
        <div className="p-6 border-t border-stone-100 dark:border-stone-800 flex items-center justify-between bg-stone-50/50 dark:bg-stone-900/50">
          <div className="text-xs text-slate-400 dark:text-stone-500">
            <span className="font-normal text-orange-600 dark:text-orange-400">{selectedNames.size}</span> seleccionados
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-6 py-2.5 text-xs font-normal text-slate-500 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-xl transition-all"
            >
              Cancelar
            </button>
            {step === 1 ? (
              <button
                onClick={() => setStep(2)}
                className="px-8 py-2.5 bg-orange-600 hover:bg-orange-700 text-white text-xs font-normal rounded-xl transition-all active:scale-95 flex items-center gap-2"
              >
                Siguiente →
              </button>
            ) : (
              <button
                onClick={handleSave}
                className="px-8 py-2.5 bg-orange-600 hover:bg-orange-700 text-white text-xs font-normal rounded-xl transition-all active:scale-95 flex items-center gap-2"
              >
                <Save size={14} />
                Guardar {selectedNames.size}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AccommodationAssignmentModal;
