import React, { useEffect, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Search, Trash2, Clock, CalendarDays, Loader2, Plus, Pencil, X, Wrench, ClipboardList } from 'lucide-react';
import { supabaseOperationsApi, IncidentReportDB, WorkerOption, ServiceReportDB } from '../services/supabaseOperationsApi';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { useAdminDraft } from '../utils/useAdminDraft';

const fmtDate = (iso: string) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-ES', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
};

const formatDuration = (val: string) => {
  if (!val) return '0h y 0m';
  const parts = val.split(':');
  if (parts.length === 2) {
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    return `${h}h y ${m}m`;
  }
  return val;
};

const ensureHHMM = (val: string) => {
  const clean = val.replace(/[^0-9:]/g, '');
  const parts = clean.split(':');
  const h = parseInt(parts[0], 10) || 0;
  const m = parseInt(parts[1], 10) || 0;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
};

// ── Shared UI helpers ────────────────────────────────────────────────
const inputCls = 'w-full px-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-xs text-slate-700 dark:text-stone-200 focus:outline-none focus:ring-2 focus:ring-orange-400/50 placeholder:text-slate-400';
const labelCls = 'block text-[11px] font-medium text-slate-500 dark:text-stone-400 mb-1';

// ── Modal ───────────────────────────────────────────────────────────
interface ModalProps {
  record: IncidentReportDB | null;  // null = create mode
  workers: WorkerOption[];
  accommodations: { id: string, name: string }[];
  onClose: () => void;
  onSave: (updated: IncidentReportDB) => void;
  onCreate: (created: IncidentReportDB) => void;
}

