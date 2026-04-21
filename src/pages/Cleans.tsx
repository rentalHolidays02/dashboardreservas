
import React, { useState, useEffect, useMemo, useRef, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  ClipboardList,
  Sparkles,
  Wrench,
  Loader2,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  Filter,
  Info,
  Key,
  KeyRound,
  User,
  MessageSquare,
  Check,
  RotateCcw,
} from 'lucide-react';
import { appsScriptApi, getDistanceMeters, parseCoords, geocodeAddress } from '../services/api';
import { NormalCleanRecord, InitialCleanRecord, HandymanRecord, Worker, Accommodation } from '../services/mockData';
import { matchesWorkerByPhone } from '../utils/payments';
import { formatName } from '../utils/formatters';
import CleanFilterModal, { CleanFilters } from '../components/cleans/CleanFilterModal';
import LoadingSpinner from '../components/ui/LoadingSpinner';

type TabType = 'normal' | 'initial' | 'handyman';

// Helper to normalize strings for comparison keys
const normalizeKey = (s: string) => s.trim().toLowerCase();

// Helper to find accommodation coords with fuzzy matching
const findAccommodationCoords = (aptName: string, geoData: Record<string, { lat: number, lng: number }>): { lat: number; lng: number } | undefined => {
  const normalizedName = normalizeKey(aptName);
  // Exact match first
  if (geoData[normalizedName]) return geoData[normalizedName];
  // Fuzzy match: try to find partial match
  for (const key of Object.keys(geoData)) {
    if (key.includes(normalizedName) || normalizedName.includes(key)) {
      return geoData[key];
    }
  }
  return undefined;
};

