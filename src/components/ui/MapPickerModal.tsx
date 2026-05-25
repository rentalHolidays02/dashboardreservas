import React, { useEffect, useRef, useState } from 'react';
import { MapPin, Info, Check, Search, X as XIcon, Loader2 } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { reverseGeocode } from '../../services/api';

interface NominatimResult {
  display_name: string;
  lat: string;
  lon: string;
}

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const isCoordString = (s: string): boolean =>
  /^-?\d+(\.\d+)?,\s*-?\d+(\.\d+)?$/.test(s.trim());

interface MapPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (address: string, coords: string) => void;
  initialValue?: string;
  siblingValue?: string;
}

export const MapPickerModal: React.FC<MapPickerModalProps> = ({ isOpen, onClose, onConfirm, initialValue, siblingValue }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const userLocationRef = useRef<[number, number] | null>(null);

  const [address, setAddress] = useState('');
  const [coords, setCoords] = useState('');
  const [loadingMap, setLoadingMap] = useState(false);
  const [hasSelection, setHasSelection] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<NominatimResult[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searching, setSearching] = useState(false);

  // Autocompletado Nominatim (debounce 400ms, mínimo 3 caracteres).
  // Sesga + ordena las sugerencias por cercanía a la ubicación del dispositivo cuando está disponible.
  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < 3) {
      setSuggestions([]);
      setSearching(false);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const loc = userLocationRef.current;
        const params = new URLSearchParams({
          q,
          format: 'json',
          limit: '10',
          addressdetails: '0',
          countrycodes: 'es',
          'accept-language': 'es',
        });
        if (loc) {
          const d = 0.5; // ~50 km de margen
          // viewbox: left,top,right,bottom = lng-d, lat+d, lng+d, lat-d
          params.set('viewbox', `${loc[1] - d},${loc[0] + d},${loc[1] + d},${loc[0] - d}`);
          params.set('bounded', '0'); // sesgo, no filtro estricto
        }
        const url = `https://nominatim.openstreetmap.org/search?${params.toString()}`;
        const res = await fetch(url, { headers: { 'User-Agent': 'BaseDatosPagosRH/1.0' } });
        const data = await res.json();
        if (cancelled) return;
        let results: NominatimResult[] = Array.isArray(data) ? data : [];
        if (loc && results.length > 0) {
          // Ordena por distancia euclídea a la ubicación del usuario (suficiente para ordenar)
          const [uLat, uLng] = loc;
          results = results
            .map(r => ({
              r,
              d: Math.pow(parseFloat(r.lat) - uLat, 2) + Math.pow(parseFloat(r.lon) - uLng, 2),
            }))
            .sort((a, b) => a.d - b.d)
            .map(x => x.r);
        }
        setSuggestions(results.slice(0, 5));
        setShowSuggestions(true);
      } catch {
        if (!cancelled) setSuggestions([]);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 400);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [searchQuery]);

  const handleSelectSuggestion = (s: NominatimResult) => {
    const lat = parseFloat(s.lat);
    const lon = parseFloat(s.lon);
    if (isNaN(lat) || isNaN(lon) || !mapRef.current) return;

    setShowSuggestions(false);
    setSuggestions([]);
    setSearchQuery('');

    mapRef.current.setView([lat, lon], 17);
    const latlng = L.latLng(lat, lon);
    if (markerRef.current) {
      markerRef.current.setLatLng(latlng);
    } else {
      markerRef.current = L.marker(latlng).addTo(mapRef.current);
    }
    setCoords(`${lat.toFixed(6)}, ${lon.toFixed(6)}`);
    setAddress(s.display_name);
    setHasSelection(true);
  };

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    // Solicita ubicación del dispositivo para sesgar el buscador y ordenar sugerencias por cercanía
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => { userLocationRef.current = [pos.coords.latitude, pos.coords.longitude]; },
        () => {},
        { timeout: 5000, maximumAge: 60_000 }
      );
    }

    const CASTELLON: [number, number] = [39.9864, -0.0513];
    let initialPos: [number, number] = CASTELLON;

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

    if (initialValue && isCoordString(initialValue)) {
      placeMarker(new L.LatLng(initialPos[0], initialPos[1]));
    } else if (siblingValue && isCoordString(siblingValue)) {
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

    map.on('click', (e) => {
      setShowSuggestions(false);
      placeMarker(e.latlng);
    });

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markerRef.current = null;
      }
    };
  }, []);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-stone-900/60 backdrop-blur-md animate-in fade-in duration-300" onClick={onClose} />
      <div className="relative w-full max-w-4xl h-[80vh] bg-white dark:bg-stone-950 rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-300">
        <div className="absolute top-6 left-1/2 -translate-x-1/2 z-10 w-[90%] max-w-md">
          {/* Buscador */}
          <div className="bg-white/95 dark:bg-stone-900/95 backdrop-blur shadow-xl border border-stone-200 dark:border-stone-800 rounded-2xl flex items-center gap-3 px-4">
            <Search size={18} className="text-slate-400 shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setShowSuggestions(true); }}
              onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }}
              placeholder="Buscar dirección o lugar..."
              className="flex-1 py-4 bg-transparent border-0 outline-none text-sm text-slate-800 dark:text-stone-200 placeholder:text-slate-400 dark:placeholder:text-stone-500"
            />
            {searching && <Loader2 size={14} className="animate-spin text-slate-400 shrink-0" />}
            {searchQuery && !searching && (
              <button
                type="button"
                onClick={() => { setSearchQuery(''); setSuggestions([]); setShowSuggestions(false); }}
                className="text-slate-400 hover:text-slate-600 shrink-0"
                aria-label="Limpiar búsqueda"
              >
                <XIcon size={14} />
              </button>
            )}
          </div>

          {/* Dropdown de sugerencias */}
          {showSuggestions && suggestions.length > 0 && (
            <div className="mt-2 bg-white dark:bg-stone-900 shadow-2xl border border-stone-200 dark:border-stone-800 rounded-2xl overflow-hidden max-h-72 overflow-y-auto">
              {suggestions.map((s, i) => (
                <button
                  type="button"
                  key={`${s.lat}-${s.lon}-${i}`}
                  onClick={() => handleSelectSuggestion(s)}
                  className="w-full px-4 py-3 hover:bg-stone-50 dark:hover:bg-stone-800 flex items-start gap-3 text-left transition-colors border-b border-stone-100 dark:border-stone-800/50 last:border-0"
                >
                  <MapPin size={14} className="text-orange-500 shrink-0 mt-0.5" />
                  <span className="text-xs text-slate-700 dark:text-stone-300 leading-snug">{s.display_name}</span>
                </button>
              ))}
            </div>
          )}

          {/* Punto seleccionado (si hay marcador y no se está escribiendo) */}
          {!searchQuery && hasSelection && (
            <div className="mt-2 bg-white/95 dark:bg-stone-900/95 backdrop-blur shadow border border-stone-200 dark:border-stone-800 rounded-xl px-4 py-2.5 flex items-center gap-3">
              <MapPin size={14} className="text-orange-600 shrink-0" />
              <p className="text-xs text-slate-700 dark:text-stone-300 truncate flex-1">
                {loadingMap ? 'Geocodificando...' : address}
              </p>
            </div>
          )}
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

export default MapPickerModal;
