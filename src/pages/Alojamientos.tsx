import React, { useEffect, useState } from 'react';
import { Search, Plus, Filter, Loader2, Home } from 'lucide-react';
import AccommodationCard from '../components/accommodations/AccommodationCard';
import AccommodationModal from '../components/accommodations/AccommodationModal';
import AccommodationFilterModal, { AccommodationFilters } from '../components/accommodations/AccommodationFilterModal';
import { appsScriptApi } from '../services/api';
import { Accommodation, Worker } from '../services/mockData';
import LoadingSpinner from '../components/ui/LoadingSpinner';

const Alojamientos: React.FC = () => {
  const [accommodations, setAccommodations] = useState<Accommodation[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  const [editingAccommodation, setEditingAccommodation] = useState<Accommodation | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Filter Modal state
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [filters, setFilters] = useState<AccommodationFilters>({
    city: 'all',
    status: 'all'
  });

  const fetchAccommodations = async () => {
    try {
      const [accData, workerData] = await Promise.all([
        appsScriptApi.getAccommodations(),
        appsScriptApi.getWorkers()
      ]);
      setAccommodations(accData);
      setWorkers(workerData);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccommodations();
  }, []);

  const handleEditClick = (accommodation: Accommodation) => {
    setEditingAccommodation(accommodation);
    setIsModalOpen(true);
  };

  const handleAddClick = () => {
    setEditingAccommodation(null);
    setIsModalOpen(true);
  };

  const handleSaveAccommodation = async (accommodationData: any) => {
    try {
      if (accommodationData.id) {
        await appsScriptApi.updateAccommodation(accommodationData as Accommodation);
      } else {
        await appsScriptApi.addAccommodation(accommodationData);
      }
      await fetchAccommodations();
    } catch (error) {
      console.error('Error saving accommodation:', error);
      throw error;
    }
  };

  const availableCities = React.useMemo(() => {
    const cities = accommodations
      .map(acc => acc.city.trim())
      .filter(city => city !== '');
    return Array.from(new Set(cities)).sort();
  }, [accommodations]);

  const activeFiltersCount = React.useMemo(() => {
    let count = 0;
    if (filters.city !== 'all') count++;
    if (filters.status !== 'all') count++;
    return count;
  }, [filters]);

  const filteredAccommodations = accommodations.filter(acc => {
    const s = searchTerm.toLowerCase();
    const matchSearch = 
      acc.name.toLowerCase().includes(s) ||
      acc.address.toLowerCase().includes(s) ||
      acc.city.toLowerCase().includes(s);
    
    const matchCity = filters.city === 'all' || 
      acc.city.trim().toLowerCase() === filters.city.trim().toLowerCase();
    const matchStatus = filters.status === 'all' || 
      (filters.status === 'active' ? acc.active : !acc.active);
    
    return matchSearch && matchCity && matchStatus;
  });

  if (loading && accommodations.length === 0) {
    return <LoadingSpinner message="Sincronizando base de alojamientos..." />;
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-700">

      {/* Header & Toolbar unificados */}
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 px-1 mb-2">
        <h1 className="text-xl font-normal text-slate-800 dark:text-stone-200 tracking-tight font-display shrink-0">
          Alojamientos
        </h1>

        <div className="flex flex-col md:flex-row gap-3 justify-end items-center flex-1">
          <div className="relative w-full md:w-72">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-stone-500 pointer-events-none" size={14} />
            <input
              type="text"
              placeholder="Buscar alojamiento..."
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

              <AccommodationFilterModal 
                isOpen={isFilterModalOpen}
                onClose={() => setIsFilterModalOpen(false)}
                filters={filters}
                availableCities={availableCities}
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
              <span>Nuevo Alojamiento</span>
            </button>
          </div>
        </div>
      </header>

      {/* Results count when searching */}
      {searchTerm && (
        <p className="px-1 text-[11px] text-slate-400 dark:text-stone-500">
          {filteredAccommodations.length === 0
            ? 'Sin resultados'
            : `${filteredAccommodations.length} resultado${filteredAccommodations.length !== 1 ? 's' : ''} para "${searchTerm}"`}
        </p>
      )}

      {/* Accommodations grid */}
      {filteredAccommodations.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAccommodations.map(acc => {
            const assignedCount = workers.filter(w => w.accommodations?.includes(acc.name)).length;
            return (
              <div
                key={acc.id}
                onClick={() => handleEditClick(acc)}
                className="cursor-pointer"
              >
                <AccommodationCard
                  accommodation={acc}
                  assignedWorkersCount={assignedCount}
                  onEdit={handleEditClick}
                />
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white dark:bg-stone-900 border border-stone-100 dark:border-stone-800 rounded-2xl p-12 flex flex-col items-center justify-center gap-4">
          <div className="w-12 h-12 bg-stone-50 dark:bg-stone-800 rounded-xl flex items-center justify-center text-slate-300 dark:text-stone-600">
            <Home size={22} />
          </div>
          <div className="text-center">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-stone-200">
              {searchTerm ? 'Sin resultados' : 'Sin alojamientos'}
            </h3>
            <p className="text-xs text-slate-400 dark:text-stone-500 mt-1 max-w-xs mx-auto">
              {searchTerm
                ? 'No hay alojamientos que coincidan con la búsqueda. Intenta con otros términos.'
                : 'Añade tu primer alojamiento con el botón de arriba.'}
            </p>
          </div>
        </div>
      )}

      {/* Modal (edición / creación) */}
      <AccommodationModal
        accommodation={editingAccommodation}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveAccommodation}
      />
    </div>
  );
};

export default Alojamientos;
