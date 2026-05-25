import React, { useState, useEffect, useRef } from 'react';
import { X, Save, PlusCircle, Loader2, MapPin, Plus, Trash2, Info, CheckCircle2, Clock, LocateFixed, Route } from 'lucide-react';
import L from 'leaflet';
import { Incidencia, Accommodation } from '../../services/mockData';
import { appsScriptApi } from '../../services/api';
import { MapPickerModal } from '../ui/MapPickerModal';

interface IncidentCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (incidentData: Omit<Incidencia, 'id'>) => Promise<void>;
}

interface Stop {
  name: string;
  time: string;   // "HH:MM"
  coords: string; // "lat, lng" (raw, no brackets) or ''
}

const emptyStop = (): Stop => ({ name: '', time: '', coords: '' });

const stopLabel = (index: number, total: number): string => {
  if (index === 0) return 'Parada Inicial';
  if (total > 1 && index === total - 1) return 'Parada Final';
  return `Parada Opcional ${index}`;
};

const isValidCoordString = (s: string): boolean =>
  /^-?\d+(\.\d+)?,\s*-?\d+(\.\d+)?$/.test((s || '').trim());

const parseCoords = (s: string): [number, number] | null => {
  if (!isValidCoordString(s)) return null;
  const [lat, lng] = s.split(',').map(p => parseFloat(p.trim()));
  if (isNaN(lat) || isNaN(lng)) return null;
  return [lat, lng];
};

// Formatea "lat, lng" → "[lat5, lng5]"; '' si no hay coords válidas
const formatCoordsBracket = (coords: string): string => {
  const parsed = parseCoords(coords);
  if (!parsed) return '[]';
  return `[${parsed[0].toFixed(5)}, ${parsed[1].toFixed(5)}]`;
};

const formatStopForSheet = (stop: Stop, fallbackTime: string, fallbackCoords: string): string => {
  const name = stop.name.trim();
  if (!name) return '';
  const time = stop.time || fallbackTime;
  const coords = stop.coords || fallbackCoords;
  return `${name} (${time}) ${formatCoordsBracket(coords)}`;
};

// Calcula ruta real por carretera con OSRM (servicio público, sin API key)
// Devuelve km totales y geometría [lat, lng][] del trazo
const fetchOsrmRoute = async (coords: [number, number][]): Promise<{ km: number; geometry: [number, number][] } | null> => {
  if (coords.length < 2) return null;
  const path = coords.map(([lat, lng]) => `${lng},${lat}`).join(';');
  const url = `https://router.project-osrm.org/route/v1/driving/${path}?overview=full&geometries=geojson`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.code !== 'Ok' || !data.routes?.[0]) return null;
    const route = data.routes[0];
    const geometry: [number, number][] = route.geometry.coordinates.map((c: [number, number]) => [c[1], c[0]]);
    return { km: route.distance / 1000, geometry };
  } catch {
    return null;
  }
};

