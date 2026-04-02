import React, { useEffect, useState } from 'react';
import { Search, Plus, Filter, Loader2 } from 'lucide-react';
import WorkerCard from '../components/workers/WorkerCard';
import WorkerModal from '../components/workers/WorkerModal';
import { appsScriptApi } from '../services/api';
import { Worker } from '../services/mockData';

const Workers: React.FC = () => {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  const [editingWorker, setEditingWorker] = useState<Worker | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

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
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <Loader2 className="animate-spin text-blue-600" size={40} />
        <p className="text-slate-500 dark:text-stone-400 font-medium">Sincronizando base de trabajadores...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <header className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-stone-100 tracking-tight">Trabajadores</h1>
          <p className="text-slate-500 dark:text-stone-400 mt-1 font-medium">Gestiona y visualiza el rendimiento de tu personal.</p>
        </div>
        <button
          onClick={handleAddClick}
          className="flex items-center justify-center space-x-2 bg-blue-600 text-white px-5 py-2.5 rounded-xl font-bold transition-all hover:bg-blue-700 hover:shadow-lg hover:shadow-blue-600/20 active:scale-95"
        >
          <Plus size={20} />
          <span>Nuevo Trabajador</span>
        </button>
      </header>

      {/* Buscador y Filtros */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1 group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-stone-500 group-focus-within:text-blue-500 transition-colors" size={20} />
          <input
            type="text"
            placeholder="Buscar por nombre..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3.5 bg-white dark:bg-stone-950 border border-slate-200 dark:border-stone-700 rounded-2xl text-slate-900 dark:text-stone-100 placeholder:text-stone-400 dark:placeholder:text-stone-400 focus:outline-none focus:ring-4 focus:ring-blue-100 dark:focus:ring-blue-900/30 focus:border-blue-500 transition-all shadow-sm"
          />
        </div>
        <button className="flex items-center justify-center space-x-2 px-6 py-3.5 bg-white dark:bg-stone-950 border border-slate-200 dark:border-stone-700 rounded-2xl text-slate-700 dark:text-stone-300 font-semibold hover:bg-slate-50 dark:hover:bg-stone-800 hover:border-slate-300 dark:hover:border-stone-600 transition-all active:scale-95 shadow-sm">
          <Filter size={20} className="text-slate-400 dark:text-stone-500" />
          <span>Filtros</span>
        </button>
      </div>

      {/* Grid de Trabajadores */}
      {filteredWorkers.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredWorkers.map(worker => (
            <WorkerCard
              key={worker.id}
              worker={worker}
              onEdit={handleEditClick}
            />
          ))}
        </div>
      ) : (
        <div className="bg-white dark:bg-stone-950 rounded-3xl border border-dashed border-slate-300 dark:border-stone-700 p-12 flex flex-col items-center justify-center space-y-4">
          <div className="w-16 h-16 bg-slate-100 dark:bg-stone-800 rounded-2xl flex items-center justify-center text-slate-400 dark:text-stone-500">
            <Search size={32} />
          </div>
          <div className="text-center">
            <h3 className="font-bold text-slate-900 dark:text-stone-100 text-lg">No se han encontrado resultados</h3>
            <p className="text-slate-500 dark:text-stone-400 mt-1 max-w-xs mx-auto">
              No hay trabajadores que coincidan con la búsqueda "{searchTerm}". Intenta con otros términos.
            </p>
          </div>
        </div>
      )}

      {/* Modal Unificado (Edición/Creación) */}
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
