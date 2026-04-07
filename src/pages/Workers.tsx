import React, { useEffect, useState } from 'react';
import { Search, Plus, Filter, Loader2, Users } from 'lucide-react';
import WorkerCard from '../components/workers/WorkerCard';
import WorkerModal from '../components/workers/WorkerModal';
import WorkerProfile from '../components/workers/WorkerProfile';
import { appsScriptApi } from '../services/api';
import { Worker } from '../services/mockData';

const Workers: React.FC = () => {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  const [editingWorker, setEditingWorker] = useState<Worker | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [profileWorker, setProfileWorker] = useState<Worker | null>(null);
  const [profileEditMode, setProfileEditMode] = useState(false);

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

  const filteredWorkers = workers.filter(worker =>
    worker.fullName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading && workers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4 animate-in fade-in duration-700">
        <Loader2 className="animate-spin text-orange-500" size={32} />
        <p className="text-slate-400 dark:text-stone-500 text-xs font-normal">Sincronizando base de trabajadores...</p>
      </div>
    );
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

      {/* Page header */}
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 px-1">
        <div>
          <h1 className="text-2xl font-semibold text-slate-800 dark:text-stone-100 tracking-tight">Trabajadores</h1>
          <p className="text-xs text-slate-400 dark:text-stone-500 mt-1">
            {workers.length > 0 ? `${workers.length} trabajadores registrados` : 'Gestiona y visualiza el rendimiento de tu personal.'}
          </p>
        </div>
        <button
          onClick={handleAddClick}
          className="flex items-center justify-center gap-2 bg-orange-600 text-white px-5 py-2.5 rounded-xl font-semibold text-sm transition-all hover:bg-orange-700 hover:shadow-lg hover:shadow-orange-600/25 active:scale-95"
        >
          <Plus size={16} />
          <span>Nuevo Trabajador</span>
        </button>
      </header>

      {/* Search and filters */}
      <div className="flex flex-col md:flex-row gap-3 px-1">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-stone-500 pointer-events-none" size={14} />
          <input
            type="text"
            placeholder="Buscar por nombre..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-xl text-slate-700 dark:text-stone-300 text-sm placeholder:text-slate-400 dark:placeholder:text-stone-500 focus:outline-none focus:ring-2 focus:ring-orange-300 dark:focus:ring-orange-800 focus:border-transparent transition-all"
          />
        </div>
        <button className="flex items-center justify-center gap-2 px-4 py-2.5 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-xl text-sm text-slate-600 dark:text-stone-400 font-medium hover:bg-stone-50 dark:hover:bg-stone-800 transition-all active:scale-95">
          <Filter size={14} className="text-slate-400 dark:text-stone-500" />
          <span>Filtros</span>
        </button>
      </div>

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
