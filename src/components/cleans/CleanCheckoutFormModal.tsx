import React, { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { InitialCleanRecord, HandymanRecord, NormalCleanRecord } from '../../services/mockData';

export type CheckoutTabType = 'normal' | 'initial' | 'handyman';
type CheckoutRecord = NormalCleanRecord | InitialCleanRecord | HandymanRecord;

interface Props {
  isOpen: boolean;
  mode: 'create' | 'edit';
  type: CheckoutTabType;
  initialValues: CheckoutRecord;
  loading?: boolean;
  onClose: () => void;
  onSubmit: (record: CheckoutRecord) => Promise<void> | void;
}

const baseInputClass = 'w-full px-3 py-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-sm';

const CleanCheckoutFormModal: React.FC<Props> = ({ isOpen, mode, type, initialValues, loading = false, onClose, onSubmit }) => {
  const [form, setForm] = useState<CheckoutRecord>(initialValues);
  const [error, setError] = useState('');

  useEffect(() => {
    setForm(initialValues);
    setError('');
  }, [initialValues, isOpen]);

  const isHandyman = type === 'handyman';
  const title = `${mode === 'create' ? 'Nuevo' : 'Editar'} checkout`;

  const apartmentLabel = isHandyman ? 'Alojamiento' : 'Apartamento';
  const apartmentValue = isHandyman ? (form as HandymanRecord).alojamiento : (form as NormalCleanRecord | InitialCleanRecord).apartamento;

  const checkRequired = () => {
    const nombre = String((form as any).nombre || '').trim();
    const apellidos = String((form as any).apellidos || '').trim();
    const apt = String(apartmentValue || '').trim();
    if (!nombre || !apellidos || !apt) {
      setError('Nombre, apellidos y apartamento/alojamiento son obligatorios.');
      return false;
    }
    return true;
  };

  const updateField = (field: string, value: any) => {
    setForm(prev => ({ ...prev, [field]: value } as CheckoutRecord));
  };

  const boolOptions = useMemo(() => [{ id: 'yes', label: 'Si', value: true }, { id: 'no', label: 'No', value: false }], []);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/40">
      <div className="w-full max-w-3xl rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-950 shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-200 dark:border-stone-800">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-stone-200">{title}</h3>
          <button type="button" onClick={onClose} className="p-1 rounded hover:bg-stone-100 dark:hover:bg-stone-800">
            <X size={16} />
          </button>
        </div>
        <form
          className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!checkRequired()) return;
            setError('');
            await onSubmit(form);
          }}
        >
          <label className="space-y-1">
            <span className="text-xs text-slate-500">Telefono</span>
            <input className={baseInputClass} value={(form as any).telefono || ''} onChange={(e) => updateField('telefono', e.target.value)} />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-slate-500">Nombre</span>
            <input className={baseInputClass} value={(form as any).nombre || ''} onChange={(e) => updateField('nombre', e.target.value)} />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-slate-500">Apellidos</span>
            <input className={baseInputClass} value={(form as any).apellidos || ''} onChange={(e) => updateField('apellidos', e.target.value)} />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-slate-500">{apartmentLabel}</span>
            <input className={baseInputClass} value={apartmentValue || ''} onChange={(e) => updateField(isHandyman ? 'alojamiento' : 'apartamento', e.target.value)} />
          </label>

          <label className="space-y-1">
            <span className="text-xs text-slate-500">Checkin fecha</span>
            <input className={baseInputClass} value={isHandyman ? (form as HandymanRecord).fechaLlegada || '' : (form as any).checkinFecha || ''} onChange={(e) => updateField(isHandyman ? 'fechaLlegada' : 'checkinFecha', e.target.value)} />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-slate-500">Checkout fecha</span>
            <input className={baseInputClass} value={isHandyman ? (form as HandymanRecord).fechaFin || '' : (form as any).checkoutFecha || ''} onChange={(e) => updateField(isHandyman ? 'fechaFin' : 'checkoutFecha', e.target.value)} />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-slate-500">Checkin ubicacion</span>
            <input className={baseInputClass} value={isHandyman ? (form as HandymanRecord).ubicacionInicio || '' : (form as any).checkinUbicacion || ''} onChange={(e) => updateField(isHandyman ? 'ubicacionInicio' : 'checkinUbicacion', e.target.value)} />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-slate-500">Checkout ubicacion</span>
            <input className={baseInputClass} value={isHandyman ? (form as HandymanRecord).ubicacionFin || '' : (form as any).checkoutUbicacion || ''} onChange={(e) => updateField(isHandyman ? 'ubicacionFin' : 'checkoutUbicacion', e.target.value)} />
          </label>

          {type !== 'handyman' && (
            <>
              <label className="space-y-1">
                <span className="text-xs text-slate-500">Hora entrada</span>
                <input className={baseInputClass} value={(form as any).horaEntrada || ''} onChange={(e) => updateField('horaEntrada', e.target.value)} />
              </label>
              <label className="space-y-1">
                <span className="text-xs text-slate-500">Hora salida</span>
                <input className={baseInputClass} value={(form as any).horaSalida || ''} onChange={(e) => updateField('horaSalida', e.target.value)} />
              </label>
              <label className="space-y-1">
                <span className="text-xs text-slate-500">Km</span>
                <input type="number" className={baseInputClass} value={(form as any).km ?? 0} onChange={(e) => updateField('km', Number(e.target.value || 0))} />
              </label>
            </>
          )}

          {type === 'normal' && (
            <>
              <label className="space-y-1">
                <span className="text-xs text-slate-500">Sigue huesped</span>
                <select className={baseInputClass} value={(form as NormalCleanRecord).sigueHuesped ? '1' : '0'} onChange={(e) => updateField('sigueHuesped', e.target.value === '1')}>
                  {boolOptions.map((o) => <option key={o.id} value={o.value ? '1' : '0'}>{o.label}</option>)}
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-xs text-slate-500">Recoge llaves</span>
                <select className={baseInputClass} value={(form as NormalCleanRecord).recogeLlaves ? '1' : '0'} onChange={(e) => updateField('recogeLlaves', e.target.value === '1')}>
                  {boolOptions.map((o) => <option key={o.id} value={o.value ? '1' : '0'}>{o.label}</option>)}
                </select>
              </label>
              <label className="space-y-1 md:col-span-2">
                <span className="text-xs text-slate-500">Fecha salida reserva</span>
                <input className={baseInputClass} value={(form as NormalCleanRecord).fechaSalidaReserva || ''} onChange={(e) => updateField('fechaSalidaReserva', e.target.value)} />
              </label>
            </>
          )}

          {type === 'handyman' && (
            <>
              <label className="space-y-1">
                <span className="text-xs text-slate-500">Hora inicio tarea</span>
                <input className={baseInputClass} value={(form as HandymanRecord).horaInicioTarea || ''} onChange={(e) => updateField('horaInicioTarea', e.target.value)} />
              </label>
              <label className="space-y-1">
                <span className="text-xs text-slate-500">Hora fin tarea</span>
                <input className={baseInputClass} value={(form as HandymanRecord).horaFinTarea || ''} onChange={(e) => updateField('horaFinTarea', e.target.value)} />
              </label>
              <label className="space-y-1">
                <span className="text-xs text-slate-500">Cantidad minutos</span>
                <input type="number" className={baseInputClass} value={(form as HandymanRecord).cantidadMinutos ?? 0} onChange={(e) => updateField('cantidadMinutos', Number(e.target.value || 0))} />
              </label>
              <label className="space-y-1">
                <span className="text-xs text-slate-500">Estado</span>
                <select className={baseInputClass} value={(form as HandymanRecord).estadoCompletado || 'Pendiente'} onChange={(e) => updateField('estadoCompletado', e.target.value)}>
                  <option value="Pendiente">Pendiente</option>
                  <option value="Completado">Completado</option>
                </select>
              </label>
            </>
          )}

          <label className="space-y-1 md:col-span-2">
            <span className="text-xs text-slate-500">Observaciones</span>
            <textarea className={baseInputClass} rows={3} value={type === 'handyman' ? (form as HandymanRecord).observacionesTarea || '' : (form as any).observaciones || ''} onChange={(e) => updateField(type === 'handyman' ? 'observacionesTarea' : 'observaciones', e.target.value)} />
          </label>

          <label className="space-y-1">
            <span className="text-xs text-slate-500">Checked</span>
            <select
              className={baseInputClass}
              value={type === 'handyman' ? ((form as HandymanRecord).estadoCompletado === 'Completado' ? '1' : '0') : ((form as any).checked ? '1' : '0')}
              onChange={(e) => {
                const next = e.target.value === '1';
                if (type === 'handyman') updateField('estadoCompletado', next ? 'Completado' : 'Pendiente');
                else updateField('checked', next);
              }}
            >
              {boolOptions.map((o) => <option key={o.id} value={o.value ? '1' : '0'}>{o.label}</option>)}
            </select>
          </label>

          {error && <p className="md:col-span-2 text-xs text-red-500">{error}</p>}

          <div className="md:col-span-2 flex items-center justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm border border-stone-300 dark:border-stone-700">
              Cancelar
            </button>
            <button type="submit" disabled={loading} className="px-4 py-2 rounded-lg text-sm bg-orange-500 text-white disabled:opacity-60">
              {loading ? 'Guardando...' : mode === 'create' ? 'Crear' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CleanCheckoutFormModal;
