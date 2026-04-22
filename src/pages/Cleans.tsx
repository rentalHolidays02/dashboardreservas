
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
  MapPin,
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
import { getExpectedHours, computeHoursWorked } from '../utils/payments';
import CleanCheckoutFormModal from '../components/cleans/CleanCheckoutFormModal';

type TabType = 'normal' | 'initial' | 'handyman';
type CheckoutRecord = NormalCleanRecord | InitialCleanRecord | HandymanRecord;

const emptyNormalRecord = (): NormalCleanRecord => ({
  id: '',
  telefono: '',
  nombre: '',
  apellidos: '',
  checkinFecha: '',
  checkinUbicacion: '',
  checkoutFecha: '',
  checkoutUbicacion: '',
  apartamento: '',
  horaEntrada: '',
  horaSalida: '',
  sigueHuesped: false,
  fechaSalidaReserva: '',
  recogeLlaves: false,
  km: 0,
  observaciones: '',
  checked: false,
});

const emptyInitialRecord = (): InitialCleanRecord => ({
  id: '',
  telefono: '',
  nombre: '',
  apellidos: '',
  checkinFecha: '',
  checkinUbicacion: '',
  checkoutFecha: '',
  checkoutUbicacion: '',
  apartamento: '',
  horaEntrada: '',
  horaSalida: '',
  km: 0,
  observaciones: '',
  checked: false,
});

const emptyHandymanRecord = (): HandymanRecord => ({
  id: '',
  telefono: '',
  nombre: '',
  apellidos: '',
  fechaLlegada: '',
  ubicacionInicio: '',
  fechaFin: '',
  ubicacionFin: '',
  alojamiento: '',
  horaInicioTarea: '',
  horaFinTarea: '',
  cantidadMinutos: 0,
  observacionesTarea: '',
  estadoCompletado: 'Pendiente',
});

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

