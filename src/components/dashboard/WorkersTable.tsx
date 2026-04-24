import React, { useState, useMemo } from 'react';
import { Pencil, Search, SlidersHorizontal, Info, X, AlertTriangle } from 'lucide-react';
import { Worker } from '../../services/mockData';
import { formatName } from '../../utils/formatters';

import { User } from '../../services/mockData';

interface WorkersTableProps {
  workers: Worker[];
  selectedWorker?: Worker | null;
  onWorkerSelect?: (w: Worker | null) => void;
  userRole?: User['role'];
}

const COL_WORKERS = 'grid-cols-[2fr_1.5fr_1fr_1fr_1fr_80px]';

type SortKey = 'none' | 'owed_asc' | 'owed_desc' | 'cleans_desc' | 'kms_desc';

const AccommodationTags: React.FC<{ items: string[] }> = ({ items }) => {
  if (!items || items.length === 0) {
    return (
      <span className="text-[11px] text-slate-400 dark:text-stone-500 italic">
        Ninguno
      </span>
    );
  }
  const visible = items.slice(0, 1);
  const extra = items.length - 1;
  return (
    <div className="flex items-center gap-1.5">
      {visible.map((a) => (
        <span key={a} className="inline-block bg-white dark:bg-stone-800 text-slate-500 dark:text-stone-400 text-[11px] px-2.5 py-1 rounded-md max-w-[160px] truncate soft-shadow">
          {a}
        </span>
      ))}
      {extra > 0 && (
        <span className="inline-block bg-white dark:bg-stone-800 text-slate-400 dark:text-stone-500 text-[11px] px-2 py-1 rounded-md flex-shrink-0 soft-shadow">
          +{extra}
        </span>
      )}
    </div>
  );
};

