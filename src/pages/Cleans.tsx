
import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  User,
  MessageSquare,
} from 'lucide-react';
import { appsScriptApi } from '../services/api';
import { NormalCleanRecord, InitialCleanRecord, HandymanRecord, Worker } from '../services/mockData';
import CleanFilterModal, { CleanFilters } from '../components/cleans/CleanFilterModal';
import LoadingSpinner from '../components/ui/LoadingSpinner';

type TabType = 'normal' | 'initial' | 'handyman';

const Cleans: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('normal');
  const [loading, setLoading] = useState(true);
  const [normalCleans, setNormalCleans] = useState<NormalCleanRecord[]>([]);
  const [initialCleans, setInitialCleans] = useState<InitialCleanRecord[]>([]);
  const [handymanRecords, setHandymanRecords] = useState<HandymanRecord[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  // Filter Modal state
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [filters, setFilters] = useState<CleanFilters>({
    startDate: '',
    endDate: '',
    apartment: '',
    status: 'all'
  });

  const photoMap = useMemo(() => {
    const map: Record<string, string> = {};
    workers.forEach(w => { if (w.photo) map[w.fullName] = w.photo; });
    return map;
  }, [workers]);

  useEffect(() => {
    appsScriptApi.getWorkers().then(setWorkers);
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
      fullName = `${record.nombre} ${record.apellidos}`.toLowerCase();
      telefono = record.telefono.toLowerCase();
      apt = ('apartamento' in record ? record.apartamento : record.alojamiento).toLowerCase();
      fecha = 'checkinFecha' in record ? record.checkinFecha : record.fechaLlegada;
      checked = 'checked' in record ? record.checked : record.estadoCompletado === 'Completado';
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
      <div className="flex items-center gap-8 border-b border-stone-100/20 dark:border-stone-700/30 w-full animate-in fade-in slide-in-from-left-4 duration-700">
        {tabs.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabType)}
              className={`relative flex items-center gap-2 pb-3.5 px-0.5 text-xs font-normal transition-all duration-300 group
                ${active ? 'text-slate-800 dark:text-stone-200' : 'text-slate-400 dark:text-stone-600 hover:text-slate-600 dark:hover:text-stone-400'}`}
            >
              <span className={`transition-transform duration-300 ${active ? 'scale-110' : 'group-hover:scale-105'}`}>
                {React.cloneElement(tab.icon as React.ReactElement, {
                  size: 16,
                  className: active ? 'text-orange-500' : 'text-slate-400 dark:text-stone-600'
                })}
              </span>
              <span>{tab.label}</span>
              {active && (
                <div className="absolute bottom-[-1px] left-0 right-0 h-0.5 bg-orange-500 rounded-full animate-in fade-in slide-in-from-left-2 duration-300" />
              )}
            </button>
          );
        })}
      </div>

      {/* Content Area */}
      <div className="bg-white/60 dark:bg-stone-950 backdrop-blur-md border border-white dark:border-stone-800 rounded-2xl overflow-hidden">
        {activeTab === 'normal' && <TableNormalCleans data={filteredNormal} photoMap={photoMap} />}
        {activeTab === 'initial' && <TableInitialCleans data={filteredInitial} photoMap={photoMap} />}
        {activeTab === 'handyman' && <TableHandyman data={filteredHandyman} photoMap={photoMap} />}
      </div>
    </div>
  );
};


