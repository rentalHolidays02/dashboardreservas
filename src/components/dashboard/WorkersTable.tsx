import React, { useState, useMemo } from 'react';
import { Pencil, Search, SlidersHorizontal, Info, X } from 'lucide-react';
import { Worker } from '../../services/mockData';

interface WorkersTableProps {
  workers: Worker[];
  selectedWorker?: Worker | null;
  onWorkerSelect?: (w: Worker | null) => void;
}

const COL_WORKERS = 'grid-cols-[1.8fr_1.2fr_1fr_1fr_0.8fr_140px]';

type SortKey = 'none' | 'net_asc' | 'net_desc' | 'cleans_desc' | 'kms_desc';

const AccommodationTags: React.FC<{ items: string[] }> = ({ items }) => {
  const visible = items.slice(0, 1);
  const extra = items.length - 1;
  return (
    <div className="flex items-center gap-1.5">
      {visible.map((a) => (
        <span key={a} className="inline-block bg-white text-slate-500 text-[11px] px-2.5 py-1 rounded-md max-w-[120px] truncate soft-shadow">
          {a}
        </span>
      ))}
      {extra > 0 && (
        <span className="inline-block bg-white text-slate-400 text-[11px] px-2 py-1 rounded-md flex-shrink-0 soft-shadow">
          +{extra}
        </span>
      )}
    </div>
  );
};