const IncidentModal: React.FC<ModalProps> = ({ record, workers, accommodations, onClose, onSave, onCreate }) => {
  const isNew = !record;
  const [workerId, setWorkerId] = useState(record?.worker_id ?? '');
  const [accommodationName, setAccommodationName] = useState(record?.accommodation_name ?? '');
  const [duracion, setDuracion] = useState(record?.duracion ?? '00:00');
  const [detalles, setDetalles] = useState(record?.detalles ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const clearDraft = useAdminDraft(
    'admin_draft_incidencia',
    isNew,
    { workerId, accommodationName, duracion, detalles },
    (draft: any) => {
      setWorkerId(draft.workerId ?? '');
      setAccommodationName(draft.accommodationName ?? '');
      setDuracion(draft.duracion ?? '00:00');
      setDetalles(draft.detalles ?? '');
    }
  );

  const handleSave = async () => {
    if (!accommodationName.trim()) { setError('El alojamiento es obligatorio.'); return; }
    if (isNew && !workerId) { setError('Selecciona un trabajador.'); return; }
    setSaving(true);
    setError('');
    const finalDuracion = ensureHHMM(duracion);
    try {
      if (isNew) {
        const created = await supabaseOperationsApi.createIncidentReport({
          worker_id: workerId,
          accommodation_name: accommodationName.trim(),
          duracion: finalDuracion,
          detalles,
        });
        if (!created) { setError('Error al crear la incidencia.'); return; }
        clearDraft();
        onCreate(created);
      } else {
        const ok = await supabaseOperationsApi.updateIncidentReport(record!.id, {
          accommodation_name: accommodationName.trim(),
          duracion: finalDuracion,
          detalles,
        });
        if (!ok) { setError('Error al guardar los cambios.'); return; }
        onSave({ ...record!, accommodation_name: accommodationName.trim(), duracion: finalDuracion, detalles });
      }
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div className="relative w-full max-w-md bg-white dark:bg-stone-900 shadow-2xl rounded-2xl flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200 border border-stone-200 dark:border-stone-700">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100 dark:border-stone-800 shrink-0">
          <div>
            <h2 className="text-sm font-semibold text-slate-800 dark:text-stone-200">
              {isNew ? 'Nueva Incidencia' : 'Editar Incidencia'}
            </h2>
            {!isNew && <p className="text-[10px] text-slate-400 mt-0.5">{record!.worker_name}</p>}
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-lg transition-colors">
            <X size={16} className="text-slate-500" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {isNew && (
            <div>
              <label className={labelCls}>Trabajador *</label>
              <select value={workerId} onChange={e => setWorkerId(e.target.value)} className={inputCls}>
                <option value="">— Selecciona un trabajador —</option>
                {workers.map(w => (
                  <option key={w.id} value={w.id}>{w.full_name} ({w.phone})</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className={labelCls}>Alojamiento *</label>
            <input type="text" list="accommodations-list" value={accommodationName} onChange={e => setAccommodationName(e.target.value)}
              placeholder="Escribe o selecciona..." className={inputCls} />
            <datalist id="accommodations-list">
              {accommodations.map(a => <option key={a.id} value={a.name} />)}
            </datalist>
          </div>

          <div>
            <label className={labelCls}>Duración (HH:MM)</label>
            <input type="text" value={duracion} onChange={e => setDuracion(e.target.value)}
              placeholder="01:30" className={inputCls} />
            <p className="text-[10px] text-slate-400 mt-1">Formato: horas:minutos — ej. 01:30</p>
          </div>

          <div>
            <label className={labelCls}>Detalles de la incidencia</label>
            <textarea value={detalles} onChange={e => setDetalles(e.target.value)}
              rows={6} placeholder="Describe la incidencia..." className={`${inputCls} resize-none`} />
          </div>

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 text-red-600 dark:text-red-400 text-xs px-3 py-2 rounded-xl">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-stone-100 dark:border-stone-800 flex gap-3 shrink-0 rounded-b-2xl bg-stone-50 dark:bg-stone-900">
          <button onClick={onClose} className="flex-1 py-2.5 text-xs rounded-xl border border-stone-200 dark:border-stone-700 text-slate-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors">
            Cancelar
          </button>
          <button onClick={handleSave} disabled={saving} className="flex-1 py-2.5 text-xs rounded-xl bg-orange-600 hover:bg-orange-700 disabled:opacity-60 text-white font-medium transition-colors flex items-center justify-center gap-2 shadow-sm">
            {saving && <Loader2 size={13} className="animate-spin" />}
            {saving ? 'Guardando...' : (isNew ? 'Crear Incidencia' : 'Guardar Cambios')}
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
          <LinkedServiceRow label="Fecha" value={fmtDate(service.created_at)} />
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
interface IncidenciasDBProps {
  userRole?: 'admin' | 'editor' | 'viewer' | 'trabajador';
}

const IncidenciasDB: React.FC<IncidenciasDBProps> = ({ userRole }) => {
  const isReadOnly = userRole === 'viewer';
  const [incidencias, setIncidencias] = useState<IncidentReportDB[]>([]);
  const [workers, setWorkers] = useState<WorkerOption[]>([]);
  const [accommodations, setAccommodations] = useState<{ id: string, name: string }[]>([]);
  const [servicios, setServicios] = useState<ServiceReportDB[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'connected' | 'unique'>('all');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<IncidentReportDB | null>(null);
  const [linkedServicePopup, setLinkedServicePopup] = useState<ServiceReportDB | null>(null);

  const serviciosById = useMemo(() => {
    const m = new Map<string, ServiceReportDB>();
    for (const s of servicios) m.set(s.id, s);
    return m;
  }, [servicios]);

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    const [data, wks, accs, srvs] = await Promise.all([
      supabaseOperationsApi.getIncidentReports(),
      supabaseOperationsApi.getWorkers(),
      supabaseOperationsApi.getAccommodations(),
      supabaseOperationsApi.getServiceReports(),
    ]);
    setIncidencias(data);
    setWorkers(wks);
    setAccommodations(accs);
    setServicios(srvs);
    setLoading(false);
  };

  const openCreate = () => { setEditingRecord(null); setModalOpen(true); };
  const openEdit = (inc: IncidentReportDB) => { setEditingRecord(inc); setModalOpen(true); };
  const closeModal = () => setModalOpen(false);

  const handleCreated = (created: IncidentReportDB) => {
    setIncidencias(prev => [created, ...prev]);
  };
  const handleSaved = (updated: IncidentReportDB) => {
    setIncidencias(prev => prev.map(i => i.id === updated.id ? updated : i));
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('¿Seguro que quieres borrar esta incidencia permanentemente?')) return;
    setActionLoading(id);
    const ok = await supabaseOperationsApi.deleteRecord('incident_reports', id);
    if (ok) setIncidencias(prev => prev.filter(i => i.id !== id));
    else alert('Error al borrar la incidencia');
    setActionLoading(null);
  };

  const getLinkedService = (inc: IncidentReportDB): ServiceReportDB | null => {
    return inc.parent_service_id ? serviciosById.get(inc.parent_service_id) ?? null : null;
  };

  const isIncidentConnected = (inc: IncidentReportDB): boolean => {
    return !!getLinkedService(inc);
  };

  const filteredIncidencias = useMemo(() => {
    const s = searchTerm.toLowerCase().trim();
    let result = incidencias;

    // Filtro de búsqueda
    if (s) {
      result = result.filter(inc =>
        inc.worker_name.toLowerCase().includes(s) ||
        inc.worker_phone.toLowerCase().includes(s) ||
        inc.accommodation_name.toLowerCase().includes(s) ||
        inc.detalles.toLowerCase().includes(s)
      );
    }

    // Filtro por conexión con servicios
    if (filterType === 'connected') {
      result = result.filter(inc => isIncidentConnected(inc));
    } else if (filterType === 'unique') {
      result = result.filter(inc => !isIncidentConnected(inc));
    }

    return result;
  }, [incidencias, searchTerm, filterType, servicios]);

  if (loading) return <LoadingSpinner message="Cargando reportes de incidencias..." />;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-700">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-1 mb-2">
        <h1 className="text-xl font-normal text-slate-800 dark:text-stone-200 tracking-tight font-display shrink-0">
          Incidencias Reportadas
        </h1>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative w-full md:w-72">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
            <input type="text" placeholder="Buscar trabajador, apto o detalles..."
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
        {filteredIncidencias.length === 0 ? (
          <div className="px-6 py-16 flex flex-col items-center justify-center text-center">
            <AlertTriangle size={32} className="text-orange-300 dark:text-orange-500/50 mb-3" />
            <p className="text-sm font-medium text-slate-700 dark:text-stone-300">No hay incidencias reportadas</p>
            <p className="text-xs text-slate-500 mt-1">Las incidencias que envíen los trabajadores aparecerán aquí.</p>
          </div>
        ) : (
          <table className="min-w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-stone-200/50 dark:border-stone-800/80">
                <th className="px-5 py-3.5 font-medium text-slate-500 dark:text-stone-400">Fecha de Envío</th>
                <th className="px-5 py-3.5 font-medium text-slate-500 dark:text-stone-400">Trabajador</th>
                <th className="px-5 py-3.5 font-medium text-slate-500 dark:text-stone-400">Alojamiento</th>
                <th className="px-5 py-3.5 font-medium text-slate-500 dark:text-stone-400">Duración</th>
                <th className="px-5 py-3.5 font-medium text-slate-500 dark:text-stone-400 w-1/3">Detalles</th>
                {!isReadOnly && <th className="px-5 py-3.5 font-medium text-slate-500 dark:text-stone-400 text-right">Acciones</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 dark:divide-stone-800/60">
              {filteredIncidencias.map((inc) => {
                const linkedService = getLinkedService(inc);
                return (
                <tr key={inc.id}
                  onClick={() => !isReadOnly && openEdit(inc)}
                  className={`transition-colors group ${!isReadOnly ? 'cursor-pointer hover:bg-stone-50 dark:hover:bg-stone-900/30' : ''}`}
                >
                  <td className="px-5 py-3.5 text-slate-700 dark:text-stone-300">
                    <div className="flex items-center gap-1.5 whitespace-nowrap">
                      <CalendarDays size={13} className="text-slate-400" />
                      {fmtDate(inc.created_at)}
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-slate-700 dark:text-stone-300">
                    <div className="font-medium">{inc.worker_name}</div>
                    <div className="text-[10px] text-slate-500">{inc.worker_phone}</div>
                  </td>
                  <td className="px-5 py-3.5 font-medium text-slate-700 dark:text-stone-200">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span>{inc.accommodation_name || '—'}</span>
                      {linkedService && (
                        <button
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
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-slate-700 dark:text-stone-300">
                    <div className="flex items-center gap-1.5 whitespace-nowrap bg-stone-100 dark:bg-stone-800 w-fit px-2 py-1 rounded text-[11px] font-medium">
                      <Clock size={12} className="text-orange-500" />
                      {formatDuration(inc.duracion)}
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-slate-600 dark:text-stone-400">
                    <p className="line-clamp-2" title={inc.detalles}>
                      {inc.detalles || 'Sin detalles proporcionados.'}
                    </p>
                  </td>
                  {!isReadOnly && (
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={e => { e.stopPropagation(); openEdit(inc); }}
                          className="p-1.5 text-slate-400 hover:text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-500/10 rounded-lg transition-colors"
                          title="Editar">
                          <Pencil size={13} />
                        </button>
                        <button onClick={e => { e.stopPropagation(); handleDelete(inc.id); }}
                          disabled={actionLoading === inc.id}
                          className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-50"
                          title="Eliminar">
                          {actionLoading === inc.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {modalOpen && (
        <IncidentModal
          record={editingRecord}
          workers={workers}
          accommodations={accommodations}
          onClose={closeModal}
          onSave={handleSaved}
          onCreate={handleCreated}
        />
      )}

      <LinkedServicePopup service={linkedServicePopup} onClose={() => setLinkedServicePopup(null)} />
    </div>
  );
};

export default IncidenciasDB;