// Verification cell component with green/red buttons
const VerificationCell = React.forwardRef<HTMLButtonElement, { verified: boolean; onClick: (verified: boolean) => void }>(
  ({ verified, onClick }, ref) => (
    <button
      ref={ref}
      type="button"
      onClick={() => onClick(!verified)}
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-medium transition ${verified
        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/70 dark:text-emerald-200 hover:bg-emerald-200 dark:hover:bg-emerald-900'
        : 'bg-red-100 text-red-700 dark:bg-red-900/70 dark:text-red-200 hover:bg-red-200 dark:hover:bg-red-900'}`}
    >
      {verified ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
      <span>{verified ? 'Verificado' : 'No Verificado'}</span>
    </button>
  )
);

// Placeholder coords — swap for real data later
const PLACEHOLDER_ACCOMMODATION: [number, number] = [40.4168, -3.7038];
const PLACEHOLDER_USER: [number, number] = [40.419, -3.7005];
const ACCOMMODATION_RADIUS_METERS = 80;

// Mini map using leaflet directly (no react-leaflet)
const MiniMap: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: PLACEHOLDER_ACCOMMODATION,
      zoom: 15,
      zoomControl: false,
      attributionControl: false,
      dragging: false,
      touchZoom: false,
      doubleClickZoom: false,
      scrollWheelZoom: false,
      boxZoom: false,
      keyboard: false,
    });
    mapRef.current = map;

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png').addTo(map);

    // Accommodation radius
    L.circle(PLACEHOLDER_ACCOMMODATION, {
      radius: ACCOMMODATION_RADIUS_METERS,
      color: '#f97316',
      fillColor: '#f97316',
      fillOpacity: 0.08,
      opacity: 0.3,
      weight: 1,
    }).addTo(map);

    // User marker
    const userIcon = L.divIcon({
      className: '',
      html: `<div style="width:12px;height:12px;border-radius:50%;background:#f97316;border:2px solid white;box-shadow:0 0 0 2px #f97316;"></div>`,
      iconSize: [12, 12],
      iconAnchor: [6, 6],
    });
    L.marker(PLACEHOLDER_USER, { icon: userIcon }).addTo(map);

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />;
};

// Location verification modal component
const LocationVerificationModal: React.FC<{ isOpen: boolean; onClose: () => void; anchorRef: React.RefObject<HTMLButtonElement | null> }> = ({ isOpen, onClose, anchorRef }) => {
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (isOpen && anchorRef.current) {
      const rect = anchorRef.current.getBoundingClientRect();
      const popupW = 220;
      const left = Math.min(rect.left, window.innerWidth - popupW - 8);
      setPos({ top: rect.bottom + 6, left });
      // Mount map after container is visible in DOM
      setTimeout(() => setShow(true), 20);
    } else {
      setShow(false);
    }
  }, [isOpen]);

  return createPortal(
    <>
      <div
        className={`fixed inset-0 z-[105] transition-opacity duration-200 ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />
      <div
        className={`fixed z-[110] bg-white dark:bg-stone-900 rounded-2xl overflow-hidden border border-stone-200 dark:border-stone-700 shadow-xl transition-opacity duration-200 ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        style={{ top: pos.top, left: pos.left, width: 220, height: 200 }}
      >
        {show && <MiniMap />}
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

const diffMinutes = (a: string, b: string): number =>
  Math.abs(toMinutes(a) - toMinutes(b));

// Date verification popup
interface DateVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLButtonElement | null>;
  appEntry: string;   // from checkinFecha
  appExit: string;    // from checkoutFecha
  userEntry: string;  // horaEntrada
  userExit: string;   // horaSalida
}

const DateVerificationModal: React.FC<DateVerificationModalProps> = ({
  isOpen, onClose, anchorRef, appEntry, appExit, userEntry, userExit,
}) => {
  const [pos, setPos] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (isOpen && anchorRef.current) {
      const rect = anchorRef.current.getBoundingClientRect();
      const popupW = 240;
      const left = Math.min(rect.left, window.innerWidth - popupW - 8);
      setPos({ top: rect.bottom + 6, left });
    }
  }, [isOpen]);

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
            <p className="text-xs font-semibold text-slate-700 dark:text-stone-200 tabular-nums">{appTime}</p>
          </div>
          {/* Diff badge */}
          <div className={`flex flex-col items-center px-1.5 py-1 rounded-lg text-[9px] font-bold tabular-nums ${ok ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400' : 'bg-red-50 dark:bg-red-900/30 text-red-500 dark:text-red-400'}`}>
            <span>{ok ? '✓' : '✗'}</span>
            <span>{diff}m</span>
          </div>
          {/* User value */}
          <div className="flex-1 bg-slate-50 dark:bg-stone-800 rounded-lg px-2.5 py-1.5">
            <p className="text-[9px] text-slate-400 dark:text-stone-500 mb-0.5">Usuario</p>
            <p className={`text-xs font-semibold tabular-nums ${ok ? 'text-slate-700 dark:text-stone-200' : 'text-red-500 dark:text-red-400'}`}>{user}</p>
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
        className={`fixed z-[110] bg-white dark:bg-stone-900 rounded-2xl overflow-hidden border border-stone-200 dark:border-stone-700 shadow-xl transition-opacity duration-200 ${isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        style={{ top: pos.top, left: pos.left, width: 240 }}
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
// Sub-components: Tables
const TableNormalCleans: React.FC<{ data: NormalCleanRecord[]; photoMap: Record<string, string> }> = ({ data }) => {
  const [locationModalOpen, setLocationModalOpen] = useState(false);
  const locationBtnRef = useRef<HTMLButtonElement>(null);
  const [dateModal, setDateModal] = useState<{ open: boolean; record: NormalCleanRecord | null }>({ open: false, record: null });
  const dateBtnRef = useRef<HTMLButtonElement>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const toggleRow = (id: string) => {
    setExpandedId(prev => prev === id ? null : id);
  };

  return (
    <>
      <table className="w-full text-left border-collapse text-xs sm:text-sm">
        <thead>
          <tr className="border-b border-stone-100 dark:border-stone-800">
            <th className={thClass}>Nombres y Apellidos</th>
            <th className={thClass}>Verificar Hora</th>
            <th className={thClass}>Verificar Ubicación</th>
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
                    <div className="font-normal text-slate-800 dark:text-stone-200">{r.nombre} {r.apellidos}</div>
                  </div>
                </td>
                <td className={tdClass} onClick={(e) => e.stopPropagation()}>
                  <VerificationCell verified={r.checked} onClick={() => setDateModal({ open: true, record: r })} ref={dateBtnRef} />
                </td>
                <td className={tdClass} onClick={(e) => e.stopPropagation()}>
                  <VerificationCell verified={r.checked} onClick={() => setLocationModalOpen(true)} ref={locationBtnRef} />
                </td>
                <td className={tdClass}>
                  <span className="inline-block bg-white dark:bg-stone-800 text-black dark:text-stone-100 text-[11px] px-2 py-0.5 rounded-md soft-shadow font-normal">
                    {r.apartamento}
                  </span>
                </td>
                <td className={`${tdClass}`}>
                  <div className="text-[11px] text-slate-400 dark:text-stone-500 mb-0.5">{r.checkinFecha.split(' ')[0]}</div>
                  <div className="text-slate-600 dark:text-stone-400 text-sm tabular-nums">{r.horaEntrada} - {r.horaSalida}</div>
                </td>
                <td className={`${tdClass} text-slate-600 dark:text-stone-400 tabular-nums`}>{r.km} km</td>
              </tr>
              {expandedId === r.id && (
                <tr className="bg-orange-50/20 dark:bg-stone-900/40 border-b border-stone-100 dark:border-stone-800 animate-in fade-in slide-in-from-top-2 duration-300">
                  <td colSpan={6} className="px-8 py-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
      <LocationVerificationModal isOpen={locationModalOpen} onClose={() => setLocationModalOpen(false)} anchorRef={locationBtnRef} />
      {dateModal.record && (
        <DateVerificationModal
          isOpen={dateModal.open}
          onClose={() => setDateModal({ open: false, record: null })}
          anchorRef={dateBtnRef}
          appEntry={dateModal.record.checkinFecha}
          appExit={dateModal.record.checkoutFecha}
          userEntry={dateModal.record.horaEntrada}
          userExit={dateModal.record.horaSalida}
        />
      )}
    </>
  );
};

const TableInitialCleans: React.FC<{ data: InitialCleanRecord[]; photoMap: Record<string, string> }> = ({ data }) => {
  const [locationModalOpen, setLocationModalOpen] = useState(false);
  const locationBtnRef = useRef<HTMLButtonElement>(null);
  const [dateModal, setDateModal] = useState<{ open: boolean; record: InitialCleanRecord | null }>({ open: false, record: null });
  const dateBtnRef = useRef<HTMLButtonElement>(null);

  return (
    <>
      <table className="w-full text-left border-collapse text-xs sm:text-sm">
        <thead>
          <tr className="border-b border-stone-100 dark:border-stone-800">
            <th className={thClass}>Nombres y Apellidos</th>
            <th className={thClass}>Verificar Hora</th>
            <th className={thClass}>Verificar Ubicación</th>
            <th className={thClass}>Apartamento</th>
            <th className={thClass}>Fecha</th>
            <th className={thClass}>Km</th>
            <th className={thClass}>Observaciones</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
          {data.map((r) => (
            <tr key={r.id} className="hover:bg-stone-100/50 dark:hover:bg-stone-700/30 transition-colors duration-200">
              <td className={tdClass}>
                <div className="font-normal text-slate-800 dark:text-stone-200">{r.nombre} {r.apellidos}</div>
              </td>
              <td className={tdClass}>
                <VerificationCell verified={r.checked} onClick={() => setDateModal({ open: true, record: r })} ref={dateBtnRef} />
              </td>
              <td className={tdClass}>
                <VerificationCell verified={r.checked} onClick={() => setLocationModalOpen(true)} ref={locationBtnRef} />
              </td>
              <td className={tdClass}>
                <span className="inline-block bg-white dark:bg-stone-800 text-slate-500 dark:text-stone-400 text-[11px] px-2 py-0.5 rounded-md soft-shadow font-normal">
                  {r.apartamento}
                </span>
              </td>
              <td className={`${tdClass}`}>
                <div className="text-[11px] text-slate-400 dark:text-stone-500 mb-0.5">{r.checkinFecha.split(' ')[0]}</div>
                <div className="text-slate-600 dark:text-stone-400 text-sm tabular-nums">{r.horaEntrada} - {r.horaSalida}</div>
              </td>
              <td className={`${tdClass} text-slate-600 dark:text-stone-400 tabular-nums`}>{r.km} km</td>
              <td className={`${tdClass} text-center`}>
                <ObservationButton text={r.observaciones} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <LocationVerificationModal isOpen={locationModalOpen} onClose={() => setLocationModalOpen(false)} anchorRef={locationBtnRef} />
      {dateModal.record && (
        <DateVerificationModal
          isOpen={dateModal.open}
          onClose={() => setDateModal({ open: false, record: null })}
          anchorRef={dateBtnRef}
          appEntry={dateModal.record.checkinFecha}
          appExit={dateModal.record.checkoutFecha}
          userEntry={dateModal.record.horaEntrada}
          userExit={dateModal.record.horaSalida}
        />
      )}
    </>
  );
};

const TableHandyman: React.FC<{ data: HandymanRecord[]; photoMap: Record<string, string> }> = ({ data }) => {
  const [locationModalOpen, setLocationModalOpen] = useState(false);
  const locationBtnRef = useRef<HTMLButtonElement>(null);
  const [dateModal, setDateModal] = useState<{ open: boolean; record: HandymanRecord | null }>({ open: false, record: null });
  const dateBtnRef = useRef<HTMLButtonElement>(null);

  return (
    <>
      <table className="w-full text-left border-collapse text-xs sm:text-sm">
        <thead>
          <tr className="border-b border-stone-100 dark:border-stone-800">
            <th className={thClass}>Nombres y Apellidos</th>
            <th className={thClass}>Verificar Hora</th>
            <th className={thClass}>Verificar Ubicación</th>
            <th className={thClass}>Alojamiento</th>
            <th className={thClass}>Fecha</th>
            <th className={thClass}>Km</th>
            <th className={thClass}>Detalles del Trabajo</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
          {data.map((r) => (
            <tr key={r.id} className="hover:bg-stone-100/50 dark:hover:bg-stone-700/30 transition-colors duration-200">
              <td className={tdClass}>
                <div className="font-normal text-slate-800 dark:text-stone-200">{r.nombre} {r.apellidos}</div>
              </td>
              <td className={tdClass}>
                <VerificationCell verified={r.estadoCompletado === 'Completado'} onClick={() => setDateModal({ open: true, record: r })} ref={dateBtnRef} />
              </td>
              <td className={tdClass}>
                <VerificationCell verified={r.estadoCompletado === 'Completado'} onClick={() => setLocationModalOpen(true)} ref={locationBtnRef} />
              </td>
              <td className={tdClass}>
                <span className="inline-block bg-white dark:bg-stone-800 text-slate-500 dark:text-stone-400 text-[11px] px-2 py-0.5 rounded-md soft-shadow font-normal">
                  {r.alojamiento}
                </span>
              </td>
              <td className={`${tdClass}`}>
                <div className="text-[11px] text-slate-400 dark:text-stone-500 mb-0.5">{r.fechaLlegada.split(' ')[0]}</div>
                <div className="text-slate-600 dark:text-stone-400 text-sm tabular-nums">{r.horaInicioTarea} - {r.horaFinTarea}</div>
              </td>
              <td className={`${tdClass} text-slate-600 dark:text-stone-400 tabular-nums`}>{r.cantidadMinutos} km</td>
              <td className={`${tdClass} text-center`}>
                <ObservationButton text={r.observacionesTarea} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <LocationVerificationModal isOpen={locationModalOpen} onClose={() => setLocationModalOpen(false)} anchorRef={locationBtnRef} />
      {dateModal.record && (
        <DateVerificationModal
          isOpen={dateModal.open}
          onClose={() => setDateModal({ open: false, record: null })}
          anchorRef={dateBtnRef}
          appEntry={dateModal.record.fechaLlegada}
          appExit={dateModal.record.fechaFin}
          userEntry={dateModal.record.horaInicioTarea}
          userExit={dateModal.record.horaFinTarea}
        />
      )}
    </>
  );
};

export default Cleans;
