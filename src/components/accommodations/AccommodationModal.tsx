import React, { useState, useEffect, useRef } from 'react';
import {
  X, Save, MapPin, Building2, Home, Loader2, Camera, Hash, FileText, Info, Trash2
} from 'lucide-react';
import { Accommodation } from '../../services/mockData';

interface AccommodationModalProps {
  accommodation?: Accommodation | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (accommodationData: any) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
}

const inputClass =
  'w-full px-4 py-2.5 bg-stone-50 dark:bg-stone-800/50 rounded-xl text-slate-700 dark:text-stone-300 text-sm focus:outline-none focus:bg-white dark:focus:bg-stone-800 focus:ring-2 focus:ring-orange-200 dark:focus:ring-orange-900/50 transition-all placeholder:text-stone-400 dark:placeholder:text-stone-500';

const labelClass =
  'block text-[10px] font-light text-slate-400 dark:text-stone-500 mb-2 flex items-center gap-1.5';

const AccommodationModal: React.FC<AccommodationModalProps> = ({ accommodation, isOpen, onClose, onSave, onDelete }) => {
  const isEditMode = !!accommodation;

  const initialData: Omit<Accommodation, 'id'> = {
    name: '',
    ref: '',
    address: '',
    city: '',
    zipCode: '',
    active: true,
    notes: '',
    image: undefined
  };

  const [formData, setFormData] = useState<any>(initialData);
  const [isSaving, setIsSaving] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setFormData(isEditMode && accommodation ? { ...accommodation } : initialData);
    }
  }, [isOpen, accommodation, isEditMode]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await onSave(formData);
      onClose();
    } catch (error) {
      console.error('Error saving accommodation:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target as any;
    setFormData((prev: any) => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const base64 = ev.target?.result as string;
      if (base64) setFormData((prev: any) => ({ ...prev, image: base64 }));
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-300">
      <div className="absolute inset-0 bg-slate-900/60 dark:bg-black/70 backdrop-blur-md" onClick={onClose} />

      <div className="relative bg-white dark:bg-stone-900 w-full max-w-lg rounded-2xl overflow-hidden animate-in zoom-in-95 duration-300">
        {/* Header */}
        <div className="px-8 py-6 flex items-center justify-between border-b border-stone-100 dark:border-stone-800">
          <div className="flex items-center space-x-4">
            <button
              type="button"
              onClick={() => imageInputRef.current?.click()}
              title="Cambiar imagen"
              className="relative w-10 h-10 rounded-xl overflow-hidden bg-stone-50 dark:bg-stone-800 flex items-center justify-center text-slate-500 dark:text-stone-400 text-lg font-normal group/avatar focus:outline-none focus:ring-2 focus:ring-orange-400"
            >
              {formData.image ? (
                <img src={formData.image} alt="" className="w-full h-full object-cover" />
              ) : (
                <Home size={20} />
              )}
              <span className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover/avatar:opacity-100 transition-opacity pointer-events-none">
                <Camera size={12} className="text-white" />
              </span>
            </button>
            <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageFileChange} />
            
            <div>
              <h2 className="text-lg font-normal font-display tracking-tight text-slate-800 dark:text-stone-200">
                {isEditMode ? 'Editar Alojamiento' : 'Nuevo Alojamiento'}
              </h2>
              <p className="text-[10px] text-slate-400 dark:text-stone-500 font-light mt-0.5">
                {isEditMode ? formData.name : 'Registro de nueva propiedad'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-stone-100 dark:hover:bg-stone-700 rounded-lg transition-colors text-slate-400 hover:text-slate-600 dark:hover:text-stone-200">
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-8 space-y-5 max-h-[70vh] overflow-y-auto">

          {/* ── Datos generales ── */}
          <p className="text-[10px] font-semibold text-slate-400 dark:text-stone-500 uppercase tracking-widest">Información general</p>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}><Home size={12} className="text-orange-500" />Nombre del alojamiento</label>
              <input type="text" name="name" value={formData.name} onChange={handleChange} placeholder="Ej. Apt. Ramblas 12" required autoFocus={!isEditMode} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}><Hash size={12} className="text-orange-500" />Referencia (REF)</label>
              <input type="text" name="ref" value={formData.ref ?? ''} onChange={handleChange} placeholder="Ej. 069" className={inputClass} />
            </div>
          </div>

          <div>
            <label className={labelClass}><Building2 size={12} />Dirección completa</label>
            <input type="text" name="address" value={formData.address} onChange={handleChange} placeholder="Calle, número, piso..." className={inputClass} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}><MapPin size={12} />Ciudad</label>
              <input type="text" name="city" value={formData.city} onChange={handleChange} placeholder="Ej. Barcelona" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}><Hash size={12} />Código Postal</label>
              <input type="text" name="zipCode" value={formData.zipCode} onChange={handleChange} placeholder="08001" className={inputClass} />
            </div>
          </div>

          {/* ── Estado ── */}
          <div className="flex items-center gap-3 py-2 bg-stone-50 dark:bg-stone-800/30 rounded-xl px-4 border border-stone-100 dark:border-stone-800/40">
            <div className={`p-2 rounded-lg ${formData.active ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'}`}>
              <Info size={16} />
            </div>
            <div className="flex-1">
              <p className="text-xs font-semibold text-slate-700 dark:text-stone-200">Estado de la propiedad</p>
              <p className="text-[10px] text-slate-400 dark:text-stone-500">Define si el alojamiento está disponible para operar</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" name="active" checked={formData.active} onChange={handleChange} className="sr-only peer" />
              <div className="w-9 h-5 bg-stone-200 peer-focus:outline-none rounded-full peer dark:bg-stone-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-orange-500"></div>
            </label>
          </div>

          {/* ── Notas ── */}
          <div>
            <label className={labelClass}><FileText size={12} />Notas adicionales</label>
            <textarea
              name="notes"
              value={formData.notes ?? ''}
              onChange={handleChange}
              rows={3}
              placeholder="Instrucciones de acceso, códigos, contactos..."
              className={`${inputClass} resize-none`}
            />
          </div>

          {/* Actions */}
          <div className="flex space-x-3 pt-2">
            {isEditMode && onDelete && (
              <button 
                type="button" 
                onClick={() => onDelete(accommodation!.id)}
                disabled={isSaving}
                className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl hover:bg-red-100 dark:hover:bg-red-900/40 transition-all active:scale-95 disabled:opacity-50 text-xs"
                title="Eliminar alojamiento"
              >
                <Trash2 size={16} />
              </button>
            )}
            <button type="button" onClick={onClose} className="flex-1 py-3 px-6 bg-stone-50 dark:bg-stone-800/50 text-slate-500 dark:text-stone-400 font-bold rounded-xl hover:bg-stone-100 dark:hover:bg-stone-800 transition-all active:scale-95 text-xs">
              Cancelar
            </button>
            <button type="submit" disabled={isSaving} className="flex-[2] py-3 px-6 bg-orange-600 text-white font-bold rounded-xl hover:bg-orange-700 transition-all active:scale-95 flex items-center justify-center space-x-2 disabled:opacity-70 disabled:cursor-not-allowed text-xs">
              {isSaving ? (
                <><Loader2 className="animate-spin" size={16} /><span>Guardando...</span></>
              ) : (
                <><Save size={16} /><span>{isEditMode ? 'Guardar Cambios' : 'Crear Alojamiento'}</span></>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AccommodationModal;
