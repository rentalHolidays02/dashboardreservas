import React, { useState, useMemo } from 'react';
import { Pencil, Search, SlidersHorizontal } from 'lucide-react';
import { Worker } from '../../services/mockData';

interface WorkersTableProps {
  workers: Worker[];
}

const COL_WORKERS = 'grid-cols-[1.8fr_1.2fr_1fr_1fr_0.8fr_44px]';

type SortKey = 'none' | 'net_asc' | 'net_desc' | 'cleans_desc' | 'kms_desc';

const AccommodationTags: React.FC<{ items: string[] }> = ({ items }) => {
  const visible = items.slice(0, 1);
  const extra = items.length - 1;
  return (
    <div className="flex items-center gap-1.5">
      {visible.map((a) => (
        <span key={a} className="inline-block bg-slate-100 text-slate-500 text-[11px] px-2 py-0.5 rounded-md truncate max-w-[120px]">
          {a}
        </span>
      ))}
      {extra > 0 && (
        <span className="inline-block bg-slate-100 text-slate-400 text-[11px] px-2 py-0.5 rounded-md flex-shrink-0">
          +{extra}
        </span>
      )}
    </div>
  );
};

const WorkersTable: React.FC<WorkersTableProps> = ({ workers }) => {
  const [query, setQuery]           = useState('');
  const [accommodation, setAccommodation] = useState('');
  const [sort, setSort]             = useState<SortKey>('none');

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

    if (sort === 'net_asc')   result = [...result].sort((a, b) => a.netMoneyMonth - b.netMoneyMonth);
    if (sort === 'net_desc')  result = [...result].sort((a, b) => b.netMoneyMonth - a.netMoneyMonth);
    if (sort === 'cleans_desc') result = [...result].sort((a, b) => b.cleansCountMonth - a.cleansCountMonth);
    if (sort === 'kms_desc')  result = [...result].sort((a, b) => b.kmsMonth - a.kmsMonth);

    return result;
  }, [workers, query, accommodation, sort]);

  const hasFilters = query || accommodation || sort !== 'none';

  return (
    <div className="flex flex-col animate-in fade-in slide-in-from-bottom-2 duration-700">
      <div className="flex items-center justify-between mb-3 px-1">
        <h3 className="text-base font-medium font-display tracking-tight text-slate-800">Listado de Trabajadores</h3>

        {/* Barra de filtros */}
        <div className="flex items-center gap-2">
        {/* Búsqueda */}
        <div className="relative">
          <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Buscar nombre..."
            className="pl-8 pr-3 py-1.5 w-44 text-xs text-slate-700 bg-white border border-slate-200 rounded-lg outline-none focus:border-slate-400 transition-colors placeholder:text-slate-300"
          />
        </div>

        {/* Alojamiento */}
        <div className="relative">
          <select
            value={accommodation}
            onChange={e => setAccommodation(e.target.value)}
            className="appearance-none pl-3 pr-7 py-1.5 text-xs text-slate-600 bg-white border border-slate-200 rounded-lg outline-none focus:border-slate-400 transition-colors cursor-pointer"
          >
            <option value="">Todos los alojamientos</option>
            {allAccommodations.map(a => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
          <SlidersHorizontal size={11} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        </div>

        {/* Ordenar */}
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

        {/* Limpiar filtros */}
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

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden flex flex-col">
        <div className={`grid ${COL_WORKERS} gap-4 px-6 py-3 border-b border-slate-100`}>
          <span className="text-xs text-slate-400">Nombre</span>
          <span className="text-xs text-slate-400">Alojamientos</span>
          <span className="text-xs text-slate-400">Dinero Neto</span>
          <span className="text-xs text-slate-400">Limpiezas</span>
          <span className="text-xs text-slate-400">Kms</span>
          <span />
        </div>

        <ul className="divide-y divide-slate-50">
          {filtered.length === 0 ? (
            <li className="module-item flex items-center justify-center">
              <span className="text-xs text-slate-400">Sin resultados</span>
            </li>
          ) : filtered.map((worker) => (
            <li key={worker.id} className={`group module-item grid ${COL_WORKERS} gap-4 items-center`}>
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 text-xs font-semibold border border-slate-200 flex-shrink-0">
                  {worker.fullName.charAt(0)}
                </div>
                <p className="text-sm text-slate-800 truncate">{worker.fullName}</p>
              </div>

              <AccommodationTags items={worker.accommodations} />

              <p className="text-xs text-slate-500 tabular-nums">
                {worker.netMoneyMonth.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
              </p>

              <p className="text-xs text-slate-500 tabular-nums">{worker.cleansCountMonth}</p>

              <p className="text-xs text-slate-500 tabular-nums">
                {worker.kmsMonth} <span className="text-slate-400">km</span>
              </p>

              <div className="flex justify-center">
                <button
                  onClick={() => console.log('Edit worker', worker.id)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity duration-150 text-slate-400 hover:text-slate-700"
                  title="Editar trabajador"
                >
                  <Pencil size={13} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="px-1 mt-2">
        <span className="text-xs text-slate-400">{filtered.length} de {workers.length} trabajadores</span>
      </div>
    </div>
  );
};

export default WorkersTable;
