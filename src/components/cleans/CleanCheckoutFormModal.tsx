import React, { useEffect, useMemo, useState, useRef } from 'react';
import { 
  X, 
  User, 
  Home, 
  Clock, 
  Calendar, 
  MapPin, 
  Info, 
  CheckCircle2, 
  AlertCircle,
  Hash,
  Navigation,
  MessageSquare,
  Check,
  LocateFixed
} from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { InitialCleanRecord, HandymanRecord, NormalCleanRecord, Worker, Accommodation } from '../../services/mockData';
import { computeHoursWorked, getExpectedHours, matchesWorkerByPhone } from '../../utils/payments';
import { appsScriptApi, reverseGeocode } from '../../services/api';

// Fix for default marker icons in Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

export type CheckoutTabType = 'normal' | 'initial' | 'handyman';
type CheckoutRecord = NormalCleanRecord | InitialCleanRecord | HandymanRecord;

interface Props {
  isOpen: boolean;
  mode: 'create' | 'edit';
  type: CheckoutTabType;
  initialValues: CheckoutRecord;
  workers: Worker[];
  accommodations: Accommodation[];
  loading?: boolean;
  onClose: () => void;
  onSubmit: (record: CheckoutRecord) => Promise<void> | void;
}

const formatPhoneNumber = (value: string): string => {
  const digits = value.replace(/\D/g, '').slice(0, 9);
  const parts = [];
  if (digits.length > 0) parts.push(digits.slice(0, 3));
  if (digits.length > 3) parts.push(digits.slice(3, 5));
  if (digits.length > 5) parts.push(digits.slice(5, 7));
  if (digits.length > 7) parts.push(digits.slice(7, 9));
  return parts.join(' ');
};

const COUNTRY_PREFIXES = [
  { code: '+34', label: 'ESP', flag: '🇪🇸' },
  { code: '+33', label: 'FRA', flag: '🇫🇷' },
  { code: '+39', label: 'ITA', flag: '🇮🇹' },
  { code: '+44', label: 'GBR', flag: '🇬🇧' },
  { code: '+49', label: 'DEU', flag: '🇩🇪' },
  { code: '+351', label: 'PRT', flag: '🇵🇹' },
];

const toDigits = (s: string) => String(s || '').replace(/\D/g, '');