const formatDisplayDate = (value: unknown): string => {
  if (!value) return '';
  const raw = String(value);
  const datePart = raw.includes('T') ? raw.split('T')[0] : raw.split(' ')[0];
  const parts = datePart.split('-');
  if (parts.length === 3) {
    const [y, m, d] = parts;
    if (y.length === 4) return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`;
  }
  if (datePart.includes('/')) {
    const slash = datePart.split('/');
    if (slash.length === 3) {
      if (slash[0].length === 4) return `${slash[2].padStart(2, '0')}/${slash[1].padStart(2, '0')}/${slash[0]}`;
      return `${slash[0].padStart(2, '0')}/${slash[1].padStart(2, '0')}/${slash[2]}`;
    }
  }
  return datePart;
};

interface CleansProps {
  userRole?: 'admin' | 'viewer' | 'trabajador';
}

const Cleans: React.FC<CleansProps> = ({ userRole }) => {
  const isReadOnly = userRole === 'viewer';
  const [activeTab, setActiveTab] = useState<TabType>('normal');
  const [loading, setLoading] = useState(true);
  const [normalCleans, setNormalCleans] = useState<NormalCleanRecord[]>([]);
  const [initialCleans, setInitialCleans] = useState<InitialCleanRecord[]>([]);
  const [handymanRecords, setHandymanRecords] = useState<HandymanRecord[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [accommodations, setAccommodations] = useState<Accommodation[]>([]);
  const [geoData, setGeoData] = useState<Record<string, { lat: number, lng: number }>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [checkoutForm, setCheckoutForm] = useState<{
    open: boolean;
    mode: 'create' | 'edit';
    type: TabType;
    record: CheckoutRecord;
  }>({
    open: false,
    mode: 'create',
    type: 'normal',
    record: emptyNormalRecord(),
  });

  // Filter Modal state
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [filters, setFilters] = useState<CleanFilters>({
    startDate: '',
    endDate: '',
    apartment: '',
    timeStatus: 'all',
    extraHours: 'all',
    keysStatus: 'all',
    guestTiming: 'all'
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

  const addressMap = useMemo(() => {
    const map: Record<string, string> = {};
    accommodations.forEach((a) => {
      const key = normalizeKey(a.name);
      const full = [a.address, a.zipCode, a.city, a.provincia].filter(Boolean).join(', ').trim();
      map[key] = full || 'Direccion no encontrada';
    });
    return map;
  }, [accommodations]);

  useEffect(() => {
    appsScriptApi.getWorkers().then(setWorkers);
    appsScriptApi.getAccommodations().then(async (accs) => {
      setAccommodations(accs);
      // Trigger geocoding for each unique address (rate limiting is handled in geocodeAddress)
      for (const acc of accs) {
        if (!acc.address || !acc.city) {
          console.warn(`⚠ Skipping ${acc.name}: missing address or city`);
          continue;
        }

        const cleanedStreet = cleanAddressForSearch(acc.address);
        const fullAddress = `${cleanedStreet}, ${acc.zipCode} ${acc.city}, ${acc.provincia || ''}, Spain`;

        const coords = await geocodeAddress(fullAddress);
        if (coords) {
          console.log(`✓ Geocoded: ${acc.name} -> ${coords.lat}, ${coords.lng}`);
          setGeoData(prev => ({ ...prev, [normalizeKey(acc.name)]: coords }));
        } else {
          console.warn(`✗ Failed to geocode: ${acc.name} (${fullAddress})`);
        }
      }
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

  const refreshCleans = async () => {
    const [nc, ic, hm] = await Promise.all([
      appsScriptApi.getNormalCleans(),
      appsScriptApi.getInitialCleans(),
      appsScriptApi.getHandymanRecords()
    ]);
    setNormalCleans(nc);
    setInitialCleans(ic);
    setHandymanRecords(hm);
  };

  const handleCreateCheckout = (type: TabType) => {
    const record =
      type === 'normal'
        ? emptyNormalRecord()
        : type === 'initial'
          ? emptyInitialRecord()
          : emptyHandymanRecord();
    setCheckoutForm({ open: true, mode: 'create', type, record });
  };

  const handleEditCheckout = (type: TabType, record: NormalCleanRecord | InitialCleanRecord | HandymanRecord) => {
    setCheckoutForm({ open: true, mode: 'edit', type, record });
  };

  const handleCheckoutSubmit = async (record: CheckoutRecord) => {
    try {
      const type = checkoutForm.type;
      setActionLoading(true);
      const requiredName = String((record as any).nombre || '').trim();
      const requiredLastName = String((record as any).apellidos || '').trim();
      const requiredApartment = type === 'handyman'
        ? String((record as HandymanRecord).alojamiento || '').trim()
        : String((record as NormalCleanRecord | InitialCleanRecord).apartamento || '').trim();
      if (!requiredName || !requiredLastName || !requiredApartment) {
        window.alert('Nombre, apellidos y apartamento/alojamiento son obligatorios.');
        return;
      }

      const ok = checkoutForm.mode === 'create'
        ? await appsScriptApi.createCheckoutRecord(type, record)
        : await appsScriptApi.updateCheckoutRecord(type, String((checkoutForm.record as any).id), record);
      if (!ok) throw new Error('No se pudo guardar el checkout');
      setCheckoutForm(prev => ({ ...prev, open: false }));
      await refreshCleans();
    } catch (error) {
      console.error(error);
      window.alert('Error al guardar checkout.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteCheckout = async (type: TabType, id: string) => {
    const confirmed = window.confirm('¿Seguro que deseas borrar este checkout? Esta acción no se puede deshacer.');
    if (!confirmed) return;
    try {
      setActionLoading(true);
      const ok = await appsScriptApi.deleteCheckoutRecord(type, id);
      if (!ok) throw new Error('No se pudo borrar el checkout');
      await refreshCleans();
    } catch (error) {
      console.error(error);
      window.alert('Error al borrar checkout.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUndo = async () => {
    if (!lastAction) return;
    const { id, type, wasChecked } = lastAction;
    try {
      if (type === 'normal') {
        setNormalCleans(prev => prev.map(r => r.id === id ? { ...r, checked: wasChecked } : r));
      } else if (type === 'initial') {
        setInitialCleans(prev => prev.map(r => r.id === id ? { ...r, checked: wasChecked } : r));
      } else {
        setHandymanRecords(prev => prev.map(r => r.id === id ? { ...r, estadoCompletado: wasChecked ? 'Completado' : 'Pendiente' } : r));
      }
      await appsScriptApi.updateCleanStatus(type, id, wasChecked);
      setLastAction(null);
    } catch (error) {
      console.error('Error undoing status:', error);
    }
  };

  useEffect(() => {
    if (!lastAction) return;
    const timer = setTimeout(() => setLastAction(null), 8000);
    return () => clearTimeout(timer);
  }, [lastAction]);

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filters.startDate || filters.endDate) count++;
    if (filters.timeStatus !== 'all') count++;
    if (activeTab === 'normal' && filters.extraHours !== 'all') count++;
    if (activeTab === 'normal' && filters.keysStatus !== 'all') count++;
    if (activeTab === 'normal' && filters.guestTiming !== 'all') count++;
    return count;
  }, [filters, activeTab]);

  const applyFilters = (record: NormalCleanRecord | InitialCleanRecord | HandymanRecord) => {
    const s = searchTerm.toLowerCase();
    
    // Search matching
    let fullName = '';
    let telefono = '';
    let apt = '';
    let fecha = '';
    let timeVerified = false;
    let hasExtraHours = false;
    let keysDelivered = false;
    let guestLate = false;
    const isNormalRecord = 'recogeLlaves' in record && 'sigueHuesped' in record;

    if ('nombre' in record) {
      fullName = `${record.nombre || ''} ${record.apellidos || ''}`.toLowerCase();
      telefono = String(record.telefono || '').toLowerCase();
      apt = String(('apartamento' in record ? record.apartamento : (record as any).alojamiento) || '').toLowerCase();
      fecha = 'checkinFecha' in record ? record.checkinFecha : (record as HandymanRecord).fechaLlegada;
      if ('horaEntrada' in record && 'horaSalida' in record) {
        const normalOrInitial = record as NormalCleanRecord | InitialCleanRecord;
        timeVerified = isTimeVerified(normalOrInitial.checkinFecha, normalOrInitial.checkoutFecha, normalOrInitial.horaEntrada, normalOrInitial.horaSalida);
        if (isNormalRecord) {
          const expected = getExpectedHours(normalOrInitial.apartamento || '');
          const worked = computeHoursWorked(normalOrInitial.horaEntrada, normalOrInitial.horaSalida);
          hasExtraHours = worked > expected;
          keysDelivered = !!(record as NormalCleanRecord).recogeLlaves;
          guestLate = !!(record as NormalCleanRecord).sigueHuesped;
        }
      } else {
        const hm = record as HandymanRecord;
        timeVerified = isTimeVerified(hm.fechaLlegada, hm.fechaFin, hm.horaInicioTarea, hm.horaFinTarea);
      }
    }

    const matchSearch = 
      fullName.includes(s) || 
      telefono.includes(s) || 
      apt.includes(s);

    if (!matchSearch) return false;

    // Filter matching
    if (filters.timeStatus === 'verified' && !timeVerified) return false;
    if (filters.timeStatus === 'unverified' && timeVerified) return false;

    if (isNormalRecord) {
      if (filters.extraHours === 'with_extra' && !hasExtraHours) return false;
      if (filters.extraHours === 'without_extra' && hasExtraHours) return false;
      if (filters.keysStatus === 'delivered' && !keysDelivered) return false;
      if (filters.keysStatus === 'not_delivered' && keysDelivered) return false;
      if (filters.guestTiming === 'on_time' && guestLate) return false;
      if (filters.guestTiming === 'late' && !guestLate) return false;
    }

    const fechaDate = (fecha || '').split('T')[0].split(' ')[0];
    if (filters.startDate && fechaDate < filters.startDate) return false;
    if (filters.endDate && fechaDate > filters.endDate) return false;

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
          {!isReadOnly && (
            <button
              onClick={() => handleCreateCheckout(activeTab)}
              disabled={actionLoading}
              className="px-4 py-2.5 rounded-xl text-xs font-medium bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-60 disabled:cursor-not-allowed transition"
            >
              {actionLoading ? 'Procesando...' : 'Nuevo Checkout'}
            </button>
          )}
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
              activeTab={activeTab}
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
      <div className="bg-white/60 dark:bg-stone-950 backdrop-blur-md border border-white dark:border-stone-800 rounded-2xl overflow-x-auto">
        {activeTab === 'normal' && (
          <TableNormalCleans 
            data={filteredNormal} 
            photoMap={photoMap} 
            geoData={geoData}
            workers={workers}
            addressMap={addressMap}
            onUpdate={(id, checked) => {
              const old = normalCleans.find(r => r.id === id);
              if (old) setLastAction({ id, type: 'normal', wasChecked: old.checked });
              setNormalCleans(prev => prev.map(r => r.id === id ? { ...r, checked } : r));
              appsScriptApi.updateCleanStatus('normal', id, checked);
            }}
            onEdit={(record) => handleEditCheckout('normal', record)}
            onDelete={(id) => handleDeleteCheckout('normal', id)}
            isReadOnly={isReadOnly}
          />
        )}
        {activeTab === 'initial' && (
          <TableInitialCleans 
            data={filteredInitial} 
            photoMap={photoMap} 
            geoData={geoData}
            workers={workers}
            addressMap={addressMap}
            onUpdate={(id, checked) => {
              const old = initialCleans.find(r => r.id === id);
              if (old) setLastAction({ id, type: 'initial', wasChecked: old.checked });
              setInitialCleans(prev => prev.map(r => r.id === id ? { ...r, checked } : r));
              appsScriptApi.updateCleanStatus('initial', id, checked);
            }}
            onEdit={(record) => handleEditCheckout('initial', record)}
            onDelete={(id) => handleDeleteCheckout('initial', id)}
            isReadOnly={isReadOnly}
          />
        )}
        {activeTab === 'handyman' && (
          <TableHandyman 
            data={filteredHandyman} 
            photoMap={photoMap} 
            geoData={geoData}
            workers={workers}
            addressMap={addressMap}
            onUpdate={(id, checked) => {
              const old = handymanRecords.find(r => r.id === id);
              if (old) setLastAction({ id, type: 'handyman', wasChecked: old.estadoCompletado === 'Completado' });
              setHandymanRecords(prev => prev.map(r => r.id === id ? { ...r, estadoCompletado: checked ? 'Completado' : 'Pendiente' } : r));
              appsScriptApi.updateCleanStatus('handyman', id, checked);
            }}
            onEdit={(record) => handleEditCheckout('handyman', record)}
            onDelete={(id) => handleDeleteCheckout('handyman', id)}
            isReadOnly={isReadOnly}
          />
        )}
      </div>
      <CleanCheckoutFormModal
        isOpen={checkoutForm.open}
        mode={checkoutForm.mode}
        type={checkoutForm.type}
        initialValues={checkoutForm.record}
        loading={actionLoading}
        onClose={() => setCheckoutForm(prev => ({ ...prev, open: false }))}
        onSubmit={handleCheckoutSubmit}
      />
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

const StatusIconButton = React.forwardRef<HTMLElement, {
  verified: boolean;
  onClick: (ev: React.MouseEvent<HTMLElement>) => void;
  icon: 'clock' | 'map';
}>(({ verified, onClick, icon }, ref) => (
  <button
    ref={ref as any}
    type="button"
    onClick={onClick}
    className={`inline-flex items-center justify-center w-8 h-8 rounded-lg transition ${
      icon === 'map'
        ? 'text-slate-500 hover:text-orange-500 dark:text-stone-400 dark:hover:text-orange-400'
        : (verified
          ? 'text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300'
          : 'text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300')
    }`}
  >
    {icon === 'clock' ? <Clock size={14} /> : <MapPin size={14} />}
  </button>
));

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

    // Marcadores del trabajador (checkin/checkout)
    markers?.forEach((m, i) => {
      const marker = L.circleMarker(m, {
        radius: 7,
        color: 'white',
        fillColor: i === 0 ? '#10b981' : '#3b82f6',
        fillOpacity: 1,
        weight: 2.5,
      }).addTo(map).bindPopup(i === 0 ? 'Entrada' : 'Salida');

      marker.on('mouseover', () => {
        marker.setStyle({ radius: 9, weight: 3 });
        const el = marker.getElement() as HTMLElement | null;
        if (el) el.style.cursor = 'pointer';
      });
      marker.on('mouseout', () => marker.setStyle({ radius: 7, weight: 2.5 }));
      marker.on('click', () => {
        const [lat, lng] = m;
        window.open(`https://www.google.com/maps?q=${lat},${lng}`, '_blank', 'noopener,noreferrer');
      });
    });

    // Ajustar el zoom para mostrar todos los puntos
    if (markers && markers.length > 0) {
      const group = L.featureGroup([
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
  apartmentName?: string;
}> = ({ isOpen, onClose, anchorRef, targetCoords, userCoords, apartmentName }) => {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [show, setShow] = useState(false);

  useLayoutEffect(() => {
    if (isOpen && anchorRef) {
      const rect = anchorRef.getBoundingClientRect();
      const popupW = 280;
      const popupH = targetCoords ? 240 : 170;
      const left = Math.max(8, Math.min(rect.left, window.innerWidth - popupW - 8));
      const openAbove = rect.bottom + 6 + popupH > window.innerHeight - 8;
      const top = openAbove ? Math.max(8, rect.top - popupH - 6) : rect.bottom + 6;
      setPos({ top, left });
      setTimeout(() => setShow(true), 100);
    } else {
      setShow(false);
      setPos(null);
    }
  }, [isOpen, anchorRef, targetCoords]);

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
        style={{ top: pos?.top ?? 0, left: pos?.left ?? 0, width: 280, height: targetCoords ? 240 : 'auto' }}
      >
        {show && targetCoords && (
          <div className="w-full h-full relative">
            <MiniMap target={targetCoords} markers={userCoords} />
          </div>
        )}
        {!targetCoords && isOpen && (
          <div className="w-full flex flex-col items-center justify-center p-6 text-center gap-3">
            <XCircle size={28} className="text-red-400" />
            <div>
              <p className="text-xs text-slate-700 dark:text-stone-300 font-medium mb-1">Ubicación no encontrada</p>
              <p className="text-[10px] text-slate-500 dark:text-stone-500 leading-relaxed">
                No se pudo geocodificar la dirección de "{apartmentName}"
              </p>
            </div>
            <p className="text-[10px] text-slate-400 dark:text-stone-600 italic">
              Verifica la dirección en Alojamientos o espera unos segundos y reintenta
            </p>
          </div>
        )}
      </div>
    </>,
    document.body
  );
};

// Extracts a time token like "HH:mm" or "HH:mm:ss" from mixed datetime strings.
const extractTimeToken = (value: string): string | null => {
  if (!value) return null;
  const match = String(value).trim().match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  return match ? match[0] : null;
};

// Parses time strings and returns minutes from midnight, or null if invalid.
const toMinutes = (time: string): number | null => {
  const token = extractTimeToken(time);
  if (!token) return null;
  const [hRaw, mRaw] = token.split(':');
  const h = Number(hRaw);
  const m = Number(mRaw);
  if (!Number.isFinite(h) || !Number.isFinite(m) || h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
};

const formatTime = (time: string): string => {
  if (!time) return '';
  const part = extractTimeToken(time);
  if (!part) return '';
  const parts = part.split(':');
  if (parts.length >= 2) {
    return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
  }
  return part;
};

const diffMinutes = (a: string, b: string): number | null => {
  const aMinutes = toMinutes(a);
  const bMinutes = toMinutes(b);
  if (aMinutes === null || bMinutes === null) return null;
  return Math.abs(aMinutes - bMinutes);
};

const isTimeVerified = (appEntry: string, appExit: string, userEntry: string, userExit: string): boolean => {
  const entryDiff = diffMinutes(appEntry, userEntry);
  const exitDiff = diffMinutes(appExit, userExit);
  if (entryDiff === null || exitDiff === null) return false;
  return entryDiff <= 30 && exitDiff <= 30;
};

// Date verification popup
interface DateVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  anchorRef: HTMLElement | null;
  appEntry: string;   // from checkinFecha
  appExit: string;    // from checkoutFecha
  userEntry: string;  // horaEntrada
  userExit: string;   // horaSalida
}

const DateVerificationModal: React.FC<DateVerificationModalProps> = ({
  isOpen, onClose, anchorRef, appEntry, appExit, userEntry, userExit
}) => {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    if (isOpen && anchorRef) {
      const rect = anchorRef.getBoundingClientRect();
      const popupW = 240;
      const popupH = 220;
      const left = Math.max(8, Math.min(rect.left, window.innerWidth - popupW - 8));
      const openAbove = rect.bottom + 6 + popupH > window.innerHeight - 8;
      const top = openAbove ? Math.max(8, rect.top - popupH - 6) : rect.bottom + 6;
      setPos({ top, left });
    } else {
      setPos(null);
    }
  }, [isOpen, anchorRef]);

  const entryDiff = diffMinutes(appEntry, userEntry);
  const exitDiff = diffMinutes(appExit, userExit);
  const entryOk = entryDiff !== null && entryDiff <= 30;
  const exitOk = exitDiff !== null && exitDiff <= 30;
  const allOk = entryOk && exitOk;

  const Row: React.FC<{ label: string; app: string; user: string; ok: boolean; diff: number | null }> = ({ label, app, user, ok, diff }) => {
    return (
      <div className="space-y-1.5">
        <p className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-stone-500 font-medium">{label}</p>
        <div className="flex items-center gap-2">
          {/* App value */}
          <div className="flex-1 bg-slate-50 dark:bg-stone-800 rounded-lg px-2.5 py-1.5">
            <p className="text-[9px] text-slate-400 dark:text-stone-500 mb-0.5">App</p>
            <p className="text-xs font-semibold text-slate-700 dark:text-stone-200 tabular-nums">{formatTime(app) || '—'}</p>
          </div>
          {/* Diff badge */}
          <div className={`flex flex-col items-center px-1.5 py-1 rounded-lg text-[9px] font-bold tabular-nums ${ok ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400' : 'bg-red-50 dark:bg-red-900/30 text-red-500 dark:text-red-400'}`}>
            <span>{ok ? '✓' : '✗'}</span>
            <span>{diff === null ? '—' : `${diff}m`}</span>
          </div>
          {/* User value */}
          <div className="flex-1 bg-slate-50 dark:bg-stone-800 rounded-lg px-2.5 py-1.5">
            <p className="text-[9px] text-slate-400 dark:text-stone-500 mb-0.5">Usuario</p>
            <p className={`text-xs font-semibold tabular-nums ${ok ? 'text-slate-700 dark:text-stone-200' : 'text-red-500 dark:text-red-400'}`}>{formatTime(user) || '—'}</p>
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
      </div>
    </>,
    document.body
  );
};