// Clean address for OSM (c/ -> Calle, n- -> empty, etc)
const cleanAddressForSearch = (addr: string) => {
  return addr
    .replace(/\bc\/\b/gi, 'Calle ')
    .replace(/\bn-\b/gi, '')
    .replace(/\snº\s/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

const Cleans: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('normal');
  const [loading, setLoading] = useState(true);
  const [normalCleans, setNormalCleans] = useState<NormalCleanRecord[]>([]);
  const [initialCleans, setInitialCleans] = useState<InitialCleanRecord[]>([]);
  const [handymanRecords, setHandymanRecords] = useState<HandymanRecord[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [accommodations, setAccommodations] = useState<Accommodation[]>([]);
  const [geoData, setGeoData] = useState<Record<string, { lat: number, lng: number }>>({});
  const [searchTerm, setSearchTerm] = useState('');

  // Filter Modal state
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [filters, setFilters] = useState<CleanFilters>({
    startDate: '',
    endDate: '',
    apartment: '',
    status: 'all'
  });

  const [lastAction, setLastAction] = useState<{ 
    id: string; 
    type: TabType; 
    wasChecked: boolean;
  } | null>(null);

  const photoMap = useMemo(() => {
    const map: Record<string, string> = {};
    workers.forEach(w => { if (w.photo) map[w.fullName] = w.photo; });
    return map;
  }, [workers]);


  useEffect(() => {
    appsScriptApi.getWorkers().then(setWorkers);
    appsScriptApi.getAccommodations().then(accs => {
      setAccommodations(accs);
      // Trigger geocoding for each unique address
      accs.forEach(async (acc) => {
        const cleanedStreet = cleanAddressForSearch(acc.address);
        const fullAddress = `${cleanedStreet}, ${acc.zipCode} ${acc.city}, ${acc.provincia || ''}, Spain`;
        
        const coords = await geocodeAddress(fullAddress);
        if (coords) {
          setGeoData(prev => ({ ...prev, [normalizeKey(acc.name)]: coords }));
        }
      });
    });

    const fetchAllData = async () => {
      setLoading(true);
      try {
        const [nc, ic, hm] = await Promise.all([
          appsScriptApi.getNormalCleans(),
          appsScriptApi.getInitialCleans(),
          appsScriptApi.getHandymanRecords()
        ]);
        setNormalCleans(nc);
        setInitialCleans(ic);
        setHandymanRecords(hm);
      } catch (error) {
        console.error('Error fetching cleans data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchAllData();
  }, []);

  const handleUndo = async () => {
    if (!lastAction) return;
    const { id, type, wasChecked } = lastAction;
    
    try {
      if (type === 'normal') {
        setNormalCleans(prev => prev.map(r => r.id === id ? { ...r, checked: wasChecked } : r));
      } else if (type === 'initial') {
        setInitialCleans(prev => prev.map(r => r.id === id ? { ...r, checked: wasChecked } : r));
      } else if (type === 'handyman') {
        setHandymanRecords(prev => prev.map(r => r.id === id ? { ...r, estadoCompletado: wasChecked ? 'Completado' : 'Pendiente' } : r));
      }
      
      await appsScriptApi.updateCleanStatus(type, id, wasChecked);
      setLastAction(null);
    } catch (error) {
      console.error('Error undoing status:', error);
    }
  };

  // Timer to clear last action after 8 seconds
  useEffect(() => {
    if (lastAction) {
      const timer = setTimeout(() => setLastAction(null), 8000);
      return () => clearTimeout(timer);
    }
  }, [lastAction]);

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filters.startDate || filters.endDate) count++;
    if (filters.apartment) count++;
    if (filters.status !== 'all') count++;
    return count;
  }, [filters]);

  const applyFilters = (record: NormalCleanRecord | InitialCleanRecord | HandymanRecord) => {
    const s = searchTerm.toLowerCase();
    
    // Search matching
    let fullName = '';
    let telefono = '';
    let apt = '';
    let fecha = '';
    let checked = false;

    if ('nombre' in record) {
      fullName = `${record.nombre || ''} ${record.apellidos || ''}`.toLowerCase();
      telefono = String(record.telefono || '').toLowerCase();
      apt = String(('apartamento' in record ? record.apartamento : (record as any).alojamiento) || '').toLowerCase();
      fecha = 'checkinFecha' in record ? record.checkinFecha : (record as HandymanRecord).fechaLlegada;
      checked = 'checked' in record ? record.checked : (record as HandymanRecord).estadoCompletado === 'Completado';
    }

    const matchSearch = 
      fullName.includes(s) || 
      telefono.includes(s) || 
      apt.includes(s);

    if (!matchSearch) return false;

    // Filter matching
    if (filters.apartment && !apt.includes(filters.apartment.toLowerCase())) return false;
    
    if (filters.status === 'verified' && !checked) return false;
    if (filters.status === 'unverified' && checked) return false;

    if (filters.startDate && fecha < filters.startDate) return false;
    if (filters.endDate && fecha > filters.endDate) return false;

    return true;
  };

  const filteredNormal = useMemo(() => normalCleans.filter(applyFilters), [normalCleans, searchTerm, filters]);
  const filteredInitial = useMemo(() => initialCleans.filter(applyFilters), [initialCleans, searchTerm, filters]);
  const filteredHandyman = useMemo(() => handymanRecords.filter(applyFilters), [handymanRecords, searchTerm, filters]);

  const tabs = [
    { id: 'normal', label: 'Limpieza Normal', icon: <ClipboardList size={18} /> },
    { id: 'initial', label: 'Limpieza Inicial', icon: <Sparkles size={18} /> },
    { id: 'handyman', label: 'Manitas', icon: <Wrench size={18} /> },
  ] as const;

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header & Toolbar unificados */}
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 px-1 mb-2">
        <h1 className="text-xl font-normal text-slate-800 dark:text-stone-200 tracking-tight font-display shrink-0">
          Registros de Limpieza
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

            <CleanFilterModal 
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

      {/* Tab Navigation */}
      <div className="flex items-center gap-6 border-b border-stone-200 dark:border-stone-800 w-full animate-in fade-in slide-in-from-left-4 duration-700 mb-6">
        {tabs.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabType)}
              className={`flex items-center gap-2 py-3 px-1 text-xs transition-colors border-b-2 -mb-px font-medium ${
                active 
                  ? 'border-orange-500 text-orange-600 dark:text-orange-500' 
                  : 'border-transparent text-slate-400 dark:text-stone-500 hover:text-slate-600 dark:hover:text-stone-300'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Content Area */}
      <div className="bg-white/60 dark:bg-stone-950 backdrop-blur-md border border-white dark:border-stone-800 rounded-2xl overflow-x-auto relative">
        {activeTab === 'normal' && (
          <TableNormalCleans 
            data={filteredNormal} 
            photoMap={photoMap} 
            geoData={geoData}
            workers={workers}
            onUpdate={(id, checked) => {
              const old = normalCleans.find(r => r.id === id);
              if (old) setLastAction({ id, type: 'normal', wasChecked: old.checked });
              setNormalCleans(prev => prev.map(r => r.id === id ? { ...r, checked } : r));
              appsScriptApi.updateCleanStatus('normal', id, checked);
            }} 
          />
        )}
        {activeTab === 'initial' && (
          <TableInitialCleans 
            data={filteredInitial} 
            photoMap={photoMap} 
            geoData={geoData}
            workers={workers}
            onUpdate={(id, checked) => {
              const old = initialCleans.find(r => r.id === id);
              if (old) setLastAction({ id, type: 'initial', wasChecked: old.checked });
              setInitialCleans(prev => prev.map(r => r.id === id ? { ...r, checked } : r));
              appsScriptApi.updateCleanStatus('initial', id, checked);
            }} 
          />
        )}
        {activeTab === 'handyman' && (
          <TableHandyman 
            data={filteredHandyman} 
            photoMap={photoMap} 
            geoData={geoData}
            workers={workers}
            onUpdate={(id, checked) => {
              const old = handymanRecords.find(r => r.id === id);
              if (old) setLastAction({ id, type: 'handyman', wasChecked: old.estadoCompletado === 'Completado' });
              setHandymanRecords(prev => prev.map(r => r.id === id ? { ...r, estadoCompletado: checked ? 'Completado' : 'Pendiente' } : r));
              appsScriptApi.updateCleanStatus('handyman', id, checked);
            }} 
          />
        )}
      </div>

      {/* Undo Notification */}
      {lastAction && (
        <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-right-4 duration-300">
          <button
            onClick={handleUndo}
            className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 dark:bg-stone-800 text-white rounded-full shadow-2xl border border-white/10 hover:bg-slate-800 dark:hover:bg-stone-700 transition-all group"
          >
            <RotateCcw size={14} className="group-hover:rotate-[-45deg] transition-transform" />
            <span className="text-xs font-medium">Revertir cambio de estado</span>
          </button>
        </div>
      )}
    </div>
  );
};


// Verification cell component with green/red buttons
const VerificationCell = React.forwardRef<HTMLElement, { verified: boolean; onClick: (ev: React.MouseEvent<HTMLElement>) => void }>(
  ({ verified, onClick }, ref) => (
    <button
      ref={ref as any}
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-medium transition ${verified
        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/70 dark:text-emerald-200 hover:bg-emerald-200 dark:hover:bg-emerald-900'
        : 'bg-red-100 text-red-700 dark:bg-red-900/70 dark:text-red-200 hover:bg-red-200 dark:hover:bg-red-900'}`}
    >
      {verified ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
      <span>{verified ? 'Verificado' : 'No Verificado'}</span>
    </button>
  )
);

// Radio de verificación en metros
const VERIFICATION_RADIUS_METERS = 80;

