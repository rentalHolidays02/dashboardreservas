import React, { useEffect, useState, useMemo } from 'react';
import { Search, Trash2, Loader2, CalendarDays, ClipboardList, Wrench, Clock } from 'lucide-react';
import { supabaseOperationsApi, ServiceReportDB } from '../services/supabaseOperationsApi';
import LoadingSpinner from '../components/ui/LoadingSpinner';

const fmtDateTime = (iso: string) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-ES', { 
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit'
  });
};

type TabType = 'reserva' | 'manitas';

interface ServiciosDBProps {
  userRole?: 'admin' | 'editor' | 'viewer' | 'trabajador';
}

const ServiciosDB: React.FC<ServiciosDBProps> = ({ userRole }) => {
  const isReadOnly = userRole === 'viewer';
  const [activeTab, setActiveTab] = useState<TabType>('reserva');
  const [reports, setReports] = useState<ServiceReportDB[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const data = await supabaseOperationsApi.getServiceReports();
      setReports(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('¿Seguro que quieres borrar este registro permanentemente?')) return;
    
    setActionLoading(id);
    try {
      const ok = await supabaseOperationsApi.deleteRecord('service_reports', id);
      if (ok) {
        setReports(prev => prev.filter(r => r.id !== id));
      } else {
        alert('Error al borrar el registro');
      }
    } catch (e) {
      console.error(e);
      alert('Error de red al borrar');
    } finally {
      setActionLoading(null);
    }
  };

  const toggleRow = (id: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRows(newExpanded);
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

  if (loading) {
    return <LoadingSpinner message="Cargando reportes de servicios..." />;
  }

  const tabs = [
    { id: 'reserva', label: 'Limpieza Reserva', icon: <ClipboardList size={18} /> },
    { id: 'manitas', label: 'Manitas', icon: <Wrench size={18} /> },
  ] as const;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-700">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-1 mb-2">
        <h1 className="text-xl font-normal text-slate-800 dark:text-stone-200 tracking-tight font-display shrink-0 flex items-center gap-2">
          Servicios Realizados
        </h1>

        <div className="relative w-full md:w-72">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
          <input
            type="text"
            placeholder="Buscar trabajador o apto..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-white/40 dark:bg-stone-900/40 backdrop-blur-md border border-white/60 dark:border-stone-700/50 rounded-xl text-slate-700 dark:text-stone-300 text-xs focus:outline-none focus:bg-white dark:focus:bg-stone-900 transition-all"
          />
        </div>
      </header>

      {/* Tab Navigation */}
      <div className="flex items-center gap-8 border-b border-stone-100/20 dark:border-stone-700/30 w-full animate-in fade-in slide-in-from-left-4 duration-700">
        {tabs.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabType)}
              className={`relative flex items-center gap-2 pb-3.5 px-0.5 text-xs font-normal transition-all duration-300 group
                ${active ? 'text-slate-800 dark:text-stone-200' : 'text-slate-400 dark:text-stone-600 hover:text-slate-600 dark:hover:text-stone-400'}`}
            >
              <span className={`transition-transform duration-300 ${active ? 'scale-110' : 'group-hover:scale-105'}`}>
                {React.cloneElement(tab.icon as React.ReactElement, {
                  size: 16,
                  className: active ? 'text-orange-500' : 'text-slate-400 dark:text-stone-600'
                })}
              </span>
              <span>{tab.label}</span>
              {active && (
                <div className="absolute bottom-[-1px] left-0 right-0 h-0.5 bg-orange-500 rounded-full animate-in fade-in slide-in-from-left-2 duration-300" />
              )}
            </button>
          );
        })}
      </div>

      <div className="bg-white/60 dark:bg-stone-950 backdrop-blur-md border border-white/60 dark:border-stone-800 rounded-2xl overflow-x-auto shadow-sm">
        {filteredReports.length === 0 ? (
          <div className="px-6 py-16 flex flex-col items-center justify-center text-center">
            {activeTab === 'reserva' && <ClipboardList size={32} className="text-orange-300 dark:text-orange-500/50 mb-3" />}
            {activeTab === 'manitas' && <Wrench size={32} className="text-orange-300 dark:text-orange-500/50 mb-3" />}
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
                {activeTab === 'manitas' && <th className="px-4 py-3 font-medium text-slate-500 dark:text-stone-400 whitespace-nowrap">Detalles</th>}
                {!isReadOnly && <th className="px-4 py-3 font-medium text-slate-500 dark:text-stone-400 text-right">Acciones</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 dark:divide-stone-800/60">
              {filteredReports.map((rep) => {
                const isExpanded = expandedRows.has(rep.id);
                return (
                  <React.Fragment key={rep.id}>
                    <tr 
                      onClick={() => toggleRow(rep.id)}
                      className={`cursor-pointer transition-colors ${isExpanded ? 'bg-orange-50/50 dark:bg-orange-900/5' : 'hover:bg-stone-50 dark:hover:bg-stone-900/30'}`}
                    >
                      <td className="px-4 py-3 text-slate-700 dark:text-stone-300 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 font-medium">
                          <CalendarDays size={12} className="text-slate-400" />
                          {fmtDateTime(rep.created_at)}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-700 dark:text-stone-300">
                        <div className="font-medium text-[12px]">{rep.worker_name}</div>
                        <div className="text-slate-500">{rep.worker_phone}</div>
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-700 dark:text-stone-200">
                        {rep.accommodation_name || '—'}
                      </td>
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
                          <span className="font-medium bg-stone-100 dark:bg-stone-800 px-1.5 py-0.5 rounded text-stone-600 dark:text-stone-300">
                            {rep.km || 0} km
                          </span>
                        </td>
                      )}
                      
                      {activeTab === 'reserva' && (
                        <td className="px-4 py-3 text-slate-700 dark:text-stone-300">
                          {rep.horas_extra && rep.horas_extra !== '00:00' && rep.horas_extra !== '0:00' ? (
                            <span className="font-semibold text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 px-1.5 py-0.5 rounded w-fit">
                              +{rep.horas_extra} hrs
                            </span>
                          ) : (
                            <span className="text-slate-400 italic">—</span>
                          )}
                        </td>
                      )}

                      {activeTab === 'manitas' && (
                        <td className="px-4 py-3 text-slate-700 dark:text-stone-300">
                          <span className="font-medium bg-stone-100 dark:bg-stone-800 px-1.5 py-0.5 rounded text-stone-600 dark:text-stone-300">
                            {rep.km || 0} km
                          </span>
                        </td>
                      )}

                      {!isReadOnly && (
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(rep.id);
                            }}
                            disabled={actionLoading === rep.id}
                            className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-50"
                            title="Eliminar registro"
                          >
                            {actionLoading === rep.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                          </button>
                        </td>
                      )}
                    </tr>
                    
                    {/* Fila Desplegable */}
                    {isExpanded && (
                      <tr className="bg-stone-50/80 dark:bg-stone-900/40 border-b border-stone-100 dark:border-stone-800">
                        <td colSpan={10} className="px-8 py-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 text-[11px]">
                            {/* General Details */}
                            <div className="space-y-2">
                              <h4 className="font-semibold text-slate-700 dark:text-stone-300 uppercase tracking-wider text-[10px] mb-2 border-b border-stone-200 dark:border-stone-700 pb-1">Detalles Generales</h4>
                              <div className="flex flex-col gap-1.5">
                                <div className="flex justify-between">
                                  <span className="text-slate-500">KMs Totales:</span>
                                  <span className="font-medium text-slate-700 dark:text-stone-200">{rep.km || 0} km</span>
                                </div>
                                {rep.kind === 'reserva' && (
                                  <>
                                    <div className="flex justify-between">
                                      <span className="text-slate-500">¿Recoge llaves?:</span>
                                      <span className={`font-medium ${rep.recoge_llaves ? 'text-orange-600 dark:text-orange-400' : 'text-slate-700 dark:text-stone-200'}`}>
                                        {rep.recoge_llaves ? 'Sí' : 'No'}
                                      </span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-slate-500">¿Sigue huésped?:</span>
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
                                        <span className="text-slate-500 block mb-0.5 text-[10px]">Justificación Extra:</span>
                                        <p className="text-slate-700 dark:text-stone-300 leading-relaxed">{rep.justificacion_extra}</p>
                                      </div>
                                    )}
                                  </>
                                )}
                              </div>
                            </div>
                            
                            {/* Observaciones */}
                            <div className="space-y-2 md:col-span-2">
                              <h4 className="font-semibold text-slate-700 dark:text-stone-300 uppercase tracking-wider text-[10px] mb-2 border-b border-stone-200 dark:border-stone-700 pb-1">Observaciones / Notas</h4>
                              <div className="bg-white dark:bg-stone-800 p-3 rounded-xl border border-stone-100 dark:border-stone-700 h-full min-h-[80px]">
                                {rep.notas ? (
                                  <p className="text-slate-700 dark:text-stone-300 leading-relaxed whitespace-pre-wrap">{rep.notas}</p>
                                ) : (
                                  <span className="text-slate-400 italic flex items-center justify-center h-full">Sin observaciones</span>
                                )}
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
    </div>
  );
};

export default ServiciosDB;
