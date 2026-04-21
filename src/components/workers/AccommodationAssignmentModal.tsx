import React, { useState, useMemo } from 'react';
import { 
  X, Search, MapPin, Check, Home, 
  Building2, Hash, Loader2, Save 
} from 'lucide-react';
import { Accommodation } from '../../services/mockData';
import defaultAccImage from '../../assets/default_accommodation.png';

const toTitleCase = (str: string) =>
  str.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());

interface AccommodationAssignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  allAccommodations: Accommodation[];
  selectedAccommodations: string[]; // List of accommodation names
  onSave: (selectedNames: string[]) => void;
  workerName: string;
}

const AccommodationAssignmentModal: React.FC<AccommodationAssignmentModalProps> = ({
  isOpen,
  onClose,
  allAccommodations,
  selectedAccommodations,
  onSave,
  workerName
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [currentSelection, setCurrentSelection] = useState<Set<string>>(new Set(selectedAccommodations));

  if (!isOpen) return null;

  const filteredAccommodations = allAccommodations.filter(acc => 
    acc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    acc.city.toLowerCase().includes(searchTerm.toLowerCase()) ||
    acc.address.toLowerCase().includes(searchTerm.toLowerCase())
  ).sort((a, b) => {
    const aSelected = currentSelection.has(a.name);
    const bSelected = currentSelection.has(b.name);
    if (aSelected && !bSelected) return -1;
    if (!aSelected && bSelected) return 1;
    return a.name.localeCompare(b.name);
  });

  const toggleSelection = (name: string) => {
    setCurrentSelection(prev => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  };

  const handleSave = () => {
    onSave(Array.from(currentSelection));
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
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center text-orange-600 dark:text-orange-400">
                <Home size={20} />
              </div>
              <div>
                <h2 className="text-lg font-normal text-slate-800 dark:text-stone-100">Asignar Alojamientos</h2>
                <p className="text-[10px] text-slate-400 dark:text-stone-500 tracking-wide mt-0.5 font-light">Operario: {workerName}</p>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-xl text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Search Bar (Matching Cleans Style) */}
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
        </div>

        {/* Selection List (Airbnb Style Grid) */}
        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          {filteredAccommodations.length === 0 ? (
            <div className="py-20 flex flex-col items-center justify-center text-slate-300 dark:text-stone-700 gap-3">
              <Search size={40} />
              <p className="text-sm">No se encontraron alojamientos</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
              {filteredAccommodations.map(acc => {
                const isSelected = currentSelection.has(acc.name);
                return (
                  <button
                    key={acc.id}
                    onClick={() => toggleSelection(acc.name)}
                    className="group flex flex-col gap-3 text-left transition-all duration-300 active:scale-95 hover:scale-[0.96]"
                  >
                    {/* Image Container with Airbnb Style Selection */}
                    <div className={`aspect-square w-full rounded-2xl overflow-hidden relative bg-stone-50 dark:bg-stone-800 border-2 transition-all duration-300 ${
                      isSelected 
                        ? 'border-orange-500' 
                        : 'border-transparent'
                    }`}>
                      <img 
                        src={acc.image || defaultAccImage} 
                        alt={acc.name} 
                        className="w-full h-full object-cover"
                      />
                      {/* Selection Overlay */}
                      {isSelected && (
                        <div className="absolute inset-0 bg-orange-500/5" />
                      )}
                      {/* Reference Badge */}
                      <div className="absolute top-2.5 left-2.5 px-2 py-0.5 bg-white/90 dark:bg-stone-900/90 backdrop-blur-md rounded-lg text-[9px] font-medium text-slate-500 dark:text-stone-400 border border-stone-100 dark:border-stone-800 shadow-sm">
                        {acc.ref || 'S/R'}
                      </div>
                    </div>

                    {/* Meta Info */}
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

        {/* Footer */}
        <div className="p-6 border-t border-stone-100 dark:border-stone-800 flex items-center justify-between bg-stone-50/50 dark:bg-stone-900/50">
          <div className="text-xs text-slate-400 dark:text-stone-500">
            <span className="font-normal text-orange-600 dark:text-orange-400">{currentSelection.size}</span> seleccionados
          </div>
          <div className="flex gap-3">
            <button 
              onClick={onClose}
              className="px-6 py-2.5 text-xs font-normal text-slate-500 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-xl transition-all"
            >
              Cancelar
            </button>
            <button 
              onClick={handleSave}
              className="px-8 py-2.5 bg-orange-600 hover:bg-orange-700 text-white text-xs font-normal rounded-xl transition-all active:scale-95 flex items-center gap-2"
            >
              <Save size={14} />
              Añadir {currentSelection.size}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AccommodationAssignmentModal;