// Mini map using leaflet directly (no react-leaflet)
const MiniMap: React.FC<{ target?: [number, number]; markers?: [number, number][] }> = ({ target, markers }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current || !target) return;

    const map = L.map(containerRef.current, {
      center: target,
      zoom: 17,
      zoomControl: false,
      attributionControl: false,
      dragging: true,
      touchZoom: true,
      doubleClickZoom: true,
      scrollWheelZoom: true,
      boxZoom: true,
      keyboard: true,
    });
    mapRef.current = map;

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png').addTo(map);

    // Círculo de verificación - centro en el apartamento
    L.circle(target, {
      radius: VERIFICATION_RADIUS_METERS,
      color: '#f97316',
      fillColor: '#f97316',
      fillOpacity: 0.15,
      opacity: 0.6,
      weight: 2,
    }).addTo(map);

    // Marcador del apartamento (centro del círculo)
    L.circleMarker(target, {
      radius: 8,
      color: 'white',
      fillColor: '#f97316',
      fillOpacity: 1,
      weight: 3,
    }).addTo(map).bindPopup('Apartamento');

    // Marcadores del trabajador (checkin/checkout)
    markers?.forEach((m, i) => {
      const userIcon = L.divIcon({
        className: '',
        html: `<div style="width:14px;height:14px;border-radius:50%;background:${i === 0 ? '#10b981' : '#3b82f6'};border:2.5px solid white;box-shadow:0 0 0 1px rgba(0,0,0,0.1);"></div>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      });
      L.marker(m, { icon: userIcon }).addTo(map).bindPopup(i === 0 ? 'Entrada' : 'Salida');
    });

    // Ajustar el zoom para mostrar todos los puntos
    if (markers && markers.length > 0) {
      const group = L.featureGroup([
        L.marker(target),
        ...markers.map(m => L.marker(m))
      ]);
      map.fitBounds(group.getBounds().pad(0.3));
    }

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [target, markers]);

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />;
};

// Location verification modal component
const LocationVerificationModal: React.FC<{ 
  isOpen: boolean; 
  onClose: () => void; 
  anchorRef: HTMLElement | null;
  targetCoords?: [number, number];
  userCoords?: [number, number][];
}> = ({ isOpen, onClose, anchorRef, targetCoords, userCoords }) => {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [show, setShow] = useState(false);

  useLayoutEffect(() => {
    if (isOpen && anchorRef) {
      const rect = anchorRef.getBoundingClientRect();
      const popupW = 280;
      const left = Math.min(rect.left, window.innerWidth - popupW - 8);
      setPos({ top: rect.bottom + 6, left });
      setTimeout(() => setShow(true), 100);
    } else {
      setShow(false);
      setPos(null);
    }
  }, [isOpen, anchorRef]);

  return createPortal(
    <>
      <div
        className={`fixed inset-0 z-[105] transition-opacity duration-200 ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />
      <div
        className={`fixed z-[110] bg-white dark:bg-stone-900 rounded-2xl overflow-hidden border border-stone-200 dark:border-stone-700 shadow-xl ${
          isOpen && pos ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        style={{ top: pos?.top ?? 0, left: pos?.left ?? 0, width: 280, height: 240 }}
      >
        {show && targetCoords && (
          <div className="w-full h-full relative">
            <MiniMap target={targetCoords} markers={userCoords} />
            <div className="absolute top-2 right-2 flex flex-col gap-1.5 z-[1000]">
               <div className="flex items-center gap-1.5 bg-white/90 dark:bg-stone-900/90 px-2 py-1 rounded-md border border-stone-100 dark:border-stone-800 text-[10px] font-medium shadow-sm">
                  <div className="w-2 h-2 rounded-full bg-[#f97316]" />
                  <span>Apt.</span>
               </div>
               <div className="flex items-center gap-1.5 bg-white/90 dark:bg-stone-900/90 px-2 py-1 rounded-md border border-stone-100 dark:border-stone-800 text-[10px] font-medium shadow-sm">
                  <div className="w-2 h-2 rounded-full bg-[#10b981]" />
                  <span>Entrada</span>
               </div>
               <div className="flex items-center gap-1.5 bg-white/90 dark:bg-stone-900/90 px-2 py-1 rounded-md border border-stone-100 dark:border-stone-800 text-[10px] font-medium shadow-sm">
                  <div className="w-2 h-2 rounded-full bg-[#3b82f6]" />
                  <span>Salida</span>
               </div>
            </div>
          </div>
        )}
        {!targetCoords && isOpen && (
          <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center gap-2">
            <XCircle size={24} className="text-red-400" />
            <p className="text-xs text-slate-500 font-medium">Ubicación del apartamento no encontrada</p>
          </div>
        )}
      </div>
    </>,
    document.body
  );
};

// Parses "HH:MM" or "YYYY-MM-DD HH:MM" and returns total minutes from midnight
const toMinutes = (time: string): number => {
  const part = time.includes(' ') ? time.split(' ')[1] : time;
  const [h, m] = part.split(':').map(Number);
  return h * 60 + m;
};

const formatTime = (time: string): string => {
  if (!time) return '';
  const part = time.includes(' ') ? time.split(' ')[1] : time;
  const parts = part.split(':');
  if (parts.length >= 2) {
    return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
  }
  return part;
};

const diffMinutes = (a: string, b: string): number =>
  Math.abs(toMinutes(a) - toMinutes(b));

// Date verification popup
interface DateVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  anchorRef: HTMLElement | null;
  appEntry: string;   // from checkinFecha
  appExit: string;    // from checkoutFecha
  userEntry: string;  // horaEntrada
  userExit: string;   // horaSalida
  onVerify?: () => void;
  isVerified?: boolean;
}

const DateVerificationModal: React.FC<DateVerificationModalProps> = ({
  isOpen, onClose, anchorRef, appEntry, appExit, userEntry, userExit, onVerify, isVerified
}) => {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    if (isOpen && anchorRef) {
      const rect = anchorRef.getBoundingClientRect();
      const popupW = 240;
      const left = Math.min(rect.left, window.innerWidth - popupW - 8);
      setPos({ top: rect.bottom + 6, left });
    } else {
      setPos(null);
    }
  }, [isOpen, anchorRef]);

  const entryDiff = diffMinutes(appEntry, userEntry);
  const exitDiff = diffMinutes(appExit, userExit);
  const entryOk = entryDiff <= 30;
  const exitOk = exitDiff <= 30;
  const allOk = entryOk && exitOk;

  const Row: React.FC<{ label: string; app: string; user: string; ok: boolean; diff: number }> = ({ label, app, user, ok, diff }) => {
    const appTime = app.includes(' ') ? app.split(' ')[1] : app;
    return (
      <div className="space-y-1.5">
        <p className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-stone-500 font-medium">{label}</p>
        <div className="flex items-center gap-2">
          {/* App value */}
          <div className="flex-1 bg-slate-50 dark:bg-stone-800 rounded-lg px-2.5 py-1.5">
            <p className="text-[9px] text-slate-400 dark:text-stone-500 mb-0.5">App</p>
            <p className="text-xs font-semibold text-slate-700 dark:text-stone-200 tabular-nums">{formatTime(appTime)}</p>
          </div>
          {/* Diff badge */}
          <div className={`flex flex-col items-center px-1.5 py-1 rounded-lg text-[9px] font-bold tabular-nums ${ok ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400' : 'bg-red-50 dark:bg-red-900/30 text-red-500 dark:text-red-400'}`}>
            <span>{ok ? '✓' : '✗'}</span>
            <span>{diff}m</span>
          </div>
          {/* User value */}
          <div className="flex-1 bg-slate-50 dark:bg-stone-800 rounded-lg px-2.5 py-1.5">
            <p className="text-[9px] text-slate-400 dark:text-stone-500 mb-0.5">Usuario</p>
            <p className={`text-xs font-semibold tabular-nums ${ok ? 'text-slate-700 dark:text-stone-200' : 'text-red-500 dark:text-red-400'}`}>{formatTime(user)}</p>
          </div>
        </div>
      </div>
    );
  };

  return createPortal(
    <>
      <div
        className={`fixed inset-0 z-[105] transition-opacity duration-200 ${isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />
      <div
        className={`fixed z-[110] bg-white dark:bg-stone-900 rounded-2xl overflow-hidden border border-stone-200 dark:border-stone-700 shadow-xl ${isOpen && pos ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        style={{ top: pos?.top ?? 0, left: pos?.left ?? 0, width: 240 }}
      >
        {/* Header */}
        <div className={`px-4 py-2.5 flex items-center gap-2 border-b border-stone-100 dark:border-stone-800 ${allOk ? 'bg-emerald-50 dark:bg-emerald-900/20' : 'bg-red-50 dark:bg-red-900/20'}`}>
          <div className={`w-1.5 h-1.5 rounded-full ${allOk ? 'bg-emerald-500' : 'bg-red-500'}`} />
          <span className={`text-[11px] font-semibold ${allOk ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
            {allOk ? 'Horario verificado' : 'Horario no verificado'}
          </span>
        </div>
        {/* Rows */}
        <div className="p-3 space-y-3">
          <Row label="Entrada" app={appEntry} user={userEntry} ok={entryOk} diff={entryDiff} />
          <Row label="Salida" app={appExit} user={userExit} ok={exitOk} diff={exitDiff} />
        </div>
        {/* Actions */}
        {!isVerified && onVerify && (
          <div className="px-3 pb-3">
            <button
              onClick={(e) => { e.stopPropagation(); onVerify(); }}
              className="w-full py-2 bg-orange-500 hover:bg-orange-600 text-white text-[11px] font-bold rounded-xl transition-colors shadow-lg shadow-orange-500/20"
            >
              Confirmar Verificación
            </button>
          </div>
        )}
      </div>
    </>,
    document.body
  );
};

const thClass = "px-6 py-5 sm:px-8 sm:py-6 text-xs font-normal text-slate-400 dark:text-stone-500 capitalize whitespace-nowrap";
const tdClass = "px-6 py-5 sm:px-8 sm:py-7";

// Observation popup modal
const ObservationModal: React.FC<{ isOpen: boolean; anchorRef: React.RefObject<HTMLElement | null>; text: string }> = ({ isOpen, anchorRef, text }) => {
  const [pos, setPos] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (isOpen && anchorRef.current) {
      const rect = anchorRef.current.getBoundingClientRect();
      const popupW = 240;
      const left = Math.min(rect.left, window.innerWidth - popupW - 8);
      setPos({ top: rect.bottom + 6, left });
    }
  }, [isOpen]);

  return createPortal(
    <>
      <div
        className={`fixed z-[110] bg-white dark:bg-stone-900 rounded-2xl overflow-hidden border border-stone-200 dark:border-stone-700 shadow-xl transition-opacity duration-200 pointer-events-none ${isOpen ? 'opacity-100' : 'opacity-0'}`}
        style={{ top: pos.top, left: pos.left, width: 240 }}
      >
        <div className="px-4 py-2.5 flex items-center gap-2 border-b border-stone-100 dark:border-stone-800 bg-orange-50 dark:bg-orange-900/20">
          <Info size={13} className="text-orange-500" />
          <span className="text-[11px] font-semibold text-orange-700 dark:text-orange-400">Observaciones</span>
        </div>
        <div className="p-3">
          <p className="text-xs text-slate-600 dark:text-stone-300 leading-relaxed">{text}</p>
        </div>
      </div>
    </>,
    document.body
  );
};


// Observation button component
const ObservationButton: React.FC<{ text?: string }> = ({ text }) => {
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
        <ObservationModal isOpen={open} anchorRef={btnRef} text={text!} />
      )}
    </>
  );
};

// Sub-components: Tables
const TableNormalCleans: React.FC<{ 
  data: NormalCleanRecord[]; 
  photoMap: Record<string, string>; 
  geoData: Record<string, { lat: number, lng: number }>;
  workers: Worker[];
  onUpdate: (id: string, checked: boolean) => void 
}> = ({ data, geoData, workers, onUpdate }) => {
  const [locationModal, setLocationModal] = useState<{ 
    open: boolean; 
    anchor: HTMLElement | null;
    targetCoords?: [number, number];
    userCoords?: [number, number][];
  }>({ open: false, anchor: null });
  const [dateModal, setDateModal] = useState<{ open: boolean; record: NormalCleanRecord | null; anchor: HTMLElement | null }>({ open: false, record: null, anchor: null });
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const toggleRow = (id: string) => {
    setExpandedId(prev => prev === id ? null : id);
  };

  return (
    <>
      <table className="min-w-[800px] w-full text-left border-collapse text-xs sm:text-sm">
        <thead>
          <tr className="border-b border-stone-100 dark:border-stone-800">
            <th className={thClass}>Nombres y Apellidos</th>
            <th className={thClass}>Hora</th>
            <th className={thClass}>Ubicación</th>
            <th className={thClass}>Apartamento</th>
            <th className={thClass}>Fecha</th>
            <th className={thClass}>Km</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
          {data.map((r) => (
            <React.Fragment key={r.id}>
              <tr
                onClick={() => toggleRow(r.id)}
                className={`group cursor-pointer transition-colors duration-200 ${
                  expandedId === r.id
                    ? 'bg-orange-50/30 dark:bg-orange-900/10'
                    : 'hover:bg-stone-100/50 dark:hover:bg-stone-700/30'
                }`}
              >
                <td className={tdClass}>
                  <div className="flex items-center gap-2">
                    <div className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${expandedId === r.id ? 'bg-orange-500 scale-125' : 'bg-transparent'}`} />
                    <div className="flex flex-col">
                      <div className="font-normal text-slate-800 dark:text-stone-200 flex items-center gap-1.5">
                        {(() => {
                          const w = workers.find(w => matchesWorkerByPhone(w.telefono, r.telefono));
                          return (
                            <>
                              <span>{formatName(w?.fullName || `${r.nombre} ${r.apellidos}`)}</span>
                              {!w && <div className="w-1.5 h-1.5 rounded-full bg-red-500/80 shrink-0" title="Trabajador no registrado en el sistema" />}
                            </>
                          );
                        })()}
                      </div>
                      <div className="text-[10px] text-slate-400 dark:text-stone-500">{r.telefono}</div>
                    </div>
                    <div className="flex items-center gap-1 ml-1">
                      {r.recogeLlaves && (
                        <KeyRound size={12} className="text-orange-400 dark:text-orange-300" />
                      )}
                      {!r.sigueHuesped && (
                        <Check size={12} className="text-emerald-500 dark:text-emerald-400" />
                      )}
                    </div>
                  </div>
                </td>
                <td className={tdClass} onClick={(e) => e.stopPropagation()}>
                  <VerificationCell verified={r.checked} onClick={(ev) => setDateModal({ open: true, record: r, anchor: ev.currentTarget })} />
                </td>
                <td className={tdClass} onClick={(e) => e.stopPropagation()}>
                  {(() => {
                    const target = findAccommodationCoords(r.apartamento, geoData);
                    const checkin = parseCoords(r.checkinUbicacion);
                    const checkout = parseCoords(r.checkoutUbicacion);
                    const isVerified = target && checkin && checkout &&
                      getDistanceMeters(checkin[0], checkin[1], target.lat, target.lng) <= VERIFICATION_RADIUS_METERS &&
                      getDistanceMeters(checkout[0], checkout[1], target.lat, target.lng) <= VERIFICATION_RADIUS_METERS;

                    return (
                      <VerificationCell
                        verified={!!isVerified}
                        onClick={(ev) => setLocationModal({
                          open: true,
                          anchor: ev.currentTarget,
                          targetCoords: target ? [target.lat, target.lng] : undefined,
                          userCoords: [checkin, checkout].filter(c => c !== null) as [number, number][]
                        })}
                      />
                    );
                  })()}
                </td>
                <td className={tdClass}>
                  <span className="inline-block bg-white dark:bg-stone-800 text-black dark:text-stone-100 text-[11px] px-2 py-0.5 rounded-md soft-shadow font-normal">
                    {r.apartamento}
                  </span>
                </td>
                <td className={`${tdClass}`}>
                  <div className="text-[11px] text-slate-400 dark:text-stone-500 mb-0.5">{r.checkinFecha.split(' ')[0]}</div>
                  <div className="text-slate-600 dark:text-stone-400 text-sm tabular-nums">{formatTime(r.horaEntrada)} - {formatTime(r.horaSalida)}</div>
                </td>
                <td className={`${tdClass} text-slate-600 dark:text-stone-400 tabular-nums`}>{r.km} km</td>
              </tr>
              {expandedId === r.id && (
                <tr className="bg-orange-50/20 dark:bg-stone-900/40 border-b border-stone-100 dark:border-stone-800 animate-in fade-in slide-in-from-top-2 duration-300">
                  <td colSpan={6} className="px-8 py-6">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                      {/* Observaciones */}
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-slate-400 dark:text-stone-500 font-bold">
                          <MessageSquare size={12} className="text-orange-500" />
                          <span>Observaciones</span>
                        </div>
                        <div className="bg-white/50 dark:bg-stone-800/50 rounded-xl p-3 border border-stone-100 dark:border-stone-700/50 min-h-[60px]">
                          <p className="text-xs text-slate-600 dark:text-stone-300 leading-relaxed italic">
                            {r.observaciones || 'Sin observaciones adicionales.'}
                          </p>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-slate-400 dark:text-stone-500 font-bold">
                          <CheckCircle2 size={12} className="text-orange-500" />
                          <span>Estado Verificado (Checked)</span>
                        </div>
                        <VerificationCell verified={r.checked} onClick={() => onUpdate(r.id, !r.checked)} />
                      </div>

                      {/* Llaves */}
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-slate-400 dark:text-stone-500 font-bold">
                          <Key size={12} className="text-orange-500" />
                          <span>Llaves Entregadas</span>
                        </div>
                        <div className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium border ${
                          r.recogeLlaves 
                            ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-900/40 text-emerald-700 dark:text-emerald-400' 
                            : 'bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-900/40 text-red-600 dark:text-red-400'
                        }`}>
                          {r.recogeLlaves ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                          <span>{r.recogeLlaves ? 'ENTREGADAS' : 'PENDIENTES'}</span>
                        </div>
                      </div>

                      {/* Huésped */}
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-slate-400 dark:text-stone-500 font-bold">
                          <User size={12} className="text-orange-500" />
                          <span>Estado del Huésped</span>
                        </div>
                        <div className="flex flex-col gap-2">
                          <div className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium border self-start ${
                            r.sigueHuesped 
                              ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-100 dark:border-amber-900/40 text-amber-700 dark:text-amber-400' 
                              : 'bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-900/40 text-blue-600 dark:text-blue-400'
                          }`}>
                            <div className={`w-1.5 h-1.5 rounded-full ${r.sigueHuesped ? 'bg-amber-500 animate-pulse' : 'bg-blue-500'}`} />
                            <span>{r.sigueHuesped ? 'Salió tarde' : 'YA SALIÓ'}</span>
                          </div>
                          {r.fechaSalidaReserva && (
                            <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-stone-400 bg-white/40 dark:bg-stone-800/40 px-3 py-1.5 rounded-lg border border-stone-100/50 dark:border-stone-700/30 w-fit">
                              <Clock size={12} className="text-orange-500" />
                              <span>Hora en la que salió: <span className="font-semibold">{r.fechaSalidaReserva}</span></span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>
                </tr>
              )}
            </React.Fragment>
          ))}
        </tbody>
      </table>
      <LocationVerificationModal 
        isOpen={locationModal.open} 
        onClose={() => setLocationModal({ open: false, anchor: null })} 
        anchorRef={locationModal.anchor}
        {...(locationModal as any)}
      />
      {dateModal.record && (
        <DateVerificationModal
          isOpen={dateModal.open}
          onClose={() => setDateModal({ open: false, record: null, anchor: null })}
          anchorRef={dateModal.anchor}
          appEntry={dateModal.record.checkinFecha}
          appExit={dateModal.record.checkoutFecha}
          userEntry={dateModal.record.horaEntrada}
          userExit={dateModal.record.horaSalida}
          isVerified={dateModal.record.checked}
          onVerify={() => {
            onUpdate(dateModal.record!.id, true);
            setDateModal(prev => ({ ...prev, open: false }));
          }}
        />
      )}
    </>
  );
};

const TableInitialCleans: React.FC<{ 
  data: InitialCleanRecord[]; 
  photoMap: Record<string, string>; 
  geoData: Record<string, { lat: number, lng: number }>;
  workers: Worker[];
  onUpdate: (id: string, checked: boolean) => void 
}> = ({ data, geoData, workers, onUpdate }) => {
  const [locationModal, setLocationModal] = useState<{ 
    open: boolean; 
    anchor: HTMLElement | null;
    targetCoords?: [number, number];
    userCoords?: [number, number][];
  }>({ open: false, anchor: null });
  const [dateModal, setDateModal] = useState<{ open: boolean; record: InitialCleanRecord | null; anchor: HTMLElement | null }>({ open: false, record: null, anchor: null });
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const toggleRow = (id: string) => {
    setExpandedId(prev => prev === id ? null : id);
  };

  return (
    <>
      <table className="min-w-[800px] w-full text-left border-collapse text-xs sm:text-sm">
        <thead>
          <tr className="border-b border-stone-100 dark:border-stone-800">
            <th className={thClass}>Nombres y Apellidos</th>
            <th className={thClass}>Hora</th>
            <th className={thClass}>Ubicación</th>
            <th className={thClass}>Apartamento</th>
            <th className={thClass}>Fecha</th>
            <th className={thClass}>Km</th>
            <th className={thClass}>Observaciones</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
          {data.map((r) => (
            <React.Fragment key={r.id}>
              <tr
                onClick={() => toggleRow(r.id)}
                className={`group cursor-pointer transition-colors duration-200 ${
                  expandedId === r.id
                    ? 'bg-orange-50/30 dark:bg-orange-900/10'
                    : 'hover:bg-stone-100/50 dark:hover:bg-stone-700/30'
                }`}
              >
                <td className={tdClass}>
                  <div className="flex flex-col">
                    <div className="font-normal text-slate-800 dark:text-stone-200 flex items-center gap-1.5">
                      {(() => {
                        const w = workers.find(w => matchesWorkerByPhone(w.telefono, r.telefono));
                        return (
                          <>
                            <span>{formatName(w?.fullName || `${r.nombre} ${r.apellidos}`)}</span>
                            {!w && <div className="w-1.5 h-1.5 rounded-full bg-red-500/80 shrink-0" title="Trabajador no registrado en el sistema" />}
                          </>
                        );
                      })()}
                    </div>
                    <div className="text-[10px] text-slate-400 dark:text-stone-500">{r.telefono}</div>
                  </div>
                </td>
                <td className={tdClass} onClick={(e) => e.stopPropagation()}>
                  <VerificationCell verified={r.checked} onClick={(ev) => setDateModal({ open: true, record: r, anchor: ev.currentTarget })} />
                </td>
                <td className={tdClass} onClick={(e) => e.stopPropagation()}>
                  {(() => {
                    const target = findAccommodationCoords(r.apartamento, geoData);
                    const checkin = parseCoords(r.checkinUbicacion);
                    const checkout = parseCoords(r.checkoutUbicacion);
                    const isVerified = target && checkin && checkout &&
                      getDistanceMeters(checkin[0], checkin[1], target.lat, target.lng) <= VERIFICATION_RADIUS_METERS &&
                      getDistanceMeters(checkout[0], checkout[1], target.lat, target.lng) <= VERIFICATION_RADIUS_METERS;

                    return (
                      <VerificationCell
                        verified={!!isVerified}
                        onClick={(ev) => setLocationModal({
                          open: true,
                          anchor: ev.currentTarget,
                          targetCoords: target ? [target.lat, target.lng] : undefined,
                          userCoords: [checkin, checkout].filter(c => c !== null) as [number, number][]
                        })}
                      />
                    );
                  })()}
                </td>
                <td className={tdClass}>
                  <span className="inline-block bg-white dark:bg-stone-800 text-[11px] px-2 py-0.5 rounded-md soft-shadow font-normal text-slate-500 dark:text-stone-400">
                    {r.apartamento}
                  </span>
                </td>
                <td className={`${tdClass}`}>
                  <div className="text-[11px] text-slate-400 dark:text-stone-500 mb-0.5">{r.checkinFecha.split(' ')[0]}</div>
                  <div className="text-slate-600 dark:text-stone-400 text-sm tabular-nums">{formatTime(r.horaEntrada)} - {formatTime(r.horaSalida)}</div>
                </td>
                <td className={`${tdClass} text-slate-600 dark:text-stone-400 tabular-nums`}>{r.km} km</td>
                <td className={`${tdClass} text-center`}>
                  <ObservationButton text={r.observaciones} />
                </td>
              </tr>
              {expandedId === r.id && (
                <tr className="bg-orange-50/20 dark:bg-stone-900/40 border-b border-stone-100 dark:border-stone-800 animate-in fade-in slide-in-from-top-2 duration-300">
                  <td colSpan={7} className="px-8 py-6">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-slate-400 dark:text-stone-500 font-bold">
                          <MessageSquare size={12} className="text-orange-500" />
                          <span>Observaciones</span>
                        </div>
                        <div className="bg-white/50 dark:bg-stone-800/50 rounded-xl p-3 border border-stone-100 dark:border-stone-700/50 min-h-[60px]">
                          <p className="text-xs text-slate-600 dark:text-stone-300 leading-relaxed italic">
                            {r.observaciones || 'Sin observaciones adicionales.'}
                          </p>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-slate-400 dark:text-stone-500 font-bold">
                          <CheckCircle2 size={12} className="text-orange-500" />
                          <span>Estado Verificado (Checked)</span>
                        </div>
                        <VerificationCell verified={r.checked} onClick={() => onUpdate(r.id, !r.checked)} />
                      </div>
                    </div>
                  </td>
                </tr>
              )}
            </React.Fragment>
          ))}
        </tbody>
      </table>
      <LocationVerificationModal 
        isOpen={locationModal.open} 
        onClose={() => setLocationModal({ open: false, anchor: null })} 
        anchorRef={locationModal.anchor}
        {...(locationModal as any)}
      />
      {dateModal.record && (
        <DateVerificationModal
          isOpen={dateModal.open}
          onClose={() => setDateModal({ open: false, record: null, anchor: null })}
          anchorRef={dateModal.anchor}
          appEntry={dateModal.record.checkinFecha}
          appExit={dateModal.record.checkoutFecha}
          userEntry={dateModal.record.horaEntrada}
          userExit={dateModal.record.horaSalida}
          isVerified={dateModal.record.checked}
          onVerify={() => {
            onUpdate(dateModal.record!.id, true);
            setDateModal(prev => ({ ...prev, open: false }));
          }}
        />
      )}
    </>
  );
};

const TableHandyman: React.FC<{ 
  data: HandymanRecord[]; 
  photoMap: Record<string, string>; 
  geoData: Record<string, { lat: number, lng: number }>;
  workers: Worker[];
  onUpdate: (id: string, checked: boolean) => void 
}> = ({ data, geoData, workers, onUpdate }) => {
  const [locationModal, setLocationModal] = useState<{ 
    open: boolean; 
    anchor: HTMLElement | null;
    targetCoords?: [number, number];
    userCoords?: [number, number][];
  }>({ open: false, anchor: null });
  const [dateModal, setDateModal] = useState<{ open: boolean; record: HandymanRecord | null; anchor: HTMLElement | null }>({ open: false, record: null, anchor: null });
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const toggleRow = (id: string) => {
    setExpandedId(prev => prev === id ? null : id);
  };

  return (
    <>
      <table className="min-w-[800px] w-full text-left border-collapse text-xs sm:text-sm">
        <thead>
          <tr className="border-b border-stone-100 dark:border-stone-800">
            <th className={thClass}>Nombres y Apellidos</th>
            <th className={thClass}>Hora</th>
            <th className={thClass}>Ubicación</th>
            <th className={thClass}>Alojamiento</th>
            <th className={thClass}>Fecha</th>
            <th className={thClass}>Km</th>
            <th className={thClass}>Detalles del Trabajo</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
          {data.map((r) => (
            <React.Fragment key={r.id}>
              <tr
                onClick={() => toggleRow(r.id)}
                className={`group cursor-pointer transition-colors duration-200 ${
                  expandedId === r.id
                    ? 'bg-orange-50/30 dark:bg-orange-900/10'
                    : 'hover:bg-stone-100/50 dark:hover:bg-stone-700/30'
                }`}
              >
                <td className={tdClass}>
                  <div className="flex flex-col">
                    <div className="font-normal text-slate-800 dark:text-stone-200 flex items-center gap-1.5">
                      {(() => {
                        const w = workers.find(w => matchesWorkerByPhone(w.telefono, r.telefono));
                        return (
                          <>
                            <span>{formatName(w?.fullName || `${r.nombre} ${r.apellidos}`)}</span>
                            {!w && <div className="w-1.5 h-1.5 rounded-full bg-red-500/80 shrink-0" title="Trabajador no registrado en el sistema" />}
                          </>
                        );
                      })()}
                    </div>
                    <div className="text-[10px] text-slate-400 dark:text-stone-500">{r.telefono}</div>
                  </div>
                </td>
                <td className={tdClass} onClick={(e) => e.stopPropagation()}>
                  <VerificationCell
                    verified={r.estadoCompletado === 'Completado'}
                    onClick={(ev) => setDateModal({ open: true, record: r, anchor: ev.currentTarget })}
                  />
                </td>
                <td className={tdClass} onClick={(e) => e.stopPropagation()}>
                  {(() => {
                    const target = findAccommodationCoords(r.alojamiento, geoData);
                    const checkin = parseCoords(r.ubicacionInicio);
                    const checkout = parseCoords(r.ubicacionFin);
                    const isVerified = target && checkin && checkout &&
                      getDistanceMeters(checkin[0], checkin[1], target.lat, target.lng) <= VERIFICATION_RADIUS_METERS &&
                      getDistanceMeters(checkout[0], checkout[1], target.lat, target.lng) <= VERIFICATION_RADIUS_METERS;

                    return (
                      <VerificationCell
                        verified={!!isVerified}
                        onClick={(ev) => setLocationModal({
                          open: true,
                          anchor: ev.currentTarget,
                          targetCoords: target ? [target.lat, target.lng] : undefined,
                          userCoords: [checkin, checkout].filter(c => c !== null) as [number, number][]
                        })}
                      />
                    );
                  })()}
                </td>
                <td className={tdClass}>
                  <span className="inline-block bg-white dark:bg-stone-800 text-slate-500 dark:text-stone-400 text-[11px] px-2 py-0.5 rounded-md soft-shadow font-normal">
                    {r.alojamiento}
                  </span>
                </td>
                <td className={`${tdClass}`}>
                  <div className="text-[11px] text-slate-400 dark:text-stone-500 mb-0.5">{r.fechaLlegada.split(' ')[0]}</div>
                  <div className="text-slate-600 dark:text-stone-400 text-sm tabular-nums">{formatTime(r.horaInicioTarea)} - {formatTime(r.horaFinTarea)}</div>
                </td>
                <td className={`${tdClass} text-slate-600 dark:text-stone-400 tabular-nums`}>{r.cantidadMinutos} min</td>
                <td className={`${tdClass} text-center`}>
                  <ObservationButton text={r.observacionesTarea} />
                </td>
              </tr>
              {expandedId === r.id && (
                <tr className="bg-orange-50/20 dark:bg-stone-900/40 border-b border-stone-100 dark:border-stone-800 animate-in fade-in slide-in-from-top-2 duration-300">
                  <td colSpan={7} className="px-8 py-6">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-slate-400 dark:text-stone-500 font-bold">
                          <MessageSquare size={12} className="text-orange-500" />
                          <span>Observaciones del Trabajo</span>
                        </div>
                        <div className="bg-white/50 dark:bg-stone-800/50 rounded-xl p-3 border border-stone-100 dark:border-stone-700/50 min-h-[60px]">
                          <p className="text-xs text-slate-600 dark:text-stone-300 leading-relaxed italic">
                            {r.observacionesTarea || 'Sin detalles adicionales.'}
                          </p>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-slate-400 dark:text-stone-500 font-bold">
                          <CheckCircle2 size={12} className="text-orange-500" />
                          <span>Estado Verificado (Checked)</span>
                        </div>
                        <VerificationCell verified={r.estadoCompletado === 'Completado'} onClick={() => onUpdate(r.id, r.estadoCompletado !== 'Completado')} />
                      </div>
                    </div>
                  </td>
                </tr>
              )}
            </React.Fragment>
          ))}
        </tbody>
      </table>
      <LocationVerificationModal 
        isOpen={locationModal.open} 
        onClose={() => setLocationModal({ open: false, anchor: null })} 
        anchorRef={locationModal.anchor}
        {...(locationModal as any)}
      />
      {dateModal.record && (
        <DateVerificationModal
          isOpen={dateModal.open}
          onClose={() => setDateModal({ open: false, record: null, anchor: null })}
          anchorRef={dateModal.anchor}
          appEntry={dateModal.record.fechaLlegada}
          appExit={dateModal.record.fechaFin}
          userEntry={dateModal.record.horaInicioTarea}
          userExit={dateModal.record.horaFinTarea}
          isVerified={dateModal.record.estadoCompletado === 'Completado'}
          onVerify={() => {
            onUpdate(dateModal.record!.id, true);
            setDateModal(prev => ({ ...prev, open: false }));
          }}
        />
      )}
    </>
  );
};

export default Cleans;
