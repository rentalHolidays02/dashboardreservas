import React, { useState, useEffect, useRef } from 'react';
import {
  X, Save, User as UserIcon, Phone, CreditCard, Home,
  Loader2, UserPlus, Camera, Mail, Hash, Car, Building2, Landmark,
} from 'lucide-react';
import { Worker } from '../../services/mockData';

interface WorkerModalProps {
  worker?: Worker | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (workerData: any) => Promise<void>;
}

const inputClass =
  'w-full px-4 py-2.5 bg-stone-50 dark:bg-stone-800/50 rounded-xl text-slate-700 dark:text-stone-300 text-sm focus:outline-none focus:bg-white dark:focus:bg-stone-800 focus:ring-2 focus:ring-orange-200 dark:focus:ring-orange-900/50 transition-all placeholder:text-stone-400 dark:placeholder:text-stone-500';

const labelClass =
  'block text-[10px] font-light text-slate-400 dark:text-stone-500 mb-2 flex items-center gap-1.5';

const WorkerModal: React.FC<WorkerModalProps> = ({ worker, isOpen, onClose, onSave }) => {
  const isEditMode = !!worker;

  const initialData = {
    fullName: '',
    telefono: '',
    email: '',
    dni: '',
    tipoPago: 'bizum' as 'bizum' | 'tarjeta' | 'efectivo',
    pagoPorReserva: 0,
    precioPorKm: 0,
    telefonoBizum: '',
    iban: '',
    banco: '',
    titularCuenta: '',
    accommodations: [] as string[],
    netMoneyMonth: 0,
    cleansCountMonth: 0,
    kmsMonth: 0,
  };

  const [formData, setFormData] = useState<any>(initialData);
  const [isSaving, setIsSaving] = useState(false);
  const [accInput, setAccInput] = useState('');
  const photoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setFormData(isEditMode && worker ? { ...worker } : initialData);
      setAccInput('');
    }
  }, [isOpen, worker, isEditMode]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await onSave(formData);
      onClose();
    } catch (error) {
      console.error('Error saving worker:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    const numericFields = ['pagoPorReserva', 'precioPorKm'];
    setFormData((prev: any) => ({
      ...prev,
      [name]: numericFields.includes(name) ? parseFloat(value) || 0 : value,
    }));
  };

  const addAccommodation = () => {
    const trimmed = accInput.trim();
    if (trimmed && !formData.accommodations.includes(trimmed)) {
      setFormData((prev: any) => ({ ...prev, accommodations: [...prev.accommodations, trimmed] }));
    }
    setAccInput('');
  };

  const removeAccommodation = (acc: string) => {
    setFormData((prev: any) => ({
      ...prev,
      accommodations: prev.accommodations.filter((a: string) => a !== acc),
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
        {/* Header */}
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
                    worker?.fullName[0].toUpperCase()
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

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-8 space-y-5 max-h-[70vh] overflow-y-auto">

          {/* ── Datos personales ── */}
          <p className="text-[10px] font-semibold text-slate-400 dark:text-stone-500 uppercase tracking-widest">Datos personales</p>

          <div>
            <label className={labelClass}><UserIcon size={12} className="text-orange-500" />Nombre completo</label>
            <input type="text" name="fullName" value={formData.fullName} onChange={handleChange} placeholder="Ej. Juan Pérez" required autoFocus={!isEditMode} className={inputClass} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}><Phone size={12} />Teléfono</label>
              <input type="tel" name="telefono" value={formData.telefono ?? ''} onChange={handleChange} placeholder="+34 600 111 222" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}><Hash size={12} />DNI / NIE</label>
              <input type="text" name="dni" value={formData.dni ?? ''} onChange={handleChange} placeholder="12345678A" className={inputClass} />
            </div>
          </div>

          <div>
            <label className={labelClass}><Mail size={12} />Email</label>
            <input type="email" name="email" value={formData.email ?? ''} onChange={handleChange} placeholder="trabajador@ejemplo.com" className={inputClass} />
          </div>

          {/* ── Tarifas ── */}
          <p className="text-[10px] font-semibold text-slate-400 dark:text-stone-500 uppercase tracking-widest pt-1">Tarifas</p>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}><CreditCard size={12} />Tipo de pago</label>
              <select name="tipoPago" value={formData.tipoPago} onChange={handleChange} className={inputClass}>
                <option value="bizum">Bizum</option>
                <option value="tarjeta">Tarjeta / Transferencia</option>
                <option value="efectivo">Efectivo</option>
              </select>
            </div>
            <div>
              <label className={labelClass}><span className="text-slate-400">€</span> Pago por reserva</label>
              <input type="number" step="0.01" name="pagoPorReserva" value={formData.pagoPorReserva} onChange={handleChange} placeholder="20" className={`${inputClass} tabular-nums`} />
            </div>
          </div>

          <div>
            <label className={labelClass}><Car size={12} />Precio por km (€/km)</label>
            <input type="number" step="0.01" name="precioPorKm" value={formData.precioPorKm} onChange={handleChange} placeholder="Ej. 0.19" className={`${inputClass} tabular-nums`} />
          </div>

          {/* ── Datos de pago condicionales ── */}
          {formData.tipoPago === 'bizum' && (
            <div>
              <label className={labelClass}><Phone size={12} className="text-green-500" />Teléfono Bizum</label>
              <input type="tel" name="telefonoBizum" value={formData.telefonoBizum ?? ''} onChange={handleChange} placeholder="+34 600 111 222" className={inputClass} />
            </div>
          )}

          {formData.tipoPago === 'tarjeta' && (
            <div className="space-y-3">
              <div>
                <label className={labelClass}><Landmark size={12} className="text-blue-500" />IBAN</label>
                <input type="text" name="iban" value={formData.iban ?? ''} onChange={handleChange} placeholder="ES12 3456 7890 1234 5678 9012" className={`${inputClass} font-mono`} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}><Building2 size={12} />Banco</label>
                  <input type="text" name="banco" value={formData.banco ?? ''} onChange={handleChange} placeholder="Ej. Santander" className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}><UserIcon size={12} />Titular</label>
                  <input type="text" name="titularCuenta" value={formData.titularCuenta ?? ''} onChange={handleChange} placeholder="Nombre titular" className={inputClass} />
                </div>
              </div>
            </div>
          )}

          {/* ── Alojamientos ── */}
          <p className="text-[10px] font-semibold text-slate-400 dark:text-stone-500 uppercase tracking-widest pt-1">Alojamientos</p>

          <div>
            <label className={labelClass}><Home size={12} className="text-orange-500" />Alojamientos asignados</label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={accInput}
                onChange={(e) => setAccInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addAccommodation(); } }}
                placeholder="Nombre del alojamiento"
                className={inputClass}
              />
              <button type="button" onClick={addAccommodation} className="px-3 py-2.5 bg-orange-600 text-white rounded-xl text-xs font-bold hover:bg-orange-700 transition-all active:scale-95">
                Añadir
              </button>
            </div>
            {formData.accommodations?.length > 0 && (
              <div className="flex flex-wrap gap-1.5 bg-orange-50 dark:bg-orange-900/20 rounded-xl p-2.5 border border-orange-100 dark:border-orange-800/40">
                {formData.accommodations.map((acc: string) => (
                  <span key={acc} className="inline-flex items-center gap-1 text-[10px] font-bold bg-white dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 border border-orange-200 dark:border-orange-800/50 rounded-md px-2 py-0.5">
                    {acc}
                    <button type="button" onClick={() => removeAccommodation(acc)} className="ml-0.5 hover:text-orange-800 dark:hover:text-orange-300 transition-colors">×</button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex space-x-3 pt-2">
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