const splitFullName = (fullName: string): { nombre: string; apellidos: string } => {
  const parts = String(fullName || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { nombre: '', apellidos: '' };
  if (parts.length === 1) return { nombre: parts[0], apellidos: '' };
  return { nombre: parts[0], apellidos: parts.slice(1).join(' ') };
};

const normalizeNameKey = (s: string) => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');

const formatWorkerPhoneForSheet = (prefix: string, localDigits: string) => {
  const p = prefix.startsWith('+') ? prefix : `+${prefix}`;
  const formatted = formatPhoneNumber(localDigits);
  return `${p} ${formatted}`.trim();
};

// Valida si una cadena tiene el formato "lat, lng" (solo números, no direcciones de texto)
const isCoordString = (s: string): boolean =>
  /^-?\d+(\.\d+)?,\s*-?\d+(\.\d+)?$/.test(s.trim());

const toISOForInput = (dateStr: string) => {
  if (!dateStr) return '';
  if (dateStr.includes('T')) return dateStr;
  
  const match = dateStr.match(/(\d{2})\/(\d{2})\/(\d{4})(?:\s+|T)(\d{2}:\d{2}(?::\d{2})?)/);
  if (match) {
    return `${match[3]}-${match[2]}-${match[1]}T${match[4]}`;
  }
  return dateStr.replace(' ', 'T');
};

const MapPickerModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (address: string, coords: string) => void;
  initialValue?: string;
  siblingValue?: string;
}> = ({ isOpen, onClose, onConfirm, initialValue, siblingValue }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  const [address, setAddress] = useState('');
  const [coords, setCoords] = useState('');
  const [loadingMap, setLoadingMap] = useState(false);
  const [hasSelection, setHasSelection] = useState(false);

  useEffect(() => {
    // Evita doble inicialización de Leaflet (React StrictMode / cambios de deps)
    if (!mapContainerRef.current || mapRef.current) return;

    const CASTELLON: [number, number] = [39.9864, -0.0513];
    let initialPos: [number, number] = CASTELLON;

    // Solo parsear si es realmente un string de coordenadas
    if (initialValue && isCoordString(initialValue)) {
      const parts = initialValue.split(',').map(s => parseFloat(s.trim()));
      if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        initialPos = [parts[0], parts[1]];
      }
    }

    const map = L.map(mapContainerRef.current, {
      center: initialPos,
      zoom: 15,
      zoomControl: false,
      attributionControl: false
    });
    mapRef.current = map;

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png').addTo(map);

    // Marcador de referencia del campo hermano (solo si tiene coordenadas válidas)
    if (siblingValue && isCoordString(siblingValue)) {
      const sParts = siblingValue.split(',').map((s: string) => parseFloat(s.trim()));
      if (!isNaN(sParts[0]) && !isNaN(sParts[1])) {
        const siblingIcon = L.icon({
          iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
          shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
          iconSize: [25, 41],
          iconAnchor: [12, 41],
          className: 'grayscale opacity-50'
        });
        L.marker([sParts[0], sParts[1]], { icon: siblingIcon, interactive: false })
          .addTo(map)
          .bindTooltip('Referencia del otro punto', { permanent: false, direction: 'top' });
      }
    }

    const placeMarker = async (latlng: L.LatLng) => {
      if (!mapRef.current) return;
      if (markerRef.current) {
        markerRef.current.setLatLng(latlng);
      } else {
        markerRef.current = L.marker(latlng).addTo(mapRef.current);
      }
      const cStr = `${latlng.lat.toFixed(6)}, ${latlng.lng.toFixed(6)}`;
      setCoords(cStr);
      setHasSelection(true);
      setLoadingMap(true);
      try {
        const addr = await reverseGeocode(cStr);
        setAddress(addr || 'Ubicación seleccionada');
      } catch {
        setAddress('Ubicación seleccionada');
      } finally {
        setLoadingMap(false);
      }
    };

    // Centro inicial: si ya tiene coords propias, centra ahí y pone el marcador
    if (initialValue && isCoordString(initialValue)) {
      placeMarker(new L.LatLng(initialPos[0], initialPos[1]));
    } else if (siblingValue && isCoordString(siblingValue)) {
      // Centra cerca del otro punto
      const sParts = siblingValue.split(',').map((s: string) => parseFloat(s.trim()));
      map.setView([sParts[0], sParts[1]], 16);
    } else {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (mapRef.current) mapRef.current.setView([pos.coords.latitude, pos.coords.longitude], 16);
        },
        () => {
          if (mapRef.current) mapRef.current.setView(CASTELLON, 15);
        },
        { timeout: 5000 }
      );
    }

    map.on('click', (e) => placeMarker(e.latlng));

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markerRef.current = null;
      }
    };
  }, []); // deps vacías: el componente se desmonta con key={field} en el padre

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-stone-900/60 backdrop-blur-md animate-in fade-in duration-300" onClick={onClose} />
      <div className="relative w-full max-w-4xl h-[80vh] bg-white dark:bg-stone-950 rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-300">
        <div className="absolute top-6 left-1/2 -translate-x-1/2 z-10 w-[90%] max-w-md">
          <div className="bg-white/95 dark:bg-stone-900/95 backdrop-blur shadow-xl border border-stone-200 dark:border-stone-800 rounded-2xl px-6 py-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-orange-500/10 flex items-center justify-center text-orange-600">
              <MapPin size={20} />
            </div>
            <div className="flex-1 truncate">
              <p className="text-[10px] text-slate-400 dark:text-stone-500 uppercase tracking-widest font-black">Punto de interés</p>
              <p className="text-sm text-slate-800 dark:text-stone-200 font-medium truncate leading-tight">
                {hasSelection ? (loadingMap ? 'Geocodificando...' : address) : 'Haz clic para colocar el pin'}
              </p>
            </div>
          </div>
        </div>
        <div ref={mapContainerRef} className="flex-1 w-full z-0" />
        <div className="p-8 bg-white dark:bg-stone-950 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-stone-100 dark:border-stone-800/50">
          <div className="flex items-center gap-3 text-slate-400 dark:text-stone-600">
            <Info size={14} />
            <p className="text-[11px] font-medium italic">Haz clic en cualquier parte del mapa para fijar la ubicación.</p>
          </div>
          <div className="flex items-center gap-4 w-full sm:w-auto">
            <button onClick={onClose} className="flex-1 sm:flex-none px-8 py-3.5 text-xs font-bold text-slate-500 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-900 rounded-xl transition-all uppercase tracking-widest">
              Cerrar
            </button>
            <button 
              onClick={() => onConfirm(address, coords)}
              disabled={!hasSelection || loadingMap}
              className="flex-[2] sm:flex-none px-12 py-3.5 bg-orange-500 text-white text-xs font-black rounded-xl hover:bg-orange-600 shadow-xl shadow-orange-500/30 active:scale-95 transition-all disabled:opacity-30 disabled:grayscale disabled:cursor-not-allowed uppercase tracking-widest flex items-center justify-center gap-2"
            >
              <Check size={18} />
              Confirmar ubicación
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const CleanCheckoutFormModal: React.FC<Props> = ({ 
  isOpen, 
  mode, 
  type, 
  initialValues, 
  workers,
  accommodations,
  loading = false, 
  onClose, 
  onSubmit 
}) => {
  const [form, setForm] = useState<CheckoutRecord>(initialValues);
  const [error, setError] = useState('');
  const [kmInput, setKmInput] = useState<string>(String((initialValues as any).km ?? (initialValues as any).cantidadMinutos ?? 0));
  const [mapPicker, setMapPicker] = useState<{ open: boolean; field: string; initial?: string; sibling?: string }>({ open: false, field: '' });
  
  const [phonePrefix, setPhonePrefix] = useState('+34');
  const [workerInput, setWorkerInput] = useState('');
  const [accommodationInput, setAccommodationInput] = useState('');
  const [workerPickerOpen, setWorkerPickerOpen] = useState(false);
  const [accPickerOpen, setAccPickerOpen] = useState(false);
  const [extraHoursReason, setExtraHoursReason] = useState('');
  const [reservaTime, setReservaTime] = useState('');
  const [reservaDate, setReservaDate] = useState('');

  useEffect(() => {
    setForm(initialValues);
    setKmInput(String((initialValues as any).km ?? (initialValues as any).cantidadMinutos ?? 0));
    setError('');

    const telRaw = String((initialValues as any).telefono || '');
    const telDigits = toDigits(telRaw);
    // Soporta formato viejo "+34 600..." y el nuevo "34#########"
    if (telRaw.startsWith('+')) {
      const parts = telRaw.split(' ');
      const prefix = parts[0];
      if (COUNTRY_PREFIXES.some(p => p.code === prefix)) {
        setPhonePrefix(prefix);
        updateField('telefono', parts.slice(1).join(' '));
      }
    } else if (telDigits.length > 9) {
      const knownPrefix = COUNTRY_PREFIXES.find(p => telDigits.startsWith(toDigits(p.code)));
      if (knownPrefix) {
        setPhonePrefix(knownPrefix.code);
        const local = telDigits.slice(toDigits(knownPrefix.code).length).slice(-9);
        updateField('telefono', formatPhoneNumber(local));
      } else {
        updateField('telefono', formatPhoneNumber(telDigits.slice(-9)));
      }
    } else if (telDigits.length > 0) {
      updateField('telefono', formatPhoneNumber(telDigits));
    }

    const currentFullName = `${String((initialValues as any).nombre || '').trim()} ${String((initialValues as any).apellidos || '').trim()}`.trim();
    setWorkerInput(currentFullName);
    const isHandymanLocal = type === 'handyman';
    const apt = isHandymanLocal
      ? String((initialValues as HandymanRecord).alojamiento || '')
      : String((initialValues as NormalCleanRecord | InitialCleanRecord).apartamento || '');
    setAccommodationInput(apt);

    if (type === 'normal') {
      const val = (initialValues as NormalCleanRecord).fechaSalidaReserva || '';
      const raw = String(val || '').trim();
      if (!raw) {
        setReservaTime('');
        setReservaDate('');
      } else if (raw.includes(',')) {
        const [a, b] = raw.split(',').map(s => s.trim());
        // Soportar ambos formatos: "HH:mm, DD/MM/YYYY" y "DD/MM/YYYY, HH:mm"
        const aIsTime = /\d{1,2}:\d{2}/.test(a);
        setReservaTime(aIsTime ? a : b);
        setReservaDate(aIsTime ? b : a);
      } else if (raw.includes(' ')) {
        // Soporta "DD/MM/YYYY HH:mm" o "YYYY-MM-DD HH:mm"
        const parts = raw.split(' ').filter(Boolean);
        const maybeTime = parts.find(p => /\d{1,2}:\d{2}/.test(p)) || '';
        const maybeDate = parts.find(p => /\d{2}\/\d{2}\/\d{4}/.test(p) || /\d{4}-\d{2}-\d{2}/.test(p)) || '';
        setReservaTime(maybeTime);
        setReservaDate(maybeDate);
      } else {
        setReservaTime('');
        setReservaDate('');
      }
    }
  }, [initialValues, isOpen]);

  const isHandyman = type === 'handyman';
  const title = `${mode === 'create' ? 'Nuevo' : 'Editar'} Checkout`;

  const apartmentValue = isHandyman 
    ? (form as HandymanRecord).alojamiento 
    : (form as NormalCleanRecord | InitialCleanRecord).apartamento;

  const updateField = (field: string, value: any) => {
    setForm(prev => ({ ...prev, [field]: value } as CheckoutRecord));
  };

  const handleKmChange = (val: string) => {
    setKmInput(val);
    const num = parseFloat(val);
    updateField(isHandyman ? 'cantidadMinutos' : 'km', isNaN(num) ? 0 : num);
  };

  const handlePhoneChange = (val: string) => {
    const formatted = formatPhoneNumber(val);
    updateField('telefono', formatted);
  };

  const checkRequired = () => {
    const nombre = String((form as any).nombre || '').trim();
    const apellidos = String((form as any).apellidos || '').trim();
    const workerText = workerInput.trim();
    const apt = String(apartmentValue || '').trim();
    const telLocalDigits = toDigits(String((form as any).telefono || ''));

    if ((!nombre && !apellidos) && !workerText) {
      setError('El operario es obligatorio.');
      return false;
    }
    if (!apt) {
      setError('El alojamiento es obligatorio.');
      return false;
    }
    if (telLocalDigits.length !== 9) {
      setError('El teléfono es obligatorio y debe tener exactamente 9 dígitos (sin prefijo).');
      return false;
    }
    return true;
  };

  const hoursWorked = useMemo(() => {
    if (isHandyman) {
      const f = form as HandymanRecord;
      return computeHoursWorked(f.horaInicioTarea || '', f.horaFinTarea || '');
    }
    const f = form as NormalCleanRecord | InitialCleanRecord;
    return computeHoursWorked(f.horaEntrada || '', f.horaSalida || '');
  }, [form, isHandyman]);

  const expectedHours = useMemo(() => {
    return getExpectedHours(apartmentValue || '');
  }, [apartmentValue]);

  const isExtra = hoursWorked > expectedHours;

  const inputClass = "w-full pl-10 pr-4 py-3.5 bg-white/50 dark:bg-stone-900/50 border border-stone-200 dark:border-stone-800 rounded-xl text-xs text-slate-700 dark:text-stone-300 focus:outline-none focus:ring-1 focus:ring-orange-500/50 transition-all placeholder:text-slate-400 dark:placeholder:text-stone-600 peer";
  const labelClass = "text-[10px] font-bold text-slate-400 dark:text-stone-500 mb-1.5 block ml-1 uppercase tracking-[0.1em]";
  const dropdownClass = "absolute left-0 right-0 mt-2 z-[210] max-h-64 overflow-auto rounded-xl border border-stone-200 dark:border-stone-800 bg-white/95 dark:bg-stone-950/95 backdrop-blur-xl shadow-2xl";
  const dropdownItemClass = "w-full text-left px-4 py-2.5 text-xs text-slate-700 dark:text-stone-200 hover:bg-orange-500/10 dark:hover:bg-orange-500/10 transition";

  const filteredWorkers = useMemo(() => {
    const q = normalizeNameKey(workerInput);
    const all = [...workers].sort((a, b) => a.fullName.localeCompare(b.fullName));
    if (!q) return all.slice(0, 50);
    return all.filter(w => normalizeNameKey(w.fullName).includes(q)).slice(0, 50);
  }, [workerInput, workers]);

  const filteredAccommodations = useMemo(() => {
    const q = normalizeNameKey(accommodationInput);
    const all = [...accommodations].sort((a, b) => a.name.localeCompare(b.name));
    if (!q) return all.slice(0, 80);
    return all.filter(a => normalizeNameKey(a.name).includes(q)).slice(0, 80);
  }, [accommodationInput, accommodations]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 overflow-y-auto">
      <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-sm animate-in fade-in duration-300" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-white/90 dark:bg-stone-950/95 backdrop-blur-xl rounded-[2.5rem] border border-white dark:border-stone-800 shadow-2xl animate-in zoom-in-95 duration-300 my-8">
        <div className="flex items-center justify-between px-8 py-6 border-b border-stone-100 dark:border-stone-800/50">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-orange-500 flex items-center justify-center text-white shadow-lg shadow-orange-500/20">
              <Calendar size={22} />
            </div>
            <div>
              <h3 className="text-xl font-normal text-slate-800 dark:text-stone-200 font-display tracking-tight leading-none">
                {title}
              </h3>
              <p className="text-[10px] text-slate-400 dark:text-stone-500 mt-1.5 uppercase tracking-widest font-black">
                {type === 'normal' ? 'Limpieza Normal' : type === 'initial' ? 'Limpieza Inicial' : 'Tareas de Manitas'}
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-2.5 rounded-2xl bg-stone-50 dark:bg-stone-900 hover:bg-stone-100 dark:hover:bg-stone-800 transition-all text-slate-400">
            <X size={20} />
          </button>
        </div>

        <form className="p-8 max-h-[70vh] overflow-y-auto custom-scrollbar" onSubmit={async (e) => { 
          e.preventDefault(); 
          if (!checkRequired()) return; 
          setError(''); 
          const finalRecord = { ...form } as any;
          // Guardar teléfono del checkout como solo dígitos con prefijo (ej +34 + 777 77 77 77 -> 34777777777)
          const prefixDigits = toDigits(phonePrefix);
          const localDigits = toDigits(String(finalRecord.telefono || ''));
          finalRecord.telefono = prefixDigits && localDigits ? `${prefixDigits}${localDigits}` : localDigits;

          // Si el operario se ha escrito a mano, actualizamos nombre/apellidos desde el input
          const typedWorker = workerInput.trim();
          if (typedWorker) {
            const { nombre, apellidos } = splitFullName(typedWorker);
            finalRecord.nombre = nombre;
            finalRecord.apellidos = apellidos;
          }
          // Si alojamiento se ha escrito a mano
          const typedAcc = accommodationInput.trim();
          if (typedAcc) {
            if (isHandyman) finalRecord.alojamiento = typedAcc;
            else finalRecord.apartamento = typedAcc;
          }

          if (isExtra && extraHoursReason.trim()) {
            const obsKey = isHandyman ? 'observacionesTarea' : 'observaciones';
            const currentObs = String(finalRecord[obsKey] || '').trim();
            finalRecord[obsKey] = currentObs 
              ? `${currentObs}\n[HORAS EXTRA] ${extraHoursReason.trim()}` 
              : `[HORAS EXTRA] ${extraHoursReason.trim()}`;
          }
          if (type === 'normal' && (finalRecord as NormalCleanRecord).sigueHuesped) {
            if (reservaTime && reservaDate) {
              let formattedDate = reservaDate;
              if (reservaDate.includes('-')) {
                const [y, m, d] = reservaDate.split('-');
                formattedDate = `${d}/${parseInt(m, 10)}/${y}`;
              } else if (reservaDate.includes('/')) {
                const [d, m, y] = reservaDate.split('/');
                formattedDate = `${d}/${parseInt(m, 10)}/${y}`;
              }
              // Guardar formato hh:mm dd/m/aaaa
              (finalRecord as NormalCleanRecord).fechaSalidaReserva = `${reservaTime} ${formattedDate}`.trim();
            }
          } else if (type === 'normal') {
            (finalRecord as NormalCleanRecord).fechaSalidaReserva = '';
          }

          // Si el operario no existe aún en la lista, lo añadimos a "informacion operarios"
          const typedKey = normalizeNameKey(typedWorker);
          const exists = !typedKey ? true : workers.some(w => normalizeNameKey(w.fullName) === typedKey);
          const workerPhoneForSheet = formatWorkerPhoneForSheet(phonePrefix, localDigits);
          const phoneExists = !!localDigits && workers.some(w => matchesWorkerByPhone(workerPhoneForSheet, w.telefono));
          if (typedWorker && !exists && !phoneExists) {
            await appsScriptApi.addWorker({
              fullName: typedWorker,
              telefono: workerPhoneForSheet,
              netMoneyMonth: 0,
              owedMoney: 0,
              cleansCountMonth: 0,
              kmsMonth: 0,
              accommodations: [],
              accommodationDetails: [],
            });
          }
          await onSubmit(finalRecord); 
        }}>
          {error && <div className="mb-6 flex items-center gap-3 p-4 bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 rounded-2xl text-xs text-red-600 dark:text-red-400 animate-in slide-in-from-top-2"><AlertCircle size={16} />{error}</div>}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-7">
            <div className="md:col-span-2"><h4 className="text-[10px] font-bold text-orange-500 uppercase tracking-[0.25em] mb-4 flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-orange-500" />Información del Servicio</h4></div>

            <div className="space-y-2">
              <label className={labelClass}>Operario Responsable</label>
              <div className="relative group">
                <User size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-orange-500 transition-colors pointer-events-none" />
                <input
                  className={`${inputClass} !pl-10`}
                  value={workerInput}
                  onFocus={() => setWorkerPickerOpen(true)}
                  onBlur={() => setTimeout(() => setWorkerPickerOpen(false), 120)}
                  onChange={(e) => {
                    const val = e.target.value;
                    setWorkerInput(val);
                    const { nombre, apellidos } = splitFullName(val);
                    updateField('nombre', nombre);
                    updateField('apellidos', apellidos);

                    const worker = workers.find(w => normalizeNameKey(w.fullName) === normalizeNameKey(val));
                    if (worker) {
                      const raw = String(worker.telefono || '');
                      let digits = toDigits(raw);
                      // Si viene con +34 o 34 delante, lo llevamos al selector de prefijo
                      const knownPrefix = COUNTRY_PREFIXES.find(p => digits.startsWith(toDigits(p.code)));
                      if (knownPrefix) {
                        setPhonePrefix(knownPrefix.code);
                        digits = digits.slice(toDigits(knownPrefix.code).length);
                      }
                      updateField('telefono', formatPhoneNumber(digits));
                    }
                  }}
                  placeholder="Elegir o escribir operario..."
                />

                {workerPickerOpen && filteredWorkers.length > 0 && (
                  <div className={dropdownClass}>
                    {filteredWorkers.map((w) => (
                      <button
                        key={w.id}
                        type="button"
                        className={dropdownItemClass}
                        onMouseDown={(ev) => {
                          ev.preventDefault(); // evita blur antes de seleccionar
                          setWorkerInput(w.fullName);
                          const { nombre, apellidos } = splitFullName(w.fullName);
                          updateField('nombre', nombre);
                          updateField('apellidos', apellidos);

                          const raw = String(w.telefono || '');
                          let digits = toDigits(raw);
                          const knownPrefix = COUNTRY_PREFIXES.find(p => digits.startsWith(toDigits(p.code)));
                          if (knownPrefix) {
                            setPhonePrefix(knownPrefix.code);
                            digits = digits.slice(toDigits(knownPrefix.code).length);
                          }
                          updateField('telefono', formatPhoneNumber(digits));
                          setWorkerPickerOpen(false);
                        }}
                      >
                        {w.fullName}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <label className={labelClass}>Alojamiento / Propiedad</label>
              <div className="relative group">
                <Home size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-orange-500 transition-colors pointer-events-none" />
                <input
                  className={`${inputClass} !pl-10`}
                  value={accommodationInput}
                  onFocus={() => setAccPickerOpen(true)}
                  onBlur={() => setTimeout(() => setAccPickerOpen(false), 120)}
                  onChange={(e) => {
                    const val = e.target.value;
                    setAccommodationInput(val);
                    updateField(isHandyman ? 'alojamiento' : 'apartamento', val);
                  }}
                  placeholder="Elegir o escribir alojamiento..."
                />

                {accPickerOpen && filteredAccommodations.length > 0 && (
                  <div className={dropdownClass}>
                    {filteredAccommodations.map((a) => (
                      <button
                        key={a.id}
                        type="button"
                        className={dropdownItemClass}
                        onMouseDown={(ev) => {
                          ev.preventDefault();
                          setAccommodationInput(a.name);
                          updateField(isHandyman ? 'alojamiento' : 'apartamento', a.name);
                          setAccPickerOpen(false);
                        }}
                      >
                        {a.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <label className={labelClass}>Teléfono de Contacto</label>
              <div className="flex gap-2">
                <div className="relative group w-32 shrink-0">
                  <select 
                    className={`${inputClass} !pl-3 pr-8 !py-3 font-medium appearance-none`}
                    value={phonePrefix}
                    onChange={(e) => setPhonePrefix(e.target.value)}
                  >
                    {COUNTRY_PREFIXES.map(p => (
                      <option key={p.code} value={p.code}>{p.flag} {p.code}</option>
                    ))}
                  </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                    <Clock size={12} className="rotate-90" />
                  </div>
                </div>
                <div className="group relative flex-1">
                  <Hash size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-orange-500 transition-colors pointer-events-none" />
                  <input type="text" className={`${inputClass} font-mono tracking-wider`} value={(form as any).telefono || ''} onChange={(e) => handlePhoneChange(e.target.value)} placeholder="000 00 00 00" />
                </div>
              </div>
            </div>

            <div className="md:col-span-2 pt-4"><h4 className="text-[10px] font-bold text-orange-500 uppercase tracking-[0.25em] mb-4 flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-orange-500" />Control de Horarios</h4></div>

            <div className="space-y-2">
              <label className={labelClass}>{isHandyman ? 'Fecha de Inicio' : 'Fecha Check-in'}</label>
              <div className="relative group"><Calendar size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-orange-500 transition-colors" />
                <input type="datetime-local" step="1" max="9999-12-31T23:59:59" className={`${inputClass} !pl-10`} value={toISOForInput(isHandyman ? ((form as HandymanRecord).fechaLlegada || '') : ((form as any).checkinFecha || ''))} onChange={(e) => {
                  const val = e.target.value;
                  if (val.split('-')[0].length > 4) return;
                  updateField(isHandyman ? 'fechaLlegada' : 'checkinFecha', val.replace('T', ' '));
                }} />
              </div>
            </div>

            <div className="space-y-2">
              <label className={labelClass}>{isHandyman ? 'Fecha de Fin' : 'Fecha Check-out'}</label>
              <div className="relative group"><Calendar size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-orange-500 transition-colors" />
                <input type="datetime-local" step="1" max="9999-12-31T23:59:59" className={`${inputClass} !pl-10`} value={toISOForInput(isHandyman ? ((form as HandymanRecord).fechaFin || '') : ((form as any).checkoutFecha || ''))} onChange={(e) => {
                  const val = e.target.value;
                  if (val.split('-')[0].length > 4) return;
                  updateField(isHandyman ? 'fechaFin' : 'checkoutFecha', val.replace('T', ' '));
                }} />
              </div>
            </div>

            <div className="space-y-2">
              <label className={labelClass}>Hora Entrada</label>
              <div className="relative group"><Clock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-orange-500 transition-colors" />
                <input type="time" className={`${inputClass} !pl-10`} value={isHandyman ? (form as HandymanRecord).horaInicioTarea || '' : (form as any).horaEntrada || ''} onChange={(e) => updateField(isHandyman ? 'horaInicioTarea' : 'horaEntrada', e.target.value)} />
              </div>
            </div>

            <div className="space-y-2">
              <label className={labelClass}>Hora Salida</label>
              <div className="relative group"><Clock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-orange-500 transition-colors" />
                <input type="time" className={`${inputClass} !pl-10`} value={isHandyman ? (form as HandymanRecord).horaFinTarea || '' : (form as any).horaSalida || ''} onChange={(e) => updateField(isHandyman ? 'horaFinTarea' : 'horaSalida', e.target.value)} />
              </div>
            </div>

            {type === 'normal' && (
              <div className="md:col-span-2 space-y-4">
                <div className="flex items-center gap-6 p-6 bg-stone-50 dark:bg-stone-900 shadow-inner rounded-3xl border border-stone-100 dark:border-stone-800">
                  <div className="flex-1"><p className="text-[10px] text-slate-400 dark:text-stone-500 uppercase tracking-widest font-black mb-1">Duración Total</p><div className="flex items-baseline gap-2"><span className="text-2xl font-bold text-slate-800 dark:text-stone-200">{hoursWorked.toFixed(1)}h</span><span className="text-[10px] text-slate-500 font-medium pb-1 uppercase italic">Registradas</span></div></div>
                  <div className="h-10 w-px bg-stone-200 dark:bg-stone-800" />
                  <div className="flex-1"><p className="text-[10px] text-slate-400 dark:text-stone-500 uppercase tracking-widest font-black mb-1">Esperado</p><div className="flex items-center gap-3"><span className="text-2xl font-bold text-slate-800 dark:text-stone-200">{expectedHours}h</span>{isExtra && <span className="px-3 py-1 bg-orange-500 text-white text-[9px] rounded-full uppercase font-black tracking-widest shadow-lg shadow-orange-500/30">Extra</span>}</div></div>
                </div>

                {isExtra && (
                  <div className="animate-in slide-in-from-top-2 duration-300">
                    <label className={labelClass}>¿Por qué se ha tardado más de lo esperado?</label>
                    <div className="relative group">
                      <AlertCircle size={14} className="absolute left-3.5 top-4 text-orange-500" />
                      <textarea 
                        className={`${inputClass} !pl-10 h-24 resize-none pt-4 border-orange-200 dark:border-orange-900/30 bg-orange-50/10`}
                        placeholder="Indique el motivo del retraso..."
                        value={extraHoursReason}
                        onChange={(e) => setExtraHoursReason(e.target.value)}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {type !== 'normal' && (
              <div className="md:col-span-2 p-6 bg-stone-50 dark:bg-stone-900 shadow-inner rounded-3xl border border-stone-100 dark:border-stone-800">
                 <p className="text-[10px] text-slate-400 dark:text-stone-500 uppercase tracking-widest font-black mb-1">Duración Registrada</p>
                 <div className="flex items-baseline gap-2">
                   <span className="text-2xl font-bold text-slate-800 dark:text-stone-200">{hoursWorked.toFixed(1)}h</span>
                 </div>
              </div>
            )}

            <div className="md:col-span-2 pt-4"><h4 className="text-[10px] font-bold text-orange-500 uppercase tracking-[0.25em] mb-4 flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-orange-500" />Geolocalización</h4></div>

            <div className="space-y-2">
              <label className={labelClass}>Ubicación Entrada</label>
              <div className="relative group">
                <MapPin size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-orange-500 transition-colors pointer-events-none" />
                <input type="text" className={`${inputClass} !pr-16`} value={isHandyman ? (form as HandymanRecord).ubicacionInicio || '' : (form as any).checkinUbicacion || ''} onChange={(e) => updateField(isHandyman ? 'ubicacionInicio' : 'checkinUbicacion', e.target.value)} placeholder="Elegir en el mapa..." />
                <button 
                  type="button" 
                  onClick={() => {
                    const cur = isHandyman ? (form as HandymanRecord).ubicacionInicio : (form as any).checkinUbicacion;
                    const sib = isHandyman ? (form as HandymanRecord).ubicacionFin : (form as any).checkoutUbicacion;
                    setMapPicker({ 
                      open: true, 
                      field: isHandyman ? 'ubicacionInicio' : 'checkinUbicacion', 
                      initial: cur,
                      sibling: sib
                    });
                  }} 
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center rounded-xl bg-orange-500 text-white shadow-lg shadow-orange-500/20 active:scale-95 transition-all"
                >
                  <LocateFixed size={18} />
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <label className={labelClass}>Ubicación Salida</label>
              <div className="relative group">
                <Navigation size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-orange-500 transition-colors pointer-events-none" />
                <input type="text" className={`${inputClass} !pr-16`} value={isHandyman ? (form as HandymanRecord).ubicacionFin || '' : (form as any).checkoutUbicacion || ''} onChange={(e) => updateField(isHandyman ? 'ubicacionFin' : 'checkoutUbicacion', e.target.value)} placeholder="Elegir en el mapa..." />
                <button 
                  type="button" 
                  onClick={() => {
                    const cur = isHandyman ? (form as HandymanRecord).ubicacionFin : (form as any).checkoutUbicacion;
                    const sib = isHandyman ? (form as HandymanRecord).ubicacionInicio : (form as any).checkinUbicacion;
                    setMapPicker({ 
                      open: true, 
                      field: isHandyman ? 'ubicacionFin' : 'checkoutUbicacion', 
                      initial: cur,
                      sibling: sib
                    });
                  }} 
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center rounded-xl bg-orange-500 text-white shadow-lg shadow-orange-500/20 active:scale-95 transition-all"
                >
                  <LocateFixed size={18} />
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <label className={labelClass}>Km (ida y vuelta)</label>
              <div className="relative group"><Navigation size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-orange-500 transition-colors pointer-events-none" />
                <input type="text" className={`${inputClass} !pl-10`} value={kmInput} onChange={(e) => handleKmChange(e.target.value)} />
              </div>
            </div>

            <div className="md:col-span-2 pt-4"><h4 className="text-[10px] font-bold text-orange-500 uppercase tracking-[0.25em] mb-4 flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-orange-500" />Estado y Observaciones</h4></div>

            {type === 'normal' && (
              <>
                <div className="space-y-3">
                  <label className={labelClass}>¿Sigue el Huésped?</label>
                  <div className="flex p-1.5 bg-stone-100 dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800">
                    <button type="button" onClick={() => updateField('sigueHuesped', true)} className={`flex-1 py-2 text-xs rounded-xl transition-all font-medium ${(form as NormalCleanRecord).sigueHuesped ? 'bg-white dark:bg-stone-800 text-orange-500 shadow-md' : 'text-slate-400'}`}>Sí</button>
                    <button type="button" onClick={() => updateField('sigueHuesped', false)} className={`flex-1 py-2 text-xs rounded-xl transition-all font-medium ${!(form as NormalCleanRecord).sigueHuesped ? 'bg-white dark:bg-stone-800 text-orange-500 shadow-md' : 'text-slate-400'}`}>No</button>
                  </div>
                </div>

                <div className="space-y-3">
                  <label className={labelClass}>¿Recogió Llaves?</label>
                  <div className="flex p-1.5 bg-stone-100 dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800">
                    <button type="button" onClick={() => updateField('recogeLlaves', true)} className={`flex-1 py-2 text-xs rounded-xl transition-all font-medium ${(form as NormalCleanRecord).recogeLlaves ? 'bg-white dark:bg-stone-800 text-orange-500 shadow-md' : 'text-slate-400'}`}>Sí</button>
                    <button type="button" onClick={() => updateField('recogeLlaves', false)} className={`flex-1 py-2 text-xs rounded-xl transition-all font-medium ${!(form as NormalCleanRecord).recogeLlaves ? 'bg-white dark:bg-stone-800 text-orange-500 shadow-md' : 'text-slate-400'}`}>No</button>
                  </div>
                </div>

                {(form as NormalCleanRecord).sigueHuesped && (
                  <div className="md:col-span-2 space-y-2 animate-in slide-in-from-left-2 duration-300">
                    <label className={labelClass}>Fecha Salida Reserva</label>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="relative group">
                        <Clock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                        <input 
                          type="time" 
                          className={`${inputClass} !pl-10`}
                          value={reservaTime}
                          onChange={(e) => setReservaTime(e.target.value)}
                        />
                      </div>
                      <div className="relative group">
                        <Calendar size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                        <input 
                          type="date" 
                          className={`${inputClass} !pl-10`}
                          max="9999-12-31"
                          value={reservaDate.includes('/') ? reservaDate.split('/').reverse().join('-') : reservaDate}
                          onChange={(e) => {
                            const val = e.target.value; 
                            if (!val) { setReservaDate(''); return; }
                            if (val.split('-')[0].length > 4) return;
                            const [y, m, d] = val.split('-');
                            setReservaDate(`${d}/${m}/${y}`);
                          }}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}

            <div className="space-y-3"><label className={labelClass}>Revisión</label><div className="flex p-1.5 bg-stone-100 dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800"><button type="button" onClick={() => isHandyman ? updateField('estadoCompletado', 'Completado') : updateField('checked', true)} className={`flex-1 py-2 text-xs rounded-xl transition-all font-medium flex items-center justify-center gap-2 ${(isHandyman ? (form as HandymanRecord).estadoCompletado === 'Completado' : (form as any).checked) ? 'bg-emerald-500 text-white shadow-lg' : 'text-slate-400'}`}><CheckCircle2 size={12} />Verificado</button><button type="button" onClick={() => isHandyman ? updateField('estadoCompletado', 'Pendiente') : updateField('checked', false)} className={`flex-1 py-2 text-xs rounded-xl transition-all font-medium ${!(isHandyman ? (form as HandymanRecord).estadoCompletado === 'Completado' : (form as any).checked) ? 'bg-white dark:bg-stone-800 text-slate-600' : 'text-slate-400'}`}>Pendiente</button></div></div>

            <div className="md:col-span-2 space-y-2"><label className={labelClass}>{isHandyman ? 'Detalles del trabajo' : 'Notas'}</label><div className="relative group"><MessageSquare size={14} className="absolute left-3.5 top-4 text-slate-400" /><textarea className={`${inputClass} !pl-10 h-32 resize-none pt-4`} placeholder={isHandyman ? "Describa los detalles del trabajo realizado..." : "Notas adicionales..."} value={isHandyman ? (form as HandymanRecord).observacionesTarea || '' : (form as any).observaciones || ''} onChange={(e) => updateField(isHandyman ? 'observacionesTarea' : 'observaciones', e.target.value)} /></div></div>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-4 pt-12 pb-2">
            <button type="button" onClick={onClose} className="w-full sm:flex-1 py-4 px-6 rounded-2xl text-[11px] font-black uppercase tracking-widest text-slate-400 hover:bg-stone-50 dark:hover:bg-stone-900 transition-all font-display">Cancelar</button>
            <button type="submit" disabled={loading} className="w-full sm:flex-[1.5] py-4 px-6 rounded-2xl text-[11px] font-black bg-orange-500 text-white hover:bg-orange-600 shadow-2xl shadow-orange-500/20 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-3 uppercase tracking-widest font-display"><Check size={18} />{mode === 'create' ? 'Confirmar Registro' : 'Actualizar Registro'}</button>
          </div>
        </form>
      </div>

      {mapPicker.open && (
        <MapPickerModal 
          key={mapPicker.field}
          isOpen={mapPicker.open} 
          initialValue={mapPicker.initial} 
          siblingValue={mapPicker.sibling}
          onClose={() => setMapPicker({ open: false, field: '' })} 
          onConfirm={(_addr, coords) => { 
            // Guardamos las coordenadas para que el marcador hermano siempre funcione
            updateField(mapPicker.field, coords); 
            setMapPicker({ open: false, field: '' }); 
          }} 
        />
      )}
    </div>
  );
};

export default CleanCheckoutFormModal;