// Mapa de previsualización: marcadores numerados + polyline del recorrido
const RoutePreviewMap: React.FC<{
  stops: Stop[];
  geometry: [number, number][];
  loading: boolean;
}> = ({ stops, geometry, loading }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;
    const map = L.map(mapContainerRef.current, {
      center: [39.9864, -0.0513],
      zoom: 12,
      zoomControl: true,
      attributionControl: false,
      scrollWheelZoom: false,
    });
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png').addTo(map);
    layerGroupRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      layerGroupRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const group = layerGroupRef.current;
    if (!map || !group) return;
    group.clearLayers();

    const points: { lat: number; lng: number; label: string }[] = [];
    stops.forEach((s, i) => {
      const c = parseCoords(s.coords);
      if (!c) return;
      points.push({ lat: c[0], lng: c[1], label: stopLabel(i, stops.length) });
    });

    if (points.length === 0) {
      map.setView([39.9864, -0.0513], 12);
      return;
    }

    points.forEach((p, idx) => {
      const isFirst = idx === 0;
      const isLast = idx === points.length - 1 && points.length > 1;
      const bg = isFirst ? '#10b981' : isLast ? '#ef4444' : '#f97316';
      const html = `<div style="background:${bg};color:white;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:12px;border:2px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.25);">${idx + 1}</div>`;
      const icon = L.divIcon({ html, className: '', iconSize: [28, 28], iconAnchor: [14, 14] });
      L.marker([p.lat, p.lng], { icon }).bindTooltip(p.label, { direction: 'top' }).addTo(group);
    });

    if (geometry.length > 0) {
      const line = L.polyline(geometry, { color: '#f97316', weight: 4, opacity: 0.85 }).addTo(group);
      map.fitBounds(line.getBounds(), { padding: [30, 30], maxZoom: 16 });
    } else if (points.length > 1) {
      const fallback = L.polyline(points.map(p => [p.lat, p.lng] as [number, number]), {
        color: '#f97316', weight: 2.5, opacity: 0.6, dashArray: '6, 8'
      }).addTo(group);
      map.fitBounds(fallback.getBounds(), { padding: [30, 30], maxZoom: 16 });
    } else {
      map.setView([points[0].lat, points[0].lng], 15);
    }
  }, [stops, geometry]);

  return (
    <div className="relative rounded-2xl overflow-hidden border border-slate-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800/50">
      <div ref={mapContainerRef} className="w-full h-64 z-0" />
      {loading && (
        <div className="absolute top-3 right-3 bg-white/90 dark:bg-stone-900/90 backdrop-blur px-3 py-1.5 rounded-full shadow flex items-center gap-2 text-[11px] text-orange-600 dark:text-orange-400">
          <Loader2 className="animate-spin" size={12} /> Calculando ruta...
        </div>
      )}
    </div>
  );
};

