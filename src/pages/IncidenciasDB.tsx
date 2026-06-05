import React, { useEffect, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Search, Trash2, Clock, CalendarDays, Loader2, Plus, Pencil, X } from 'lucide-react';
import { supabaseOperationsApi, IncidentReportDB, WorkerOption } from '../services/supabaseOperationsApi';
import LoadingSpinner from '../components/ui/LoadingSpinner';

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
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
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

// ── Main Component ───────────────────────────────────────────────────
interface IncidenciasDBProps {
  userRole?: 'admin' | 'editor' | 'viewer' | 'trabajador';
}

const IncidenciasDB: React.FC<IncidenciasDBProps> = ({ userRole }) => {
  const isReadOnly = userRole === 'viewer';
  const [incidencias, setIncidencias] = useState<IncidentReportDB[]>([]);
  const [workers, setWorkers] = useState<WorkerOption[]>([]);
  const [accommodations, setAccommodations] = useState<{ id: string, name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<IncidentReportDB | null>(null);

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    const [data, wks, accs] = await Promise.all([
      supabaseOperationsApi.getIncidentReports(),
      supabaseOperationsApi.getWorkers(),
      supabaseOperationsApi.getAccommodations(),
    ]);
    setIncidencias(data);
    setWorkers(wks);
    setAccommodations(accs);
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

  const filteredIncidencias = useMemo(() => {
    const s = searchTerm.toLowerCase().trim();
    if (!s) return incidencias;
    return incidencias.filter(inc =>
      inc.worker_name.toLowerCase().includes(s) ||
      inc.worker_phone.toLowerCase().includes(s) ||
      inc.accommodation_name.toLowerCase().includes(s) ||
      inc.detalles.toLowerCase().includes(s)
    );
  }, [incidencias, searchTerm]);

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
              {filteredIncidencias.map((inc) => (
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
                    {inc.accommodation_name || '—'}
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
              ))}
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
    </div>
  );
};

export default IncidenciasDB;