const WorkersTable: React.FC<WorkersTableProps> = ({ workers, selectedWorker, onWorkerSelect }) => {
  const [query, setQuery]               = useState('');
  const [accommodation, setAccommodation] = useState('');
  const [sort, setSort]                 = useState<SortKey>('none');


  const allAccommodations = useMemo(() =>
    Array.from(new Set(workers.flatMap(w => w.accommodations))).sort(),
    [workers]
  );

  const filtered = useMemo(() => {
    let result = workers;

    if (query.trim())
      result = result.filter(w =>
        w.fullName.toLowerCase().includes(query.toLowerCase())
      );

    if (accommodation)
      result = result.filter(w => w.accommodations.includes(accommodation));

    if (sort === 'net_asc')     result = [...result].sort((a, b) => a.netMoneyMonth - b.netMoneyMonth);
    if (sort === 'net_desc')    result = [...result].sort((a, b) => b.netMoneyMonth - a.netMoneyMonth);
    if (sort === 'cleans_desc') result = [...result].sort((a, b) => b.cleansCountMonth - a.cleansCountMonth);
    if (sort === 'kms_desc')    result = [...result].sort((a, b) => b.kmsMonth - a.kmsMonth);

    return result;
  }, [workers, query, accommodation, sort]);

  const hasFilters = query || accommodation || sort !== 'none';

  const handleRowClick = (worker: Worker) => {
    onWorkerSelect?.(selectedWorker?.id === worker.id ? null : worker);
  };

return (
    <div className="flex flex-col animate-in fade-in slide-in-from-bottom-2 duration-700">
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-normal font-display tracking-tight text-slate-800">Listado de Trabajadores</h3>
          {selectedWorker && (
            <span className="inline-flex items-center gap-1.5 text-xs bg-orange-50 text-orange-600 border border-orange-100 rounded-md px-2 py-0.5">
              {selectedWorker.fullName}
              <button onClick={() => onWorkerSelect?.(null)} className="hover:text-orange-800 transition-colors">
                <X size={10} />
              </button>
            </span>
          )}
        </div>

        {/* Barra de filtros */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Buscar nombre..."
              className="pl-8 pr-3 py-1.5 w-44 text-xs text-slate-700 bg-white/60 border border-white rounded-lg outline-none focus:bg-white focus:border-white transition-all placeholder:text-slate-400"
            />
          </div>

          <div className="relative">
            <select
              value={accommodation}
              onChange={e => setAccommodation(e.target.value)}
              className="appearance-none pl-3 pr-7 py-1.5 text-xs text-slate-600 bg-white/60 border border-white rounded-lg outline-none focus:bg-white focus:border-white transition-all cursor-pointer"
            >
              <option value="">Todos los alojamientos</option>
              {allAccommodations.map(a => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
            <SlidersHorizontal size={11} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>

          <div className="relative">
            <select
              value={sort}
              onChange={e => setSort(e.target.value as SortKey)}
              className="appearance-none pl-3 pr-7 py-1.5 text-xs text-slate-600 bg-white border border-slate-200 rounded-lg outline-none focus:border-slate-400 transition-colors cursor-pointer"
            >
              <option value="none">Ordenar por...</option>
              <option value="net_desc">Mayor dinero neto</option>
              <option value="net_asc">Menor dinero neto</option>
              <option value="cleans_desc">Más limpiezas</option>
              <option value="kms_desc">Más kilómetros</option>
            </select>
            <SlidersHorizontal size={11} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>

          {hasFilters && (
            <button
              onClick={() => { setQuery(''); setAccommodation(''); setSort('none'); }}
              className="text-[11px] text-slate-400 hover:text-slate-600 transition-colors px-1"
            >
              Limpiar
            </button>
          )}
        </div>
      </div>

      <div className="bg-white/80 backdrop-blur-md border border-white/60 rounded-2xl overflow-hidden flex flex-col">
        <div className={`grid ${COL_WORKERS} gap-4 px-6 py-3 border-b border-white/40`}>
          <span className="text-xs text-slate-400">Nombre</span>
          <span className="text-xs text-slate-400">Alojamientos</span>
          <span className="text-xs text-slate-400">Dinero Neto</span>
          <span className="text-xs text-slate-400">Limpiezas</span>
          <span className="text-xs text-slate-400">Kms</span>
          <span />
        </div>

        <ul className="divide-y divide-white/60">
          {filtered.length === 0 ? (
            <li className="module-item flex items-center justify-center">
              <span className="text-xs text-slate-400">Sin resultados</span>
            </li>
          ) : filtered.map((worker) => {
            const isSelected = selectedWorker?.id === worker.id;

            return (
              <React.Fragment key={worker.id}>
                <li
                  onClick={() => handleRowClick(worker)}
                  className={`group module-item grid ${COL_WORKERS} gap-4 items-center cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-orange-50/40 hover:bg-orange-50/60'
                      : 'hover:bg-orange-50/40'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-normal flex-shrink-0 transition-colors soft-shadow ${
                      isSelected
                        ? 'bg-orange-100 text-orange-600 border-none'
                        : 'bg-white text-slate-500 border-none'
                    }`}>
                      {worker.fullName.charAt(0)}
                    </div>
                    <p className={`text-sm truncate transition-colors ${isSelected ? 'text-orange-700 font-medium' : 'text-slate-800'}`}>
                      {worker.fullName}
                    </p>
                  </div>

                  <AccommodationTags items={worker.accommodations} />

                  <p className="text-xs text-slate-500 tabular-nums">
                    {worker.netMoneyMonth.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                  </p>

                  <p className="text-xs text-slate-500 tabular-nums">{worker.cleansCountMonth}</p>

                  <p className="text-xs text-slate-500 tabular-nums">
                    {worker.kmsMonth} <span className="text-slate-400">km</span>
                  </p>

                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={e => e.stopPropagation()}
                      className="opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex items-center gap-1.5 text-[11px] font-bold text-slate-600 hover:text-orange-600 bg-white backdrop-blur-sm px-2.5 py-1.5 rounded-lg soft-shadow"
                    >
                      <Info size={12} />
                      Info
                    </button>
                    <button
                      onClick={e => e.stopPropagation()}
                      className="opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex items-center gap-1.5 text-[11px] font-bold text-slate-600 hover:text-slate-900 bg-white backdrop-blur-sm px-2.5 py-1.5 rounded-lg soft-shadow"
                    >
                      <Pencil size={12} />
                      Editar
                    </button>
                  </div>
                </li>

                {/* Fila de datos personales expandida */}
              </React.Fragment>
            );
          })}
        </ul>
      </div>

      <div className="px-1 mt-2">
        <span className="text-xs text-slate-400">{filtered.length} de {workers.length} trabajadores</span>
      </div>
    </div>
  );
};

export default WorkersTable;
