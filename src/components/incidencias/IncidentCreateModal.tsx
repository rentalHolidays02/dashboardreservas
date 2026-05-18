import React, { useState, useEffect } from 'react';
import { X, Save, PlusCircle, Loader2, MapPin, Building2, UserRound, Plus, Trash2 } from 'lucide-react';
import { Incidencia, Accommodation } from '../../services/mockData';
import { appsScriptApi } from '../../services/api';

interface IncidentCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (incidentData: Omit<Incidencia, 'id'>) => Promise<void>;
}

const IncidentCreateModal: React.FC<IncidentCreateModalProps> = ({ isOpen, onClose, onCreate }) => {
  const [isSaving, setIsSaving] = useState(false);
  const [accommodations, setAccommodations] = useState<Accommodation[]>([]);
  
  const [stops, setStops] = useState<string[]>(['']);
  
  const [formData, setFormData] = useState<Partial<Incidencia>>({
    coste: 0,
    kms: 0,
    pagadoPor: 'empresa',
    checked: false,
    timestamp: new Date().toISOString().slice(0, 16)
  });

  useEffect(() => {
    if (isOpen) {
      appsScriptApi.getAccommodations().then(acc => {
        setAccommodations(acc.filter(a => a.active).sort((a, b) => a.name.localeCompare(b.name)));
      });
    }
  }, [isOpen]);

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

  const handleAddStop = () => {
    setStops([...stops, '']);
  };

  const handleStopChange = (index: number, val: string) => {
    const newStops = [...stops];
    newStops[index] = val;
    setStops(newStops);
  };

  const handleRemoveStop = (index: number) => {
    const newStops = stops.filter((_, i) => i !== index);
    setStops(newStops);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const userName = `${formData.nombre || ''} ${formData.apellidos || ''}`.trim() || 'Desconocido';
      
      // Formato fecha: 18/5/2026, 15:05:23
      const d = formData.timestamp ? new Date(formData.timestamp) : new Date();
      const formattedDate = `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}, ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`;
      
      const newIncidencia: Omit<Incidencia, 'id'> = {
        userName,
        description: formData.description || '',
        timestamp: formattedDate,
        accommodationId: 'temp_acc',
        accommodationName: formData.accommodationName || 'Sin especificar',
        coste: formData.coste !== undefined ? formData.coste : 0,
        pagadoPor: formData.pagadoPor || 'empresa',
        kms: (formData.kms !== undefined ? formData.kms : 0).toString() as any, // Conversión a string para evitar el fallo de 0 en el Apps Script
        checked: formData.checked || false,
        telefono: formData.telefono ? `34${formData.telefono.replace(/\s/g, '')}` : '',
        nombre: formData.nombre || '',
        apellidos: formData.apellidos || ''
      };

      // Obtener coordenadas GPS reales del dispositivo
      const getDeviceCoords = (): Promise<{lat: number, lng: number} | null> => {
        return new Promise((resolve) => {
          if (!navigator.geolocation) {
            resolve(null);
            return;
          }
          navigator.geolocation.getCurrentPosition(
            (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
            (err) => {
              console.warn("Error getting location", err);
              resolve(null);
            },
            { enableHighAccuracy: true, timeout: 5000 }
          );
        });
      };

      const deviceCoords = await getDeviceCoords();

      // Helper to format stop
      const formatStop = async (stopText: string) => {
        const text = stopText.trim();
        if (!text) return '';
        if (text.includes('[') && text.includes(']')) return text; // already formatted
        
        const timeStr = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
        
        if (deviceCoords) {
          return `${text} (${timeStr}) [${deviceCoords.lat.toFixed(5)}, ${deviceCoords.lng.toFixed(5)}]`;
        }
        return `${text} (${timeStr}) []`;
      };

      const rawValidStops = stops.filter(s => s.trim() !== '');
      const validStops = await Promise.all(rawValidStops.map(formatStop));
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
      
      if (optionalStops.length > 4) {
        newIncidencia.paradaOpcional5 = optionalStops.slice(4).join('\n');
      }

      await onCreate(newIncidencia);
      
      setFormData({ coste: 0, kms: 0, pagadoPor: 'empresa', checked: false, timestamp: new Date().toISOString().slice(0, 16) });
      setStops(['']);
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
                    placeholder="600 000 000"
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

            {/* Fila: Paradas (Dynamic) */}
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
              
              <div className="space-y-2">
                {stops.map((stop, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <div className="flex-1 relative">
                      <MapPin size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
                      <input
                        type="text"
                        value={stop}
                        onChange={(e) => handleStopChange(index, e.target.value)}
                        placeholder={`Parada ${index + 1}`}
                        className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-stone-900 border border-slate-200 dark:border-stone-700 rounded-xl text-slate-700 dark:text-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500/40 transition-all font-light"
                      />
                    </div>
                    {stops.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveStop(index)}
                        className="p-2.5 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Fila: Coste, Kms, Quién paga */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-[11px] font-normal text-slate-400 dark:text-stone-500 tracking-widest mb-2 px-1">
                  Coste Estimado (€)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.coste || ''}
                  onChange={e => setFormData({ ...formData, coste: parseFloat(e.target.value) })}
                  className="w-full px-4 py-3 bg-stone-50 dark:bg-stone-800/50 border border-slate-100 dark:border-stone-700/50 rounded-2xl text-slate-700 dark:text-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500/40 transition-all font-light"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-[11px] font-normal text-slate-400 dark:text-stone-500 tracking-widest mb-2 px-1">
                  Kilómetros (KMS)
                </label>
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
              <div>
                <label className="block text-[11px] font-normal text-slate-400 dark:text-stone-500 tracking-widest mb-2 px-1">
                  ¿Quién paga?
                </label>
                <div className="flex gap-2 h-[46px]">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, pagadoPor: 'empresa' })}
                    className={`flex-1 rounded-xl border transition-all flex items-center justify-center gap-1.5 text-xs ${
                      formData.pagadoPor === 'empresa'
                        ? 'bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-900/50 text-orange-700 dark:text-orange-400 shadow-sm font-medium'
                        : 'border-slate-200 dark:border-stone-700 text-slate-500 hover:bg-stone-50 dark:hover:bg-stone-800'
                    }`}
                  >
                    <Building2 size={12} /> Empresa
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, pagadoPor: 'limpiador' })}
                    className={`flex-1 rounded-xl border transition-all flex items-center justify-center gap-1.5 text-xs ${
                      formData.pagadoPor === 'limpiador'
                        ? 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900/50 text-blue-700 dark:text-blue-400 shadow-sm font-medium'
                        : 'border-slate-200 dark:border-stone-700 text-slate-500 hover:bg-stone-50 dark:hover:bg-stone-800'
                    }`}
                  >
                    <UserRound size={12} /> Trab.
                  </button>
                </div>
              </div>
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
    </div>
  );
};

export default IncidentCreateModal;
