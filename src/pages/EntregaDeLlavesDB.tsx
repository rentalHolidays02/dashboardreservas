import React, { useEffect, useState, useMemo } from 'react';
import { Search, Trash2, Key, Loader2, CalendarDays } from 'lucide-react';
import { supabaseOperationsApi, KeyDeliveryDB } from '../services/supabaseOperationsApi';
import LoadingSpinner from '../components/ui/LoadingSpinner';

const fmtDate = (iso: string | null) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-ES', { 
    day: '2-digit', month: '2-digit', year: 'numeric'
  });
};

const fmtDateTime = (iso: string) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-ES', { 
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit'
  });
};

const fmtEuro = (n: number | string | null) => {
  if (n === null || n === undefined || n === '') return '0,00 €';
  const num = typeof n === 'string' ? parseFloat(n) : n;
  if (isNaN(num)) return '0,00 €';
  return `${num.toFixed(2).replace('.', ',')} €`;
};

const SignaturePreview: React.FC<{ url: string | null; label: string; color: string }> = ({ url, label, color }) => (
  <div className="space-y-1">
    <span className="text-[10px] font-semibold text-slate-500 dark:text-stone-400 uppercase tracking-wide block">{label}</span>
    {url ? (
      <div className={`border-2 ${color} rounded-xl overflow-hidden bg-white p-1`} style={{ minHeight: 80 }}>
        <img
          src={url}
          alt={label}
          className="w-full max-h-32 object-contain"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none';
            (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
          }}
        />
        <span className="hidden text-slate-400 italic text-[10px] text-center w-full block py-2">No se puede cargar</span>
      </div>
    ) : (
      <div className="border border-dashed border-stone-200 dark:border-stone-700 rounded-xl bg-stone-50 dark:bg-stone-800/50 flex items-center justify-center" style={{ minHeight: 80 }}>
        <span className="text-slate-400 italic text-[10px]">Sin firma</span>
      </div>
    )}
  </div>
);

interface EntregaDeLlavesDBProps {
  userRole?: 'admin' | 'editor' | 'viewer' | 'trabajador';
}