const thClass = "px-6 py-5 sm:px-8 sm:py-6 text-xs font-normal text-slate-400 dark:text-stone-500 capitalize whitespace-nowrap";
const tdClass = "px-6 py-5 sm:px-8 sm:py-7";

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

const ApartmentAddressModal: React.FC<{
  isOpen: boolean;
  anchorRef: React.RefObject<HTMLElement | null>;
  apartmentName: string;
  address?: string;
}> = ({ isOpen, anchorRef, apartmentName, address }) => {
  const [pos, setPos] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (isOpen && anchorRef.current) {
      const rect = anchorRef.current.getBoundingClientRect();
      const popupW = 260;
      const popupH = 120;
      const left = Math.max(8, Math.min(rect.left, window.innerWidth - popupW - 8));
      const openAbove = rect.bottom + 6 + popupH > window.innerHeight - 8;
      const top = openAbove ? Math.max(8, rect.top - popupH - 6) : rect.bottom + 6;
      setPos({ top, left });
    }
  }, [isOpen, anchorRef]);

  return createPortal(
    <div
      className={`fixed z-[110] bg-white dark:bg-stone-900 rounded-2xl overflow-hidden border border-stone-200 dark:border-stone-700 shadow-xl transition-opacity duration-200 pointer-events-none ${isOpen ? 'opacity-100' : 'opacity-0'}`}
      style={{ top: pos.top, left: pos.left, width: 260 }}
    >
      <div className="px-4 py-2.5 flex items-center gap-2 border-b border-stone-100 dark:border-stone-800 bg-orange-50 dark:bg-orange-900/20">
        <MapPin size={13} className="text-orange-500" />
        <span className="text-[11px] font-semibold text-orange-700 dark:text-orange-400">Direccion</span>
      </div>
      <div className="p-3 space-y-1.5">
        <p className="text-[10px] text-slate-400 dark:text-stone-500">{apartmentName}</p>
        <p className="text-xs text-slate-600 dark:text-stone-300 leading-relaxed">{address || 'Direccion no encontrada'}</p>
      </div>
    </div>,
    document.body
  );
};

