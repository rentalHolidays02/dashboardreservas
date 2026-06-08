import React, { useEffect, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Search, Trash2, Key, Loader2, CalendarDays, Plus, Pencil, X, ClipboardList, Wrench, AlertTriangle } from 'lucide-react';
import SignaturePad from '../components/ui/SignaturePad';
import { supabaseOperationsApi, KeyDeliveryDB, WorkerOption, ServiceReportDB, IncidentReportDB } from '../services/supabaseOperationsApi';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { formatBizumNumber } from '../components/workers/serviceFormHelpers';

const stripBizum = (v: string) => v.replace(/\D/g, '');

const fmtDate = (iso: string | null) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
};
const fmtDateTime = (iso: string) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
};
const fmtEuro = (n: number | string | null) => {
  if (n === null || n === undefined || n === '') return '0,00 €';
  const num = typeof n === 'string' ? parseFloat(n) : n;
  return isNaN(num) ? '0,00 €' : `${num.toFixed(2).replace('.', ',')} €`;
};

const inputCls = 'w-full px-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-xs text-slate-700 dark:text-stone-200 focus:outline-none focus:ring-2 focus:ring-orange-400/50 placeholder:text-slate-400';
const labelCls = 'block text-[11px] font-medium text-slate-500 dark:text-stone-400 mb-1';

