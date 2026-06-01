import React, { useState, useEffect, useRef } from 'react';
import {
  X, Save, User as UserIcon, Phone, CreditCard, Home,
  Loader2, UserPlus, Camera, Mail, Hash, Car, Building2, Landmark, Trash2, Plus, MapPin
} from 'lucide-react';
import { Worker, WorkerAccommodationDetails } from '../../services/mockData';

interface WorkerModalProps {
  worker?: Worker | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (workerData: any) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  existingWorkers: Worker[];
  allAccommodations: string[];
}

const inputClass =
  'w-full px-4 py-2.5 bg-stone-50 dark:bg-stone-800/50 rounded-xl text-slate-700 dark:text-stone-300 text-sm focus:outline-none focus:bg-white dark:focus:bg-stone-800 focus:ring-2 focus:ring-orange-200 dark:focus:ring-orange-900/50 transition-all placeholder:text-stone-400 dark:placeholder:text-stone-500';

const labelClass =
  'block text-[10px] font-light text-slate-400 dark:text-stone-500 mb-2 flex items-center gap-1.5';

const WorkerModal: React.FC<WorkerModalProps> = ({ 
  worker, isOpen, onClose, onSave, onDelete, existingWorkers = [], allAccommodations = [] 
}) => {
  const isEditMode = !!worker;

  const initialData = {
    fullName: '',
    telefono: '',
    email: '',
    dni: '',
    tipoPago: 'bizum' as 'bizum' | 'tarjeta' | 'efectivo',
    tipoTrabajador: 'Limpiador' as 'Limpiador' | 'Manitas',
    pagoPorReserva: 0,
    pagoPorReservaAdicional: 0,
    pagoPorServicioSabanas: 0,
    pagoPorIncidencia: 0,
    precioPorKm: 0,
    telefonoBizum: '',
    iban: '',
    banco: '',
    titularCuenta: '',
    accommodations: [] as string[],
    accommodationDetails: [] as WorkerAccommodationDetails[],
    netMoneyMonth: 0,
    owedMoney: 0,
    cleansCountMonth: 0,
    kmsMonth: 0,
  };

  const [formData, setFormData] = useState<any>(initialData);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [newAccommodation, setNewAccommodation] = useState('');
  const [showAccSuggestions, setShowAccSuggestions] = useState(false);
  const suggestionRef = useRef<HTMLDivElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      if (isEditMode && worker) {
        const details: WorkerAccommodationDetails[] = worker.accommodationDetails?.length
          ? worker.accommodationDetails
          : (worker.accommodations || []).map(name => ({ accommodationName: name, precio: 0, sabanasIncluidas: false, toallasIncluidas: false }));
        setFormData({ ...worker, accommodationDetails: details, accommodations: details.map(d => d.accommodationName) });
      } else {
        setFormData(initialData);
      }
      setNewAccommodation('');
    }
  }, [isOpen, worker, isEditMode]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (suggestionRef.current && !suggestionRef.current.contains(event.target as Node)) {
        setShowAccSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!isOpen) return null;

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    const phoneDigits = formData.telefono.replace(/\D/g, '');
    if (phoneDigits.length < 9) {
      newErrors.telefono = 'El teléfono debe tener al menos 9 dígitos';
    }

    const dniRegex = /^[0-9]{8}[TRWAGMYFPDXBNJZSQVHLCKE]$/i;
    const nieRegex = /^[XYZ][0-9]{7}[TRWAGMYFPDXBNJZSQVHLCKE]$/i;
    const dniClean = formData.dni?.trim().toUpperCase() || '';
    
    if (dniClean && !dniRegex.test(dniClean) && !nieRegex.test(dniClean)) {
      newErrors.dni = 'Formato de DNI (12345678A) o NIE (X1234567L) no válido';
    }

    const isDuplicate = (existingWorkers || []).some(w => 
      w.fullName && formData.fullName &&
      w.fullName.trim().toLowerCase() === formData.fullName.trim().toLowerCase() && 
      (!worker || w.id !== worker.id)
    );

    if (isDuplicate) {
      newErrors.fullName = 'Ya existe un trabajador registrado con este nombre';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setIsSaving(true);
    try {
      const dataToSave = {
        ...formData,
        dni: formData.dni?.trim().toUpperCase(),
        pagoPorReserva:           parseFloat(String(formData.pagoPorReserva          ).replace(',', '.')) || 0,
        pagoPorReservaAdicional:  parseFloat(String(formData.pagoPorReservaAdicional ).replace(',', '.')) || 0,
        pagoPorServicioSabanas:   parseFloat(String(formData.pagoPorServicioSabanas  ).replace(',', '.')) || 0,
        pagoPorIncidencia:        parseFloat(String(formData.pagoPorIncidencia       ).replace(',', '.')) || 0,
        precioPorKm:              parseFloat(String(formData.precioPorKm             ).replace(',', '.')) || 0,
      };
      await onSave(dataToSave);
      onClose();
    } catch (error) {
      console.error('Error saving worker:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!worker || !onDelete) return;
    if (window.confirm(`¿Estás seguro de que deseas eliminar a ${worker.fullName}? Esta acción no se puede deshacer en el Excel.`)) {
      setIsSaving(true);
      try {
        await onDelete(worker.id);
        onClose();
      } catch (error) {
        console.error('Error deleting worker:', error);
      } finally {
        setIsSaving(false);
      }
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    let { name, value } = e.target;
    
    if (name === 'dni') {
      value = value.toUpperCase().replace(/\s/g, '');
    }

    if (name === 'telefono' || name === 'telefonoBizum') {
      const digits = value.replace(/\D/g, '');
      let finalValue = '';
      
      if (digits.length > 0) {
        finalValue = '+34 ';
        const mobileDigits = digits.startsWith('34') ? digits.substring(2, 11) : digits.substring(0, 9);
        
        if (mobileDigits.length > 0) finalValue += mobileDigits.substring(0, 3);
        if (mobileDigits.length > 3) finalValue += ' ' + mobileDigits.substring(3, 5);
        if (mobileDigits.length > 5) finalValue += ' ' + mobileDigits.substring(5, 7);
        if (mobileDigits.length > 7) finalValue += ' ' + mobileDigits.substring(7, 9);
      }
      value = finalValue;
    }

    if (['pagoPorReserva', 'pagoPorReservaAdicional', 'pagoPorServicioSabanas', 'pagoPorIncidencia', 'precioPorKm'].includes(name)) {
      setFormData((prev: any) => ({
        ...prev,
        [name]: value === '' ? '' : value.replace(',', '.')
      }));
      return;
    }

    setFormData((prev: any) => ({
      ...prev,
      [name]: value,
    }));

    if (errors[name]) {
      setErrors(prev => {
        const newErrs = { ...prev };
        delete newErrs[name];
        return newErrs;
      });
    }
  };

  const addAccommodation = (value?: string) => {
    const accToAdd = (value || newAccommodation).trim();
    const currentNames = (formData.accommodationDetails as WorkerAccommodationDetails[]).map(d => d.accommodationName);
    if (accToAdd && !currentNames.includes(accToAdd)) {
      const newDetail: WorkerAccommodationDetails = { accommodationName: accToAdd, precio: 0, sabanasIncluidas: false, toallasIncluidas: false };
      setFormData((prev: any) => ({
        ...prev,
        accommodationDetails: [...(prev.accommodationDetails || []), newDetail],
        accommodations: [...(prev.accommodations || []), accToAdd],
      }));
      setNewAccommodation('');
      setShowAccSuggestions(false);
    }
  };

  const removeAccommodation = (name: string) => {
    setFormData((prev: any) => ({
      ...prev,
      accommodationDetails: (prev.accommodationDetails as WorkerAccommodationDetails[]).filter(d => d.accommodationName !== name),
      accommodations: (prev.accommodations as string[]).filter((a: string) => a !== name),
    }));
  };

  const updateAccommodationDetail = (name: string, field: keyof Omit<WorkerAccommodationDetails, 'accommodationName'>, value: number | boolean) => {
    setFormData((prev: any) => ({
      ...prev,
      accommodationDetails: (prev.accommodationDetails as WorkerAccommodationDetails[]).map(d =>
        d.accommodationName === name ? { ...d, [field]: value } : d
      ),
    }));
  };

  const handlePhotoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const base64 = ev.target?.result as string;
      if (base64) setFormData((prev: any) => ({ ...prev, photo: base64 }));
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-300">
      <div className="absolute inset-0 bg-slate-900/60 dark:bg-black/70 backdrop-blur-md" onClick={onClose} />

      <div className="relative bg-white dark:bg-stone-900 w-full max-w-lg rounded-2xl overflow-hidden animate-in zoom-in-95 duration-300">
        <div className="px-8 py-6 flex items-center justify-between border-b border-stone-100 dark:border-stone-800">
          <div className="flex items-center space-x-4">
            {isEditMode ? (
              <>
                <button
                  type="button"
                  onClick={() => photoInputRef.current?.click()}
                  title="Cambiar foto"
                  className="relative w-10 h-10 rounded-full overflow-hidden bg-stone-50 dark:bg-stone-800 flex items-center justify-center text-slate-500 dark:text-stone-400 text-lg font-normal group/avatar focus:outline-none focus:ring-2 focus:ring-orange-400"
                >
                  {formData.photo ? (
                    <img src={formData.photo} alt="" className="w-full h-full object-cover" />
                  ) : (
                    (worker?.fullName || '?')[0].toUpperCase()
                  )}
                  <span className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover/avatar:opacity-100 transition-opacity pointer-events-none">
                    <Camera size={12} className="text-white" />
                  </span>
                </button>
                <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoFileChange} />
              </>
            ) : (
              <div className="w-10 h-10 rounded-full bg-stone-50 dark:bg-stone-800 flex items-center justify-center text-slate-500 dark:text-stone-400">
                <UserPlus size={18} />
              </div>
            )}
            <div>
              <h2 className="text-lg font-normal font-display tracking-tight text-slate-800 dark:text-stone-200">
                {isEditMode ? 'Editar Trabajador' : 'Nuevo Trabajador'}
              </h2>
              <p className="text-[10px] text-slate-400 dark:text-stone-500 font-light mt-0.5">
                {isEditMode ? worker?.telefono || '—' : 'Registro de nuevo ingreso'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-stone-100 dark:hover:bg-stone-700 rounded-lg transition-colors text-slate-400 hover:text-slate-600 dark:hover:text-stone-200">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-5 max-h-[70vh] overflow-y-auto">
          <p className="text-[10px] font-semibold text-slate-400 dark:text-stone-500 uppercase tracking-widest">Datos personales</p>

          <div>
            <label className={labelClass}>Nombre completo</label>
            <input 
              type="text" 
              name="fullName" 
              value={formData.fullName} 
              onChange={handleChange} 
              placeholder="Ej. Juan Pérez" 
              required 
              autoFocus={!isEditMode} 
              className={`${inputClass} ${errors.fullName ? 'ring-2 ring-red-500 bg-red-50 dark:bg-red-900/10' : ''}`} 
            />
            {errors.fullName && <p className="text-[10px] text-red-500 mt-1 ml-1">{errors.fullName}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Teléfono</label>
              <input 
                type="tel" 
                name="telefono" 
                value={formData.telefono ?? ''} 
                onChange={handleChange} 
                placeholder="697 60 97 56" 
                maxLength={17}
                required
                className={`${inputClass} ${errors.telefono ? 'ring-2 ring-red-500 bg-red-50 dark:bg-red-900/10' : ''}`} 
              />
              {errors.telefono && <p className="text-[10px] text-red-500 mt-1 ml-1">{errors.telefono}</p>}
            </div>
            <div>
              <label className={labelClass}>DNI / NIE</label>
              <input 
                type="text" 
                name="dni" 
                value={formData.dni ?? ''} 
                onChange={handleChange} 
                placeholder="12345678A" 
                maxLength={9}
                required
                className={`${inputClass} ${errors.dni ? 'ring-2 ring-red-500 bg-red-50 dark:bg-red-900/10' : ''} uppercase`} 
              />
              {errors.dni && <p className="text-[10px] text-red-500 mt-1 ml-1">{errors.dni}</p>}
            </div>
          </div>

          <div>
            <label className={labelClass}>Email</label>
            <input type="email" name="email" value={formData.email ?? ''} onChange={handleChange} placeholder="trabajador@ejemplo.com" className={inputClass} />
          </div>

          <div>
            <label className={labelClass}>Tipo de Trabajador</label>
            <select name="tipoTrabajador" value={formData.tipoTrabajador} onChange={handleChange} className={inputClass}>
              <option value="Limpiador">Limpiador</option>
              <option value="Manitas">Manitas</option>
            </select>
          </div>

          <p className="text-[10px] font-semibold text-slate-400 dark:text-stone-500 uppercase tracking-widest pt-1">Tarifas</p>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Tipo de pago</label>
              <select name="tipoPago" value={formData.tipoPago} onChange={handleChange} className={inputClass}>
                <option value="bizum">Bizum</option>
                <option value="tarjeta">Tarjeta / Transferencia</option>
                <option value="efectivo">Efectivo</option>
              </select>
            </div>
            <div>
              <label className={labelClass}><span className="text-slate-400">€</span> Pago por reserva</label>
              <input
                type="text"
                name="pagoPorReserva"
                value={formData.pagoPorReserva}
                onChange={handleChange}
                placeholder="20"
                className={`${inputClass} tabular-nums`}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}><span className="text-slate-400">€</span> Pago por reserva adicional</label>
              <input
                type="text"
                name="pagoPorReservaAdicional"
                value={formData.pagoPorReservaAdicional ?? 0}
                onChange={handleChange}
                placeholder="5"
                className={`${inputClass} tabular-nums`}
              />
            </div>
            <div>
              <label className={labelClass}><span className="text-slate-400">€</span> Pago por sábanas y toallas</label>
              <input
                type="text"
                name="pagoPorServicioSabanas"
                value={formData.pagoPorServicioSabanas ?? 0}
                onChange={handleChange}
                placeholder="5"
                className={`${inputClass} tabular-nums`}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}><span className="text-slate-400">€</span> Pago por incidencia</label>
              <input
                type="text"
                name="pagoPorIncidencia"
                value={formData.pagoPorIncidencia ?? 0}
                onChange={handleChange}
                placeholder="10"
                className={`${inputClass} tabular-nums`}
              />
            </div>
            <div>
              <label className={labelClass}>Precio por km (€/km)</label>
              <input
                type="text"
                name="precioPorKm"
                value={formData.precioPorKm}
                onChange={handleChange}
                placeholder="Ej. 0.19"
                className={`${inputClass} tabular-nums`}
              />
            </div>
          </div>

          {formData.tipoPago === 'bizum' && (
            <div>
              <label className={labelClass}>Teléfono Bizum</label>
              <input 
                type="tel" 
                name="telefonoBizum" 
                value={formData.telefonoBizum ?? ''} 
                onChange={handleChange} 
                placeholder="697 60 97 56" 
                maxLength={17}
                className={inputClass} 
              />
            </div>
          )}

          {formData.tipoPago === 'tarjeta' && (
            <div className="space-y-3">
              <div>
                <label className={labelClass}>IBAN</label>
                <input type="text" name="iban" value={formData.iban ?? ''} onChange={handleChange} placeholder="ES12 3456 7890 1234 5678 9012" className={`${inputClass} font-mono`} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Banco</label>
                  <input type="text" name="banco" value={formData.banco ?? ''} onChange={handleChange} placeholder="Ej. Santander" className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Titular</label>
                  <input type="text" name="titularCuenta" value={formData.titularCuenta ?? ''} onChange={handleChange} placeholder="Nombre titular" className={inputClass} />
                </div>
              </div>
            </div>
          )}

          <p className="text-[10px] font-semibold text-slate-400 dark:text-stone-500 uppercase tracking-widest pt-1">Alojamientos</p>

          <div>
            <label className={labelClass}>Asignar Alojamientos</label>
            <div className="relative">
              <div className="flex gap-2 mb-3">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={newAccommodation}
                    onChange={(e) => {
                      setNewAccommodation(e.target.value);
                      setShowAccSuggestions(true);
                    }}
                    onFocus={() => setShowAccSuggestions(true)}
                    placeholder="Busca o escribe un alojamiento..."
                    className={inputClass}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addAccommodation();
                      }
                    }}
                  />
                  {showAccSuggestions && newAccommodation.trim() && (
                    <div
                      ref={suggestionRef}
                      className="absolute z-50 left-0 right-0 mt-1 bg-white dark:bg-stone-900 border border-stone-100 dark:border-stone-800 rounded-xl shadow-xl max-h-48 overflow-y-auto animate-in fade-in zoom-in-95 duration-200"
                    >
                      {(allAccommodations || [])
                        .filter(acc =>
                          acc.toLowerCase().includes(newAccommodation.toLowerCase()) &&
                          !(formData.accommodationDetails as WorkerAccommodationDetails[]).some(d => d.accommodationName === acc)
                        )
                        .map((acc, index) => (
                          <button
                            key={index}
                            type="button"
                            onClick={() => addAccommodation(acc)}
                            className="w-full text-left px-4 py-2.5 text-xs text-slate-700 dark:text-stone-300 hover:bg-orange-50 dark:hover:bg-orange-900/20 border-b border-stone-50 dark:border-stone-800/50 last:border-0 transition-colors"
                          >
                            {acc}
                          </button>
                        ))
                      }
                      <button
                        type="button"
                        onClick={() => addAccommodation()}
                        className="w-full text-left px-4 py-2.5 text-[10px] font-medium text-orange-600 dark:text-orange-400 bg-orange-50/30 dark:bg-orange-900/10 hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors flex items-center gap-2"
                      >
                        <Plus size={12} />
                        Usar "{newAccommodation}" como nuevo
                      </button>
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => addAccommodation()}
                  className="px-4 bg-stone-100 dark:bg-stone-800 text-slate-600 dark:text-stone-300 rounded-xl hover:bg-orange-100 dark:hover:bg-orange-900/30 hover:text-orange-600 dark:hover:text-orange-400 transition-all font-medium text-xs active:scale-95"
                >
                  Añadir
                </button>
              </div>

              {/* Accommodation detail rows */}
              <div className="space-y-2">
                {(formData.accommodationDetails as WorkerAccommodationDetails[]).map((detail) => (
                  <div key={detail.accommodationName} className="bg-stone-50 dark:bg-stone-800/50 rounded-xl border border-stone-100 dark:border-stone-800 p-3 animate-in zoom-in duration-200">
                    {/* Name row */}
                    <div className="flex items-center justify-between mb-2.5">
                      <div className="flex items-center gap-1.5 text-[11px] font-normal text-orange-600 dark:text-orange-400">
                        <MapPin size={10} />
                        <span className="truncate max-w-[220px]">{detail.accommodationName}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeAccommodation(detail.accommodationName)}
                        className="text-slate-300 dark:text-stone-600 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                      >
                        <X size={13} />
                      </button>
                    </div>
                    {/* Detail fields */}
                    <div className="flex items-center gap-3 flex-wrap">
                      {/* Precio */}
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-slate-400 dark:text-stone-500">€ Precio</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={detail.precio}
                          onChange={(e) => updateAccommodationDetail(detail.accommodationName, 'precio', parseFloat(e.target.value) || 0)}
                          className="w-20 px-2 py-1 text-xs bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-lg text-slate-700 dark:text-stone-300 focus:outline-none focus:ring-1 focus:ring-orange-300 tabular-nums"
                        />
                      </div>
                      {/* Sábanas */}
                      <button
                        type="button"
                        onClick={() => updateAccommodationDetail(detail.accommodationName, 'sabanasIncluidas', !detail.sabanasIncluidas)}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-normal border transition-all ${
                          detail.sabanasIncluidas
                            ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800'
                            : 'bg-white dark:bg-stone-900 text-slate-400 dark:text-stone-500 border-stone-200 dark:border-stone-700'
                        }`}
                      >
                        <span>🛏</span>
                        Sábanas {detail.sabanasIncluidas ? '✓' : '—'}
                      </button>
                      {/* Toallas */}
                      <button
                        type="button"
                        onClick={() => updateAccommodationDetail(detail.accommodationName, 'toallasIncluidas', !detail.toallasIncluidas)}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-normal border transition-all ${
                          detail.toallasIncluidas
                            ? 'bg-teal-50 dark:bg-teal-900/20 text-teal-600 dark:text-teal-400 border-teal-200 dark:border-teal-800'
                            : 'bg-white dark:bg-stone-900 text-slate-400 dark:text-stone-500 border-stone-200 dark:border-stone-700'
                        }`}
                      >
                        <span>🛁</span>
                        Toallas {detail.toallasIncluidas ? '✓' : '—'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex space-x-3 pt-2">
            {isEditMode && (
              <button 
                type="button" 
                onClick={handleDelete}
                disabled={isSaving}
                className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl hover:bg-red-100 dark:hover:bg-red-900/40 transition-all active:scale-95 disabled:opacity-50"
                title="Eliminar trabajador"
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
                <><Save size={16} /><span>{isEditMode ? 'Guardar Cambios' : 'Crear Trabajador'}</span></>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default WorkerModal;