const ApartmentAddressButton: React.FC<{ apartmentName: string; address?: string }> = ({ apartmentName, address }) => {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(prev => !prev); }}
        onMouseEnter={(e) => { e.stopPropagation(); setOpen(true); }}
        onMouseLeave={() => setOpen(false)}
        className="inline-block bg-white dark:bg-stone-800 text-[11px] px-2 py-0.5 rounded-md soft-shadow font-normal text-slate-500 dark:text-stone-400 hover:text-orange-500 dark:hover:text-orange-400 transition-colors"
      >
        {apartmentName}
      </button>
      <ApartmentAddressModal isOpen={open} anchorRef={btnRef} apartmentName={apartmentName} address={address} />
    </>
  );
};

// Sub-components: Tables
const TableNormalCleans: React.FC<{
  data: NormalCleanRecord[];
  photoMap: Record<string, string>;
  geoData: Record<string, { lat: number, lng: number }>;
  workers: Worker[];
  addressMap: Record<string, string>;
  onUpdate: (id: string, checked: boolean) => void;
  onEdit: (record: NormalCleanRecord) => void;
  onDelete: (id: string) => void;
  isReadOnly?: boolean;
}> = ({ data, geoData, workers, addressMap, onUpdate, onEdit, onDelete, isReadOnly }) => {
  const [locationModal, setLocationModal] = useState<{
    open: boolean;
    anchor: HTMLElement | null;
    targetCoords?: [number, number];
    userCoords?: [number, number][];
    apartmentName?: string;
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
            <th className={thClass}>Apartamento</th>
            <th className={thClass}>Fecha</th>
            <th className={thClass}>Km</th>
            <th className={thClass}>Hora</th>
            <th className={thClass}>GPS</th>
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
                          const w = workers.find(worker => matchesWorkerByPhone(worker.telefono, r.telefono));
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
                <td className={tdClass}>
                  <ApartmentAddressButton apartmentName={r.apartamento} address={addressMap[normalizeKey(r.apartamento)]} />
                </td>
                <td className={`${tdClass}`}>
                  <div className="text-[11px] text-slate-400 dark:text-stone-500 mb-0.5">{formatDisplayDate(r.checkinFecha)}</div>
                  <div className="text-slate-600 dark:text-stone-400 text-sm tabular-nums">{formatTime(r.horaEntrada)} - {formatTime(r.horaSalida)}</div>
                </td>
                <td className={`${tdClass} text-slate-600 dark:text-stone-400 tabular-nums`}>{r.km} km</td>
                <td className={tdClass} onClick={(e) => e.stopPropagation()}>
                  <StatusIconButton
                    verified={isTimeVerified(r.checkinFecha, r.checkoutFecha, r.horaEntrada, r.horaSalida)}
                    icon="clock"
                    onClick={(ev) => setDateModal({ open: true, record: r, anchor: ev.currentTarget })}
                  />
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
                      <StatusIconButton
                        verified={!!isVerified}
                        icon="map"
                        onClick={(ev) => setLocationModal({
                          open: true,
                          anchor: ev.currentTarget,
                          targetCoords: target ? [target.lat, target.lng] : undefined,
                          userCoords: [checkin, checkout].filter(c => c !== null) as [number, number][],
                          apartmentName: r.apartamento
                        })}
                      />
                    );
                  })()}
                </td>
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
                        <VerificationCell 
                          verified={r.checked} 
                          onClick={isReadOnly ? () => {} : () => onUpdate(r.id, !r.checked)} 
                        />
                      </div>
                      {!isReadOnly && (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-slate-400 dark:text-stone-500 font-bold">
                            <span>Acciones</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <button type="button" onClick={() => onEdit(r)} className="px-3 py-1.5 text-xs rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">Editar</button>
                            <button type="button" onClick={() => onDelete(r.id)} className="px-3 py-1.5 text-xs rounded-lg bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">Borrar</button>
                          </div>
                        </div>
                      )}

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
  addressMap: Record<string, string>;
  onUpdate: (id: string, checked: boolean) => void;
  onEdit: (record: InitialCleanRecord) => void;
  onDelete: (id: string) => void;
  isReadOnly?: boolean;
}> = ({ data, geoData, workers, addressMap, onUpdate, onEdit, onDelete, isReadOnly }) => {
  const [locationModal, setLocationModal] = useState<{
    open: boolean;
    anchor: HTMLElement | null;
    targetCoords?: [number, number];
    userCoords?: [number, number][];
    apartmentName?: string;
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
            <th className={thClass}>Apartamento</th>
            <th className={thClass}>Fecha</th>
            <th className={thClass}>Km</th>
            <th className={thClass}>Hora</th>
            <th className={thClass}>GPS</th>
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
                        const w = workers.find(worker => matchesWorkerByPhone(worker.telefono, r.telefono));
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
                <td className={tdClass}>
                  <ApartmentAddressButton apartmentName={r.apartamento} address={addressMap[normalizeKey(r.apartamento)]} />
                </td>
                <td className={`${tdClass}`}>
                  <div className="text-[11px] text-slate-400 dark:text-stone-500 mb-0.5">{formatDisplayDate(r.checkinFecha)}</div>
                  <div className="text-slate-600 dark:text-stone-400 text-sm tabular-nums">{formatTime(r.horaEntrada)} - {formatTime(r.horaSalida)}</div>
                </td>
                <td className={`${tdClass} text-slate-600 dark:text-stone-400 tabular-nums`}>{r.km} km</td>
                <td className={tdClass} onClick={(e) => e.stopPropagation()}>
                  <StatusIconButton
                    verified={isTimeVerified(r.checkinFecha, r.checkoutFecha, r.horaEntrada, r.horaSalida)}
                    icon="clock"
                    onClick={(ev) => setDateModal({ open: true, record: r, anchor: ev.currentTarget })}
                  />
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
                      <StatusIconButton
                        verified={!!isVerified}
                        icon="map"
                        onClick={(ev) => setLocationModal({
                          open: true,
                          anchor: ev.currentTarget,
                          targetCoords: target ? [target.lat, target.lng] : undefined,
                          userCoords: [checkin, checkout].filter(c => c !== null) as [number, number][],
                          apartmentName: r.apartamento
                        })}
                      />
                    );
                  })()}
                </td>
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
                        <VerificationCell 
                          verified={r.checked} 
                          onClick={isReadOnly ? () => {} : () => onUpdate(r.id, !r.checked)} 
                        />
                      </div>
                      {!isReadOnly && (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-slate-400 dark:text-stone-500 font-bold">
                            <span>Acciones</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <button type="button" onClick={() => onEdit(r)} className="px-3 py-1.5 text-xs rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">Editar</button>
                            <button type="button" onClick={() => onDelete(r.id)} className="px-3 py-1.5 text-xs rounded-lg bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">Borrar</button>
                          </div>
                        </div>
                      )}
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
  addressMap: Record<string, string>;
  onUpdate: (id: string, checked: boolean) => void;
  onEdit: (record: HandymanRecord) => void;
  onDelete: (id: string) => void;
  isReadOnly?: boolean;
}> = ({ data, geoData, workers, addressMap, onUpdate, onEdit, onDelete, isReadOnly }) => {
  const [locationModal, setLocationModal] = useState<{
    open: boolean;
    anchor: HTMLElement | null;
    targetCoords?: [number, number];
    userCoords?: [number, number][];
    apartmentName?: string;
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
            <th className={thClass}>Detalles del Trabajo</th>
            <th className={thClass}>Alojamiento</th>
            <th className={thClass}>Fecha</th>
            <th className={thClass}>Km</th>
            <th className={thClass}>Hora</th>
            <th className={thClass}>GPS</th>
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
                        const w = workers.find(worker => matchesWorkerByPhone(worker.telefono, r.telefono));
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
                <td className={`${tdClass} text-center`}>
                  <ObservationButton text={r.observacionesTarea} modalTitle="" />
                </td>
                <td className={tdClass}>
                  <ApartmentAddressButton apartmentName={r.alojamiento} address={addressMap[normalizeKey(r.alojamiento)]} />
                </td>
                <td className={`${tdClass}`}>
                  <div className="text-[11px] text-slate-400 dark:text-stone-500 mb-0.5">{formatDisplayDate(r.fechaLlegada)}</div>
                  <div className="text-slate-600 dark:text-stone-400 text-sm tabular-nums">{formatTime(r.horaInicioTarea)} - {formatTime(r.horaFinTarea)}</div>
                </td>
                <td className={`${tdClass} text-slate-600 dark:text-stone-400 tabular-nums`}>{r.cantidadMinutos} min</td>
                <td className={tdClass} onClick={(e) => e.stopPropagation()}>
                  <StatusIconButton
                    verified={isTimeVerified(r.fechaLlegada, r.fechaFin, r.horaInicioTarea, r.horaFinTarea)}
                    icon="clock"
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
                      <StatusIconButton
                        verified={!!isVerified}
                        icon="map"
                        onClick={(ev) => setLocationModal({
                          open: true,
                          anchor: ev.currentTarget,
                          targetCoords: target ? [target.lat, target.lng] : undefined,
                          userCoords: [checkin, checkout].filter(c => c !== null) as [number, number][],
                          apartmentName: r.alojamiento
                        })}
                      />
                    );
                  })()}
                </td>
              </tr>
              {expandedId === r.id && (
                <tr className="bg-orange-50/20 dark:bg-stone-900/40 border-b border-stone-100 dark:border-stone-800 animate-in fade-in slide-in-from-top-2 duration-300">
                  <td colSpan={7} className="px-8 py-6">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-slate-400 dark:text-stone-500 font-bold">
                          <MessageSquare size={12} className="text-orange-500" />
                          <span>Detalles del Trabajo</span>
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
                        <VerificationCell 
                          verified={r.estadoCompletado === 'Completado'} 
                          onClick={isReadOnly ? () => {} : () => onUpdate(r.id, r.estadoCompletado !== 'Completado')} 
                        />
                      </div>
                      {!isReadOnly && (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-slate-400 dark:text-stone-500 font-bold">
                            <span>Acciones</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <button type="button" onClick={() => onEdit(r)} className="px-3 py-1.5 text-xs rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">Editar</button>
                            <button type="button" onClick={() => onDelete(r.id)} className="px-3 py-1.5 text-xs rounded-lg bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">Borrar</button>
                          </div>
                        </div>
                      )}
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
        />
      )}
    </>
  );
};

export default Cleans;