const WorkersTable: React.FC<WorkersTableProps> = ({ workers, selectedWorker, onWorkerSelect, userRole }) => {
  const isReadOnly = userRole === 'viewer';
  const [query, setQuery]               = useState('');
  const [accommodation, setAccommodation] = useState('');
  const [sort, setSort]                 = useState<SortKey>('owed_desc');

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

    if (sort === 'owed_asc')    result = [...result].sort((a, b) => a.owedMoney - b.owedMoney);
    if (sort === 'owed_desc')   result = [...result].sort((a, b) => b.owedMoney - a.owedMoney);
    if (sort === 'cleans_desc') result = [...result].sort((a, b) => b.cleansCountMonth - a.cleansCountMonth);
    if (sort === 'kms_desc')    result = [...result].sort((a, b) => b.kmsMonth - a.kmsMonth);

    return result;
  }, [workers, query, accommodation, sort]);

  const hasFilters = query || accommodation || sort !== 'owed_desc';

  const handleRowClick = (worker: Worker) => {
    onWorkerSelect?.(selectedWorker?.id === worker.id ? null : worker);
  };

  return (
    <div className="flex flex-col animate-in fade-in slide-in-from-bottom-2 duration-700">
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-normal font-display tracking-tight text-slate-800 dark:text-stone-200">Listado de Trabajadores</h3>
          {selectedWorker && (
            <span className="inline-flex items-center gap-1.5 text-xs bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 border border-orange-100 dark:border-orange-800/50 rounded-md px-2 py-0.5">
              {formatName(selectedWorker.fullName)}
              <button onClick={() => onWorkerSelect?.(null)} className="hover:text-orange-800 dark:hover:text-orange-300 transition-colors">
                <X size={10} />
              </button>
            </span>
          )}
        </div>

        {/* Barra de filtros */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-stone-500 pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Buscar nombre..."
              className="pl-8 pr-3 py-1.5 w-44 text-xs text-slate-700 dark:text-stone-300 bg-white/80 dark:bg-stone-900 border border-white/60 dark:border-stone-700/50 rounded-lg outline-none focus:bg-white dark:focus:bg-stone-900 focus:border-stone-100 dark:focus:border-stone-600 transition-all placeholder:text-stone-400 dark:placeholder:text-stone-400"
            />
          </div>

          <div className="relative">
            <select
              value={accommodation}
              onChange={e => setAccommodation(e.target.value)}
              className="appearance-none pl-3 pr-7 py-1.5 text-xs text-slate-600 dark:text-stone-400 bg-white/80 dark:bg-stone-900 border border-white/60 dark:border-stone-700/50 rounded-lg outline-none focus:bg-white dark:focus:bg-stone-900 focus:border-stone-100 dark:focus:border-stone-600 transition-all cursor-pointer"
            >
              <option value="">Todos los alojamientos</option>
              {allAccommodations.map(a => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
            <SlidersHorizontal size={11} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-stone-500 pointer-events-none" />
          </div>

          <div className="relative">
            <select
              value={sort}
              onChange={e => setSort(e.target.value as SortKey)}
              className="appearance-none pl-3 pr-7 py-1.5 text-xs text-slate-600 dark:text-stone-400 bg-white/80 dark:bg-stone-900 border border-white/60 dark:border-stone-700/50 rounded-lg outline-none focus:bg-white dark:focus:bg-stone-900 focus:border-stone-100 dark:focus:border-stone-600 transition-colors cursor-pointer"
            >
              <option value="none">Ordenar por...</option>
              <option value="owed_desc">Mayor dinero debido</option>
              <option value="owed_asc">Menor dinero debido</option>
              <option value="cleans_desc">Más limpiezas</option>
              <option value="kms_desc">Más kilómetros</option>
            </select>
            <SlidersHorizontal size={11} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-stone-500 pointer-events-none" />
          </div>

          {hasFilters && (
            <button
              onClick={() => { setQuery(''); setAccommodation(''); setSort('owed_desc'); }}
              className="text-[11px] text-slate-400 dark:text-stone-500 hover:text-slate-600 dark:hover:text-stone-300 transition-colors px-1"
            >
              Limpiar
            </button>
          )}
        </div>
      </div>

      <div className="bg-white/80 dark:bg-stone-900 backdrop-blur-md border border-white/60 dark:border-stone-700/50 rounded-2xl overflow-hidden flex flex-col">
        <div className={`grid ${COL_WORKERS} gap-4 px-8 py-6 border-b border-stone-100 dark:border-stone-800`}>
          <span className="text-xs text-slate-400 dark:text-stone-500">Nombre</span>
          <span className="text-xs text-slate-400 dark:text-stone-500">Alojamientos</span>
          <span className="text-xs text-slate-400 dark:text-stone-500">Dinero</span>
          <span className="text-xs text-slate-400 dark:text-stone-500">Limpiezas</span>
          <span className="text-xs text-slate-400 dark:text-stone-500">Kms</span>
          <span />
        </div>

        <ul className="divide-y divide-stone-100 dark:divide-stone-800">
          {filtered.length === 0 ? (
            <li className="module-item flex items-center justify-center">
              <span className="text-xs text-slate-400 dark:text-stone-500">Sin resultados</span>
            </li>
          ) : filtered.map((worker) => {
            const isSelected = selectedWorker?.id === worker.id;
            const formattedName = formatName(worker.fullName);

            return (
              <React.Fragment key={worker.id}>
                <li
                  onClick={() => handleRowClick(worker)}
                  className={`group module-item grid ${COL_WORKERS} gap-4 items-center cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-stone-100/70 dark:bg-stone-700/40 hover:bg-stone-100/90 dark:hover:bg-stone-700/60'
                      : 'hover:bg-stone-100/50 dark:hover:bg-stone-700/30'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-7 h-7 rounded-full flex-shrink-0 overflow-hidden transition-colors soft-shadow bg-white dark:bg-stone-800">
                      {worker.photo ? (
                        <img src={worker.photo} alt={formattedName} className="w-full h-full object-cover" />
                      ) : (
                        <span className="w-full h-full flex items-center justify-center text-xs font-normal text-slate-500 dark:text-stone-400">
                          {formattedName.charAt(0)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 min-w-0">
                      <p className={`text-sm truncate transition-colors ${isSelected ? 'text-orange-500' : 'text-slate-800 dark:text-stone-200'}`}>
                        {formattedName}
                      </p>
                      {!worker.profileId && (
                        <div className="group/tooltip relative">
                          <AlertTriangle 
                            size={12} 
                            className="text-amber-500 cursor-help flex-shrink-0" 
                          />
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-slate-800 text-white text-[10px] rounded opacity-0 group-hover/tooltip:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                            Sin cuenta de usuario
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <AccommodationTags items={worker.accommodations} />

                  <p className={`text-xs tabular-nums ${worker.owedMoney > 0 ? 'text-amber-600 dark:text-amber-400 font-medium' : 'text-slate-500 dark:text-stone-400'}`}>
                    {worker.owedMoney.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                  </p>

                  <p className="text-xs text-slate-500 dark:text-stone-400 tabular-nums">{worker.cleansCountMonth}</p>

                  <p className="text-xs text-slate-500 dark:text-stone-400 tabular-nums">
                    {worker.kmsMonth} <span className="text-slate-400 dark:text-stone-500">km</span>
                  </p>

                  <div className="flex items-center justify-end gap-3 pr-2">
                    <button
                      onClick={e => e.stopPropagation()}
                      className="opacity-0 group-hover:opacity-100 transition-all duration-200 text-orange-500 p-1 rounded-md"
                      title="Información"
                    >
                      <Info size={16} />
                    </button>
                    {!isReadOnly && (
                      <button
                        onClick={e => e.stopPropagation()}
                        className="opacity-0 group-hover:opacity-100 transition-all duration-200 text-orange-500 p-1 rounded-md"
                        title="Editar"
                      >
                        <Pencil size={16} />
                      </button>
                    )}
                  </div>
                </li>
              </React.Fragment>
            );
          })}
        </ul>
      </div>

      <div className="px-1 mt-2">
        <span className="text-xs text-slate-400 dark:text-stone-500">{filtered.length} de {workers.length} trabajadores</span>
      </div>
    </div>
  );
};

export default WorkersTable;
