import React, { useState, useEffect } from 'react';
import { X, Save, User as UserIcon, Wallet, CheckCircle2, Navigation, Loader2, UserPlus } from 'lucide-react';
import { Worker } from '../../services/mockData';

interface WorkerModalProps {
  worker?: Worker | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (workerData: any) => Promise<void>;
}

const WorkerModal: React.FC<WorkerModalProps> = ({ worker, isOpen, onClose, onSave }) => {
  const isEditMode = !!worker;

  const initialData = {
    fullName: '',
    netMoneyMonth: 0,
    cleansCountMonth: 0,
    kmsMonth: 0
  };

  const [formData, setFormData] = useState<any>(initialData);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (isEditMode && worker) {
        setFormData({ ...worker });
      } else {
        setFormData(initialData);
      }
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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev: any) => ({
      ...prev,
      [name]: name === 'fullName' ? value : parseFloat(value) || 0
    }));
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-300">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/60 dark:bg-black/70 backdrop-blur-md"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white dark:bg-stone-900 w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden border border-slate-200 dark:border-stone-700/50 animate-in zoom-in-95 duration-300">
        {/* Header */}
        <div className={`${isEditMode ? 'bg-slate-900 dark:bg-stone-800' : 'bg-blue-600 dark:bg-blue-700'} px-8 py-6 flex items-center justify-between text-white transition-colors duration-500`}>
          <div className="flex items-center space-x-3">
            <div className={`w-10 h-10 rounded-xl ${isEditMode ? 'bg-blue-500 dark:bg-blue-600' : 'bg-white/20'} flex items-center justify-center font-bold text-lg`}>
              {isEditMode ? (
                worker?.fullName[0].toUpperCase()
              ) : (
                <UserPlus size={20} />
              )}
            </div>
            <div>
              <h2 className="text-xl font-bold font-display tracking-tight">
                {isEditMode ? 'Editar Trabajador' : 'Nuevo Trabajador'}
              </h2>
              <p className="text-white/60 text-xs font-medium uppercase tracking-wider">
                {isEditMode ? `ID: #${worker?.id.padStart(3, '0')}` : 'Registro de nuevo ingreso'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-xl transition-colors text-white/50 hover:text-white"
          >
            <X size={24} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          <div className="space-y-5">
            {/* Nombre */}
            <div className="group">
              <label className="block text-xs font-bold text-slate-500 dark:text-stone-400 mb-2 uppercase tracking-widest flex items-center">
                <UserIcon size={14} className="mr-2 text-blue-500" />
                Nombre Completo
              </label>
              <input
                type="text"
                name="fullName"
                value={formData.fullName}
                onChange={handleChange}
                placeholder="Ej. Juan Pérez"
                required
                autoFocus={!isEditMode}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-stone-800 border border-slate-200 dark:border-stone-700 rounded-2xl text-slate-900 dark:text-stone-100 focus:outline-none focus:ring-4 focus:ring-blue-100 dark:focus:ring-blue-900/30 focus:border-blue-500 transition-all font-medium placeholder:text-stone-400 dark:placeholder:text-stone-400"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Dinero Neto */}
              <div className="group">
                <label className="block text-xs font-bold text-slate-500 dark:text-stone-400 mb-2 uppercase tracking-widest flex items-center">
                  <Wallet size={14} className="mr-2 text-emerald-500" />
                  Dinero Neto (€)
                </label>
                <input
                  type="number"
                  step="0.01"
                  name="netMoneyMonth"
                  value={formData.netMoneyMonth}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-stone-800 border border-slate-200 dark:border-stone-700 rounded-2xl text-slate-900 dark:text-stone-100 focus:outline-none focus:ring-4 focus:ring-emerald-100 dark:focus:ring-emerald-900/30 focus:border-emerald-500 transition-all font-mono font-bold"
                />
              </div>

              {/* Limpiezas */}
              <div className="group">
                <label className="block text-xs font-bold text-slate-500 dark:text-stone-400 mb-2 uppercase tracking-widest flex items-center">
                  <CheckCircle2 size={14} className="mr-2 text-purple-500" />
                  Limpiezas
                </label>
                <input
                  type="number"
                  name="cleansCountMonth"
                  value={formData.cleansCountMonth}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-stone-800 border border-slate-200 dark:border-stone-700 rounded-2xl text-slate-900 dark:text-stone-100 focus:outline-none focus:ring-4 focus:ring-purple-100 dark:focus:ring-purple-900/30 focus:border-purple-500 transition-all font-bold"
                />
              </div>
            </div>

            {/* Kilómetros */}
            <div className="group">
              <label className="block text-xs font-bold text-slate-500 dark:text-stone-400 mb-2 uppercase tracking-widest flex items-center">
                <Navigation size={14} className="mr-2 text-amber-500" />
                Kilómetros Acumulados
              </label>
              <input
                type="number"
                name="kmsMonth"
                value={formData.kmsMonth}
                onChange={handleChange}
                required
                className="w-full px-4 py-3 bg-slate-50 dark:bg-stone-800 border border-slate-200 dark:border-stone-700 rounded-2xl text-slate-900 dark:text-stone-100 focus:outline-none focus:ring-4 focus:ring-amber-100 dark:focus:ring-amber-900/30 focus:border-amber-500 transition-all font-bold"
              />
            </div>
          </div>

          <div className="flex space-x-3 pt-6">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-4 px-6 border border-slate-200 dark:border-stone-700 text-slate-600 dark:text-stone-300 font-bold rounded-2xl hover:bg-slate-50 dark:hover:bg-stone-800 transition-all active:scale-95"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className={`flex-[2] py-4 px-6 ${isEditMode ? 'bg-slate-900 dark:bg-stone-700' : 'bg-blue-600 dark:bg-blue-700'} text-white font-bold rounded-2xl shadow-lg ${isEditMode ? 'shadow-slate-900/30' : 'shadow-blue-600/30'} hover:opacity-90 transition-all active:scale-95 flex items-center justify-center space-x-2 disabled:opacity-70 disabled:cursor-not-allowed`}
            >
              {isSaving ? (
                <>
                  <Loader2 className="animate-spin" size={20} />
                  <span>Guardando...</span>
                </>
              ) : (
                <>
                  <Save size={20} />
                  <span>{isEditMode ? 'Guardar Cambios' : 'Crear Trabajador'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default WorkerModal;
