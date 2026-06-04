import React, { useEffect, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Search, Trash2, Loader2, CalendarDays, ClipboardList, Wrench, Clock, Plus, Pencil, X } from 'lucide-react';
import { supabaseOperationsApi, ServiceReportDB, WorkerOption } from '../services/supabaseOperationsApi';
import LoadingSpinner from '../components/ui/LoadingSpinner';

const fmtDateTime = (iso: string) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-ES', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit'
  });
};

type TabType = 'reserva' | 'manitas';

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

// ── Modal ───────────────────────────────────────────────────────────
interface ModalProps {
  record: ServiceReportDB | null;
  kind: TabType;
  workers: WorkerOption[];
  accommodations: { id: string, name: string }[];
  onClose: () => void;
  onSave: (updated: ServiceReportDB) => void;
  onCreate: (created: ServiceReportDB) => void;
}

const ServiceModal: React.FC<ModalProps> = ({ record, kind, workers, accommodations, onClose, onSave, onCreate }) => {
  const isNew = !record;

  const [workerId, setWorkerId] = useState(record?.worker_id ?? '');
  const [accommodationName, setAccommodationName] = useState(record?.accommodation_name ?? '');
  const [horaEntrada, setHoraEntrada] = useState(record?.hora_entrada ?? '');
  const [horaSalida, setHoraSalida] = useState(record?.hora_salida ?? '');
  const [km, setKm] = useState(String(record?.km ?? 0));
  const [recogeLlaves, setRecogeLlaves] = useState(record?.recoge_llaves ?? false);
  const [sigueHuesped, setSigueHuesped] = useState(record?.sigue_huesped ?? false);
  const [horaSalidaHuesped, setHoraSalidaHuesped] = useState(record?.hora_salida_huesped ?? '');
  const [horasExtra, setHorasExtra] = useState(record?.horas_extra ?? '00:00');
  const [justificacionExtra, setJustificacionExtra] = useState(record?.justificacion_extra ?? '');
  const [notas, setNotas] = useState(record?.notas ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!accommodationName.trim()) { setError('El alojamiento es obligatorio.'); return; }
    if (isNew && !workerId) { setError('Selecciona un trabajador.'); return; }
    setSaving(true);
    setError('');
    try {
      const payload = {
        accommodation_name: accommodationName.trim(),
        hora_entrada: horaEntrada || null,
        hora_salida: horaSalida || null,
        km: parseFloat(km) || 0,
        recoge_llaves: recogeLlaves,
        sigue_huesped: sigueHuesped,
        hora_salida_huesped: sigueHuesped ? (horaSalidaHuesped || null) : null,
        horas_extra: horasExtra,
        justificacion_extra: justificacionExtra,
        notas,
      };

      if (isNew) {
        const created = await supabaseOperationsApi.createServiceReport({ worker_id: workerId, kind, ...payload });
        if (!created) { setError('Error al crear el servicio.'); return; }
        onCreate(created);
      } else {
        const ok = await supabaseOperationsApi.updateServiceReport(record!.id, payload);
        if (!ok) { setError('Error al guardar los cambios.'); return; }
        onSave({ ...record!, ...payload, hora_entrada: payload.hora_entrada, hora_salida: payload.hora_salida, hora_salida_huesped: payload.hora_salida_huesped });
      }
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const title = kind === 'reserva' ? 'Limpieza Reserva' : 'Manitas';

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white dark:bg-stone-900 shadow-2xl rounded-2xl flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200 border border-stone-200 dark:border-stone-700">
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100 dark:border-stone-800 shrink-0">
          <div>
            <h2 className="text-sm font-semibold text-slate-800 dark:text-stone-200">
              {isNew ? `Nuevo servicio — ${title}` : `Editar — ${title}`}
            </h2>
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
            <input type="text" list="accommodations-list-servicios" value={accommodationName} onChange={e => setAccommodationName(e.target.value)}
              placeholder="Escribe o selecciona..." className={inputCls} />
            <datalist id="accommodations-list-servicios">
              {accommodations.map(a => <option key={a.id} value={a.name} />)}
            </datalist>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Hora Entrada</label>
              <input type="time" value={horaEntrada} onChange={e => setHoraEntrada(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Hora Salida</label>
              <input type="time" value={horaSalida} onChange={e => setHoraSalida(e.target.value)} className={inputCls} />
            </div>
          </div>

          <div>
            <label className={labelCls}>Kilómetros</label>
            <input type="number" min={0} step={0.1} value={km} onChange={e => setKm(e.target.value)} className={inputCls} />
          </div>

          {kind === 'reserva' && (
            <>
              <div className="bg-stone-50 dark:bg-stone-800/60 rounded-xl px-4 py-3 space-y-3">
                <Toggle value={recogeLlaves} onChange={setRecogeLlaves} label="¿Recoge llaves?" />
                <Toggle value={sigueHuesped} onChange={setSigueHuesped} label="¿Sigue huésped?" />
                {sigueHuesped && (
                  <div>
                    <label className={labelCls}>Hora salida huésped</label>
                    <input type="time" value={horaSalidaHuesped} onChange={e => setHoraSalidaHuesped(e.target.value)} className={inputCls} />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Horas Extra (HH:MM)</label>
                  <input type="text" value={horasExtra} onChange={e => setHorasExtra(e.target.value)} placeholder="00:00" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Justificación extra</label>
                  <input type="text" value={justificacionExtra} onChange={e => setJustificacionExtra(e.target.value)} placeholder="Motivo..." className={inputCls} />
                </div>
              </div>
            </>
          )}

          <div>
            <label className={labelCls}>Notas / Observaciones</label>
            <textarea value={notas} onChange={e => setNotas(e.target.value)} rows={4}
              placeholder="Observaciones adicionales..." className={`${inputCls} resize-none`} />
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
            {saving ? 'Guardando...' : (isNew ? 'Crear Servicio' : 'Guardar Cambios')}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

// ── Main Component ───────────────────────────────────────────────────
interface ServiciosDBProps {
  userRole?: 'admin' | 'editor' | 'viewer' | 'trabajador';
}

const ServiciosDB: React.FC<ServiciosDBProps> = ({ userRole }) => {
  const isReadOnly = userRole === 'viewer';
  const [activeTab, setActiveTab] = useState<TabType>('reserva');
  const [reports, setReports] = useState<ServiceReportDB[]>([]);
  const [workers, setWorkers] = useState<WorkerOption[]>([]);
  const [accommodations, setAccommodations] = useState<{ id: string, name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<ServiceReportDB | null>(null);

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    setLoading(true);
    const [data, wks, accs] = await Promise.all([
      supabaseOperationsApi.getServiceReports(),
      supabaseOperationsApi.getWorkers(),
      supabaseOperationsApi.getAccommodations(),
    ]);
    setReports(data);
    setWorkers(wks);
    setAccommodations(accs);
    setLoading(false);
  };

  const openCreate = () => { setEditingRecord(null); setModalOpen(true); };
  const openEdit = (rep: ServiceReportDB) => { setEditingRecord(rep); setModalOpen(true); };
  const closeModal = () => setModalOpen(false);

  const handleCreated = (created: ServiceReportDB) => setReports(prev => [created, ...prev]);
  const handleSaved = (updated: ServiceReportDB) => setReports(prev => prev.map(r => r.id === updated.id ? updated : r));

  const handleDelete = async (id: string) => {
    if (!window.confirm('¿Seguro que quieres borrar este registro permanentemente?')) return;
    setActionLoading(id);
    const ok = await supabaseOperationsApi.deleteRecord('service_reports', id);
    if (ok) setReports(prev => prev.filter(r => r.id !== id));
    else alert('Error al borrar el registro');
    setActionLoading(null);
  };

  const toggleRow = (id: string) => {
    const s = new Set(expandedRows);
    s.has(id) ? s.delete(id) : s.add(id);
    setExpandedRows(s);
  };

  const filteredReports = useMemo(() => {
    const s = searchTerm.toLowerCase().trim();
    const tabFiltered = reports.filter(r => r.kind === activeTab);
    if (!s) return tabFiltered;
    return tabFiltered.filter(r =>
      r.worker_name.toLowerCase().includes(s) ||
      r.worker_phone.toLowerCase().includes(s) ||
      r.accommodation_name.toLowerCase().includes(s) ||
      (r.notas && r.notas.toLowerCase().includes(s))
    );
  }, [reports, activeTab, searchTerm]);

  if (loading) return <LoadingSpinner message="Cargando reportes de servicios..." />;

  const tabs = [
    { id: 'reserva', label: 'Limpieza Reserva', icon: <ClipboardList size={16} /> },
    { id: 'manitas', label: 'Manitas', icon: <Wrench size={16} /> },
  ] as const;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-700">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-1 mb-2">
        <h1 className="text-xl font-normal text-slate-800 dark:text-stone-200 tracking-tight font-display shrink-0">
          Servicios Realizados
        </h1>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative w-full md:w-64">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
            <input type="text" placeholder="Buscar trabajador o apto..."
              value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-white/40 dark:bg-stone-900/40 backdrop-blur-md border border-white/60 dark:border-stone-700/50 rounded-xl text-slate-700 dark:text-stone-300 text-xs focus:outline-none focus:bg-white dark:focus:bg-stone-900 transition-all"
            />
          </div>
          {!isReadOnly && (
            <button onClick={openCreate}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-orange-600 hover:bg-orange-700 text-white text-xs font-medium rounded-xl transition-colors whitespace-nowrap">
              <Plus size={14} /> Nuevo
            </button>
          )}
        </div>
      </header>

      {/* Tabs */}
      <div className="flex items-center gap-8 border-b border-stone-100/20 dark:border-stone-700/30 w-full">
        {tabs.map(tab => {
          const active = activeTab === tab.id;
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as TabType)}
              className={`relative flex items-center gap-2 pb-3.5 px-0.5 text-xs font-normal transition-all duration-300 group
                ${active ? 'text-slate-800 dark:text-stone-200' : 'text-slate-400 dark:text-stone-600 hover:text-slate-600 dark:hover:text-stone-400'}`}>
              {React.cloneElement(tab.icon as React.ReactElement, {
                className: active ? 'text-orange-500' : 'text-slate-400 dark:text-stone-600'
              })}
              <span>{tab.label}</span>
              {active && <div className="absolute bottom-[-1px] left-0 right-0 h-0.5 bg-orange-500 rounded-full" />}
            </button>
          );
        })}
      </div>

      <div className="bg-white/60 dark:bg-stone-950 backdrop-blur-md border border-white/60 dark:border-stone-800 rounded-2xl overflow-x-auto shadow-sm">
        {filteredReports.length === 0 ? (
          <div className="px-6 py-16 flex flex-col items-center justify-center text-center">
            {activeTab === 'reserva' ? <ClipboardList size={32} className="text-orange-300 dark:text-orange-500/50 mb-3" /> : <Wrench size={32} className="text-orange-300 dark:text-orange-500/50 mb-3" />}
            <p className="text-sm font-medium text-slate-700 dark:text-stone-300">No hay servicios registrados de este tipo</p>
          </div>
        ) : (
          <table className="min-w-full text-left border-collapse text-[11px]">
            <thead>
              <tr className="border-b border-stone-200/50 dark:border-stone-800/80">
                <th className="px-4 py-3 font-medium text-slate-500 dark:text-stone-400 whitespace-nowrap">Fecha de Envío</th>
                <th className="px-4 py-3 font-medium text-slate-500 dark:text-stone-400 whitespace-nowrap">Trabajador</th>
                <th className="px-4 py-3 font-medium text-slate-500 dark:text-stone-400 whitespace-nowrap">Alojamiento</th>
                <th className="px-4 py-3 font-medium text-slate-500 dark:text-stone-400 whitespace-nowrap">Horarios</th>
                {activeTab === 'reserva' && <th className="px-4 py-3 font-medium text-slate-500 dark:text-stone-400 whitespace-nowrap">KMs</th>}
                {activeTab === 'reserva' && <th className="px-4 py-3 font-medium text-slate-500 dark:text-stone-400 whitespace-nowrap">Horas Extra</th>}
                {activeTab === 'manitas' && <th className="px-4 py-3 font-medium text-slate-500 dark:text-stone-400 whitespace-nowrap">KMs</th>}
                {!isReadOnly && <th className="px-4 py-3 font-medium text-slate-500 dark:text-stone-400 text-right">Acciones</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 dark:divide-stone-800/60">
              {filteredReports.map(rep => {
                const isExpanded = expandedRows.has(rep.id);
                return (
                  <React.Fragment key={rep.id}>
                    <tr onClick={() => toggleRow(rep.id)}
                      className={`cursor-pointer transition-colors ${isExpanded ? 'bg-orange-50/50 dark:bg-orange-900/5' : 'hover:bg-stone-50 dark:hover:bg-stone-900/30'}`}>
                      <td className="px-4 py-3 text-slate-700 dark:text-stone-300 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 font-medium">
                          <CalendarDays size={12} className="text-slate-400" />
                          {fmtDateTime(rep.submitted_at)}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-700 dark:text-stone-300">
                        <div className="font-medium text-[12px]">{rep.worker_name}</div>
                        <div className="text-slate-500">{rep.worker_phone}</div>
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-700 dark:text-stone-200">{rep.accommodation_name || '—'}</td>
                      <td className="px-4 py-3 text-slate-700 dark:text-stone-300">
                        <div className="flex items-center gap-1">
                          <Clock size={11} className="text-emerald-500" />
                          <span>{rep.hora_entrada || '—'}</span>
                          <span className="mx-1 text-slate-300">→</span>
                          <Clock size={11} className="text-blue-500" />
                          <span>{rep.hora_salida || '—'}</span>
                        </div>
                      </td>
                      {activeTab === 'reserva' && (
                        <td className="px-4 py-3 text-slate-700 dark:text-stone-300">
                          <span className="font-medium bg-stone-100 dark:bg-stone-800 px-1.5 py-0.5 rounded">{rep.km || 0} km</span>
                        </td>
                      )}
                      {activeTab === 'reserva' && (
                        <td className="px-4 py-3 text-slate-700 dark:text-stone-300">
                          {rep.horas_extra && rep.horas_extra !== '00:00' && rep.horas_extra !== '0:00'
                            ? <span className="font-semibold text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 px-1.5 py-0.5 rounded">+{rep.horas_extra} hrs</span>
                            : <span className="text-slate-400 italic">—</span>
                          }
                        </td>
                      )}
                      {activeTab === 'manitas' && (
                        <td className="px-4 py-3 text-slate-700 dark:text-stone-300">
                          <span className="font-medium bg-stone-100 dark:bg-stone-800 px-1.5 py-0.5 rounded">{rep.km || 0} km</span>
                        </td>
                      )}
                      {!isReadOnly && (
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={e => { e.stopPropagation(); openEdit(rep); }}
                              className="p-1.5 text-slate-400 hover:text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-500/10 rounded-lg transition-colors"
                              title="Editar">
                              <Pencil size={13} />
                            </button>
                            <button onClick={e => { e.stopPropagation(); handleDelete(rep.id); }}
                              disabled={actionLoading === rep.id}
                              className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-50"
                              title="Eliminar">
                              {actionLoading === rep.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>

                    {isExpanded && (
                      <tr className="bg-stone-50/80 dark:bg-stone-900/40">
                        <td colSpan={10} className="px-8 py-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-[11px]">
                            <div className="space-y-2">
                              <h4 className="font-semibold text-slate-700 dark:text-stone-300 uppercase tracking-wider text-[10px] border-b border-stone-200 dark:border-stone-700 pb-1">Detalles</h4>
                              <div className="flex flex-col gap-1.5">
                                <div className="flex justify-between">
                                  <span className="text-slate-500">Kilómetros:</span>
                                  <span className="font-medium text-slate-700 dark:text-stone-200">{rep.km || 0} km</span>
                                </div>
                                {rep.kind === 'reserva' && <>
                                  <div className="flex justify-between">
                                    <span className="text-slate-500">¿Recoge llaves?</span>
                                    <span className={`font-medium ${rep.recoge_llaves ? 'text-orange-600 dark:text-orange-400' : 'text-slate-700 dark:text-stone-200'}`}>{rep.recoge_llaves ? 'Sí' : 'No'}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-slate-500">¿Sigue huésped?</span>
                                    <span className={`font-medium ${rep.sigue_huesped ? 'text-red-600 dark:text-red-400' : 'text-slate-700 dark:text-stone-200'}`}>
                                      {rep.sigue_huesped ? `Sí (Salida: ${rep.hora_salida_huesped || '?'})` : 'No'}
                                    </span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-slate-500">Horas Extra:</span>
                                    <span className="font-medium text-slate-700 dark:text-stone-200">{rep.horas_extra || '00:00'}</span>
                                  </div>
                                  {rep.justificacion_extra && (
                                    <div className="mt-1 bg-white dark:bg-stone-800 p-2 rounded border border-stone-100 dark:border-stone-700">
                                      <span className="text-slate-500 block mb-0.5">Justificación:</span>
                                      <p className="text-slate-700 dark:text-stone-300">{rep.justificacion_extra}</p>
                                    </div>
                                  )}
                                </>}
                              </div>
                            </div>
                            <div>
                              <h4 className="font-semibold text-slate-700 dark:text-stone-300 uppercase tracking-wider text-[10px] border-b border-stone-200 dark:border-stone-700 pb-1 mb-2">Notas</h4>
                              <div className="bg-white dark:bg-stone-800 p-3 rounded-xl border border-stone-100 dark:border-stone-700 min-h-[80px]">
                                {rep.notas ? <p className="text-slate-700 dark:text-stone-300 leading-relaxed whitespace-pre-wrap">{rep.notas}</p>
                                  : <span className="text-slate-400 italic">Sin notas</span>}
                              </div>
                            </div>
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
        <ServiceModal
          record={editingRecord}
          kind={activeTab}
          workers={workers}
          accommodations={accommodations}
          onClose={closeModal}
          onSave={handleSaved}
          onCreate={handleCreated}
        />
      )}
    </div>
  );
};

export default ServiciosDB;
