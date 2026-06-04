import React, { useEffect, useState, useMemo } from 'react';
import { AlertTriangle, Search, Trash2, Clock, CalendarDays, Loader2 } from 'lucide-react';
import { supabaseOperationsApi, IncidentReportDB } from '../services/supabaseOperationsApi';
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

interface IncidenciasDBProps {
  userRole?: 'admin' | 'editor' | 'viewer' | 'trabajador';
}

const IncidenciasDB: React.FC<IncidenciasDBProps> = ({ userRole }) => {
  const isReadOnly = userRole === 'viewer';
  const [incidencias, setIncidencias] = useState<IncidentReportDB[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    fetchIncidencias();
  }, []);

  const fetchIncidencias = async () => {
    setLoading(true);
    try {
      const data = await supabaseOperationsApi.getIncidentReports();
      setIncidencias(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('¿Seguro que quieres borrar esta incidencia permanentemente?')) return;
    
    setActionLoading(id);
    try {
      const ok = await supabaseOperationsApi.deleteRecord('incident_reports', id);
      if (ok) {
        setIncidencias(prev => prev.filter(i => i.id !== id));
      } else {
        alert('Error al borrar la incidencia');
      }
    } catch (e) {
      console.error(e);
      alert('Error de red al borrar');
    } finally {
      setActionLoading(null);
    }
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

  if (loading) {
    return <LoadingSpinner message="Cargando reportes de incidencias..." />;
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-700">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-1 mb-2">
        <h1 className="text-xl font-normal text-slate-800 dark:text-stone-200 tracking-tight font-display shrink-0">
          Incidencias Reportadas
        </h1>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative w-full md:w-72">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
            <input
              type="text"
              placeholder="Buscar trabajador, apto o detalles..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-white/40 dark:bg-stone-900/40 backdrop-blur-md border border-white/60 dark:border-stone-700/50 rounded-xl text-slate-700 dark:text-stone-300 text-xs focus:outline-none focus:bg-white dark:focus:bg-stone-900 transition-all"
            />
          </div>
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
                <tr key={inc.id} className="hover:bg-white/80 dark:hover:bg-stone-900/50 transition-colors group">
                  <td className="px-5 py-3.5 text-slate-700 dark:text-stone-300">
                    <div className="flex items-center gap-1.5 whitespace-nowrap">
                      <CalendarDays size={13} className="text-slate-400" />
                      {fmtDate(inc.submitted_at)}
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
                    <p className="line-clamp-2 hover:line-clamp-none transition-all duration-300" title={inc.detalles}>
                      {inc.detalles || 'Sin detalles proporcionados.'}
                    </p>
                  </td>
                  {!isReadOnly && (
                    <td className="px-5 py-3.5 text-right">
                      <button
                        onClick={() => handleDelete(inc.id)}
                        disabled={actionLoading === inc.id}
                        className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-50"
                        title="Eliminar registro"
                      >
                        {actionLoading === inc.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default IncidenciasDB;
