import React, { useState, useMemo, useEffect } from 'react';
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  X,
  Check,
  Key,
  KeyRound,
  BedDouble,
  ChevronDown,
  Navigation,
  MapPin,
  Loader2,
} from 'lucide-react';
import { appsScriptApi } from '../services/api';
import { EntregaLlaves, Accommodation, Worker } from '../services/mockData';
import { cleanPhone } from '../utils/payments';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import SignaturePad from '../components/ui/SignaturePad';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtDate = (s: string) => {
  if (!s) return '—';

  // Si viene en formato datetime-local: YYYY-MM-DDThh:mm
  if (s.includes('T')) {
    const [datePart, timePart] = s.split('T');
    const [y, m, d] = datePart.split('-');
    if (!y || !m || !d || y === 'undefined') return '—';
    return `${d}/${m}/${y}, ${timePart}`;
  }

  // Soporta formato YYYY-MM-DD o DD/MM/YYYY con hora separado por coma
  if (s.includes('/')) return s.split(',')[0].trim() || '—';
  const [y, m, d] = s.split('-');
  if (!y || !m || !d || y === 'undefined') return '—';
  return `${d}/${m}/${y}`;
};

const fmtPhone = (t: string) => {
  if (!t) return '';
  const digits = t.replace(/\D/g, '');
  let res = '';
  if (digits.length > 0) res += digits.slice(0, 3);
  if (digits.length > 3) res += ' ' + digits.slice(3, 5);
  if (digits.length > 5) res += ' ' + digits.slice(5, 7);
  if (digits.length > 7) res += ' ' + digits.slice(7, 9);
  return res;
};

// Cuantía a pagar al trabajador por una entrega de llaves:
//   km × precioPorKm del worker (match por teléfono limpio) + 5 € fijo si entregó sábanas y toallas.
// Devuelve null si no hay match de trabajador.
const computeEntregaPay = (
  entrega: Pick<EntregaLlaves, 'telefono' | 'km' | 'sabanasToallas'>,
  workers: Worker[],
): { total: number | null; kmPay: number; sabanasExtra: number; precio: number } => {
  const tel = cleanPhone(entrega.telefono);
  const worker = tel ? workers.find(w => cleanPhone(w.telefono) === tel) : undefined;
  if (!worker) return { total: null, kmPay: 0, sabanasExtra: 0, precio: 0 };
  const precio = worker.precioPorKm ?? 0;
  const km = Number(entrega.km) || 0;
  const kmPay = km * precio;
  const sabanasExtra = String(entrega.sabanasToallas || '').toLowerCase().includes('entregad') ? 5 : 0;
  return {
    total: Math.round((kmPay + sabanasExtra) * 100) / 100,
    kmPay: Math.round(kmPay * 100) / 100,
    sabanasExtra,
    precio,
  };
};

const fmtEuro = (n: number) => `${n.toFixed(2).replace('.', ',')} €`;

const emptyEntrega = (): Omit<EntregaLlaves, 'id'> => ({
  telefono: '',
  nombre: '',
  apellidos: '',
  fechaUbicacionEntrega: '',
  apartamento: '',
  nombreCliente: '',
  fechaEntradaReserva: '',
  fechaSalidaReserva: '',
  entregaLlaves: false,
  sabanasToallas: 'No',
  km: 0,
  observaciones: '',
  fianzaMonto: 'Efectivo',
  bizumMonto: '',
  cantidadPagadaMonto: '0',
  fianzaGarantia: 'Efectivo',
  bizumGarantia: '',
  cantidadPagadaGarantia: '0',
  checked: false,
});

// ─── BoolBadge ────────────────────────────────────────────────────────────────

const BoolBadge: React.FC<{ value: boolean }> = ({ value }) =>
  value ? (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400">
      <Check size={10} strokeWidth={2.5} /> Sí
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 dark:bg-stone-700/60 text-slate-400 dark:text-stone-500">
      <X size={10} strokeWidth={2.5} /> No
    </span>
  );

// ─── Modal ────────────────────────────────────────────────────────────────────

interface ModalProps {
  initial: Partial<EntregaLlaves> | null;
  onSave: (data: Omit<EntregaLlaves, 'id'>) => Promise<void>;
  onClose: () => void;
  onDelete?: () => void;
  accommodations: Accommodation[];
  workers: Worker[];
  isReadOnly?: boolean;
}

