import React, { useEffect, useState } from 'react';
import { Search, Plus, Filter, Loader2, Users } from 'lucide-react';
import WorkerCard from '../components/workers/WorkerCard';
import WorkerModal from '../components/workers/WorkerModal';
import WorkerProfile from '../components/workers/WorkerProfile';
import WorkerFilterModal, { WorkerFilters } from '../components/workers/WorkerFilterModal';
import { appsScriptApi } from '../services/api';
import { Worker } from '../services/mockData';
import LoadingSpinner from '../components/ui/LoadingSpinner';

const Workers: React.FC = () => {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  const [editingWorker, setEditingWorker] = useState<Worker | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [profileWorker, setProfileWorker] = useState<Worker | null>(null);
  const [profileEditMode, setProfileEditMode] = useState(false);

  // Filter Modal state
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [filters, setFilters] = useState<WorkerFilters>({
    tipoPago: 'all',
    minCleans: 0,
    maxCleans: 50,
    minKms: 0,
    maxKms: 2000
  });

  const fetchWorkers = async () => {
    try {
      const data = await appsScriptApi.getWorkers();
      setWorkers(data);
    } catch (error) {
      console.error('Error fetching workers:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkers();
  }, []);

  const handleEditClick = (worker: Worker) => {
    setEditingWorker(worker);
    setIsModalOpen(true);
  };

  const handleAddClick = () => {
    setEditingWorker(null);
    setIsModalOpen(true);
  };

  const handleSaveWorker = async (workerData: any) => {
    try {
      if (workerData.id) {
        await appsScriptApi.updateWorker(workerData as Worker);
      } else {
        await appsScriptApi.addWorker(workerData);
      }
      await fetchWorkers();
      // Refresh profileWorker if it's the one being edited
      if (profileWorker && workerData.id === profileWorker.id) {
        const updated = await appsScriptApi.getWorkers();
        const fresh = updated.find(w => w.id === workerData.id);
        if (fresh) setProfileWorker(fresh);
      }
    } catch (error) {
      console.error('Error saving worker:', error);
      throw error;
    }
  };

  const activeFiltersCount = React.useMemo(() => {
    let count = 0;
    if (filters.tipoPago !== 'all') count++;
    if (filters.minCleans > 0 || filters.maxCleans < 50) count++;
    if (filters.minKms > 0 || filters.maxKms < 2000) count++;
    return count;
  }, [filters]);

  const filteredWorkers = workers.filter(worker => {
    const s = searchTerm.toLowerCase();
    const matchSearch = 
      worker.fullName.toLowerCase().includes(s) ||
      (worker.telefono && worker.telefono.toLowerCase().includes(s)) ||
      (worker.email && worker.email.toLowerCase().includes(s)) ||
      (worker.dni && worker.dni.toLowerCase().includes(s));
    const matchTipoPago = filters.tipoPago === 'all' || worker.tipoPago === filters.tipoPago;
    const matchCleans = (worker.cleansCountMonth || 0) >= filters.minCleans && (worker.cleansCountMonth || 0) <= filters.maxCleans;
    const matchKms = (worker.kmsMonth || 0) >= filters.minKms && (worker.kmsMonth || 0) <= filters.maxKms;
    
    return matchSearch && matchTipoPago && matchCleans && matchKms;
  });

  if (loading && workers.length === 0) {
    return <LoadingSpinner message="Sincronizando base de trabajadores..." />;
  }

  // Worker profile view
  if (profileWorker) {
    return (
      <WorkerProfile
        worker={profileWorker}
        onBack={() => { setProfileWorker(null); setProfileEditMode(false); }}
        initialEditing={profileEditMode}
        onSave={async (w) => {
          await handleSaveWorker(w);
          setProfileWorker(w);
        }}
      />
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-700">

      {/* Header & Toolbar unificados */}
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 px-1 mb-2">
        <h1 className="text-xl font-normal text-slate-800 dark:text-stone-200 tracking-tight font-display shrink-0">
          Trabajadores
        </h1>

        <div className="flex flex-col md:flex-row gap-3 justify-end items-center flex-1">
          <div className="relative w-full md:w-72">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-stone-500 pointer-events-none" size={14} />
            <input
              type="text"
              placeholder="Buscar trabajador..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-white/40 dark:bg-stone-900/40 backdrop-blur-md border border-white/60 dark:border-stone-700/50 rounded-xl text-slate-700 dark:text-stone-300 text-xs font-normal placeholder:text-slate-400 dark:placeholder:text-stone-500 focus:outline-none transition-all hover:bg-white/80 dark:hover:bg-stone-800/60 focus:bg-white dark:focus:bg-stone-900"
            />
          </div>
          
          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:flex-none">
              <button 
                onClick={() => setIsFilterModalOpen(true)}
                className={`w-full flex items-center justify-center gap-2 px-6 py-2.5 bg-white dark:bg-stone-900 backdrop-blur-md border border-white/60 dark:border-stone-700/50 rounded-xl text-xs font-normal transition-all active:scale-[0.98] relative ${
                  activeFiltersCount > 0 ? 'text-orange-600 dark:text-orange-400 font-medium bg-white/90 dark:bg-stone-800/90' : 'text-orange-500/80 dark:text-orange-500/70 hover:text-orange-500 dark:hover:text-orange-400 hover:bg-white/80 dark:hover:bg-stone-800/60'
                }`}
              >
                <Filter size={12} className="text-orange-500" />
                <span>Filtro</span>
                {activeFiltersCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-orange-600 text-white text-[10px] flex items-center justify-center rounded-full animate-in zoom-in-50">
                    {activeFiltersCount}
                  </span>
                )}
              </button>

              <WorkerFilterModal 
                isOpen={isFilterModalOpen}
                onClose={() => setIsFilterModalOpen(false)}
                filters={filters}
                onApply={(newFilters) => {
                  setFilters(newFilters);
                }}
              />
            </div>

            <button
              onClick={handleAddClick}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-2.5 bg-orange-600 dark:bg-orange-600/90 hover:bg-orange-700 dark:hover:bg-orange-500 text-white rounded-xl text-xs font-medium transition-all shadow-lg shadow-orange-600/10 active:scale-[0.98]"
            >
              <Plus size={14} />
              <span>Nuevo Trabajador</span>
            </button>
          </div>
        </div>
      </header>

      {/* Results count when searching */}
      {searchTerm && (
        <p className="px-1 text-[11px] text-slate-400 dark:text-stone-500">
          {filteredWorkers.length === 0
            ? 'Sin resultados'
            : `${filteredWorkers.length} resultado${filteredWorkers.length !== 1 ? 's' : ''} para "${searchTerm}"`}
        </p>
      )}

      {/* Workers grid */}
      {filteredWorkers.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredWorkers.map(worker => (
            <div
              key={worker.id}
              onClick={() => setProfileWorker(worker)}
              className="cursor-pointer"
            >
              <WorkerCard
                worker={worker}
                onEdit={(w) => { setProfileWorker(w); setProfileEditMode(true); }}
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white dark:bg-stone-900 border border-stone-100 dark:border-stone-800 rounded-2xl p-12 flex flex-col items-center justify-center gap-4">
          <div className="w-12 h-12 bg-stone-50 dark:bg-stone-800 rounded-xl flex items-center justify-center text-slate-300 dark:text-stone-600">
            <Users size={22} />
          </div>
          <div className="text-center">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-stone-200">
              {searchTerm ? 'Sin resultados' : 'Sin trabajadores'}
            </h3>
            <p className="text-xs text-slate-400 dark:text-stone-500 mt-1 max-w-xs mx-auto">
              {searchTerm
                ? 'No hay trabajadores que coincidan con la búsqueda. Intenta con otros términos.'
                : 'Añade tu primer trabajador con el botón de arriba.'}
            </p>
          </div>
        </div>
      )}

      {/* Modal (edición / creación) */}
      <WorkerModal
        worker={editingWorker}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveWorker}
      />
    </div>
  );
};

export default Workers;
