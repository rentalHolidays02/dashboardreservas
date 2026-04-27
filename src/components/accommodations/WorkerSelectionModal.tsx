import React, { useState, useMemo } from 'react';
import { X, Search, Users, Check, Save } from 'lucide-react';
import { Worker } from '../../services/mockData';

interface WorkerSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  allWorkers: Worker[];
  currentWorkerNames: string[];
  onSave: (selectedWorkerNames: string[]) => Promise<void>;
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
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedNames, setSelectedNames] = useState<Set<string>>(new Set(currentWorkerNames));
  const [isSaving, setIsSaving] = useState(false);

  // Sync selection when modal opens
  React.useEffect(() => {
    if (isOpen) {
      setSelectedNames(new Set(currentWorkerNames));
      setSearchTerm('');
    }
  }, [isOpen, currentWorkerNames]);

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

  if (!isOpen) return null;

  const toggleWorker = (name: string) => {
    const newSelection = new Set(selectedNames);
    if (newSelection.has(name)) {
      newSelection.delete(name);
    } else {
      newSelection.add(name);
    }
    setSelectedNames(newSelection);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(Array.from(selectedNames));
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
              <div className="p-2 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 rounded-xl">
                <Users size={18} />
              </div>
              <div>
                <h3 className="text-sm font-normal text-slate-800 dark:text-stone-200">Asignar Trabajadores</h3>
                <p className="text-[10px] text-slate-400 dark:text-stone-500 font-light truncate max-w-[200px]">
                  {toTitleCase(accommodationName)}
                </p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-full transition-colors text-slate-400">
              <X size={18} />
            </button>
          </div>

          {/* Search */}
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
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-1 custom-scrollbar">
          {filteredWorkers.map(worker => {
            const isSelected = selectedNames.has(worker.fullName);
            return (
              <button
                key={worker.id}
                onClick={() => toggleWorker(worker.fullName)}
                className={`w-full flex items-center justify-between p-3 rounded-xl transition-all duration-300 ${
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
                    <p className="text-[10px] text-slate-400 dark:text-stone-500 font-light">
                      {worker.telefono}
                    </p>
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

        {/* Action */}
        <div className="p-6 border-t border-stone-100 dark:border-stone-800">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="w-full py-3 bg-orange-600 text-white rounded-xl text-xs font-medium hover:bg-orange-700 transition-all active:scale-[0.98] flex items-center justify-center gap-2 shadow-lg shadow-orange-600/20 disabled:opacity-50"
          >
            <Save size={14} />
            <span>Confirmar {selectedNames.size} Trabajadores</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default WorkerSelectionModal;
