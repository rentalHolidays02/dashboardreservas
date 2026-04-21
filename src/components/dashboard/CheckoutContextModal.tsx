import React, { useState, useEffect } from 'react';
import { X, CheckCircle2, Trash2, ArrowLeft, Clock, MapPin } from 'lucide-react';
import { CheckoutTabType } from '../cleans/CleanCheckoutFormModal';
import { NormalCleanRecord, InitialCleanRecord, HandymanRecord } from '../../services/mockData';
import { formatName } from '../../utils/formatters';

type CheckoutRecord = NormalCleanRecord | InitialCleanRecord | HandymanRecord;

interface Props {
  isOpen: boolean;
  type: CheckoutTabType;
  record: CheckoutRecord | null;
  onClose: () => void;
  onFinish: (type: CheckoutTabType, record: CheckoutRecord) => void;
  onDelete: (type: CheckoutTabType, record: CheckoutRecord) => Promise<void>;
  isProcessing: boolean;
}

export const CheckoutContextModal: React.FC<Props> = ({ 
  isOpen, type, record, onClose, onFinish, onDelete, isProcessing 
}) => {
  const [view, setView] = useState<'options' | 'confirm_delete'>('options');

  useEffect(() => {
    if (isOpen) setView('options');
  }, [isOpen]);

  if (!isOpen || !record) return null;

  const workerName = formatName((record as any).nombre + ' ' + (record as any).apellidos);
  const location = type === 'handyman' ? (record as HandymanRecord).alojamiento : (record as NormalCleanRecord).apartamento;
  const startTime = type === 'handyman' ? (record as HandymanRecord).fechaLlegada : (record as NormalCleanRecord).checkinFecha;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-[320px] rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-950 shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header - Sutil y minimalista */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100 dark:border-stone-900">
          <h3 className="text-[13px] font-semibold text-slate-800 dark:text-stone-200 tracking-tight">
            {view === 'options' ? 'Gestionar actividad' : 'Confirmar borrado'}
          </h3>
          <button 
            type="button" 
            onClick={onClose} 
            className="p-1 text-slate-400 hover:text-slate-600 dark:text-stone-500 dark:hover:text-stone-300 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Info - Contexto esencial */}
        <div className="px-5 py-4 bg-slate-50/30 dark:bg-stone-900/20 text-center">
          <p className="text-sm font-medium text-slate-900 dark:text-stone-100 truncate">{workerName}</p>
          <div className="flex items-center justify-center gap-3 mt-1.5 opacity-60">
            <span className="flex items-center gap-1 text-[10px] text-slate-500 dark:text-stone-400">
              <MapPin size={10} />
              {location}
            </span>
            <span className="flex items-center gap-1 text-[10px] text-slate-500 dark:text-stone-400">
              <Clock size={10} />
              {new Date(startTime).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        </div>

        {/* Actions - Vertical as requested */}
        <div className="p-5 flex flex-col gap-2.5">
          {view === 'options' ? (
            <>
              <button
                onClick={() => onFinish(type, record)}
                className="w-full py-3.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold shadow-lg shadow-orange-500/10 transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                <CheckCircle2 size={14} />
                Finalizar Checkout
              </button>

              <button
                onClick={() => setView('confirm_delete')}
                className="w-full py-3.5 rounded-xl bg-slate-100 dark:bg-stone-800 hover:bg-slate-200 dark:hover:bg-stone-700 text-slate-600 dark:text-stone-400 text-xs font-medium transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                <Trash2 size={14} />
                Borrar Actividad
              </button>
            </>
          ) : (
            <div className="flex flex-col gap-3 animate-in slide-in-from-bottom-2 duration-300">
              <p className="text-[11px] text-slate-500 dark:text-stone-400 text-center leading-relaxed px-2">
                Esta acción eliminará el registro permanentemente. ¿Estás seguro?
              </p>
              <div className="flex flex-col gap-2 mt-2">
                <button
                  onClick={() => onDelete(type, record)}
                  disabled={isProcessing}
                  className="w-full py-3.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-xs font-semibold transition-all active:scale-95"
                >
                  {isProcessing ? 'Borrando...' : 'Sí, borrar registro'}
                </button>
                <button
                  onClick={() => setView('options')}
                  disabled={isProcessing}
                  className="w-full py-2.5 text-[11px] font-medium text-slate-400 dark:text-stone-500 hover:text-slate-600 dark:hover:text-stone-300 transition-colors"
                >
                  Cancelar y volver
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
