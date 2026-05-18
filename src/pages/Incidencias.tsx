import React, { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ExternalLink, Banknote, Building2, UserRound, Home, Loader2, Search, Filter, MapPin, CheckCircle2, ChevronRight, X, Info } from 'lucide-react';
import { appsScriptApi, geocodeAddress } from '../services/api';
import { Incidencia } from '../services/mockData';
import IncidentFilterModal, { IncidentFilters } from '../components/incidencias/IncidentFilterModal';
import IncidentEditModal from '../components/incidencias/IncidentEditModal';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { createPortal } from 'react-dom';

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' });

const fmtCost = (n: number) =>
  n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });

const StopsModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  stops: string[];
}> = ({ isOpen, onClose, stops }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const [coords, setCoords] = useState<[number, number][]>([]);
  const [expandedStops, setExpandedStops] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen || stops.length === 0) return;

    setLoading(true);
    
    const parseStop = (stopStr: string) => {
      const coordMatch = stopStr.match(/\[\s*([-\d.]+)\s*,\s*([-\d.]+)\s*\]/);
      const coords: [number, number] | null = coordMatch ? [parseFloat(coordMatch[1]), parseFloat(coordMatch[2])] : null;
      
      // Extract name without (Time) and [Coords] for better geocoding
      let cleanName = stopStr;
      cleanName = cleanName.replace(/\[.*?\]/, '').trim();
      cleanName = cleanName.replace(/\(.*?\)/, '').trim();
      
      return { coords, cleanName };
    };

    const fetchCoords = async () => {
      try {
        const allStops: string[] = [];
        const resolvedCoords: [number, number][] = [];
        
        for (const stop of stops) {
          if (!stop) continue;
          
          // Split by newline in case of multiple stops in one field (like P5)
          const lines = stop.split('\n').map(l => l.trim()).filter(Boolean);
          
          for (const line of lines) {
            allStops.push(line);
            const parsed = parseStop(line);
            
            if (parsed.coords) {
              resolvedCoords.push(parsed.coords);
            } else {
              // Fallback to geocode if no coords in string
              const res = await geocodeAddress(parsed.cleanName);
              if (res) {
                resolvedCoords.push([res.lat, res.lng]);
              }
            }
          }
        }
        
        setExpandedStops(allStops);
        setCoords(resolvedCoords);
      } catch (error) {
        console.error('Error fetching stops coords:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchCoords();
  }, [isOpen, stops]);

  useEffect(() => {
    if (!isOpen || coords.length === 0 || !containerRef.current) return;

    const timer = setTimeout(() => {
      if (!containerRef.current) return;
      
      const map = L.map(containerRef.current, {
        zoomControl: false,
        attributionControl: false,
      });
      L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png').addTo(map);
      mapRef.current = map;

      const markers = coords.map((c, i) => {
        const [lat, lng] = c;
        const popupContent = `
          <div class="text-xs p-1">
            <p class="font-semibold text-slate-800 dark:text-white mb-1">Parada ${i + 1}</p>
            <p class="text-slate-600 dark:text-stone-300 mb-2">${expandedStops[i] || ''}</p>
            <a href="https://www.google.com/maps?q=${lat},${lng}" target="_blank" rel="noopener noreferrer" class="text-orange-500 hover:text-orange-600 font-medium no-underline">Ver en Google Maps</a>
          </div>
        `;
        return L.circleMarker(c, {
          radius: 8,
          color: 'white',
          fillColor: i === 0 ? '#10b981' : i === coords.length - 1 ? '#ef4444' : '#3b82f6',
          fillOpacity: 1,
          weight: 2,
        }).addTo(map).bindPopup(popupContent, { maxWidth: 200 });
      });

      const colors = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4'];
      const polylines: L.Polyline[] = [];
      
      for (let i = 0; i < coords.length - 1; i++) {
        const pl = L.polyline([coords[i], coords[i+1]], { 
          color: colors[i % colors.length], 
          weight: 3, 
          opacity: 0.7 
        }).addTo(map);
        polylines.push(pl);
      }

      const group = L.featureGroup([...markers, ...polylines]);
      map.fitBounds(group.getBounds().pad(0.3));
      
      map.invalidateSize();
    }, 200);

    return () => {
      clearTimeout(timer);
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [isOpen, coords, expandedStops]);

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-700 shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-4 border-b border-stone-100 dark:border-stone-800 flex items-center justify-between">
          <h2 className="text-sm font-medium text-slate-800 dark:text-stone-200">Ruta de Paradas</h2>
          <button onClick={onClose} className="p-2 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-full transition-colors">
            <X size={16} className="text-stone-500" />
          </button>
        </div>
        
        <div className="flex-1 flex flex-col md:flex-row min-h-0 md:h-[500px]">
          <div className="w-full md:w-1/3 p-4 border-b md:border-b-0 md:border-r border-stone-100 dark:border-stone-800 overflow-y-auto">
            <h3 className="text-xs uppercase tracking-wider text-slate-400 dark:text-stone-500 font-medium mb-3">Paradas</h3>
            <ol className="space-y-3">
              {expandedStops.map((stop, i) => (
                <li key={i} className="flex gap-3 text-xs">
                  <div className="flex flex-col items-center">
                    <span className={`w-5 h-5 flex items-center justify-center rounded-full text-[10px] font-bold ${
                      i === 0 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 
                      i === expandedStops.length - 1 ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 
                      'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                    }`}>
                      {i + 1}
                    </span>
                    {i < expandedStops.length - 1 && <div className="w-0.5 h-full bg-stone-200 dark:bg-stone-700 my-1"></div>}
                  </div>
                  <div className="flex-1 pt-0.5">
                    <button 
                      onClick={() => {
                        if (mapRef.current && coords[i]) {
                          mapRef.current.setView(coords[i], 16);
                        }
                      }}
                      className="text-slate-700 dark:text-stone-300 text-left hover:text-orange-500 dark:hover:text-orange-400 transition-colors"
                    >
                      {stop}
                    </button>
                  </div>
                </li>
              ))}
            </ol>
          </div>
          
          <div className="w-full md:w-2/3 h-[400px] md:h-[500px] relative">
            {loading && (
              <div className="absolute inset-0 bg-white/80 dark:bg-stone-900/80 z-10 flex items-center justify-center">
                <div className="flex items-center gap-2 text-xs text-stone-500">
                  <Loader2 size={16} className="animate-spin" />
                  <span>Geolocalizando paradas...</span>
                </div>
              </div>
            )}
            {coords.length === 0 && !loading && (
              <div className="absolute inset-0 bg-stone-50 dark:bg-stone-800 z-10 flex flex-col items-center justify-center text-center p-4">
                <MapPin size={24} className="text-stone-400 mb-2" />
                <p className="text-xs text-stone-500">No se pudieron geolocalizar las paradas.</p>
                <p className="text-[10px] text-stone-400 mt-1">Verifica que las direcciones sean correctas.</p>
              </div>
            )}
            <div ref={containerRef} className="w-full h-full" />
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

// Observation popup modal
const ObservationModal: React.FC<{ isOpen: boolean; anchorRef: React.RefObject<HTMLElement | null>; text: string; title?: string }> = ({ isOpen, anchorRef, text, title = 'Observaciones' }) => {
  const [pos, setPos] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (isOpen && anchorRef.current) {
      const rect = anchorRef.current.getBoundingClientRect();
      const popupW = 240;
      const popupH = 130;
      const left = Math.max(8, Math.min(rect.left, window.innerWidth - popupW - 8));
      const openAbove = rect.bottom + 6 + popupH > window.innerHeight - 8;
      const top = openAbove ? Math.max(8, rect.top - popupH - 6) : rect.bottom + 6;
      setPos({ top, left });
    }
  }, [isOpen]);

  return createPortal(
    <>
      <div
        className={`fixed z-[110] bg-white dark:bg-stone-900 rounded-2xl overflow-hidden border border-stone-200 dark:border-stone-700 shadow-xl transition-opacity duration-200 pointer-events-none ${isOpen ? 'opacity-100' : 'opacity-0'}`}
        style={{ top: pos.top, left: pos.left, width: 240 }}
      >
        {title && (
          <div className="px-4 py-2.5 flex items-center gap-2 border-b border-stone-100 dark:border-stone-800 bg-orange-50 dark:bg-orange-900/20">
            <Info size={13} className="text-orange-500" />
            <span className="text-[11px] font-semibold text-orange-700 dark:text-orange-400">{title}</span>
          </div>
        )}
        <div className="p-3">
          <p className="text-xs text-slate-600 dark:text-stone-300 leading-relaxed">{text}</p>
        </div>
      </div>
    </>,
    document.body
  );
};

// Observation button component
const ObservationButton: React.FC<{ text?: string; modalTitle?: string }> = ({ text, modalTitle = 'Observaciones' }) => {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const hasObs = !!text && text.trim() !== '';

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onMouseEnter={() => hasObs && setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        className={`inline-flex items-center justify-center w-7 h-7 rounded-lg text-xs font-semibold transition-colors ${
          hasObs
            ? 'bg-orange-100 dark:bg-orange-900/40 text-orange-600 dark:text-orange-400 hover:bg-orange-200 dark:hover:bg-orange-900/60 cursor-default'
            : 'bg-stone-100 dark:bg-stone-800 text-slate-400 dark:text-stone-600 cursor-default'
        }`}
      >
        {hasObs ? '1' : '0'}
      </button>
      {hasObs && (
        <ObservationModal isOpen={open} anchorRef={btnRef} text={text!} title={modalTitle} />
      )}
    </>
  );
};

interface IncidenciasProps {
  userRole?: 'admin' | 'editor' | 'viewer' | 'trabajador';
}

const Incidencias: React.FC<IncidenciasProps> = ({ userRole }) => {
  const isReadOnly = userRole === 'viewer';
  const [incidencias, setIncidencias] = useState<Incidencia[]>([]);
  const [isStopsModalOpen, setIsStopsModalOpen] = useState(false);
  const [currentStops, setCurrentStops] = useState<string[]>([]);
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

      <div className="bg-white dark:bg-stone-950 border border-slate-200 dark:border-stone-700/50 rounded-2xl overflow-x-auto">
        {filteredIncidencias.length === 0 ? (
          <div className="px-5 py-12 flex flex-col items-center justify-center gap-2">
            <AlertTriangle size={32} className="text-slate-300 dark:text-stone-700" />
            <p className="text-sm text-slate-400 dark:text-stone-500">No se encontraron incidencias</p>
          </div>
        ) : (
          <table className="min-w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-stone-100 dark:border-stone-800">
                <th className="px-4 py-3 font-normal text-slate-400 dark:text-stone-500 whitespace-nowrap">Teléfono</th>
                <th className="px-4 py-3 font-normal text-slate-400 dark:text-stone-500 whitespace-nowrap">Nombre</th>
                <th className="px-4 py-3 font-normal text-slate-400 dark:text-stone-500 whitespace-nowrap">Apellidos</th>
                <th className="px-4 py-3 font-normal text-slate-400 dark:text-stone-500 whitespace-nowrap">Fecha</th>
                <th className="px-4 py-3 font-normal text-slate-400 dark:text-stone-500 whitespace-nowrap">Apartamento</th>
                <th className="px-4 py-3 font-normal text-slate-400 dark:text-stone-500 whitespace-nowrap">Detalles Incidencia</th>
                <th className="px-4 py-3 font-normal text-slate-400 dark:text-stone-500 whitespace-nowrap">Paradas</th>
                <th className="px-4 py-3 font-normal text-slate-400 dark:text-stone-500 whitespace-nowrap">Kms total</th>
                <th className="px-4 py-3 font-normal text-slate-400 dark:text-stone-500 whitespace-nowrap">Observaciones</th>
                <th className="px-4 py-3 font-normal text-slate-400 dark:text-stone-500 whitespace-nowrap">Checked</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
              {filteredIncidencias.map((inc) => (
                <tr 
                  key={inc.id} 
                  className="hover:bg-stone-100/50 dark:hover:bg-stone-700/30 transition-colors cursor-pointer"
                  onClick={() => {
                    setSelectedIncident(inc);
                    setIsEditModalOpen(true);
                  }}
                >
                  <td className="px-4 py-3 text-slate-700 dark:text-stone-300">{inc.telefono || '—'}</td>
                  <td className="px-4 py-3 text-slate-700 dark:text-stone-300">{inc.nombre || '—'}</td>
                  <td className="px-4 py-3 text-slate-700 dark:text-stone-300">{inc.apellidos || '—'}</td>
                  <td className="px-4 py-3 text-slate-700 dark:text-stone-300 whitespace-nowrap">{fmtDate(inc.timestamp)}</td>
                  <td className="px-4 py-3 text-slate-700 dark:text-stone-300">
                    <Link
                      to={`/alojamientos/${inc.accommodationId}`}
                      className="inline-flex items-center gap-1.5 hover:text-blue-600 transition-colors"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {inc.accommodationName}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-700 dark:text-stone-300 max-w-xs truncate" title={inc.description}>{inc.description}</td>
                  <td className="px-4 py-3 text-slate-700 dark:text-stone-300">
                    {[inc.paradaInicial, inc.paradaOpcional1, inc.paradaOpcional2, inc.paradaOpcional3, inc.paradaOpcional4, inc.paradaOpcional5, inc.paradaFinal].filter(Boolean).length > 0 ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setCurrentStops([inc.paradaInicial, inc.paradaOpcional1, inc.paradaOpcional2, inc.paradaOpcional3, inc.paradaOpcional4, inc.paradaOpcional5, inc.paradaFinal].filter(Boolean) as string[]);
                          setIsStopsModalOpen(true);
                        }}
                        className="text-orange-500 hover:text-orange-600 font-medium"
                      >
                        Ver paradas
                      </button>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-700 dark:text-stone-300 whitespace-nowrap">{inc.kms !== undefined ? `${Number(inc.kms).toFixed(2).replace('.', ',')} km` : '—'}</td>
                  <td className="px-4 py-3 text-slate-700 dark:text-stone-300">
                    <ObservationButton text={inc.observaciones} />
                  </td>
                  <td className="px-4 py-3 text-slate-700 dark:text-stone-300">
                    {inc.checked ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-1.5 py-0.5 rounded-md">
                        <CheckCircle2 size={10} />
                        Revisada
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-stone-400 dark:text-stone-500 bg-stone-50 dark:bg-stone-900/20 px-1.5 py-0.5 rounded-md">
                        Pendiente
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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

      <StopsModal 
        isOpen={isStopsModalOpen}
        onClose={() => setIsStopsModalOpen(false)}
        stops={currentStops}
      />
    </div>
  );
};

export default Incidencias;
