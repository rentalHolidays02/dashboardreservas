import React, { useEffect, useState } from 'react';
import { Search, Plus, Filter, Loader2, Home, RefreshCw, LayoutGrid, List, Users, ArrowUpDown, ChevronUp, ChevronDown } from 'lucide-react';
import AccommodationCard from '../components/accommodations/AccommodationCard';
import AccommodationModal from '../components/accommodations/AccommodationModal';
import AccommodationDetailModal from '../components/accommodations/AccommodationDetailModal';
import WorkerSelectionModal, { WorkerAssignmentDetail } from '../components/accommodations/WorkerSelectionModal';
import AccommodationFilterModal, { AccommodationFilters } from '../components/accommodations/AccommodationFilterModal';
import { appsScriptApi } from '../services/api';
import { Accommodation, Worker } from '../services/mockData';
import AccommodationSortModal, { AccommodationSortConfig } from '../components/accommodations/AccommodationSortModal';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { useUndoToast } from '../context/UndoToastContext';

interface AlojamientosProps {
  userRole?: 'admin' | 'editor' | 'viewer' | 'trabajador';
}

const Alojamientos: React.FC<AlojamientosProps> = ({ userRole }) => {
  const isReadOnly = userRole === 'viewer';
  const { showUndoToast } = useUndoToast();
  const [accommodations, setAccommodations] = useState<Accommodation[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  const [editingAccommodation, setEditingAccommodation] = useState<Accommodation | null>(null);
  const [viewingAccommodation, setViewingAccommodation] = useState<Accommodation | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isWorkerModalOpen, setIsWorkerModalOpen] = useState(false);

  const [isSyncing, setIsSyncing] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'table'>(
    () => (localStorage.getItem('accommodations_viewMode') as 'grid' | 'table') || 'grid'
  );
  const [isSortModalOpen, setIsSortModalOpen] = useState(false);
  const [sortConfig, setSortConfig] = useState<AccommodationSortConfig>({ field: 'name', direction: 'asc' });

  const handleSetViewMode = (mode: 'grid' | 'table') => {
    setViewMode(mode);
    localStorage.setItem('accommodations_viewMode', mode);
  };

  const handleRequestSort = (field: AccommodationSortConfig['field']) => {
    const isAsc = sortConfig.field === field && sortConfig.direction === 'asc';
    setSortConfig({
      field,
      direction: isAsc ? 'desc' : 'asc',
    });
  };

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      await appsScriptApi.syncAccommodationsFromSheets();
      await fetchAccommodations();
    } catch (error) {
      console.error('Error sincronizando:', error);
    } finally {
      setIsSyncing(false);
    }
  };

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

  const handleViewClick = (accommodation: Accommodation) => {
    setViewingAccommodation(accommodation);
    setIsViewModalOpen(true);
  };

  const handleSaveWorkersForAccommodation = async (assignmentDetails: WorkerAssignmentDetail[]) => {
    if (!viewingAccommodation) return;

    try {
      const accName = viewingAccommodation.name;
      const assignedNames = new Set(assignmentDetails.map(d => d.workerName));

      const workersToUpdate = workers.map(worker => {
        const isCurrentlyAssigned = worker.accommodations?.includes(accName);
        const shouldBeAssigned = assignedNames.has(worker.fullName);
        const detail = assignmentDetails.find(d => d.workerName === worker.fullName);

        if (isCurrentlyAssigned && !shouldBeAssigned) {
          // Eliminar asignación
          const newDetails = (worker.accommodationDetails || []).filter(d => d.accommodationName !== accName);
          return {
            ...worker,
            accommodationDetails: newDetails,
            accommodations: newDetails.map(d => d.accommodationName),
          };
        } else if (shouldBeAssigned && detail) {
          // Añadir o actualizar asignación con detalles
          const filtered = (worker.accommodationDetails || []).filter(d => d.accommodationName !== accName);
          const newDetails = [...filtered, {
            accommodationName: accName,
            precio: detail.precio,
            sabanasIncluidas: detail.sabanasIncluidas,
            toallasIncluidas: detail.toallasIncluidas,
          }];
          return {
            ...worker,
            accommodationDetails: newDetails,
            accommodations: newDetails.map(d => d.accommodationName),
          };
        }
        return null;
      }).filter((w): w is Worker => w !== null);

      await Promise.all(workersToUpdate.map(w => appsScriptApi.updateWorker(w)));

      const updatedWorkers = workers.map(w => {
        const update = workersToUpdate.find(up => up.id === w.id);
        return update || w;
      });
      setWorkers(updatedWorkers);
    } catch (error) {
      console.error('Error saving workers for accommodation:', error);
    }
  };

  const handleAddClick = () => {
    setEditingAccommodation(null);
    setIsModalOpen(true);
  };

  const handleSaveAccommodation = async (accommodationData: any) => {
    try {
      if (accommodationData.id) {
        // Edición
        const updated = await appsScriptApi.updateAccommodation(accommodationData as Accommodation);
        setAccommodations(prev =>
          prev.map(a => a.id === updated.id ? updated : a)
        );
      } else {
        // Creación
        const created = await appsScriptApi.addAccommodation(accommodationData);
        setAccommodations(prev => [created, ...prev]);
      }
    } catch (error: any) {
      console.error('Error saving accommodation:', error);
      // Podríamos mostrar un error visual aquí si tuviéramos un context de notificaciones
      throw error;
    }
  };

  const handleDeleteAccommodation = async (id: string) => {
    const accommodationToDelete = accommodations.find(a => a.id === id);
    if (!accommodationToDelete) return;

    try {
      await appsScriptApi.deleteAccommodation(id);
      
      setAccommodations(prev => prev.filter(a => a.id !== id));
      setIsModalOpen(false);
      setEditingAccommodation(null);

      showUndoToast({
        message: `Alojamiento "${accommodationToDelete.name}" eliminado`,
        onUndo: async () => {
          try {
            await appsScriptApi.restoreAccommodation(accommodationToDelete);
            setAccommodations(prev => [accommodationToDelete, ...prev].sort((a, b) => a.name.localeCompare(b.name)));
          } catch (error) {
            console.error('Error deshaciendo eliminación:', error);
          }
        }
      });
    } catch (error) {
      console.error('Error eliminando alojamiento:', error);
    }
  };

  const availableCities = React.useMemo(() => {
    const cities = accommodations
      .map(acc => (acc.city || '').trim())
      .filter(city => city !== '');
    return Array.from(new Set(cities)).sort();
  }, [accommodations]);

  const activeFiltersCount = React.useMemo(() => {
    let count = 0;
    if (filters.city !== 'all') count++;
    if (filters.status !== 'all') count++;
    return count;
  }, [filters]);

  const filteredAccommodations = React.useMemo(() => {
    return accommodations
      .filter(acc => {
        const s = searchTerm.toLowerCase();
        const name = (acc.name || '').toLowerCase();
        const address = (acc.address || '').toLowerCase();
        const city = (acc.city || '').toLowerCase();

        const matchSearch = 
          name.includes(s) ||
          address.includes(s) ||
          city.includes(s);
        
        const matchCity = filters.city === 'all' || 
          (acc.city || '').trim().toLowerCase() === filters.city.trim().toLowerCase();
        const matchStatus = filters.status === 'all' || 
          (filters.status === 'active' ? acc.active : !acc.active);
        
        return matchSearch && matchCity && matchStatus;
      })
      .sort((a, b) => {
        let valA: string, valB: string;
        switch (sortConfig.field) {
          case 'ref':
            valA = a.ref || '';
            valB = b.ref || '';
            break;
          case 'city':
            valA = a.city || '';
            valB = b.city || '';
            break;
          case 'address':
            valA = a.address || '';
            valB = b.address || '';
            break;
          case 'workers': {
            const countA = workers.filter(w => w.accommodations?.includes(a.name)).length;
            const countB = workers.filter(w => w.accommodations?.includes(b.name)).length;
            return sortConfig.direction === 'asc' ? countA - countB : countB - countA;
          }
          default:
            valA = a.name || '';
            valB = b.name || '';
        }

        const cmp = valA.localeCompare(valB, undefined, { numeric: true, sensitivity: 'base' });
        return sortConfig.direction === 'asc' ? cmp : -cmp;
      });
  }, [accommodations, searchTerm, filters, sortConfig]);

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
            <div className="relative">
              <button 
                onClick={() => setIsSortModalOpen(true)}
                className="flex items-center justify-center gap-2 px-6 py-2.5 bg-white dark:bg-stone-900 backdrop-blur-md border border-white/60 dark:border-stone-700/50 rounded-xl text-xs font-normal text-slate-600 dark:text-stone-400 transition-all active:scale-[0.98] hover:bg-white/80 dark:hover:bg-stone-800/60"
              >
                <ArrowUpDown size={12} className="text-orange-500" />
                <span>Ordenar</span>
              </button>

              <AccommodationSortModal 
                isOpen={isSortModalOpen}
                onClose={() => setIsSortModalOpen(false)}
                sortConfig={sortConfig}
                onApply={(newSort) => setSortConfig(newSort)}
              />
            </div>

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

            {/* View mode toggle */}
            <div className="flex items-center bg-white dark:bg-stone-900 border border-white/60 dark:border-stone-700/50 rounded-xl p-1 gap-0.5">
              <button
                onClick={() => handleSetViewMode('grid')}
                title="Vista en cuadrícula"
                className={`p-1.5 rounded-lg transition-all ${
                  viewMode === 'grid'
                    ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400'
                    : 'text-slate-400 dark:text-stone-500 hover:text-slate-600 dark:hover:text-stone-300'
                }`}
              >
                <LayoutGrid size={14} />
              </button>
              <button
                onClick={() => handleSetViewMode('table')}
                title="Vista en lista"
                className={`p-1.5 rounded-lg transition-all ${
                  viewMode === 'table'
                    ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400'
                    : 'text-slate-400 dark:text-stone-500 hover:text-slate-600 dark:hover:text-stone-300'
                }`}
              >
                <List size={14} />
              </button>
            </div>

            {!isReadOnly && (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSync}
                  disabled={isSyncing || loading}
                  title="Sincronizar desde Excel"
                  className="flex items-center justify-center p-2.5 bg-white dark:bg-stone-900 border border-white/60 dark:border-stone-700/50 rounded-xl text-orange-500 hover:text-orange-600 transition-all active:scale-95 disabled:opacity-50"
                >
                  <RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} />
                </button>

                <button
                  onClick={handleAddClick}
                  className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-2.5 bg-orange-600 dark:bg-orange-600/90 hover:bg-orange-700 dark:hover:bg-orange-500 text-white rounded-xl text-xs font-medium transition-all shadow-lg shadow-orange-600/10 active:scale-[0.98]"
                >
                  <Plus size={14} />
                  <span>Nuevo Alojamiento</span>
                </button>
              </div>
            )}
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

      {/* Accommodations — grid or table */}
      {filteredAccommodations.length > 0 ? (
        viewMode === 'grid' ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-x-6 gap-y-10 p-1">
            {filteredAccommodations.map(acc => {
              const assignedCount = workers.filter(w => w.accommodations?.includes(acc.name)).length;
              return (
                <div
                  key={acc.id}
                  onClick={() => handleViewClick(acc)}
                  className="cursor-pointer"
                >
                  <AccommodationCard
                    accommodation={acc}
                    assignedWorkersCount={assignedCount}
                    onEdit={handleEditClick}
                    isReadOnly={isReadOnly}
                  />
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-white dark:bg-stone-950 border border-slate-200 dark:border-stone-700/50 rounded-2xl overflow-hidden">
            {/* Table header */}
            <div className="hidden md:grid grid-cols-[3rem_2fr_1fr_1fr_2fr_1fr_1fr] gap-4 px-5 py-3 border-b border-stone-100 dark:border-stone-800">
              <span />
              <button 
                onClick={() => handleRequestSort('name')}
                className="flex items-center gap-2 text-[10px] font-medium text-slate-400 dark:text-stone-500 uppercase tracking-wider hover:text-orange-500 transition-colors"
              >
                Alojamiento
                {sortConfig.field === 'name' && (
                  sortConfig.direction === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />
                )}
              </button>
              <button 
                onClick={() => handleRequestSort('ref')}
                className="flex items-center gap-2 text-[10px] font-medium text-slate-400 dark:text-stone-500 uppercase tracking-wider hover:text-orange-500 transition-colors"
              >
                Ref.
                {sortConfig.field === 'ref' && (
                  sortConfig.direction === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />
                )}
              </button>
              <button 
                onClick={() => handleRequestSort('city')}
                className="flex items-center gap-2 text-[10px] font-medium text-slate-400 dark:text-stone-500 uppercase tracking-wider hover:text-orange-500 transition-colors"
              >
                Ciudad
                {sortConfig.field === 'city' && (
                  sortConfig.direction === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />
                )}
              </button>
              <button 
                onClick={() => handleRequestSort('address')}
                className="flex items-center gap-2 text-[10px] font-medium text-slate-400 dark:text-stone-500 uppercase tracking-wider hover:text-orange-500 transition-colors"
              >
                Dirección
                {sortConfig.field === 'address' && (
                  sortConfig.direction === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />
                )}
              </button>
              <button 
                onClick={() => handleRequestSort('workers')}
                className="flex items-center gap-2 text-[10px] font-medium text-slate-400 dark:text-stone-500 uppercase tracking-wider hover:text-orange-500 transition-colors"
              >
                Operarios
                {sortConfig.field === 'workers' && (
                  sortConfig.direction === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />
                )}
              </button>
              <span className="text-[10px] font-medium text-slate-400 dark:text-stone-500 uppercase tracking-wider">Estado</span>
            </div>
            <ul className="divide-y divide-stone-100 dark:divide-stone-800">
              {filteredAccommodations.map(acc => {
                const assignedCount = workers.filter(w => w.accommodations?.includes(acc.name)).length;
                const toTC = (s: string) => s.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
                return (
                  <li
                    key={acc.id}
                    onClick={() => handleViewClick(acc)}
                    className={`px-5 py-3.5 hover:bg-stone-50/70 dark:hover:bg-stone-700/30 transition-colors cursor-pointer group ${
                      !acc.active ? 'opacity-50' : ''
                    }`}
                  >
                    {/* Mobile: stacked */}
                    <div className="flex items-center gap-3 md:hidden">
                      <div className="w-10 h-10 rounded-xl overflow-hidden flex-shrink-0 bg-stone-100 dark:bg-stone-800">
                        <img
                          src={acc.image || '/default_accommodation.png'}
                          alt={acc.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-normal text-slate-800 dark:text-stone-100 truncate">{toTC(acc.name)}</p>
                        <p className="text-[11px] text-slate-400 dark:text-stone-500 truncate">{toTC(acc.city)} • {acc.ref || 'S/R'}</p>
                      </div>
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md ${
                        acc.active
                          ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400'
                          : 'bg-stone-100 text-stone-500 dark:bg-stone-800 dark:text-stone-400'
                      }`}>{acc.active ? 'Activo' : 'Inactivo'}</span>
                    </div>

                    {/* Desktop: grid row */}
                    <div className="hidden md:grid grid-cols-[3rem_2fr_1fr_1fr_2fr_1fr_1fr] gap-4 items-center">
                      {/* Miniatura */}
                      <div className="w-10 h-10 rounded-xl overflow-hidden flex-shrink-0 bg-stone-100 dark:bg-stone-800">
                        <img
                          src={acc.image || '/default_accommodation.png'}
                          alt={acc.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      {/* Nombre */}
                      <p className="text-sm font-normal text-slate-800 dark:text-stone-100 truncate group-hover:text-orange-600 transition-colors">{toTC(acc.name)}</p>
                      {/* Ref */}
                      <span className="text-xs text-slate-500 dark:text-stone-400">{acc.ref || '—'}</span>
                      {/* Ciudad */}
                      <span className="text-xs text-slate-500 dark:text-stone-400 truncate">{toTC(acc.city) || '—'}</span>
                      {/* Dirección */}
                      <span className="text-xs text-slate-400 dark:text-stone-500 truncate">{toTC(acc.address) || '—'}</span>
                      {/* Operarios */}
                      <span className="text-xs text-slate-500 dark:text-stone-400 flex items-center gap-1">
                        <Users size={11} className="text-orange-400 flex-shrink-0" />
                        {assignedCount}
                      </span>
                      {/* Estado */}
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md w-fit ${
                        acc.active
                          ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400'
                          : 'bg-stone-100 text-stone-500 dark:bg-stone-800 dark:text-stone-400'
                      }`}>{acc.active ? 'Activo' : 'Inactivo'}</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )
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

      <AccommodationModal
        accommodation={editingAccommodation}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveAccommodation}
        onDelete={handleDeleteAccommodation}
        isReadOnly={isReadOnly}
      />

      {/* Modal de visualización (Airbnb Style) */}
      <AccommodationDetailModal
        accommodation={viewingAccommodation}
        isOpen={isViewModalOpen}
        onClose={() => setIsViewModalOpen(false)}
        assignedWorkers={workers.filter(w => viewingAccommodation && w.accommodations?.includes(viewingAccommodation.name))}
        onManageWorkers={() => setIsWorkerModalOpen(true)}
        isReadOnly={isReadOnly}
      />

      {/* Modal de selección de trabajadores (Asignación Inversa) */}
      <WorkerSelectionModal
        isOpen={isWorkerModalOpen}
        onClose={() => setIsWorkerModalOpen(false)}
        allWorkers={workers}
        currentWorkerNames={workers
          .filter(w => viewingAccommodation && w.accommodations?.includes(viewingAccommodation.name))
          .map(w => w.fullName)
        }
        onSave={handleSaveWorkersForAccommodation}
        accommodationName={viewingAccommodation?.name || ''}
      />
    </div>
  );
};

export default Alojamientos;
