import React, { useEffect, useState } from 'react';
import { Search, Plus, Filter, Users, LayoutGrid, List, Phone, MapPin, AlertTriangle, Edit2 } from 'lucide-react';
import WorkerCard from '../components/workers/WorkerCard';
import WorkerModal from '../components/workers/WorkerModal';
import WorkerProfile from '../components/workers/WorkerProfile';
import WorkerFilterModal, { WorkerFilters } from '../components/workers/WorkerFilterModal';
import { appsScriptApi, activityLogApi } from '../services/api';
import { Worker, User } from '../services/mockData';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { useUndoToast } from '../context/UndoToastContext';

interface WorkersProps {
  user: User;
  userRole?: User['role'];
}

const Workers: React.FC<WorkersProps> = ({ user, userRole }) => {
  const isReadOnly = userRole === 'viewer';
  const { showUndoToast } = useUndoToast();
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [accommodations, setAccommodations] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  const [editingWorker, setEditingWorker] = useState<Worker | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [profileWorker, setProfileWorker] = useState<Worker | null>(null);
  const [profileEditMode, setProfileEditMode] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'table'>(
    () => (localStorage.getItem('workers_viewMode') as 'grid' | 'table') || 'grid'
  );

  const handleSetViewMode = (mode: 'grid' | 'table') => {
    setViewMode(mode);
    localStorage.setItem('workers_viewMode', mode);
  };

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
    // Carga desde Supabase (fuente única tras migración desde Apps Script).
    fetchWorkers();

    // Cargar nombres de alojamientos
    appsScriptApi.getAccommodations().then(accs => {
      setAccommodations(accs.map(a => a.name).sort());
    }).catch(console.error);
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
      // 1. Detectar y auto-registrar nuevos alojamientos
      const workerAccs = workerData.accommodations || [];
      const newAccs = workerAccs.filter((name: string) => !accommodations.includes(name));

      if (newAccs.length > 0) {
        console.log('Detectados nuevos alojamientos para registrar:', newAccs);
        // Registramos cada uno en el Excel de Alojamientos
        await Promise.all(newAccs.map((accName: string) => 
          appsScriptApi.addAccommodation({
            name: accName,
            active: true,
            address: '',
            city: '',
            zipCode: '',
            notes: 'Registrado automáticamente desde Operarios',
            ref: ''
          })
        ));
        
        // Actualizamos la lista local de sugerencias
        setAccommodations(prev => [...prev, ...newAccs].sort());
      }

      // 2. Guardar los datos del operario
      const isNew = !workerData.id || workerData.id.startsWith('temp_');
      if (!isNew) {
        await appsScriptApi.updateWorker(workerData as Worker);
        await activityLogApi.log(
          user.id || null,
          user.name || 'Usuario',
          `Modificó los datos del trabajador "${workerData.fullName}"`,
          'editar_trabajador'
        );
      } else {
        await appsScriptApi.addWorker(workerData);
        await activityLogApi.log(
          user.id || null,
          user.name || 'Usuario',
          `Creó el trabajador "${workerData.fullName}" en el sistema`,
          'crear_trabajador'
        );
      }
      
      // Solo recargamos la lista completa una vez
      await fetchWorkers();
    } catch (error) {
      console.error('Error saving worker:', error);
      throw error;
    }
  };

  const handleDeleteWorker = async (id: string) => {
    const workerToDelete = workers.find(w => w.id === id);
    if (!workerToDelete) return;

    setWorkers(prev => prev.filter(w => w.id !== id));
    if (profileWorker && profileWorker.id === id) setProfileWorker(null);

    try {
      await appsScriptApi.deleteWorker(id);
      await activityLogApi.log(
        user.id || null,
        user.name || 'Usuario',
        `Movió al trabajador "${workerToDelete.fullName}" a la papelera`,
        'eliminar_trabajador'
      );
    } catch (error) {
      console.error('Error soft-deleting worker:', error);
      await fetchWorkers();
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
  }).sort((a, b) => (b.owedMoney || 0) - (a.owedMoney || 0));

  if (loading && workers.length === 0) {
    return <LoadingSpinner message="Sincronizando base de trabajadores..." />;
  }

  // Worker profile view
  if (profileWorker) {
    return (
      <WorkerProfile
        worker={profileWorker}
        userRole={userRole}
        onBack={() => { setProfileWorker(null); setProfileEditMode(false); }}
        initialEditing={profileEditMode}
        onSave={async (w) => {
          await handleSaveWorker(w);
          setProfileWorker(w);
        }}
        onDelete={handleDeleteWorker}
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
              <button
                onClick={handleAddClick}
                className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-2.5 bg-orange-600 dark:bg-orange-600/90 hover:bg-orange-700 dark:hover:bg-orange-500 text-white rounded-xl text-xs font-medium transition-all shadow-lg shadow-orange-600/10 active:scale-[0.98]"
              >
                <Plus size={14} />
                <span>Nuevo Trabajador</span>
              </button>
            )}
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

      {/* Workers — grid or table */}
      {filteredWorkers.length > 0 ? (
        viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredWorkers.map(worker => (
              <div
                key={worker.id}
                onClick={() => setProfileWorker(worker)}
                className="cursor-pointer"
              >
                <WorkerCard
                  worker={worker}
                  onEdit={isReadOnly ? undefined : (w) => { setProfileWorker(w); setProfileEditMode(true); }}
                  isReadOnly={isReadOnly}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white dark:bg-stone-950 border border-slate-200 dark:border-stone-700/50 rounded-2xl overflow-hidden">
            {/* Table header */}
            <div className="hidden md:grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_2rem] gap-4 px-5 py-3 border-b border-stone-100 dark:border-stone-800">
              <span className="text-[10px] font-medium text-slate-400 dark:text-stone-500 uppercase tracking-wider">Trabajador</span>
              <span className="text-[10px] font-medium text-slate-400 dark:text-stone-500 uppercase tracking-wider">Tipo</span>
              <span className="text-[10px] font-medium text-slate-400 dark:text-stone-500 uppercase tracking-wider">Teléfono</span>
              <span className="text-[10px] font-medium text-slate-400 dark:text-stone-500 uppercase tracking-wider">Pago</span>
              <span className="text-[10px] font-medium text-slate-400 dark:text-stone-500 uppercase tracking-wider text-right">Por cobrar</span>
              <span className="text-[10px] font-medium text-slate-400 dark:text-stone-500 uppercase tracking-wider">Alojamientos</span>
              <span />
            </div>
            <ul className="divide-y divide-stone-100 dark:divide-stone-800">
              {filteredWorkers.map(worker => {
                const initials = worker.fullName.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
                const toTC = (s: string) => s.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
                return (
                  <li
                    key={worker.id}
                    onClick={() => setProfileWorker(worker)}
                    className="px-5 py-3.5 hover:bg-stone-50/70 dark:hover:bg-stone-700/30 transition-colors cursor-pointer group"
                  >
                    {/* Mobile: stacked */}
                    <div className="flex items-center justify-between md:hidden gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-xl flex-shrink-0 overflow-hidden">
                          {worker.photo
                            ? <img src={worker.photo} alt={worker.fullName} className="w-full h-full object-cover" />
                            : <span className="w-full h-full flex items-center justify-center text-xs font-semibold bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300">{initials}</span>
                          }
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-normal text-slate-800 dark:text-stone-100 truncate">{toTC(worker.fullName)}</p>
                          <p className="text-[11px] text-slate-400 dark:text-stone-500">{worker.telefono || '—'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-sm font-semibold text-orange-600 dark:text-orange-400 tabular-nums whitespace-nowrap">
                          {(worker.owedMoney ?? 0).toLocaleString('es-ES', { maximumFractionDigits: 0 })}€
                        </span>
                        {!isReadOnly && (
                          <button
                            onClick={(e) => { e.stopPropagation(); setProfileWorker(worker); setProfileEditMode(true); }}
                            className="p-1.5 rounded-lg text-slate-300 dark:text-stone-600 hover:text-orange-500 dark:hover:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-all active:scale-90"
                          >
                            <Edit2 size={13} />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Desktop: grid row */}
                    <div className="hidden md:grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_2rem] gap-4 items-center">
                      {/* Nombre */}
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-xl flex-shrink-0 overflow-hidden">
                          {worker.photo
                            ? <img src={worker.photo} alt={worker.fullName} className="w-full h-full object-cover" />
                            : <span className="w-full h-full flex items-center justify-center text-xs font-semibold bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300">{initials}</span>
                          }
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-sm font-normal text-slate-800 dark:text-stone-100 truncate">{toTC(worker.fullName)}</p>
                            {!worker.profileId && <AlertTriangle size={11} className="text-amber-500 flex-shrink-0" />}
                          </div>
                        </div>
                      </div>
                      {/* Tipo */}
                      <span className={`self-start mt-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-md border w-fit ${
                        worker.tipoTrabajador === 'Manitas'
                          ? 'bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-900/30 dark:border-blue-800/50'
                          : 'bg-slate-50 text-slate-500 border-slate-200 dark:bg-stone-800 dark:text-stone-400 dark:border-stone-700'
                      }`}>{worker.tipoTrabajador || 'Limpiador'}</span>
                      {/* Teléfono */}
                      <span className="text-xs text-slate-500 dark:text-stone-400 flex items-center gap-1">
                        <Phone size={10} className="text-orange-400 flex-shrink-0" />
                        {worker.telefono || '—'}
                      </span>
                      {/* Pago */}
                      <div>
                        <p className="text-xs font-medium text-slate-700 dark:text-stone-200">{worker.tipoPago ? ({ bizum: 'Bizum', tarjeta: 'Tarjeta', efectivo: 'Efectivo' }[worker.tipoPago] ?? '—') : '—'}</p>
                        {worker.pagoPorReserva != null && (
                          <p className="text-[10px] text-slate-400 dark:text-stone-500">{worker.pagoPorReserva}€/res.</p>
                        )}
                      </div>
                      {/* Por cobrar */}
                      <span className="text-sm font-semibold text-orange-600 dark:text-orange-400 tabular-nums text-right">
                        {(worker.owedMoney ?? 0).toLocaleString('es-ES', { maximumFractionDigits: 0 })}€
                      </span>
                      {/* Alojamientos */}
                      {worker.accommodations && worker.accommodations.length > 0 ? (
                        <span className="text-[11px] text-slate-400 dark:text-stone-500 flex items-center gap-1 truncate">
                          <MapPin size={10} className="text-slate-300 dark:text-stone-600 flex-shrink-0" />
                          <span className="truncate">
                            {worker.accommodations.slice(0, 2).join(', ')}
                            {worker.accommodations.length > 2 && <span className="text-slate-300 dark:text-stone-600 ml-1">+{worker.accommodations.length - 2}</span>}
                          </span>
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-300 dark:text-stone-600">—</span>
                      )}
                      {/* Editar */}
                      {!isReadOnly ? (
                        <button
                          onClick={(e) => { e.stopPropagation(); setProfileWorker(worker); setProfileEditMode(true); }}
                          className="p-1.5 rounded-lg text-slate-300 dark:text-stone-600 hover:text-orange-500 dark:hover:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-all opacity-0 group-hover:opacity-100 active:scale-90"
                        >
                          <Edit2 size={13} />
                        </button>
                      ) : <span />}
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
        onDelete={handleDeleteWorker}
        existingWorkers={workers}
        allAccommodations={accommodations}
      />
    </div>
  );
};

export default Workers;
