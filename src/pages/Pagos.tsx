import React, { useState, useEffect, useMemo } from 'react';
import { Banknote, Clock, Loader2, Filter, Search, ChevronRight } from 'lucide-react';
import { appsScriptApi } from '../services/api';
import { PagoRecord, Worker } from '../services/mockData';
import FilterModal, { PagosFilters } from '../components/pagos/FilterModal';
import { useAnimatedNumber } from '../hooks/useAnimatedNumber';

const fmtCurrency = (n: number) =>
  n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });

const fmtDate = (s: string) =>
  new Date(s + 'T00:00:00').toLocaleDateString('es-ES', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });

const Pagos: React.FC = () => {
  const [pagos, setPagos] = useState<PagoRecord[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Filter Modal state
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [filters, setFilters] = useState<PagosFilters>({
    status: 'all',
    startDate: '',
    endDate: '',
    minAmount: 0,
    maxAmount: 2000
  });

  const photoMap = useMemo(() => {
    const map: Record<string, string> = {};
    workers.forEach(w => { if (w.photo) map[w.fullName] = w.photo; });
    return map;
  }, [workers]);

  useEffect(() => {
    appsScriptApi.getWorkers().then(setWorkers);
    appsScriptApi.getAllPagos().then(data => {
      setPagos(data);
      setLoading(false);
    });
  }, []);

  const filteredPagos = useMemo(() => {
    return pagos.filter(p => {
      const matchSearch = p.workerName.toLowerCase().includes(searchTerm.toLowerCase());
      const matchStatus = filters.status === 'all' || p.estado === filters.status;
      
      let matchDate = true;
      if (filters.startDate) matchDate = matchDate && p.fecha >= filters.startDate;
      if (filters.endDate)   matchDate = matchDate && p.fecha <= filters.endDate;
      
      const matchAmount = p.importe >= filters.minAmount && p.importe <= filters.maxAmount;
      
      return matchSearch && matchStatus && matchDate && matchAmount;
    });
  }, [pagos, searchTerm, filters]);

  // Animated values
  const totalPagado = filteredPagos.filter(p => p.estado === 'pagado').reduce((acc, p) => acc + p.importe, 0);
  const animatedTotalPagado = useAnimatedNumber(totalPagado);
  
  const totalPendiente = filteredPagos.filter(p => p.estado === 'pendiente').reduce((acc, p) => acc + p.importe, 0);
  const animatedTotalPendiente = useAnimatedNumber(totalPendiente);
  
  const registros = filteredPagos.length;
  const animatedRegistros = useAnimatedNumber(registros);
  
  const pendientes = filteredPagos.filter(p => p.estado === 'pendiente').length;
  const animatedPendientes = useAnimatedNumber(pendientes);

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filters.status !== 'all') count++;
    if (filters.startDate || filters.endDate) count++;
    if (filters.minAmount > 0 || filters.maxAmount < 2000) count++;
    return count;
  }, [filters]);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-700">
      
      {/* Header & Toolbar unificados */}
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 px-1 mb-2">
        <h1 className="text-xl font-normal text-slate-800 dark:text-stone-200 tracking-tight font-display shrink-0">
          Registro de pagos
        </h1>

        <div className="flex flex-col md:flex-row gap-3 justify-end items-center flex-1">
          <div className="relative w-full md:w-72">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-stone-500 pointer-events-none" size={14} />
            <input
              type="text"
              placeholder="Buscar trabajador..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-white/40 dark:bg-stone-900/40 backdrop-blur-md border border-white/60 dark:border-stone-700/50 rounded-xl text-slate-700 dark:text-stone-300 text-xs font-normal placeholder:text-slate-400 dark:placeholder:text-stone-500 focus:outline-none transition-all hover:bg-white/80 dark:hover:bg-stone-800/60 focus:bg-white dark:focus:bg-stone-900"
            />
          </div>
          
          <div className="relative">
            <button 
              onClick={() => setIsFilterModalOpen(true)}
              className={`flex items-center justify-center gap-2 px-6 py-2.5 bg-white dark:bg-stone-900 backdrop-blur-md border border-white/60 dark:border-stone-700/50 rounded-xl text-xs font-normal transition-all active:scale-[0.98] relative ${
                activeFiltersCount > 0 ? 'text-orange-600 dark:text-orange-400 font-medium bg-white/90 dark:bg-stone-800/90' : 'text-orange-500/80 dark:text-orange-500/70 hover:text-orange-500 dark:hover:text-orange-400 hover:bg-white/80 dark:hover:bg-stone-800/60'
              }`}
            >
              <Filter size={12} className="text-orange-500" />
              <span>Filtro</span>
              {activeFiltersCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-orange-600 text-white text-[10px] flex items-center justify-center rounded-full animate-in zoom-in-50">
                  {activeFiltersCount}
                </span>
              )}
            </button>

            <FilterModal 
              isOpen={isFilterModalOpen}
              onClose={() => setIsFilterModalOpen(false)}
              filters={filters}
              onApply={(newFilters) => {
                setFilters(newFilters);
              }}
            />
          </div>
        </div>
      </header>

      {/* Resumen de Datos */}
      {!loading && filteredPagos.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 px-1">
          <div className="bg-white/80 dark:bg-stone-900 backdrop-blur-md border border-white/60 dark:border-stone-700/50 rounded-2xl p-6 transition-all duration-300 hover:border-emerald-500/30">
            <div className="flex flex-col gap-1">
              <span className="text-[11px] text-slate-400 dark:text-stone-500 font-normal uppercase tracking-wider">Total Pagado</span>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-normal text-slate-800 dark:text-stone-100 font-display tracking-tight tabular-nums">
                  {fmtCurrency(animatedTotalPagado)}
                </span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mb-1.5" />
              </div>
            </div>
          </div>

          <div className="bg-white/80 dark:bg-stone-900 backdrop-blur-md border border-white/60 dark:border-stone-700/50 rounded-2xl p-6 transition-all duration-300 hover:border-amber-500/30">
            <div className="flex flex-col gap-1">
              <span className="text-[11px] text-slate-400 dark:text-stone-500 font-normal uppercase tracking-wider">Total Pendiente</span>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-normal text-amber-600 dark:text-amber-500 font-display tracking-tight tabular-nums">
                  {fmtCurrency(animatedTotalPendiente)}
                </span>
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mb-1.5" />
              </div>
            </div>
          </div>

          <div className="bg-white/80 dark:bg-stone-900 backdrop-blur-md border border-white/60 dark:border-stone-700/50 rounded-2xl p-6 transition-all duration-300">
            <div className="flex flex-col gap-1">
              <span className="text-[11px] text-slate-400 dark:text-stone-500 font-normal uppercase tracking-wider">Registros</span>
              <span className="text-2xl font-normal text-slate-800 dark:text-stone-100 font-display tracking-tight tabular-nums">
                {animatedRegistros}
              </span>
            </div>
          </div>

          <div className="bg-white/80 dark:bg-stone-900 backdrop-blur-md border border-white/60 dark:border-stone-700/50 rounded-2xl p-6 transition-all duration-300">
            <div className="flex flex-col gap-1">
              <span className="text-[11px] text-slate-400 dark:text-stone-500 font-normal uppercase tracking-wider">Pendientes</span>
              <div className="flex items-center gap-3">
                <span className={`text-2xl font-normal font-display tracking-tight tabular-nums ${pendientes > 0 ? 'text-amber-600' : 'text-emerald-500'}`}>
                  {animatedPendientes}
                </span>
                {pendientes > 0 && (
                  <span className="inline-flex items-center gap-1.5 text-[10px] font-normal text-amber-600 dark:text-amber-400 px-2 py-0.5 bg-amber-50 dark:bg-amber-900/20 rounded-full border border-amber-100 dark:border-amber-800/10">
                    <Clock size={10} />
                    Por abonar
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Contenido Principal / Tabla */}
      <div className="px-1">
        {loading ? (
          <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4 bg-white/40 dark:bg-stone-900/40 rounded-3xl border border-dashed border-stone-200 dark:border-stone-800">
            <Loader2 className="animate-spin text-orange-500" size={32} />
            <p className="text-slate-400 dark:text-stone-500 text-xs font-medium">Buscando registros financieros...</p>
          </div>
        ) : filteredPagos.length === 0 ? (
          <div className="bg-white/80 dark:bg-stone-900 backdrop-blur-md border border-dashed border-stone-200 dark:border-stone-700/50 rounded-3xl p-20 flex flex-col items-center gap-4 text-center soft-shadow">
            <div className="w-16 h-16 bg-stone-50 dark:bg-stone-800 rounded-2xl flex items-center justify-center text-slate-300 dark:text-stone-600">
              <Banknote size={32} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-700 dark:text-stone-200">No se encontraron pagos</h3>
              <p className="text-xs text-slate-400 dark:text-stone-500 mt-1 max-w-xs">
                Ajusta los filtros o el trabajador buscado para ver resultados diferentes.
              </p>
            </div>
          </div>
        ) : (
          <div className="bg-white/80 dark:bg-stone-900 backdrop-blur-md border border-white/60 dark:border-stone-700/50 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto overflow-y-hidden">
              <table className="w-full text-left border-collapse min-w-[900px]">
                <thead>
                  <tr className="border-b border-stone-100 dark:border-stone-800 bg-stone-50/30 dark:bg-stone-800/20">
                    <th className="px-10 py-5 text-xs font-normal text-slate-400 dark:text-stone-500">Trabajador</th>
                    <th className="px-10 py-5 text-xs font-normal text-slate-400 dark:text-stone-500">Detalles Contacto</th>
                    <th className="px-10 py-5 text-xs font-normal text-slate-400 dark:text-stone-500">Fecha / Concepto</th>
                    <th className="px-10 py-5 text-xs font-normal text-slate-400 dark:text-stone-500 text-right">Importe</th>
                    <th className="px-10 py-5 text-xs font-normal text-slate-400 dark:text-stone-500 text-center">Estado</th>
                    <th className="px-10 py-5 text-xs font-normal text-slate-400 dark:text-stone-500"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
                  {filteredPagos.map(pago => (
                    <tr key={pago.id} className="group hover:bg-stone-100/50 dark:hover:bg-stone-700/30 transition-colors">
                      <td className="px-10 py-5">
                        <div className="flex items-center gap-3">
                          <div className="w-7 h-7 rounded-full overflow-hidden shrink-0 bg-white dark:bg-stone-800 soft-shadow">
                            {photoMap[pago.workerName] ? (
                              <img src={photoMap[pago.workerName]} alt={pago.workerName} className="w-full h-full object-cover" />
                            ) : (
                              <span className="w-full h-full flex items-center justify-center text-xs font-normal text-slate-500 dark:text-stone-400">
                                {pago.workerName.charAt(0)}
                              </span>
                            )}
                          </div>
                          <div>
                            <span className="block text-sm font-normal text-slate-800 dark:text-stone-200">{pago.workerName}</span>
                            <span className="text-xs text-slate-400 dark:text-stone-500 font-mono tracking-tighter">{pago.dni}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-10 py-5">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-xs text-slate-500 dark:text-stone-400">{pago.telefono}</span>
                          <span className="text-xs text-slate-400 dark:text-stone-500 lowercase">{pago.email}</span>
                        </div>
                      </td>
                      <td className="px-10 py-5">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-xs text-slate-500 dark:text-stone-400">{fmtDate(pago.fecha)}</span>
                          <span className="text-xs text-slate-400 dark:text-stone-500">{pago.concepto}</span>
                        </div>
                      </td>
                      <td className="px-10 py-5 text-right">
                        <span className="text-xs text-slate-500 dark:text-stone-400 tabular-nums">
                          {fmtCurrency(pago.importe)}
                        </span>
                      </td>
                      <td className="px-10 py-5 text-center">
                        {pago.estado === 'pagado' ? (
                          <span className="inline-flex items-center gap-1.5 text-[11px] font-normal text-emerald-600 dark:text-emerald-400">
                            <div className="w-1 h-1 rounded-full bg-emerald-500" />
                            Pagado
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-[11px] font-normal text-amber-600 dark:text-amber-500">
                            <div className="w-1 h-1 rounded-full bg-amber-500" />
                            Pendiente
                          </span>
                        )}
                      </td>
                      <td className="px-10 py-5 text-right">
                        <button className="p-1 text-slate-400 dark:text-stone-500 hover:text-orange-500 transition-colors opacity-0 group-hover:opacity-100">
                          <ChevronRight size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-6 py-3 border-t border-stone-100 dark:border-stone-800/50 bg-stone-50/30 dark:bg-stone-900/30">
              <span className="text-[10px] text-slate-400 dark:text-stone-500">Mostrando {filteredPagos.length} registros</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Pagos;
