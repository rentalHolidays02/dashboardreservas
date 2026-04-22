import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ExternalLink, Banknote, Building2, UserRound, Home, Loader2, Search, Filter, MapPin, CheckCircle2, ChevronRight } from 'lucide-react';
import { appsScriptApi } from '../services/api';
import { Incidencia } from '../services/mockData';
import IncidentFilterModal, { IncidentFilters } from '../components/incidencias/IncidentFilterModal';
import IncidentEditModal from '../components/incidencias/IncidentEditModal';
import LoadingSpinner from '../components/ui/LoadingSpinner';

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' });

const fmtCost = (n: number) =>
  n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });

interface IncidenciasProps {
  userRole?: 'admin' | 'viewer' | 'trabajador';
}

const Incidencias: React.FC<IncidenciasProps> = ({ userRole }) => {
  const isReadOnly = userRole === 'viewer';
  const [incidencias, setIncidencias] = useState<Incidencia[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Filter Modal state
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [filters, setFilters] = useState<IncidentFilters>({
    startDate: '',
    endDate: '',
    paidBy: 'all',
    minCost: 0,
    maxCost: 1000
  });

  // Edit Modal state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedIncident, setSelectedIncident] = useState<Incidencia | null>(null);

  useEffect(() => {
    fetchIncidencias();
  }, []);

  const fetchIncidencias = (showGlobalLoading = true) => {
    if (showGlobalLoading) setLoading(true);
    appsScriptApi.getRecentIncidencias(50).then(data => {
      setIncidencias(data);
      setLoading(false);
    });
  };

  const handleSaveIncident = async (incidentData: Incidencia) => {
    // 1. Actualización optimista en local
    setIncidencias(prev => prev.map(inc => 
      inc.id === incidentData.id ? incidentData : inc
    ));
    
    // 2. Guardar en el Excel por detrás
    try {
      await appsScriptApi.updateIncidencia(incidentData);
      // 3. Recargar silenciosamente para confirmar
      fetchIncidencias(false);
    } catch (error) {
      console.error('Error al guardar:', error);
      alert('Error al sincronizar con el Excel, pero los cambios se ven en pantalla.');
      fetchIncidencias(false);
    }
  };

  const handleDeleteIncident = async (id: string) => {
    // Actualización optimista
    setIncidencias(prev => prev.filter(inc => inc.id !== id));
    
    try {
      await appsScriptApi.deleteIncidencia(id);
      fetchIncidencias(false); // Confirmación silenciosa
    } catch (error) {
      console.error('Error al borrar:', error);
      alert('Error al borrar en el Excel.');
      fetchIncidencias(false);
    }
  };

  const activeFiltersCount = React.useMemo(() => {
    let count = 0;
    if (filters.startDate || filters.endDate) count++;
    if (filters.paidBy !== 'all') count++;
    if (filters.minCost > 0 || filters.maxCost < 1000) count++;
    return count;
  }, [filters]);

  const filteredIncidencias = React.useMemo(() => {
    return incidencias.filter(inc => {
      const s = searchTerm.trim().toLowerCase();
      
      // Si hay búsqueda, comprobar si coincide en alguno de los campos
      if (s) {
        const matchSearch = 
          inc.userName.toLowerCase().includes(s) ||
          inc.accommodationName.toLowerCase().includes(s) ||
          inc.description.toLowerCase().includes(s);
        
        if (!matchSearch) return false;
      }

      // Filter matching
      if (filters.paidBy !== 'all' && inc.pagadoPor !== filters.paidBy) return false;
      if (inc.coste < filters.minCost || inc.coste > filters.maxCost) return false;
      
      const incDate = inc.timestamp.split('T')[0];
      if (filters.startDate && incDate < filters.startDate) return false;
      if (filters.endDate && incDate > filters.endDate) return false;

      return true;
    });
  }, [incidencias, searchTerm, filters]);

  if (loading) {
    return <LoadingSpinner message="Cargando incidencias..." />;
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-700">
      
      {/* Header & Toolbar unificados */}
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 px-1 mb-2">
        <h1 className="text-xl font-normal text-slate-800 dark:text-stone-200 tracking-tight font-display shrink-0">
          Incidencias
        </h1>

        <div className="flex flex-col md:flex-row gap-3 justify-end items-center flex-1">
          <div className="relative w-full md:w-72">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-stone-500 pointer-events-none" size={14} />
            <input
              type="text"
              placeholder="Buscar trabajador o apto..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-white/40 dark:bg-stone-900/40 backdrop-blur-md border border-white/60 dark:border-stone-700/50 rounded-xl text-slate-700 dark:text-stone-300 text-xs font-normal placeholder:text-slate-400 dark:placeholder:text-stone-500 focus:outline-none transition-all hover:bg-white/80 dark:hover:bg-stone-800/60 focus:bg-white dark:focus:bg-stone-900"
            />
          </div>
          
          <div className="relative">
            <button 
              onClick={() => setIsFilterModalOpen(true)}
              className={`flex items-center justify-center gap-2 px-6 py-2.5 bg-white dark:bg-stone-900 backdrop-blur-md border border-white/60 dark:border-stone-700/50 rounded-xl text-xs font-normal transition-all active:scale-[0.98] relative ${
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

            <IncidentFilterModal 
              isOpen={isFilterModalOpen}
              onClose={() => setIsFilterModalOpen(false)}
              filters={filters}
              onApply={(newFilters) => {
                setFilters(newFilters);
              }}
            />
          </div>
        </div>
      </header>

      <div className="bg-white dark:bg-stone-950 border border-slate-200 dark:border-stone-700/50 rounded-2xl overflow-hidden">
        {filteredIncidencias.length === 0 ? (
          <div className="px-5 py-12 flex flex-col items-center justify-center gap-2">
            <AlertTriangle size={32} className="text-slate-300 dark:text-stone-700" />
            <p className="text-sm text-slate-400 dark:text-stone-500">No se encontraron incidencias</p>
          </div>
        ) : (
          <ul className="divide-y divide-stone-100 dark:divide-stone-800">
            {filteredIncidencias.map((inc) => (
              <li 
                key={inc.id} 
                className="px-5 py-4 hover:bg-stone-100/50 dark:hover:bg-stone-700/30 transition-colors cursor-pointer group relative"
                onClick={() => {
                  setSelectedIncident(inc);
                  setIsEditModalOpen(true);
                }}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs text-slate-400 dark:text-stone-500">{inc.userName}</span>
                  <div className="flex items-center gap-2">
                    {inc.checked && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-1.5 py-0.5 rounded-md">
                        <CheckCircle2 size={10} />
                        Revisada
                      </span>
                    )}
                    <span className="text-xs text-slate-400 dark:text-stone-500 tabular-nums">{fmtDate(inc.timestamp)}</span>
                  </div>
                </div>

                <p className="text-sm font-normal text-slate-800 dark:text-stone-200 leading-snug mb-3">
                  {inc.description.charAt(0).toUpperCase() + inc.description.slice(1)}
                </p>

                <div className="flex items-center justify-between gap-2">
                  <Link
                    to={`/alojamientos/${inc.accommodationId}`}
                    className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-stone-400 border border-slate-200 dark:border-stone-700 rounded-md px-2 py-1 hover:text-blue-600 hover:border-blue-200 dark:hover:border-blue-700 transition-colors shrink-0"
                  >
                    <Home size={10} className="text-slate-400 dark:text-stone-500" />
                    {inc.accommodationName}
                    <ExternalLink size={9} className="text-slate-300 dark:text-stone-600" />
                  </Link>

                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 text-xs font-normal text-slate-700 dark:text-stone-300">
                      <Banknote size={12} className="text-slate-400 dark:text-stone-500" />
                      {fmtCost(inc.coste)}
                    </span>
                    {inc.pagadoPor === 'limpiador' ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-white bg-orange-500 dark:bg-orange-600 rounded-md px-1.5 py-0.5 border-none">
                        <UserRound size={10} />
                        Limpiador
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950 border border-orange-100 dark:border-orange-900/50 rounded-md px-1.5 py-0.5">
                        <Building2 size={10} />
                        Empresa
                      </span>
                    )}
                    
                    {inc.kms !== undefined ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-1.5 py-0.5 border border-blue-100 dark:border-blue-900/30 rounded-md">
                        <MapPin size={10} />
                        {Number(inc.kms).toFixed(2).replace('.', ',')} km
                      </span>
                    ) : null}
                    
                    <ChevronRight size={14} className="text-slate-300 dark:text-stone-600 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <IncidentEditModal 
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        incident={selectedIncident}
        onSave={handleSaveIncident}
        onDelete={handleDeleteIncident}
        isReadOnly={isReadOnly}
      />
    </div>
  );
};

export default Incidencias;