const EntregaModal: React.FC<ModalProps> = ({ initial, onSave, onClose, onDelete, accommodations, workers, isReadOnly }) => {
  const isEdit = !!initial?.id;
  const [form, setForm] = useState<Omit<EntregaLlaves, 'id'>>(() => {
    const base = { ...emptyEntrega(), ...initial };
    if (initial?.apartamento) {
      // Buscamos coincidencia exacta ignorando mayúsculas y espacios
      const match = accommodations.find(
        a => a.name.toLowerCase().trim() === initial.apartamento!.toLowerCase().trim()
      );
      if (match) base.apartamento = match.name;
    }
    return base;
  });
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [gettingLocation, setGettingLocation] = useState(false);

  const set = (field: keyof Omit<EntregaLlaves, 'id'>, value: any) =>
    setForm(f => ({ ...f, [field]: value }));

  const kmEquivalente = useMemo(() => {
    const { total, kmPay, sabanasExtra, precio } = computeEntregaPay(form, workers);
    if (total === null) return { value: null as number | null, desglose: '' };
    const km = Number(form.km) || 0;
    const parts = [`${km} km × ${fmtEuro(precio)} = ${fmtEuro(kmPay)}`];
    if (sabanasExtra) parts.push('+ 5 € sábanas');
    return { value: total, desglose: parts.join(' ') };
  }, [form.telefono, form.km, form.sabanasToallas, workers]);

  const inputCls = 'w-full rounded-lg border border-white/60 dark:border-stone-700/50 bg-white/80 dark:bg-stone-900 text-slate-700 dark:text-stone-300 px-3 py-1.5 text-xs focus:outline-none focus:border-stone-300 dark:focus:border-stone-600 placeholder:text-slate-300 dark:placeholder:text-stone-600 transition-all';
  const labelCls = 'block text-[11px] text-slate-400 dark:text-stone-500 mb-1';
  const sectionTitleCls = 'text-[10px] font-semibold text-slate-400 dark:text-stone-500 uppercase tracking-widest mb-2.5';

  const BoolToggle = ({ label, field, customTrue = 'Sí', customFalse = 'No' }: { label: string; field: keyof Omit<EntregaLlaves, 'id'>, customTrue?: string, customFalse?: string }) => {
    const isTrue = typeof form[field] === 'string' ? form[field] === customTrue : !!form[field];
    return (
      <div>
        <label className={labelCls}>{label}</label>
        <button
          type="button"
          disabled={isReadOnly}
          onClick={() => set(field, typeof form[field] === 'string' ? (isTrue ? customFalse : customTrue) : !isTrue)}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs transition-all w-full
            ${isTrue
              ? 'border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
              : 'border-white/60 dark:border-stone-700/50 bg-white/80 dark:bg-stone-900 text-slate-400 dark:text-stone-500'
            } ${isReadOnly ? 'cursor-default' : ''}`}
        >
          <span className={`w-3.5 h-3.5 rounded border-2 flex items-center justify-center shrink-0 transition-all
            ${isTrue ? 'bg-green-500 border-green-500' : 'border-slate-300 dark:border-stone-500'}`}>
            {isTrue && <Check size={9} className="text-white" strokeWidth={3} />}
          </span>
          {isTrue ? customTrue : customFalse}
        </button>
      </div>
    );
  };

  const handleGetLocation = () => {
    setGettingLocation(true);
    if (!navigator.geolocation) {
      alert('Tu navegador no soporta geolocalización');
      setGettingLocation(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const dateStr = new Date().toLocaleString();
        const locStr = `${dateStr} | ${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`;
        set('fechaUbicacionEntrega', locStr);
        setGettingLocation(false);
      },
      (err) => {
        console.error(err);
        alert('No se pudo obtener la ubicación');
        setGettingLocation(false);
      }
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
      <div className="bg-white/90 dark:bg-stone-900 backdrop-blur-md border border-white/60 dark:border-stone-700/50 rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100 dark:border-stone-800 sticky top-0 bg-white/90 dark:bg-stone-900 backdrop-blur-md z-10 rounded-t-2xl">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
              <Key size={14} className="text-orange-600 dark:text-orange-400" />
            </div>
            <h2 className="text-sm font-normal text-slate-800 dark:text-stone-200">
              {isEdit ? 'Editar entrega' : 'Nueva entrega de llaves'}
            </h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-stone-200 transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={async e => { 
          e.preventDefault(); 
          setIsSaving(true);
          try {
            await onSave(form); 
          } finally {
            setIsSaving(false);
          }
        }} className="px-6 py-5 space-y-5">

          {/* Contacto */}
          <div>
            <p className={sectionTitleCls}>Contacto</p>
            <div className="grid grid-cols-3 gap-2.5">
              <div>
                <label className={labelCls}>Teléfono</label>
                <input 
                  type="text" 
                  value={fmtPhone(form.telefono)} 
                  readOnly={isReadOnly}
                  onChange={e => {
                    // Quitamos todo lo que no sea número y limitamos a 9 caracteres
                    const digits = e.target.value.replace(/\D/g, '');
                    if (digits.length <= 9) set('telefono', digits);
                  }}
                  placeholder="6XX XX XX XX" 
                  pattern="^([6789]\d{2})( \d{2}){3}$|^[6789]\d{8}$"
                  title="Introduce un teléfono español válido (9 dígitos)"
                  className={`${inputCls} ${form.telefono && !/^[6789]\d{8}$/.test(form.telefono.replace(/\D/g, '')) ? 'border-red-300 dark:border-red-700 bg-red-50/30' : ''} ${isReadOnly ? 'cursor-default focus:border-white/60 dark:focus:border-stone-700/50' : ''}`} 
                />
                {form.telefono && !/^[6789]\d{8}$/.test(form.telefono.replace(/\D/g, '')) && (
                  <p className="text-[10px] text-red-400 mt-0.5">Teléfono no válido (9 dígitos, empieza por 6,7,8,9)</p>
                )}
              </div>
              <div>
                <label className={labelCls}>Nombre</label>
                <input type="text" value={form.nombre} onChange={e => set('nombre', e.target.value)} readOnly={isReadOnly} placeholder="Nombre" className={`${inputCls} ${isReadOnly ? 'cursor-default focus:border-white/60 dark:focus:border-stone-700/50' : ''}`} />
              </div>
              <div>
                <label className={labelCls}>Apellidos</label>
                <input type="text" value={form.apellidos} onChange={e => set('apellidos', e.target.value)} readOnly={isReadOnly} placeholder="Apellidos" className={`${inputCls} ${isReadOnly ? 'cursor-default focus:border-white/60 dark:focus:border-stone-700/50' : ''}`} />
              </div>
            </div>
          </div>

          {/* Reserva */}
          <div>
            <p className={sectionTitleCls}>Reserva</p>
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className={labelCls}>Apartamento</label>
                <input 
                  list="apartamentos-list"
                  type="text"
                  value={form.apartamento} 
                  readOnly={isReadOnly}
                  onChange={e => set('apartamento', e.target.value)} 
                  placeholder="Escribe o selecciona..."
                  className={`${inputCls} ${isReadOnly ? 'cursor-default focus:border-white/60 dark:focus:border-stone-700/50' : ''}`}
                />
                <datalist id="apartamentos-list">
                  {accommodations.map(acc => (
                    <option key={acc.id} value={acc.name} />
                  ))}
                </datalist>
              </div>
              <div>
                <label className={labelCls}>Nombre cliente</label>
                <input type="text" value={form.nombreCliente} onChange={e => set('nombreCliente', e.target.value)} readOnly={isReadOnly} placeholder="Nombre en la reserva" className={`${inputCls} ${isReadOnly ? 'cursor-default focus:border-white/60 dark:focus:border-stone-700/50' : ''}`} />
              </div>
              <div>
                <label className={labelCls}>Fecha entrada reserva</label>
                <input type="datetime-local" value={form.fechaEntradaReserva} onChange={e => set('fechaEntradaReserva', e.target.value)} readOnly={isReadOnly} className={`${inputCls} ${isReadOnly ? 'cursor-default focus:border-white/60 dark:focus:border-stone-700/50' : ''}`} />
              </div>
              <div>
                <label className={labelCls}>Fecha salida reserva</label>
                <input type="datetime-local" value={form.fechaSalidaReserva} onChange={e => set('fechaSalidaReserva', e.target.value)} readOnly={isReadOnly} className={`${inputCls} ${isReadOnly ? 'cursor-default focus:border-white/60 dark:focus:border-stone-700/50' : ''}`} />
              </div>
            </div>
          </div>

          {/* Entrega */}
          <div>
            <p className={sectionTitleCls}>Entrega de llaves</p>
            <div className="grid grid-cols-2 gap-2.5">
              <div className="col-span-2">
                <label className={labelCls}>Fecha y ubicación (GPS)</label>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    value={form.fechaUbicacionEntrega} 
                    readOnly={isReadOnly}
                    onChange={e => set('fechaUbicacionEntrega', e.target.value)}
                    placeholder="Escribe manualmente o usa el botón GPS..." 
                    className={`${inputCls} flex-1 ${isReadOnly ? 'cursor-default focus:border-white/60 dark:focus:border-stone-700/50' : ''}`} 
                  />
                  {!isReadOnly && (
                    <button 
                      type="button" 
                      onClick={handleGetLocation} 
                      disabled={gettingLocation}
                      className="px-3 py-1.5 rounded-lg bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 hover:bg-orange-200 transition-colors shrink-0 disabled:opacity-50"
                    >
                      {gettingLocation ? <Loader2 className="animate-spin" size={14} /> : <MapPin size={14} />}
                    </button>
                  )}
                </div>
              </div>
              <BoolToggle label="Llaves entregadas" field="entregaLlaves" />
              <BoolToggle label="Sábanas y Toallas" field="sabanasToallas" customTrue="Sí, entregadas" customFalse="No" />
              <div>
                <label className={labelCls}>Km</label>
                <div className="flex items-center gap-2">
                  <input type="number" min="0" value={form.km} onChange={e => set('km', e.target.value)} readOnly={isReadOnly} placeholder="0" className={`${inputCls} flex-1 ${isReadOnly ? 'cursor-default focus:border-white/60 dark:focus:border-stone-700/50' : ''}`} />
                  <span
                    title={kmEquivalente.desglose || undefined}
                    className="shrink-0 text-xs font-medium text-orange-600 dark:text-orange-400 tabular-nums min-w-[58px] text-right"
                  >
                    {kmEquivalente.value === null ? '— €' : fmtEuro(kmEquivalente.value)}
                  </span>
                </div>
              </div>
              <div>
                <label className={labelCls}>Observaciones</label>
                <input type="text" value={form.observaciones} onChange={e => set('observaciones', e.target.value)} readOnly={isReadOnly} placeholder="Notas adicionales..." className={`${inputCls} ${isReadOnly ? 'cursor-default focus:border-white/60 dark:focus:border-stone-700/50' : ''}`} />
              </div>
            </div>
          </div>

          {/* Firmas */}
          <div>
            <p className={sectionTitleCls}>Firmas</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <SignaturePad
                label="Firma trabajador"
                value={form.firmaTrabajador}
                onChange={v => set('firmaTrabajador', v)}
                readOnly={isReadOnly}
              />
              <SignaturePad
                label="Firma huésped"
                value={form.firmaHuesped}
                onChange={v => set('firmaHuesped', v)}
                readOnly={isReadOnly}
              />
            </div>
          </div>

          {/* Fianzas */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className={sectionTitleCls}>Fianza — Monto</p>
              <div className="space-y-2">
                <div>
                  <label className={labelCls}>Medio de Pago</label>
                  <select value={form.fianzaMonto} onChange={e => set('fianzaMonto', e.target.value)} disabled={isReadOnly} className={`${inputCls} ${isReadOnly ? 'cursor-default' : ''}`}>
                    <option value="Efectivo">Efectivo</option>
                    <option value="Bizum">Bizum</option>
                    <option value="Tarjeta">Tarjeta</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Número Bizum</label>
                  <input type="text" value={form.bizumMonto} onChange={e => set('bizumMonto', e.target.value)} readOnly={isReadOnly} placeholder="6XX XXX XXX" className={`${inputCls} ${isReadOnly ? 'cursor-default focus:border-white/60 dark:focus:border-stone-700/50' : ''}`} />
                </div>
                <div>
                  <label className={labelCls}>Cantidad pagada (€)</label>
                  <input type="number" min="0" value={form.cantidadPagadaMonto} onChange={e => set('cantidadPagadaMonto', e.target.value)} readOnly={isReadOnly} placeholder="0.00" className={`${inputCls} ${isReadOnly ? 'cursor-default focus:border-white/60 dark:focus:border-stone-700/50' : ''}`} />
                </div>
              </div>
            </div>
            <div>
              <p className={sectionTitleCls}>Fianza — Garantía</p>
              <div className="space-y-2">
                <div>
                  <label className={labelCls}>Medio de Pago</label>
                  <select value={form.fianzaGarantia} onChange={e => set('fianzaGarantia', e.target.value)} disabled={isReadOnly} className={`${inputCls} ${isReadOnly ? 'cursor-default' : ''}`}>
                    <option value="Efectivo">Efectivo</option>
                    <option value="Bizum">Bizum</option>
                    <option value="Tarjeta">Tarjeta</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Número Bizum</label>
                  <input type="text" value={form.bizumGarantia} onChange={e => set('bizumGarantia', e.target.value)} readOnly={isReadOnly} placeholder="6XX XXX XXX" className={`${inputCls} ${isReadOnly ? 'cursor-default focus:border-white/60 dark:focus:border-stone-700/50' : ''}`} />
                </div>
                <div>
                  <label className={labelCls}>Cantidad pagada (€)</label>
                  <input type="number" min="0" value={form.cantidadPagadaGarantia} onChange={e => set('cantidadPagadaGarantia', e.target.value)} readOnly={isReadOnly} placeholder="0.00" className={`${inputCls} ${isReadOnly ? 'cursor-default focus:border-white/60 dark:focus:border-stone-700/50' : ''}`} />
                </div>
              </div>
            </div>
          </div>

          {/* Checked */}
          <div className="grid grid-cols-2">
            <BoolToggle label="Verificado (Checked)" field="checked" />
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between pt-3 border-t border-stone-100 dark:border-stone-800">
            {isEdit && onDelete && !isReadOnly ? (
              confirmDelete ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-red-500">¿Eliminar?</span>
                  <button type="button" onClick={onDelete}
                    className="px-3 py-1.5 text-xs rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors">
                    Confirmar
                  </button>
                  <button type="button" onClick={() => setConfirmDelete(false)}
                    className="px-3 py-1.5 text-xs rounded-lg bg-slate-100 dark:bg-stone-700 text-slate-600 dark:text-stone-300 hover:bg-slate-200 dark:hover:bg-stone-600 transition-colors">
                    Cancelar
                  </button>
                </div>
              ) : (
                <button type="button" onClick={() => setConfirmDelete(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                  <Trash2 size={12} /> Eliminar
                </button>
              )
            ) : <div />}

            <div className="flex items-center gap-2">
              <button type="button" onClick={onClose}
                className={`py-1.5 text-xs rounded-xl bg-slate-100 dark:bg-stone-700 text-slate-600 dark:text-stone-300 hover:bg-slate-200 dark:hover:bg-stone-600 transition-colors ${isReadOnly ? 'px-8' : 'px-4'}`}>
                {isReadOnly ? 'Cerrar' : 'Cancelar'}
              </button>
              {!isReadOnly && (
                <button type="submit"
                  className="px-4 py-1.5 text-xs rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-medium transition-colors">
                  {isEdit ? 'Guardar cambios' : 'Crear entrega'}
                  {isSaving && <Loader2 size={12} className="animate-spin ml-1 inline" />}
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

// ─── Expanded detail panel ────────────────────────────────────────────────────

const DetailPanel: React.FC<{ entrega: EntregaLlaves; workers: Worker[] }> = ({ entrega: e, workers }) => {
  const sectionLabel = 'text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-stone-500 mb-2.5';
  const fieldLabel = 'text-[11px] text-slate-400 dark:text-stone-500';
  const fieldValue = 'text-xs text-slate-700 dark:text-stone-300 mt-0.5';
  const euroAside = 'text-xs font-medium text-orange-600 dark:text-orange-400 tabular-nums';

  const { kmPay, sabanasExtra, precio, total } = computeEntregaPay(e, workers);

  return (
    <div className="px-8 py-5 bg-stone-50/80 dark:bg-stone-800/40 border-t border-stone-100 dark:border-stone-800">
      <div className="grid grid-cols-3 gap-x-8 gap-y-5">

        {/* Col 1: Entrega */}
        <div className="space-y-3">
          <p className={sectionLabel}>Entrega</p>
          <div>
            <p className={fieldLabel}>Fecha y Ubicación</p>
            <p className={fieldValue}>{e.fechaUbicacionEntrega || '—'}</p>
          </div>
          <div>
            <p className={fieldLabel}>Km recorridos</p>
            <div className="flex items-baseline gap-2">
              <p className={fieldValue}>{e.km ? `${e.km} km` : '—'}</p>
              {total !== null && e.km > 0 && (
                <span className={euroAside} title={`${e.km} km × ${fmtEuro(precio)}`}>
                  {fmtEuro(kmPay)}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div>
              <p className={fieldLabel}>Llaves</p>
              <div className="mt-0.5"><BoolBadge value={e.entregaLlaves} /></div>
            </div>
            <div>
              <p className={fieldLabel}>Sábanas y Toallas</p>
              <div className="flex items-baseline gap-2">
                <p className={fieldValue}>{e.sabanasToallas}</p>
                {sabanasExtra > 0 && <span className={euroAside}>+ {fmtEuro(sabanasExtra)}</span>}
              </div>
            </div>
          </div>
          {e.observaciones && (
            <div>
              <p className={fieldLabel}>Observaciones</p>
              <p className={`${fieldValue} italic`}>{e.observaciones}</p>
            </div>
          )}
        </div>

        {/* Col 2: Fianza Monto */}
        <div className="space-y-3">
          <p className={sectionLabel}>Fianza — Monto</p>
          <div>
            <p className={fieldLabel}>Importe fianza</p>
            <p className={fieldValue}>{e.fianzaMonto ? `${e.fianzaMonto} €` : '—'}</p>
          </div>
          <div>
            <p className={fieldLabel}>Número Bizum</p>
            <p className={fieldValue}>{e.bizumMonto || '—'}</p>
          </div>
          <div>
            <p className={fieldLabel}>Cantidad pagada</p>
            <p className={`${fieldValue} font-medium ${e.cantidadPagadaMonto && e.cantidadPagadaMonto !== '0' ? 'text-green-600 dark:text-green-400' : ''}`}>
              {e.cantidadPagadaMonto ? `${e.cantidadPagadaMonto} € (${e.fianzaMonto})` : '—'}
            </p>
          </div>
        </div>

        {/* Col 3: Fianza Garantía */}
        <div className="space-y-3">
          <p className={sectionLabel}>Fianza — Garantía</p>
          <div>
            <p className={fieldLabel}>Importe fianza</p>
            <p className={fieldValue}>{e.fianzaGarantia ? `${e.fianzaGarantia} €` : '—'}</p>
          </div>
          <div>
            <p className={fieldLabel}>Número Bizum</p>
            <p className={fieldValue}>{e.bizumGarantia || '—'}</p>
          </div>
          <div>
            <p className={fieldLabel}>Cantidad pagada</p>
            <p className={`${fieldValue} font-medium ${e.cantidadPagadaGarantia && e.cantidadPagadaGarantia !== '0' ? 'text-green-600 dark:text-green-400' : ''}`}>
              {e.cantidadPagadaGarantia ? `${e.cantidadPagadaGarantia} € (${e.fianzaGarantia})` : '—'}
            </p>
          </div>
        </div>

        {/* Firmas */}
        <div className="col-span-3 pt-2 border-t border-stone-200/60 dark:border-stone-700/40">
          <p className={`${sectionLabel} mb-3`}>Firmas</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
            <SignaturePad
              label="Firma trabajador"
              value={e.firmaTrabajador}
              onChange={() => {}}
              readOnly
            />
            <SignaturePad
              label="Firma huésped"
              value={e.firmaHuesped}
              onChange={() => {}}
              readOnly
            />
          </div>
        </div>

      </div>
    </div>
  );
};

// ─── COL layout ───────────────────────────────────────────────────────────────

const COLS = 'grid-cols-[2.2fr_0.8fr_1.4fr_1fr_1fr_100px]';

// ─── Main page ────────────────────────────────────────────────────────────────

interface EntregaDeLlavesProps {
  userRole?: 'admin' | 'editor' | 'viewer' | 'trabajador';
}

const EntregaDeLlaves: React.FC<EntregaDeLlavesProps> = ({ userRole }) => {
  const isReadOnly = userRole === 'viewer';
  const [entregas, setEntregas] = useState<EntregaLlaves[]>([]);
  const [accommodations, setAccommodations] = useState<Accommodation[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [modalData, setModalData] = useState<Partial<EntregaLlaves> | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchData = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      await appsScriptApi.migrateEntregaLlavesFromSheets();
      const [entries, accs, ws] = await Promise.all([
        appsScriptApi.getEntregaLlaves(),
        appsScriptApi.getAccommodations(),
        appsScriptApi.getWorkers(),
      ]);
      setEntregas(entries);
      setAccommodations(accs);
      setWorkers(ws);
    } catch (error) {
      console.error('Error fetching delivery data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filtered = useMemo(() => {
    const q = searchTerm.toLowerCase();
    const base = q
      ? entregas.filter(e =>
          e.nombre.toLowerCase().includes(q) ||
          e.apellidos.toLowerCase().includes(q) ||
          e.telefono.includes(q) ||
          e.apartamento.toLowerCase().includes(q)
        )
      : entregas;
    // Orden por fecha de entrega descendente (las más recientes primero).
    // El campo mezcla formatos: ISO "YYYY-MM-DDTHH:MM" (input manual),
    // locale "D/M/YYYY, HH:MM:SS | coords" (captura auto). Parseo a timestamp.
    const ts = (raw: string): number => {
      if (!raw) return -Infinity;
      const datePart = raw.split('|')[0].trim();
      if (/^\d{4}-\d{2}-\d{2}/.test(datePart)) {
        const t = Date.parse(datePart);
        return isNaN(t) ? -Infinity : t;
      }
      const m = datePart.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[,\s]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
      if (m) {
        const [, d, mo, y, h, mi, s] = m;
        return new Date(+y, +mo - 1, +d, +(h ?? 0), +(mi ?? 0), +(s ?? 0)).getTime();
      }
      return -Infinity;
    };
    return [...base].sort((a, b) => ts(b.fechaUbicacionEntrega || '') - ts(a.fechaUbicacionEntrega || ''));
  }, [entregas, searchTerm]);

  const handleRowClick = (id: string) =>
    setSelectedId(prev => (prev === id ? null : id));

  const openNew = () => { setModalData(null); setIsModalOpen(true); };
  const openEdit = (e: EntregaLlaves, ev: React.MouseEvent) => {
    ev.stopPropagation();
    setModalData(e);
    setIsModalOpen(true);
  };

  const handleSave = async (data: Omit<EntregaLlaves, 'id'>) => {
    try {
      const rowKey = modalData?.id?.replace(/^real_key_/, 'fila-') ?? `nueva-${data.telefono || 'entrega'}-${Date.now()}`;
      const prepared = await appsScriptApi.prepareEntregaLlavesForSave(data, { rowKey });

      if (modalData?.id) {
        // Optimistic update
        setEntregas(prev => prev.map(e => e.id === modalData.id ? { ...prepared, id: modalData.id } : e));
        await appsScriptApi.updateEntregaLlaves({ ...prepared, id: modalData.id });
      } else {
        // En adición no podemos hacer update optimista tan fácil sin ID real
        await appsScriptApi.addEntregaLlaves(prepared);
      }
      fetchData(false);
      setIsModalOpen(false);
    } catch (error) {
      console.error('Error saving delivery:', error);
      alert('Error al guardar la entrega');
    }
  };

  const handleDelete = async () => {
    if (modalData?.id) {
      const original = [...entregas];
      try {
        setEntregas(prev => prev.filter(e => e.id !== modalData.id));
        await appsScriptApi.deleteEntregaLlaves(modalData.id);
        if (selectedId === modalData.id) setSelectedId(null);
        setIsModalOpen(false);
      } catch (error) {
        setEntregas(original);
        alert('Error al eliminar');
      }
    }
  };

  if (loading && entregas.length === 0) {
    return <LoadingSpinner message="Cargando entregas de llaves..." />;
  }

  return (
    <div className="flex flex-col animate-in fade-in slide-in-from-bottom-2 duration-700 space-y-4">

      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 px-1 mb-2">
        <h1 className="text-xl font-normal text-slate-800 dark:text-stone-200 tracking-tight font-display shrink-0">
          Entrega de Llaves
        </h1>

        <div className="flex flex-col md:flex-row gap-3 justify-end items-center flex-1">
          <div className="relative w-full md:w-72">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-stone-500 pointer-events-none" size={14} />
            <input
              type="text"
              placeholder="Buscar nombre, teléfono, apartamento..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-white/40 dark:bg-stone-900/40 backdrop-blur-md border border-white/60 dark:border-stone-700/50 rounded-xl text-slate-700 dark:text-stone-300 text-xs font-normal placeholder:text-slate-400 dark:placeholder:text-stone-500 focus:outline-none transition-all hover:bg-white/80 dark:hover:bg-stone-800/60 focus:bg-white dark:focus:bg-stone-900"
            />
          </div>

          {!isReadOnly && (
            <button
              onClick={openNew}
              className="flex items-center justify-center gap-2 px-6 py-2.5 bg-white dark:bg-stone-900 backdrop-blur-md border border-white/60 dark:border-stone-700/50 rounded-xl text-xs font-normal text-orange-500/80 dark:text-orange-500/70 hover:text-orange-500 dark:hover:text-orange-400 hover:bg-white/80 dark:hover:bg-stone-800/60 transition-all active:scale-[0.98]"
            >
              <Plus size={12} className="text-orange-500" />
              <span>Nueva entrega</span>
            </button>
          )}
        </div>
      </header>

      {/* Table */}
      <div className="bg-white/80 dark:bg-stone-900 backdrop-blur-md border border-white/60 dark:border-stone-700/50 rounded-2xl overflow-hidden flex flex-col">

        {/* Column headers */}
        <div className={`grid ${COLS} gap-4 px-8 py-4 border-b border-stone-100 dark:border-stone-800`}>
          <span className="text-xs text-slate-400 dark:text-stone-500">Nombre</span>
          <span className="text-xs text-slate-400 dark:text-stone-500">Total a pagar</span>
          <span className="text-xs text-slate-400 dark:text-stone-500">Apartamento</span>
          <span className="text-xs text-slate-400 dark:text-stone-500">Entrada</span>
          <span className="text-xs text-slate-400 dark:text-stone-500">Salida</span>
          <span />
        </div>

        {/* Rows */}
        <ul className="divide-y divide-stone-100 dark:divide-stone-800">
          {filtered.length === 0 ? (
            <li className="flex items-center justify-center px-8 py-10">
              <span className="text-xs text-slate-400 dark:text-stone-500">Sin resultados</span>
            </li>
          ) : filtered.map(e => {
            const isSelected = selectedId === e.id;
            return (
              <React.Fragment key={e.id}>
                <li
                  onClick={() => handleRowClick(e.id)}
                  className={`group grid ${COLS} gap-4 items-center px-8 py-4 cursor-pointer transition-colors
                    ${isSelected
                      ? 'bg-stone-100/70 dark:bg-stone-700/40 hover:bg-stone-100/90 dark:hover:bg-stone-700/60'
                      : 'hover:bg-stone-100/50 dark:hover:bg-stone-700/30'
                    }`}
                >
                  {/* Nombre + estado llaves */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-7 h-7 rounded-full shrink-0 soft-shadow flex items-center justify-center text-xs bg-white dark:bg-stone-800 text-slate-500 dark:text-stone-400">
                      {e.nombre.charAt(0)}{e.apellidos.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <p className={`text-sm truncate transition-colors ${isSelected ? 'text-orange-500' : 'text-slate-800 dark:text-stone-200'}`}>
                          {e.nombre} {e.apellidos}
                        </p>
                        {e.entregaLlaves && (
                          <KeyRound size={12} className="shrink-0 text-orange-400 dark:text-orange-300" />
                        )}
                        {e.sabanasToallas === 'Sí, entregadas' && (
                          <BedDouble size={12} className="shrink-0 text-slate-400 dark:text-stone-400" />
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 dark:text-stone-500 truncate">{e.nombreCliente}</p>
                    </div>
                  </div>

                  {/* Cuantía total a pagar al trabajador (km × precio/km + 5 € sábanas) */}
                  {(() => {
                    const { total, kmPay, sabanasExtra, precio } = computeEntregaPay(e, workers);
                    if (total === null) {
                      return <p className="text-xs text-slate-400 dark:text-stone-500 tabular-nums">— €</p>;
                    }
                    const desglose = [
                      `${e.km || 0} km × ${fmtEuro(precio)} = ${fmtEuro(kmPay)}`,
                      sabanasExtra ? '+ 5 € sábanas' : '',
                    ].filter(Boolean).join(' ');
                    return (
                      <p
                        title={desglose}
                        className="text-xs font-medium text-orange-600 dark:text-orange-400 tabular-nums"
                      >
                        {fmtEuro(total)}
                      </p>
                    );
                  })()}

                  {/* Apartamento */}
                  <span className="inline-block bg-white dark:bg-stone-800 text-slate-500 dark:text-stone-400 text-[11px] px-2.5 py-1 rounded-md max-w-[140px] truncate soft-shadow">
                    {e.apartamento || '—'}
                  </span>

                  {/* Fechas */}
                  <p className="text-xs text-slate-500 dark:text-stone-400 tabular-nums">{fmtDate(e.fechaEntradaReserva)}</p>
                  <p className="text-xs text-slate-500 dark:text-stone-400 tabular-nums">{fmtDate(e.fechaSalidaReserva)}</p>

                  {/* Acciones */}
                    <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={ev => openEdit(e, ev)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex items-center gap-1.5 text-[11px] font-bold text-slate-600 dark:text-stone-300 hover:text-orange-600 bg-white dark:bg-stone-800 backdrop-blur-sm px-2.5 py-1.5 rounded-lg soft-shadow"
                    >
                      <Pencil size={12} /> {isReadOnly ? 'Ver' : 'Editar'}
                    </button>
                    <ChevronDown
                      size={14}
                      className={`text-slate-400 dark:text-stone-500 transition-transform duration-200 shrink-0 ${isSelected ? 'rotate-180 text-orange-500' : ''}`}
                    />
                  </div>
                </li>

                {/* Panel expandido */}
                {isSelected && <DetailPanel entrega={e} workers={workers} />}
              </React.Fragment>
            );
          })}
        </ul>
      </div>

      {/* Footer count */}
      <div className="px-1">
        <span className="text-xs text-slate-400 dark:text-stone-500">
          {filtered.length} de {entregas.length} registros
        </span>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <EntregaModal
          initial={modalData}
          onSave={handleSave}
          onClose={() => setIsModalOpen(false)}
          onDelete={modalData?.id ? handleDelete : undefined}
          accommodations={accommodations}
          workers={workers}
          isReadOnly={isReadOnly}
        />
      )}
    </div>
  );
};

export default EntregaDeLlaves;
