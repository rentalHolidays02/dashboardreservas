import React, { useState } from 'react';
import { X, Save, AlertTriangle, CheckCircle2, Info, Loader2, MapPin, Trash2 } from 'lucide-react';
import { Incidencia } from '../../services/mockData';

interface IncidentEditModalProps {
  incident: Incidencia | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (incidentData: Incidencia) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  isReadOnly?: boolean;
}

const IncidentEditModal: React.FC<IncidentEditModalProps> = ({ incident, isOpen, onClose, onSave, onDelete, isReadOnly }) => {
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [formData, setFormData] = useState<Partial<Incidencia>>({});

  React.useEffect(() => {
    if (incident) {
      setFormData(incident);
      setShowDeleteConfirm(false);
    }
  }, [incident, isOpen]);

  if (!isOpen || !incident) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await onSave({ ...incident, ...formData } as Incidencia);
      onClose();
    } catch (error) {
      console.error('Error saving incident:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!incident) return;
    setIsDeleting(true);
    try {
      await onDelete(incident.id);
      onClose();
    } catch (error) {
      console.error('Error deleting incident:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div 
        className="fixed inset-0 bg-white/20 dark:bg-stone-950/40 backdrop-blur-sm animate-in fade-in duration-300"
        onClick={onClose}
      />
      
      <div className="relative bg-white dark:bg-stone-900 w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 slide-in-from-bottom-4 duration-300">
        <header className="px-6 py-5 border-b border-stone-100 dark:border-stone-800/50 flex items-center justify-between bg-white/50 dark:bg-stone-900/50 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 rounded-xl">
              <AlertTriangle size={20} />
            </div>
            <div>
              <h2 className="text-lg font-normal text-slate-800 dark:text-stone-200 tracking-tight font-display">
                Editar Incidencia
              </h2>
              <p className="text-[10px] text-slate-400 dark:text-stone-500 font-light tracking-wider">
                {incident.accommodationName}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {!isReadOnly && (
              <>
                {!showDeleteConfirm ? (
                  <button 
                    type="button"
                    onClick={() => setShowDeleteConfirm(true)}
                    className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors text-red-400 hover:text-red-600"
                    title="Eliminar incidencia"
                  >
                    <Trash2 size={18} />
                  </button>
                ) : (
                  <div className="flex items-center animate-in slide-in-from-right-2 duration-200">
                    <button 
                      type="button"
                      onClick={handleDelete}
                      disabled={isDeleting}
                      className="px-3 py-1.5 bg-red-600 text-white text-[10px] font-bold rounded-lg hover:bg-red-700 transition-all active:scale-95 disabled:opacity-50"
                    >
                      {isDeleting ? 'Borrando...' : 'Confirmar Borrar'}
                    </button>
                    <button 
                      type="button"
                      onClick={() => setShowDeleteConfirm(false)}
                      className="p-2 text-slate-400 hover:text-slate-600 text-[10px]"
                    >
                      Cerrar
                    </button>
                  </div>
                )}
              </>
            )}
            <button onClick={onClose} className="p-2 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-xl transition-colors text-slate-400">
              <X size={20} />
            </button>
          </div>
        </header>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="space-y-4">
            <div>
              <label className="block text-[11px] font-normal text-slate-400 dark:text-stone-500 tracking-widest mb-2 px-1">
                Estado de Revisión
              </label>
              <div className="flex gap-3">
                <button
                  type="button"
                  disabled={isReadOnly}
                  onClick={() => setFormData({ ...formData, checked: false })}
                  className={`flex-1 py-3 px-4 rounded-2xl border transition-all flex items-center justify-center gap-2 text-xs ${
                    !formData.checked
                      ? 'bg-slate-50 dark:bg-stone-800 border-slate-200 dark:border-stone-700 text-slate-600 dark:text-stone-300 shadow-sm'
                      : 'border-transparent text-slate-400 dark:text-stone-600 hover:bg-stone-50 dark:hover:bg-stone-800/50'
                  } ${isReadOnly ? 'cursor-default' : ''}`}
                >
                  <Info size={14} /> Pendiente
                </button>
                <button
                  type="button"
                  disabled={isReadOnly}
                  onClick={() => setFormData({ ...formData, checked: true })}
                  className={`flex-1 py-3 px-4 rounded-2xl border transition-all flex items-center justify-center gap-2 text-xs ${
                    formData.checked
                      ? 'bg-green-50 dark:bg-green-900/20 border-green-100 dark:border-green-900/40 text-green-600 dark:text-green-400 shadow-sm'
                      : 'border-transparent text-slate-400 dark:text-stone-600 hover:bg-stone-50 dark:hover:bg-stone-800/50'
                  } ${isReadOnly ? 'cursor-default' : ''}`}
                >
                  <CheckCircle2 size={14} /> Revisada
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-normal text-slate-400 dark:text-stone-500 tracking-widest mb-2 px-1">
                  Coste Estimado (€)
                </label>
                <input
                  type="number"
                  step="0.01"
                  readOnly={isReadOnly}
                  value={formData.coste || ''}
                  onChange={e => setFormData({ ...formData, coste: parseFloat(e.target.value) })}
                  className={`w-full px-4 py-3 bg-stone-50 dark:bg-stone-800/50 border border-slate-100 dark:border-stone-700/50 rounded-2xl text-slate-700 dark:text-stone-200 text-sm focus:outline-none transition-all font-light ${isReadOnly ? 'cursor-default focus:ring-0 focus:border-slate-100 dark:focus:border-stone-700/50' : 'focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500/40'}`}
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-[11px] font-normal text-slate-400 dark:text-stone-500 tracking-widest mb-2 px-1">
                  Kilómetros (KMS)
                </label>
                <div className="relative">
                  <MapPin size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
                  <input
                    type="number"
                    step="0.1"
                    readOnly={isReadOnly}
                    value={formData.kms || 0}
                    onChange={e => setFormData({ ...formData, kms: parseFloat(e.target.value) })}
                    className={`w-full pl-10 pr-4 py-3 bg-stone-50 dark:bg-stone-800/50 border border-slate-100 dark:border-stone-700/50 rounded-2xl text-slate-700 dark:text-stone-200 text-sm focus:outline-none transition-all font-light ${isReadOnly ? 'cursor-default focus:ring-0 focus:border-slate-100 dark:focus:border-stone-700/50' : 'focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500/40'}`}
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-normal text-slate-400 dark:text-stone-500 tracking-widest mb-2 px-1">
                Descripción / Detalles
              </label>
              <textarea
                value={formData.description || ''}
                readOnly={isReadOnly}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
                rows={4}
                className={`w-full px-4 py-4 bg-stone-50 dark:bg-stone-800/50 border border-slate-100 dark:border-stone-700/50 rounded-2xl text-slate-700 dark:text-stone-200 text-sm focus:outline-none transition-all font-light resize-none ${isReadOnly ? 'cursor-default focus:ring-0 focus:border-slate-100 dark:focus:border-stone-700/50' : 'focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500/40'}`}
              />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className={`py-3 px-6 bg-stone-100 dark:bg-stone-800 text-slate-500 dark:text-stone-400 font-bold rounded-2xl hover:bg-stone-200 dark:hover:bg-stone-700 transition-all active:scale-95 text-xs ${isReadOnly ? 'w-full' : 'flex-1'}`}
            >
              {isReadOnly ? 'Cerrar' : 'Cancelar'}
            </button>
            {!isReadOnly && (
              <button
                type="submit"
                disabled={isSaving}
                className="flex-[2] py-3 px-6 bg-orange-600 text-white font-bold rounded-2xl hover:bg-orange-700 transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50 text-xs shadow-lg shadow-orange-500/20"
              >
                {isSaving ? (
                  <><Loader2 className="animate-spin" size={16} /> Guardando...</>
                ) : (
                  <><Save size={16} /> Guardar Cambios</>
                )}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

export default IncidentEditModal;