const IncidentCreateModal: React.FC<IncidentCreateModalProps> = ({ isOpen, onClose, onCreate }) => {
  const [isSaving, setIsSaving] = useState(false);
  const [accommodations, setAccommodations] = useState<Accommodation[]>([]);

  const [stops, setStops] = useState<Stop[]>([emptyStop()]);
  const [mapPickerIndex, setMapPickerIndex] = useState<number | null>(null);

  const [routeGeometry, setRouteGeometry] = useState<[number, number][]>([]);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);

  const [formData, setFormData] = useState<Partial<Incidencia>>({
    kms: 0,
    checked: false,
    timestamp: new Date().toISOString().slice(0, 16),
    observaciones: ''
  });

  useEffect(() => {
    if (isOpen) {
      appsScriptApi.getAccommodations().then(acc => {
        setAccommodations(acc.filter(a => a.active).sort((a, b) => a.name.localeCompare(b.name)));
      });
    }
  }, [isOpen]);

  // Recalcula la ruta (km + trazado) cuando cambian las coordenadas de las paradas
  const coordsKey = stops.map(s => s.coords).join('|');
  useEffect(() => {
    if (!isOpen) return;
    const validCoords = stops
      .map(s => parseCoords(s.coords))
      .filter((c): c is [number, number] => c !== null);

    if (validCoords.length < 2) {
      setRouteGeometry([]);
      setRouteError(null);
      setRouteLoading(false);
      return;
    }

    let cancelled = false;
    setRouteLoading(true);
    setRouteError(null);
    const timer = setTimeout(async () => {
      const result = await fetchOsrmRoute(validCoords);
      if (cancelled) return;
      if (result) {
        setRouteGeometry(result.geometry);
        setRouteError(null);
        const km = parseFloat(result.km.toFixed(2));
        setFormData(prev => ({ ...prev, kms: km }));
      } else {
        setRouteGeometry([]);
        setRouteError('No se pudo calcular la ruta. Se muestra línea recta como referencia.');
      }
      setRouteLoading(false);
    }, 500);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [coordsKey, isOpen]);

  if (!isOpen) return null;

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, '').slice(0, 9);

    if (val.length > 7) {
      val = `${val.slice(0, 3)} ${val.slice(3, 5)} ${val.slice(5, 7)} ${val.slice(7)}`;
    } else if (val.length > 5) {
      val = `${val.slice(0, 3)} ${val.slice(3, 5)} ${val.slice(5)}`;
    } else if (val.length > 3) {
      val = `${val.slice(0, 3)} ${val.slice(3)}`;
    }

    setFormData({ ...formData, telefono: val });
  };

  // Inserta una nueva parada opcional ANTES de la Parada Final cuando ya hay >= 2 paradas.
  // Si solo hay 1 parada (la Inicial), la nueva pasa a ser Parada Final.
  const handleAddStop = () => {
    setStops(prev => {
      if (prev.length <= 1) return [...prev, emptyStop()];
      return [...prev.slice(0, -1), emptyStop(), prev[prev.length - 1]];
    });
  };

  const handleRemoveStop = (index: number) => {
    setStops(stops.filter((_, i) => i !== index));
  };

  const updateStop = (index: number, patch: Partial<Stop>) => {
    setStops(stops.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const userName = `${formData.nombre || ''} ${formData.apellidos || ''}`.trim() || 'Desconocido';

      // Formato fecha Apps Script: 18/5/2026, 15:05:23
      const d = formData.timestamp ? new Date(formData.timestamp) : new Date();
      const formattedDate = `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}, ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`;
      const fallbackTime = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;

      // Coords del dispositivo como fallback si una parada no tiene ubicación elegida
      const deviceCoords = await new Promise<string>((resolve) => {
        if (!navigator.geolocation) return resolve('');
        navigator.geolocation.getCurrentPosition(
          (pos) => resolve(`${pos.coords.latitude}, ${pos.coords.longitude}`),
          () => resolve(''),
          { enableHighAccuracy: true, timeout: 5000 }
        );
      });

      const newIncidencia: Omit<Incidencia, 'id'> = {
        userName,
        description: formData.description || '',
        timestamp: formattedDate,
        accommodationId: 'temp_acc',
        accommodationName: formData.accommodationName || 'Sin especificar',
        coste: 0,
        pagadoPor: 'empresa',
        kms: (formData.kms !== undefined ? formData.kms : 0).toString() as any,
        checked: formData.checked || false,
        telefono: formData.telefono ? `34${formData.telefono.replace(/\s/g, '')}` : '',
        nombre: formData.nombre || '',
        apellidos: formData.apellidos || '',
        observaciones: formData.observaciones || ''
      };

      const validStops = stops
        .filter(s => s.name.trim() !== '')
        .map(s => formatStopForSheet(s, fallbackTime, deviceCoords));

      if (validStops.length > 0) {
        newIncidencia.paradaInicial = validStops[0];
      }
      if (validStops.length > 1) {
        newIncidencia.paradaFinal = validStops[validStops.length - 1];
      }

      const optionalStops = validStops.slice(1, validStops.length > 1 ? validStops.length - 1 : 1);

      if (optionalStops.length > 0) newIncidencia.paradaOpcional1 = optionalStops[0];
      if (optionalStops.length > 1) newIncidencia.paradaOpcional2 = optionalStops[1];
      if (optionalStops.length > 2) newIncidencia.paradaOpcional3 = optionalStops[2];
      if (optionalStops.length > 3) newIncidencia.paradaOpcional4 = optionalStops[3];

      // Si hay >4 opcionales, las extras (5, 6, 7…) se acumulan en paradaOpcional5 separadas por \n
      if (optionalStops.length > 4) {
        newIncidencia.paradaOpcional5 = optionalStops.slice(4).join('\n');
      }

      await onCreate(newIncidencia);

      setFormData({ coste: 0, kms: 0, pagadoPor: 'empresa', checked: false, timestamp: new Date().toISOString().slice(0, 16) });
      setStops([emptyStop()]);
      setRouteGeometry([]);
      setRouteError(null);
      onClose();
    } catch (error) {
      console.error('Error creating incident:', error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-white/20 dark:bg-stone-950/40 backdrop-blur-sm animate-in fade-in duration-300"
        onClick={onClose}
      />

      <div className="relative bg-white dark:bg-stone-900 w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 slide-in-from-bottom-4 duration-300 max-h-[90vh] flex flex-col">
        <header className="px-6 py-5 border-b border-stone-100 dark:border-stone-800/50 flex items-center justify-between bg-white/50 dark:bg-stone-900/50 backdrop-blur-md shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 rounded-xl">
              <PlusCircle size={20} />
            </div>
            <div>
              <h2 className="text-lg font-normal text-slate-800 dark:text-stone-200 tracking-tight font-display">
                Crear Nueva Incidencia
              </h2>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-xl transition-colors text-slate-400">
            <X size={20} />
          </button>
        </header>

        <div className="overflow-y-auto flex-1">
          <form id="create-incident-form" onSubmit={handleSubmit} className="p-6 space-y-6">

            {/* Fila 1: Nombre, Apellidos, Teléfono */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-[11px] font-normal text-slate-400 dark:text-stone-500 tracking-widest mb-2 px-1">
                  Nombre
                </label>
                <input
                  type="text"
                  required
                  value={formData.nombre || ''}
                  onChange={e => setFormData({ ...formData, nombre: e.target.value })}
                  className="w-full px-4 py-3 bg-stone-50 dark:bg-stone-800/50 border border-slate-100 dark:border-stone-700/50 rounded-2xl text-slate-700 dark:text-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500/40 transition-all font-light"
                  placeholder="Ej: Juan"
                />
              </div>
              <div>
                <label className="block text-[11px] font-normal text-slate-400 dark:text-stone-500 tracking-widest mb-2 px-1">
                  Apellidos
                </label>
                <input
                  type="text"
                  value={formData.apellidos || ''}
                  onChange={e => setFormData({ ...formData, apellidos: e.target.value })}
                  className="w-full px-4 py-3 bg-stone-50 dark:bg-stone-800/50 border border-slate-100 dark:border-stone-700/50 rounded-2xl text-slate-700 dark:text-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500/40 transition-all font-light"
                  placeholder="Ej: Pérez"
                />
              </div>
              <div>
                <label className="block text-[11px] font-normal text-slate-400 dark:text-stone-500 tracking-widest mb-2 px-1">
                  Teléfono
                </label>
                <div className="relative flex items-center">
                  <span className="absolute left-4 text-slate-400 dark:text-stone-500 text-sm font-light pointer-events-none">+34</span>
                  <input
                    type="tel"
                    value={formData.telefono || ''}
                    onChange={handlePhoneChange}
                    className="w-full pl-12 pr-4 py-3 bg-stone-50 dark:bg-stone-800/50 border border-slate-100 dark:border-stone-700/50 rounded-2xl text-slate-700 dark:text-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500/40 transition-all font-light"
                    placeholder="612 34 56 78"
                  />
                </div>
              </div>
            </div>

            {/* Fila 2: Fecha y Apartamento */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-normal text-slate-400 dark:text-stone-500 tracking-widest mb-2 px-1">
                  Fecha y Hora
                </label>
                <input
                  type="datetime-local"
                  required
                  value={formData.timestamp || ''}
                  onChange={e => setFormData({ ...formData, timestamp: e.target.value })}
                  className="w-full px-4 py-3 bg-stone-50 dark:bg-stone-800/50 border border-slate-100 dark:border-stone-700/50 rounded-2xl text-slate-700 dark:text-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500/40 transition-all font-light"
                />
              </div>
              <div>
                <label className="block text-[11px] font-normal text-slate-400 dark:text-stone-500 tracking-widest mb-2 px-1">
                  Apartamento
                </label>
                <select
                  required
                  value={formData.accommodationName || ''}
                  onChange={e => setFormData({ ...formData, accommodationName: e.target.value })}
                  className="w-full px-4 py-3 bg-stone-50 dark:bg-stone-800/50 border border-slate-100 dark:border-stone-700/50 rounded-2xl text-slate-700 dark:text-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500/40 transition-all font-light appearance-none"
                >
                  <option value="" disabled>Selecciona un apartamento...</option>
                  {accommodations.map(acc => (
                    <option key={acc.id} value={acc.name}>{acc.name}</option>
                  ))}
                  <option value="Otro">Otro (Especificar en detalles)</option>
                </select>
              </div>
            </div>

            {/* Detalles de la Incidencia */}
            <div>
              <label className="block text-[11px] font-normal text-slate-400 dark:text-stone-500 tracking-widest mb-2 px-1">
                Detalles Incidencia
              </label>
              <textarea
                required
                value={formData.description || ''}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                className="w-full px-4 py-4 bg-stone-50 dark:bg-stone-800/50 border border-slate-100 dark:border-stone-700/50 rounded-2xl text-slate-700 dark:text-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500/40 transition-all font-light resize-none"
                placeholder="Escribe aquí los detalles..."
              />
            </div>

            {/* Fila: Paradas (dinámicas, con hora y ubicación por parada) */}
            <div className="space-y-3 bg-stone-50 dark:bg-stone-800/30 p-4 rounded-2xl border border-stone-100 dark:border-stone-700/50">
              <div className="flex items-center justify-between mb-2">
                <label className="block text-[11px] font-normal text-slate-400 dark:text-stone-500 tracking-widest px-1">
                  Ruta / Paradas
                </label>
                <button
                  type="button"
                  onClick={handleAddStop}
                  className="flex items-center gap-1 text-[10px] text-orange-600 dark:text-orange-400 hover:text-orange-700 font-medium bg-orange-100 dark:bg-orange-900/30 px-2 py-1 rounded-lg transition-colors"
                >
                  <Plus size={12} /> Añadir Parada
                </button>
              </div>

              <div className="space-y-3">
                {stops.map((stop, index) => {
                  const label = stopLabel(index, stops.length);
                  const isInitial = index === 0;
                  const isFinal = stops.length > 1 && index === stops.length - 1;
                  const accentBg = isInitial
                    ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400'
                    : isFinal
                      ? 'bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400'
                      : 'bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400';

                  return (
                    <div key={index} className="bg-white dark:bg-stone-900 border border-slate-200 dark:border-stone-700 rounded-2xl p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-md ${accentBg}`}>
                          {label}
                        </span>
                        {stops.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveStop(index)}
                            className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                            aria-label="Eliminar parada"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-[1fr_110px] gap-2">
                        <div className="relative">
                          <MapPin size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
                          <input
                            type="text"
                            value={stop.name}
                            onChange={(e) => updateStop(index, { name: e.target.value })}
                            placeholder={isInitial ? 'Origen' : isFinal ? 'Destino' : `Parada ${index}`}
                            className="w-full pl-10 pr-4 py-2.5 bg-stone-50 dark:bg-stone-800/50 border border-slate-200 dark:border-stone-700 rounded-xl text-slate-700 dark:text-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500/40 transition-all font-light"
                          />
                        </div>
                        <div className="relative">
                          <Clock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" />
                          <input
                            type="time"
                            value={stop.time}
                            onChange={(e) => updateStop(index, { time: e.target.value })}
                            className="w-full pl-8 pr-2 py-2.5 bg-stone-50 dark:bg-stone-800/50 border border-slate-200 dark:border-stone-700 rounded-xl text-slate-700 dark:text-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500/40 transition-all font-light"
                          />
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setMapPickerIndex(index)}
                        className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl border text-xs transition-all ${
                          stop.coords
                            ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-900/40 text-orange-700 dark:text-orange-300'
                            : 'bg-stone-50 dark:bg-stone-800/50 border-slate-200 dark:border-stone-700 text-slate-500 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <LocateFixed size={14} />
                          <span className="truncate font-medium">
                            {stop.coords ? `[${stop.coords.split(',').map(p => parseFloat(p).toFixed(5)).join(', ')}]` : 'Seleccionar ubicación en el mapa'}
                          </span>
                        </div>
                        <span className="text-[10px] uppercase tracking-widest font-bold opacity-70 shrink-0">
                          {stop.coords ? 'Cambiar' : 'Mapa'}
                        </span>
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Vista previa del recorrido completo */}
              <div className="pt-1 space-y-2">
                <div className="flex items-center justify-between px-1">
                  <label className="text-[11px] font-normal text-slate-400 dark:text-stone-500 tracking-widest flex items-center gap-2">
                    <Route size={12} /> Vista previa del recorrido
                  </label>
                  {stops.filter(s => parseCoords(s.coords)).length >= 2 && formData.kms !== undefined && (
                    <span className="text-[10px] font-bold uppercase tracking-widest text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 px-2 py-1 rounded-md">
                      {formData.kms} km
                    </span>
                  )}
                </div>
                {stops.filter(s => parseCoords(s.coords)).length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 dark:border-stone-700 bg-stone-50/50 dark:bg-stone-800/30 px-4 py-6 text-center text-[11px] text-slate-400 dark:text-stone-500 italic">
                    Selecciona la ubicación de al menos una parada para previsualizar el recorrido.
                  </div>
                ) : (
                  <RoutePreviewMap stops={stops} geometry={routeGeometry} loading={routeLoading} />
                )}
                {routeError && (
                  <p className="text-[10px] text-amber-600 dark:text-amber-400 px-1">{routeError}</p>
                )}
              </div>
            </div>

            {/* Fila: Estado de Revisión y Kms */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-normal text-slate-400 dark:text-stone-500 tracking-widest mb-2 px-1">
                  Estado de Revisión
                </label>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, checked: false })}
                    className={`flex-1 py-3 px-4 rounded-2xl border transition-all flex items-center justify-center gap-2 text-xs ${
                      !formData.checked
                        ? 'bg-slate-50 dark:bg-stone-800 border-slate-200 dark:border-stone-700 text-slate-600 dark:text-stone-300 shadow-sm'
                        : 'border-transparent text-slate-400 dark:text-stone-600 hover:bg-stone-50 dark:hover:bg-stone-800/50'
                    }`}
                  >
                    <Info size={14} /> Pendiente
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, checked: true })}
                    className={`flex-1 py-3 px-4 rounded-2xl border transition-all flex items-center justify-center gap-2 text-xs ${
                      formData.checked
                        ? 'bg-green-50 dark:bg-green-900/20 border-green-100 dark:border-green-900/40 text-green-600 dark:text-green-400 shadow-sm'
                        : 'border-transparent text-slate-400 dark:text-stone-600 hover:bg-stone-50 dark:hover:bg-stone-800/50'
                    }`}
                  >
                    <CheckCircle2 size={14} /> Revisada
                  </button>
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2 px-1">
                  <label className="text-[11px] font-normal text-slate-400 dark:text-stone-500 tracking-widest">
                    Kilómetros (KMS)
                  </label>
                  {routeGeometry.length > 0 && (
                    <span className="text-[9px] font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <Route size={10} /> Auto
                    </span>
                  )}
                </div>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={formData.kms !== undefined ? formData.kms : ''}
                  onChange={e => setFormData({ ...formData, kms: e.target.value === '' ? undefined : parseFloat(e.target.value) })}
                  className="w-full px-4 py-3 bg-stone-50 dark:bg-stone-800/50 border border-slate-100 dark:border-stone-700/50 rounded-2xl text-slate-700 dark:text-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500/40 transition-all font-light"
                  placeholder="0.0"
                />
              </div>
            </div>

            {/* Observaciones */}
            <div>
              <label className="block text-[11px] font-normal text-slate-400 dark:text-stone-500 tracking-widest mb-2 px-1">
                Observaciones
              </label>
              <textarea
                value={formData.observaciones || ''}
                onChange={e => setFormData({ ...formData, observaciones: e.target.value })}
                rows={2}
                className="w-full px-4 py-4 bg-stone-50 dark:bg-stone-800/50 border border-slate-100 dark:border-stone-700/50 rounded-2xl text-slate-700 dark:text-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500/40 transition-all font-light resize-none"
                placeholder="Añade aquí cualquier observación extra..."
              />
            </div>

          </form>
        </div>

        <div className="p-6 border-t border-stone-100 dark:border-stone-800/50 bg-stone-50/50 dark:bg-stone-900/50 shrink-0">
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 px-6 bg-white dark:bg-stone-800 text-slate-600 dark:text-stone-300 font-medium rounded-2xl border border-slate-200 dark:border-stone-700 hover:bg-slate-50 dark:hover:bg-stone-700 transition-all active:scale-95 text-xs"
            >
              Cancelar
            </button>
            <button
              form="create-incident-form"
              type="submit"
              disabled={isSaving}
              className="flex-[2] py-3 px-6 bg-orange-600 text-white font-bold rounded-2xl hover:bg-orange-700 transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50 text-xs shadow-lg shadow-orange-500/20"
            >
              {isSaving ? (
                <><Loader2 className="animate-spin" size={16} /> Creando...</>
              ) : (
                <><Save size={16} /> Crear Incidencia</>
              )}
            </button>
          </div>
        </div>
      </div>

      {mapPickerIndex !== null && (
        <MapPickerModal
          key={`stop-${mapPickerIndex}`}
          isOpen={mapPickerIndex !== null}
          initialValue={stops[mapPickerIndex]?.coords || ''}
          onClose={() => setMapPickerIndex(null)}
          onConfirm={(_addr, coords) => {
            updateStop(mapPickerIndex, { coords });
            setMapPickerIndex(null);
          }}
        />
      )}
    </div>
  );
};

export default IncidentCreateModal;