const Toggle: React.FC<{ value: boolean; onChange: (v: boolean) => void; label: string }> = ({ value, onChange, label }) => (
  <div className="flex items-center justify-between">
    <span className={labelCls} style={{ marginBottom: 0 }}>{label}</span>
    <button type="button" onClick={() => onChange(!value)}
      className={`relative w-10 h-5 rounded-full transition-colors duration-200 ${value ? 'bg-orange-500' : 'bg-stone-300 dark:bg-stone-600'}`}>
      <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${value ? 'translate-x-5' : 'translate-x-0'}`} />
    </button>
  </div>
);

const SignaturePreview: React.FC<{ url: string | null; label: string; color: string }> = ({ url, label, color }) => (
  <div className="space-y-1">
    <span className="text-[10px] font-semibold text-slate-500 dark:text-stone-400 uppercase tracking-wide block">{label}</span>
    {url ? (
      <div className={`border-2 ${color} rounded-xl overflow-hidden p-1`} style={{ minHeight: 80, backgroundColor: '#ffffff' }}>
        <img src={url} alt={label} className="w-full max-h-32 object-contain" style={{ backgroundColor: '#ffffff' }}
          onError={e => {
            (e.target as HTMLImageElement).style.display = 'none';
            (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
          }} />
        <span className="hidden text-slate-400 italic text-[10px] text-center w-full block py-2">No se puede cargar</span>
      </div>
    ) : (
      <div className="border-2 border-dashed border-stone-200 rounded-xl flex items-center justify-center" style={{ minHeight: 80, backgroundColor: '#ffffff' }}>
        <span className="text-slate-400 italic text-[10px]">Sin firma</span>
      </div>
    )}
  </div>
);

// ── Modal ───────────────────────────────────────────────────────────
const PAYMENT_METHODS = ['', 'Efectivo', 'Bizum', 'Tarjeta'];

interface ModalProps {
  record: KeyDeliveryDB | null;
  workers: WorkerOption[];
  accommodations: { id: string, name: string }[];
  onClose: () => void;
  onSave: (updated: KeyDeliveryDB) => void;
  onCreate: (created: KeyDeliveryDB) => void;
}

const KeyDeliveryModal: React.FC<ModalProps> = ({ record, workers, accommodations, onClose, onSave, onCreate }) => {
  const isNew = !record;
  const [workerId, setWorkerId] = useState(record?.worker_id ?? '');
  const [accommodationName, setAccommodationName] = useState(record?.accommodation_name ?? '');
  const [nombreCliente, setNombreCliente] = useState(record?.nombre_cliente ?? '');
  const [fechaEntrada, setFechaEntrada] = useState(record?.fecha_entrada_reserva?.split('T')[0] ?? '');
  const [fechaSalida, setFechaSalida] = useState(record?.fecha_salida_reserva?.split('T')[0] ?? '');
  const [sabanasEntregadas, setSabanasEntregadas] = useState(record?.sabanas_entregadas ?? false);
  const [sabanasPersonas, setSabanasPersonas] = useState(String(record?.sabanas_personas ?? ''));
  const [fianzaMetodo, setFianzaMetodo] = useState(record?.fianza_monto_metodo ?? '');
  const [fianzaMonto, setFianzaMonto] = useState(String(record?.cantidad_pagada_monto ?? ''));
  const [bizumMonto, setBizumMonto] = useState(formatBizumNumber(record?.bizum_monto ?? ''));
  const [garantiaMetodo, setGarantiaMetodo] = useState(record?.fianza_garantia_metodo ?? '');
  const [garantiaMonto, setGarantiaMonto] = useState(String(record?.cantidad_pagada_garantia ?? ''));
  const [bizumGarantia, setBizumGarantia] = useState(formatBizumNumber(record?.bizum_garantia ?? ''));
  const [km, setKm] = useState(String(record?.km ?? 0));
  const [observaciones, setObservaciones] = useState(record?.observaciones ?? '');
  const [firmaTrabajador, setFirmaTrabajador] = useState(record?.firma_trabajador_url ?? '');
  const [firmaHuesped, setFirmaHuesped] = useState(record?.firma_huesped_url ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!accommodationName.trim()) { setError('El alojamiento es obligatorio.'); return; }
    if (isNew && !workerId) { setError('Selecciona un trabajador.'); return; }
    setSaving(true); setError('');
    try {
      const round2 = (n: number) => Math.round(n * 100) / 100;
      const nameQ = accommodationName.trim().toLowerCase();
      const accommodationId = accommodations.find(a => a.name.trim().toLowerCase() === nameQ)?.id ?? null;
      const payload = {
        accommodation_id: accommodationId,
        accommodation_name: accommodationName.trim(),
        nombre_cliente: nombreCliente,
        fecha_entrada_reserva: fechaEntrada || null,
        fecha_salida_reserva: fechaSalida || null,
        sabanas_entregadas: sabanasEntregadas,
        sabanas_personas: sabanasEntregadas ? (parseInt(sabanasPersonas) || 0) : null,
        fianza_monto_metodo: fianzaMetodo || null,
        cantidad_pagada_monto: round2(parseFloat(fianzaMonto) || 0),
        bizum_monto: fianzaMetodo === 'Bizum' ? stripBizum(bizumMonto) : '',
        fianza_garantia_metodo: garantiaMetodo || null,
        cantidad_pagada_garantia: round2(parseFloat(garantiaMonto) || 0),
        bizum_garantia: garantiaMetodo === 'Bizum' ? stripBizum(bizumGarantia) : '',
        km: round2(parseFloat(km) || 0),
        observaciones,
        firma_trabajador_url: firmaTrabajador || null,
        firma_huesped_url: firmaHuesped || null,
      };

      if (isNew) {
        const created = await supabaseOperationsApi.createKeyDelivery({ worker_id: workerId, ...payload });
        if (!created) { setError('Error al crear la entrega.'); return; }
        onCreate(created);
      } else {
        const ok = await supabaseOperationsApi.updateKeyDelivery(record!.id, payload);
        if (!ok) { setError('Error al guardar los cambios.'); return; }
        onSave({ ...record!, ...payload, fianza_monto_metodo: payload.fianza_monto_metodo ?? null, fianza_garantia_metodo: payload.fianza_garantia_metodo ?? null, fecha_entrada_reserva: payload.fecha_entrada_reserva ?? null, fecha_salida_reserva: payload.fecha_salida_reserva ?? null, sabanas_personas: payload.sabanas_personas ?? null, firma_trabajador_url: payload.firma_trabajador_url ?? null, firma_huesped_url: payload.firma_huesped_url ?? null });
      }
      onClose();
    } finally { setSaving(false); }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div className="relative w-full max-w-md bg-white dark:bg-stone-900 shadow-2xl rounded-2xl flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200 border border-stone-200 dark:border-stone-700">
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100 dark:border-stone-800 shrink-0">
          <div>
            <h2 className="text-sm font-semibold text-slate-800 dark:text-stone-200">{isNew ? 'Nueva Entrega de Llaves' : 'Editar Entrega'}</h2>
            {!isNew && <p className="text-[10px] text-slate-400 mt-0.5">{record!.worker_name}</p>}
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-lg transition-colors">
            <X size={16} className="text-slate-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {isNew && (
            <div>
              <label className={labelCls}>Trabajador *</label>
              <select value={workerId} onChange={e => setWorkerId(e.target.value)} className={inputCls}>
                <option value="">— Selecciona un trabajador —</option>
                {workers.map(w => <option key={w.id} value={w.id}>{w.full_name} ({w.phone})</option>)}
              </select>
            </div>
          )}

          <div>
            <label className={labelCls}>Alojamiento *</label>
            <input type="text" list="accommodations-list-llaves" value={accommodationName} onChange={e => setAccommodationName(e.target.value)} placeholder="Escribe o selecciona..." className={inputCls} />
            <datalist id="accommodations-list-llaves">
              {accommodations.map(a => <option key={a.id} value={a.name} />)}
            </datalist>
          </div>

          <div>
            <label className={labelCls}>Nombre del Huésped / Cliente</label>
            <input type="text" value={nombreCliente} onChange={e => setNombreCliente(e.target.value)} placeholder="Nombre completo del huésped" className={inputCls} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Fecha Entrada Reserva</label>
              <input type="date" value={fechaEntrada} onChange={e => setFechaEntrada(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Fecha Salida Reserva</label>
              <input type="date" value={fechaSalida} onChange={e => setFechaSalida(e.target.value)} className={inputCls} />
            </div>
          </div>

          <div className="bg-stone-50 dark:bg-stone-800/60 rounded-xl px-4 py-3 space-y-3">
            <Toggle value={sabanasEntregadas} onChange={setSabanasEntregadas} label="¿Sábanas entregadas?" />
            {sabanasEntregadas && (
              <div>
                <label className={labelCls}>Nº de personas</label>
                <input type="number" min={1} value={sabanasPersonas}
                  onChange={e => setSabanasPersonas(e.target.value)}
                  onWheel={e => (e.currentTarget as HTMLInputElement).blur()}
                  className={inputCls} />
              </div>
            )}
          </div>

          <div className="space-y-3">
            <h4 className="text-[11px] font-semibold text-slate-600 dark:text-stone-400 uppercase tracking-wide">Fianza (cobro)</h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Método pago</label>
                <select value={fianzaMetodo} onChange={e => setFianzaMetodo(e.target.value)} className={inputCls}>
                  {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m || '— Ninguno —'}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Importe (€)</label>
                <input type="number" min={0} step={0.01} value={fianzaMonto}
                  onChange={e => setFianzaMonto(e.target.value)}
                  onWheel={e => (e.currentTarget as HTMLInputElement).blur()}
                  className={inputCls} />
              </div>
            </div>
            {fianzaMetodo === 'Bizum' && (
              <div>
                <label className={labelCls}>Nº Bizum</label>
                <input
                  type="tel"
                  inputMode="numeric"
                  value={bizumMonto}
                  onChange={e => setBizumMonto(formatBizumNumber(e.target.value))}
                  placeholder="612 34 56 78"
                  maxLength={12}
                  className={inputCls}
                />
              </div>
            )}
          </div>

          <div className="space-y-3">
            <h4 className="text-[11px] font-semibold text-slate-600 dark:text-stone-400 uppercase tracking-wide">Garantía</h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Método garantía</label>
                <select value={garantiaMetodo} onChange={e => setGarantiaMetodo(e.target.value)} className={inputCls}>
                  {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m || '— Ninguno —'}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Importe (€)</label>
                <input type="number" min={0} step={0.01} value={garantiaMonto}
                  onChange={e => setGarantiaMonto(e.target.value)}
                  onWheel={e => (e.currentTarget as HTMLInputElement).blur()}
                  className={inputCls} />
              </div>
            </div>
            {garantiaMetodo === 'Bizum' && (
              <div>
                <label className={labelCls}>Nº Bizum Garantía</label>
                <input
                  type="tel"
                  inputMode="numeric"
                  value={bizumGarantia}
                  onChange={e => setBizumGarantia(formatBizumNumber(e.target.value))}
                  placeholder="612 34 56 78"
                  maxLength={12}
                  className={inputCls}
                />
              </div>
            )}
          </div>

          <div>
            <label className={labelCls}>Kilómetros</label>
            <input type="number" min={0} step={0.1} value={km}
              onChange={e => setKm(e.target.value)}
              onWheel={e => (e.currentTarget as HTMLInputElement).blur()}
              className={inputCls} />
          </div>

          <div>
            <label className={labelCls}>Observaciones</label>
            <textarea value={observaciones} onChange={e => setObservaciones(e.target.value)} rows={3}
              placeholder="Observaciones adicionales..." className={`${inputCls} resize-none`} />
          </div>

          <div className="space-y-3">
            <h4 className="text-[11px] font-semibold text-slate-600 dark:text-stone-400 uppercase tracking-wide">Firmas</h4>
            <div className="grid grid-cols-1 gap-3">
              <SignaturePad
                label="Firma Trabajador"
                value={firmaTrabajador}
                onChange={setFirmaTrabajador}
              />
              <SignaturePad
                label="Firma Huésped"
                value={firmaHuesped}
                onChange={setFirmaHuesped}
              />
            </div>
          </div>

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 text-red-600 dark:text-red-400 text-xs px-3 py-2 rounded-xl">
              {error}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-stone-100 dark:border-stone-800 flex gap-3 shrink-0 rounded-b-2xl bg-stone-50 dark:bg-stone-900">
          <button onClick={onClose} className="flex-1 py-2.5 text-xs rounded-xl border border-stone-200 dark:border-stone-700 text-slate-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors">
            Cancelar
          </button>
          <button onClick={handleSave} disabled={saving} className="flex-1 py-2.5 text-xs rounded-xl bg-orange-600 hover:bg-orange-700 disabled:opacity-60 text-white font-medium transition-colors flex items-center justify-center gap-2 shadow-sm">
            {saving && <Loader2 size={13} className="animate-spin" />}
            {saving ? 'Guardando...' : (isNew ? 'Crear Entrega' : 'Guardar Cambios')}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

// ── Popup detalles del servicio vinculado ───────────────────────────
const LinkedServiceRow: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div className="flex justify-between gap-3 text-[11px]">
    <span className="text-slate-500 dark:text-stone-400">{label}</span>
    <span className="font-medium text-slate-700 dark:text-stone-200 text-right">{value || '—'}</span>
  </div>
);

const LinkedServicePopup: React.FC<{ service: ServiceReportDB | null; onClose: () => void }> = ({ service, onClose }) => {
  if (!service) return null;
  const isManitas = service.kind === 'manitas';
  return createPortal(
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md max-h-[85vh] flex flex-col bg-white dark:bg-stone-900 rounded-3xl shadow-2xl border border-white/60 dark:border-stone-800/50 animate-in zoom-in-95 duration-300">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-stone-800/60">
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-xl ${isManitas ? 'bg-amber-100 dark:bg-amber-400/10 text-amber-600 dark:text-amber-400' : 'bg-emerald-100 dark:bg-emerald-400/10 text-emerald-600 dark:text-emerald-400'}`}>
              {isManitas ? <Wrench size={16} /> : <ClipboardList size={16} />}
            </div>
            <div>
              <h3 className="text-sm font-medium text-slate-800 dark:text-stone-100">
                {isManitas ? 'Manitas vinculado' : 'Limpieza reserva vinculada'}
              </h3>
              <p className="text-[10px] text-slate-400">{service.accommodation_name}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-stone-800/60">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          <LinkedServiceRow label="Trabajador" value={service.worker_name} />
          <LinkedServiceRow label="Fecha" value={fmtDateTime(service.created_at)} />
          {!isManitas && (
            <>
              <LinkedServiceRow label="Hora entrada" value={service.hora_entrada} />
              <LinkedServiceRow label="Hora salida" value={service.hora_salida} />
              <LinkedServiceRow label="Recoge llaves" value={service.recoge_llaves ? 'Sí' : 'No'} />
              <LinkedServiceRow label="Sigue huésped" value={service.sigue_huesped ? 'Sí' : 'No'} />
              {service.sigue_huesped && service.hora_salida_huesped && (
                <LinkedServiceRow label="Hora salida huésped" value={service.hora_salida_huesped} />
              )}
            </>
          )}
          <LinkedServiceRow label="Kilómetros" value={`${service.km || 0} km`} />
          <LinkedServiceRow label="Horas extra" value={service.horas_extra && service.horas_extra !== '00:00' ? service.horas_extra : '—'} />
          {service.justificacion_extra && (
            <div>
              <p className="text-[11px] text-slate-500 mb-1">Justificación horas extra</p>
              <p className="text-[11px] text-slate-700 dark:text-stone-200 bg-stone-50 dark:bg-stone-800/40 rounded-xl px-3 py-2 whitespace-pre-wrap">{service.justificacion_extra}</p>
            </div>
          )}
          {service.notas && (
            <div>
              <p className="text-[11px] text-slate-500 mb-1">Notas</p>
              <p className="text-[11px] text-slate-700 dark:text-stone-200 bg-stone-50 dark:bg-stone-800/40 rounded-xl px-3 py-2 whitespace-pre-wrap">{service.notas}</p>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

// ── Main Component ───────────────────────────────────────────────────
interface EntregaDeLlavesDBProps {
  userRole?: 'admin' | 'editor' | 'viewer' | 'trabajador';
}

const EntregaDeLlavesDB: React.FC<EntregaDeLlavesDBProps> = ({ userRole }) => {
  const isReadOnly = userRole === 'viewer';
  const [entregas, setEntregas] = useState<KeyDeliveryDB[]>([]);
  const [workers, setWorkers] = useState<WorkerOption[]>([]);
  const [accommodations, setAccommodations] = useState<{ id: string, name: string }[]>([]);
  const [servicios, setServicios] = useState<ServiceReportDB[]>([]);
  const [incidents, setIncidents] = useState<IncidentReportDB[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'connected' | 'unique'>('all');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<KeyDeliveryDB | null>(null);
  const [linkedServicePopup, setLinkedServicePopup] = useState<ServiceReportDB | null>(null);
  const [linkedIncidentPopup, setLinkedIncidentPopup] = useState<IncidentReportDB | null>(null);

  const serviciosById = useMemo(() => {
    const m = new Map<string, ServiceReportDB>();
    for (const s of servicios) m.set(s.id, s);
    return m;
  }, [servicios]);

  const incidentsByServiceId = useMemo(() => {
    const m = new Map<string, IncidentReportDB>();
    for (const inc of incidents) {
      if (inc.parent_service_id) m.set(inc.parent_service_id, inc);
    }
    return m;
  }, [incidents]);

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    setLoading(true);
    const [data, wks, accs, srvs, incs] = await Promise.all([
      supabaseOperationsApi.getKeyDeliveries(),
      supabaseOperationsApi.getWorkers(),
      supabaseOperationsApi.getAccommodations(),
      supabaseOperationsApi.getServiceReports(),
      supabaseOperationsApi.getIncidentReports(),
    ]);
    setEntregas(data);
    setWorkers(wks);
    setAccommodations(accs);
    setServicios(srvs);
    setIncidents(incs);
    setLoading(false);
  };

  const openCreate = () => { setEditingRecord(null); setModalOpen(true); };
  const openEdit = (ent: KeyDeliveryDB) => { setEditingRecord(ent); setModalOpen(true); };
  const closeModal = () => setModalOpen(false);
  
  const handleCreated = (created: KeyDeliveryDB) => setEntregas(prev => [created, ...prev]);
  const handleSaved = (updated: KeyDeliveryDB) => setEntregas(prev => prev.map(e => e.id === updated.id ? updated : e));

  const handleDelete = async (id: string) => {
    if (!window.confirm('¿Seguro que quieres borrar este registro permanentemente?')) return;
    setActionLoading(id);
    const ok = await supabaseOperationsApi.deleteRecord('key_deliveries', id);
    if (ok) setEntregas(prev => prev.filter(e => e.id !== id));
    else alert('Error al borrar el registro');
    setActionLoading(null);
  };

  const toggleRow = (id: string) => {
    const s = new Set(expandedRows);
    s.has(id) ? s.delete(id) : s.add(id);
    setExpandedRows(s);
  };

  const isDeliveryConnected = (ent: KeyDeliveryDB): boolean => {
    // Conectada si tiene un parent_service_id real y el servicio existe
    return !!ent.parent_service_id && serviciosById.has(ent.parent_service_id);
  };

  const filteredEntregas = useMemo(() => {
    const s = searchTerm.toLowerCase().trim();
    let result = entregas;

    // Filtro de búsqueda
    if (s) {
      result = result.filter(e =>
        e.worker_name.toLowerCase().includes(s) ||
        e.worker_phone.toLowerCase().includes(s) ||
        e.accommodation_name.toLowerCase().includes(s) ||
        e.nombre_cliente.toLowerCase().includes(s)
      );
    }

    // Filtro por conexión con servicios
    if (filterType === 'connected') {
      result = result.filter(ent => isDeliveryConnected(ent));
    } else if (filterType === 'unique') {
      result = result.filter(ent => !isDeliveryConnected(ent));
    }

    return result;
  }, [entregas, searchTerm, filterType, servicios]);

  if (loading) return <LoadingSpinner message="Cargando entregas de llaves..." />;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-700">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-1 mb-2">
        <h1 className="text-xl font-normal text-slate-800 dark:text-stone-200 tracking-tight font-display shrink-0">Entregas de Llaves</h1>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative w-full md:w-72">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
            <input type="text" placeholder="Buscar trabajador, apto o huésped..."
              value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-white/40 dark:bg-stone-900/40 backdrop-blur-md border border-white/60 dark:border-stone-700/50 rounded-xl text-slate-700 dark:text-stone-300 text-xs focus:outline-none focus:bg-white dark:focus:bg-stone-900 transition-all"
            />
          </div>
          <select
            value={filterType}
            onChange={e => setFilterType(e.target.value as 'all' | 'connected' | 'unique')}
            className="px-3 py-2.5 bg-white/40 dark:bg-stone-900/40 backdrop-blur-md border border-white/60 dark:border-stone-700/50 rounded-xl text-slate-700 dark:text-stone-300 text-xs focus:outline-none focus:bg-white dark:focus:bg-stone-900 transition-all whitespace-nowrap"
          >
            <option value="all">Todos</option>
            <option value="connected">Conectados c/ Limpiezas</option>
            <option value="unique">Únicos</option>
          </select>
          {!isReadOnly && (
            <button onClick={openCreate}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-orange-600 hover:bg-orange-700 text-white text-xs font-medium rounded-xl transition-colors whitespace-nowrap">
              <Plus size={14} /> Nueva
            </button>
          )}
        </div>
      </header>

      <div className="bg-white/60 dark:bg-stone-950 backdrop-blur-md border border-white/60 dark:border-stone-800 rounded-2xl overflow-x-auto shadow-sm">
        {filteredEntregas.length === 0 ? (
          <div className="px-6 py-16 flex flex-col items-center justify-center text-center">
            <Key size={32} className="text-orange-300 dark:text-orange-500/50 mb-3" />
            <p className="text-sm font-medium text-slate-700 dark:text-stone-300">No hay entregas registradas</p>
          </div>
        ) : (
          <table className="min-w-full text-left border-collapse text-[11px]">
            <thead>
              <tr className="border-b border-stone-200/50 dark:border-stone-800/80">
                <th className="px-4 py-3 font-medium text-slate-500 dark:text-stone-400 whitespace-nowrap">Registro</th>
                <th className="px-4 py-3 font-medium text-slate-500 dark:text-stone-400 whitespace-nowrap">Trabajador</th>
                <th className="px-4 py-3 font-medium text-slate-500 dark:text-stone-400 whitespace-nowrap">Alojamiento</th>
                <th className="px-4 py-3 font-medium text-slate-500 dark:text-stone-400 whitespace-nowrap">Huésped / Reservas</th>
                <th className="px-4 py-3 font-medium text-slate-500 dark:text-stone-400 whitespace-nowrap">Cobros (Fianza / Garantía)</th>
                {!isReadOnly && <th className="px-4 py-3 font-medium text-slate-500 dark:text-stone-400 text-right">Acciones</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 dark:divide-stone-800/60">
              {filteredEntregas.map(ent => {
                const isExpanded = expandedRows.has(ent.id);
                const linkedService = ent.parent_service_id ? serviciosById.get(ent.parent_service_id) ?? null : null;
                return (
                  <React.Fragment key={ent.id}>
                    <tr onClick={() => toggleRow(ent.id)}
                      className={`cursor-pointer transition-colors ${isExpanded ? 'bg-orange-50/50 dark:bg-orange-900/5' : 'hover:bg-stone-50 dark:hover:bg-stone-900/30'}`}>
                      <td className="px-4 py-3 text-slate-700 dark:text-stone-300 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 font-medium">
                          <CalendarDays size={12} className="text-slate-400" />
                          {fmtDateTime(ent.created_at)}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-700 dark:text-stone-300">
                        <div className="font-medium text-[12px]">{ent.worker_name}</div>
                        <div className="text-slate-500">{ent.worker_phone}</div>
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-700 dark:text-stone-200">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span>{ent.accommodation_name || '—'}</span>
                          {linkedService && (
                            <>
                              <button
                                type="button"
                                onClick={e => { e.stopPropagation(); setLinkedServicePopup(linkedService); }}
                                title={linkedService.kind === 'manitas' ? 'Manitas vinculado — ver detalles' : 'Limpieza reserva vinculada — ver detalles'}
                                className={`inline-flex items-center justify-center p-1 rounded-md transition-colors ${
                                  linkedService.kind === 'manitas'
                                    ? 'bg-amber-50 dark:bg-amber-400/10 text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-400/20'
                                    : 'bg-emerald-50 dark:bg-emerald-400/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-400/20'
                                }`}
                              >
                                {linkedService.kind === 'manitas' ? <Wrench size={11} /> : <ClipboardList size={11} />}
                              </button>
                              {incidentsByServiceId.has(linkedService.id) && (
                                <button
                                  type="button"
                                  onClick={e => { e.stopPropagation(); setLinkedIncidentPopup(incidentsByServiceId.get(linkedService.id) ?? null); }}
                                  title="Incidencia vinculada — ver detalles"
                                  className="inline-flex items-center justify-center p-1 rounded-md transition-colors bg-red-50 dark:bg-red-400/10 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-400/20"
                                >
                                  <AlertTriangle size={12} />
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-700 dark:text-stone-300">
                        <div className="font-medium mb-0.5">{ent.nombre_cliente || '—'}</div>
                        <div className="text-[10px] text-slate-500 whitespace-nowrap">
                          {fmtDate(ent.fecha_entrada_reserva)} <span className="text-slate-300 mx-0.5">→</span> {fmtDate(ent.fecha_salida_reserva)}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-700 dark:text-stone-300">
                        <div className="flex flex-col gap-1.5">
                          {ent.fianza_monto_metodo && (
                            <div className="bg-orange-50 dark:bg-orange-900/10 border border-orange-100 dark:border-orange-800/30 px-2 py-1 rounded">
                              <span className="font-semibold text-[10px] text-orange-700 dark:text-orange-500 uppercase block mb-0.5">Fianza: {ent.fianza_monto_metodo}</span>
                              <span className="font-medium text-slate-800 dark:text-stone-200">{fmtEuro(ent.cantidad_pagada_monto)}</span>
                              {ent.bizum_monto && <span className="text-slate-500 ml-1">({formatBizumNumber(ent.bizum_monto)})</span>}
                            </div>
                          )}
                          {ent.fianza_garantia_metodo && (
                            <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800/30 px-2 py-1 rounded">
                              <span className="font-semibold text-[10px] text-blue-700 dark:text-blue-500 uppercase block mb-0.5">Garantía: {ent.fianza_garantia_metodo}</span>
                              <span className="font-medium text-slate-800 dark:text-stone-200">{fmtEuro(ent.cantidad_pagada_garantia)}</span>
                              {ent.bizum_garantia && <span className="text-slate-500 ml-1">({formatBizumNumber(ent.bizum_garantia)})</span>}
                            </div>
                          )}
                          {!ent.fianza_monto_metodo && !ent.fianza_garantia_metodo && <span className="text-slate-400 italic">Sin cobros</span>}
                        </div>
                      </td>
                      {!isReadOnly && (
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={e => { e.stopPropagation(); openEdit(ent); }}
                              className="p-1.5 text-slate-400 hover:text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-500/10 rounded-lg transition-colors" title="Editar">
                              <Pencil size={13} />
                            </button>
                            <button onClick={e => { e.stopPropagation(); handleDelete(ent.id); }}
                              disabled={actionLoading === ent.id}
                              className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-50" title="Eliminar">
                              {actionLoading === ent.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>

                    {isExpanded && (
                      <tr className="bg-stone-50/80 dark:bg-stone-900/40">
                        <td colSpan={isReadOnly ? 5 : 6} className="px-6 py-5">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-[11px]">
                            <div className="space-y-3">
                              <h4 className="font-semibold text-slate-700 dark:text-stone-300 uppercase tracking-wider text-[10px] border-b border-stone-200 dark:border-stone-700 pb-1">Detalles Extra</h4>
                              <div className="flex flex-col gap-2">
                                <div className="flex justify-between">
                                  <span className="text-slate-500">Kilómetros:</span>
                                  <span className="font-medium text-slate-700 dark:text-stone-200">{ent.km || 0} km</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-slate-500">Sábanas entregadas:</span>
                                  <span className={`font-medium ${ent.sabanas_entregadas ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-700 dark:text-stone-200'}`}>
                                    {ent.sabanas_entregadas ? `Sí (${ent.sabanas_personas || 0} pers.)` : 'No'}
                                  </span>
                                </div>
                              </div>
                              <h4 className="font-semibold text-slate-700 dark:text-stone-300 uppercase tracking-wider text-[10px] border-b border-stone-200 dark:border-stone-700 pb-1 mt-3">Observaciones</h4>
                              <div className="bg-white dark:bg-stone-800 p-3 rounded-xl border border-stone-100 dark:border-stone-700 max-h-24 overflow-y-auto">
                                {ent.observaciones ? <p className="text-slate-700 dark:text-stone-300 leading-relaxed whitespace-pre-wrap">{ent.observaciones}</p>
                                  : <span className="text-slate-400 italic">Sin observaciones</span>}
                              </div>
                            </div>
                            <SignaturePreview url={ent.firma_trabajador_url} label="Firma del Trabajador" color="border-blue-200 dark:border-blue-700" />
                            <SignaturePreview url={ent.firma_huesped_url} label="Firma del Huésped" color="border-emerald-200 dark:border-emerald-700" />
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {modalOpen && (
        <KeyDeliveryModal
          record={editingRecord}
          workers={workers}
          accommodations={accommodations}
          onClose={closeModal}
          onSave={handleSaved}
          onCreate={handleCreated}
        />
      )}

      <LinkedServicePopup service={linkedServicePopup} onClose={() => setLinkedServicePopup(null)} />
      <LinkedIncidentPopup incident={linkedIncidentPopup} onClose={() => setLinkedIncidentPopup(null)} />
    </div>
  );
};

const LinkedIncidentPopup: React.FC<{ incident: IncidentReportDB | null; onClose: () => void }> = ({ incident, onClose }) => {
  if (!incident) return null;

  return createPortal(
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md max-h-[85vh] flex flex-col bg-white dark:bg-stone-900 rounded-3xl shadow-2xl border border-white/60 dark:border-stone-800/50 animate-in zoom-in-95 duration-300">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-stone-800/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-red-100 dark:bg-red-400/10 text-red-600 dark:text-red-400">
              <AlertTriangle size={16} />
            </div>
            <div>
              <h3 className="text-sm font-medium text-slate-800 dark:text-stone-100">Incidencia vinculada</h3>
              <p className="text-[10px] text-slate-400">{incident.accommodation_name}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-stone-800/60">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3 text-[11px]">
          <div className="grid gap-3">
            <div className="flex justify-between text-slate-500 dark:text-stone-400">
              <span>Trabajador</span>
              <span className="font-medium text-slate-700 dark:text-stone-200">{incident.worker_name}</span>
            </div>
            <div className="flex justify-between text-slate-500 dark:text-stone-400">
              <span>Fecha</span>
              <span className="font-medium text-slate-700 dark:text-stone-200">{fmtDateTime(incident.created_at)}</span>
            </div>
            <div className="flex justify-between text-slate-500 dark:text-stone-400">
              <span>Duración</span>
              <span className="font-medium text-slate-700 dark:text-stone-200">{incident.duracion || '—'}</span>
            </div>
          </div>
          <div>
            <p className="text-[11px] text-slate-500 mb-1">Detalles</p>
            <div className="bg-stone-50 dark:bg-stone-800/40 rounded-xl p-3 text-slate-700 dark:text-stone-200 whitespace-pre-wrap">
              {incident.detalles || 'Sin detalles adicionales'}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default EntregaDeLlavesDB;