const EntregaDeLlavesDB: React.FC<EntregaDeLlavesDBProps> = ({ userRole }) => {
  const isReadOnly = userRole === 'viewer';
  const [entregas, setEntregas] = useState<KeyDeliveryDB[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchEntregas();
  }, []);

  const fetchEntregas = async () => {
    setLoading(true);
    try {
      const data = await supabaseOperationsApi.getKeyDeliveries();
      setEntregas(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('¿Seguro que quieres borrar este registro de entrega permanentemente?')) return;
    
    setActionLoading(id);
    try {
      const ok = await supabaseOperationsApi.deleteRecord('key_deliveries', id);
      if (ok) {
        setEntregas(prev => prev.filter(e => e.id !== id));
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

  const filteredEntregas = useMemo(() => {
    const s = searchTerm.toLowerCase().trim();
    if (!s) return entregas;
    return entregas.filter(e => 
      e.worker_name.toLowerCase().includes(s) ||
      e.worker_phone.toLowerCase().includes(s) ||
      e.accommodation_name.toLowerCase().includes(s) ||
      e.nombre_cliente.toLowerCase().includes(s)
    );
  }, [entregas, searchTerm]);

  if (loading) {
    return <LoadingSpinner message="Cargando entregas de llaves..." />;
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-700">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-1 mb-2">
        <h1 className="text-xl font-normal text-slate-800 dark:text-stone-200 tracking-tight font-display shrink-0">
          Entregas de Llaves
        </h1>
        <div className="relative w-full md:w-72">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
          <input
            type="text"
            placeholder="Buscar trabajador, apto o huésped..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-white/40 dark:bg-stone-900/40 backdrop-blur-md border border-white/60 dark:border-stone-700/50 rounded-xl text-slate-700 dark:text-stone-300 text-xs focus:outline-none focus:bg-white dark:focus:bg-stone-900 transition-all"
          />
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
              {filteredEntregas.map((ent) => {
                const isExpanded = expandedRows.has(ent.id);
                return (
                  <React.Fragment key={ent.id}>
                    {/* Fila principal — clic abre el desplegable */}
                    <tr
                      onClick={() => toggleRow(ent.id)}
                      className={`cursor-pointer transition-colors ${isExpanded ? 'bg-orange-50/50 dark:bg-orange-900/5' : 'hover:bg-stone-50 dark:hover:bg-stone-900/30'}`}
                    >
                      <td className="px-4 py-3 text-slate-700 dark:text-stone-300 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 font-medium">
                          <CalendarDays size={12} className="text-slate-400" />
                          {fmtDateTime(ent.submitted_at)}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-700 dark:text-stone-300">
                        <div className="font-medium text-[12px]">{ent.worker_name}</div>
                        <div className="text-slate-500">{ent.worker_phone}</div>
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-700 dark:text-stone-200">
                        {ent.accommodation_name || '—'}
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
                              {ent.bizum_monto && <span className="text-slate-500 ml-1">({ent.bizum_monto})</span>}
                            </div>
                          )}
                          {ent.fianza_garantia_metodo && (
                            <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800/30 px-2 py-1 rounded">
                              <span className="font-semibold text-[10px] text-blue-700 dark:text-blue-500 uppercase block mb-0.5">Garantía: {ent.fianza_garantia_metodo}</span>
                              <span className="font-medium text-slate-800 dark:text-stone-200">{fmtEuro(ent.cantidad_pagada_garantia)}</span>
                              {ent.bizum_garantia && <span className="text-slate-500 ml-1">({ent.bizum_garantia})</span>}
                            </div>
                          )}
                          {!ent.fianza_monto_metodo && !ent.fianza_garantia_metodo && (
                            <span className="text-slate-400 italic">Sin cobros</span>
                          )}
                        </div>
                      </td>
                      {!isReadOnly && (
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDelete(ent.id); }}
                            disabled={actionLoading === ent.id}
                            className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-50"
                            title="Eliminar registro"
                          >
                            {actionLoading === ent.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                          </button>
                        </td>
                      )}
                    </tr>

                    {/* Fila desplegable */}
                    {isExpanded && (
                      <tr className="bg-stone-50/80 dark:bg-stone-900/40">
                        <td colSpan={isReadOnly ? 5 : 6} className="px-6 py-5">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-[11px]">
                            
                            {/* Detalles Extra */}
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
                                    {ent.sabanas_entregadas ? `Sí (${ent.sabanas_personas || 0} pax)` : 'No'}
                                  </span>
                                </div>
                              </div>

                              <h4 className="font-semibold text-slate-700 dark:text-stone-300 uppercase tracking-wider text-[10px] border-b border-stone-200 dark:border-stone-700 pb-1 mt-4">Observaciones</h4>
                              <div className="bg-white dark:bg-stone-800 p-3 rounded-xl border border-stone-100 dark:border-stone-700 max-h-24 overflow-y-auto">
                                {ent.observaciones ? (
                                  <p className="text-slate-700 dark:text-stone-300 leading-relaxed whitespace-pre-wrap">{ent.observaciones}</p>
                                ) : (
                                  <span className="text-slate-400 italic">Sin observaciones</span>
                                )}
                              </div>
                            </div>

                            {/* Firma Trabajador */}
                            <SignaturePreview
                              url={ent.firma_trabajador_url}
                              label="Firma del Trabajador"
                              color="border-blue-200 dark:border-blue-700"
                            />

                            {/* Firma Huésped */}
                            <SignaturePreview
                              url={ent.firma_huesped_url}
                              label="Firma del Huésped"
                              color="border-emerald-200 dark:border-emerald-700"
                            />
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

export default EntregaDeLlavesDB;
