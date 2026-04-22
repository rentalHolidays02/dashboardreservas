import React, { useEffect, useState, useMemo } from 'react';
import type { User, Worker, NormalCleanRecord, InitialCleanRecord, HandymanRecord } from '../services/mockData';
import { appsScriptApi } from '../services/api';
import { computeCleanPay, computeHoursWorked, cleanPhone } from '../utils/payments';
import {
  Search,
  Calendar,
  Clock,
  ChevronRight,
  Info,
  Wrench,
  Home,
  Sparkles,
  Banknote,
  Filter,
  ChevronDown,
} from 'lucide-react';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { formatName } from '../utils/formatters';

interface WorkerRecordsProps {
  user: User;
}

type RecordType = 'Normal' | 'Inicial' | 'Manitas';

interface UnifiedRecord {
  id: string;
  type: RecordType;
  date: string;
  accommodation: string;
  kms: number;
  minutes?: number;
  hoursWorked: number;
  earnings: number;
  observations: string;
  horaEntrada?: string;
  horaSalida?: string;
}

/** Normaliza un nombre para comparación: minúsculas sin acentos */
const normName = (s: string) =>
  s.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

/** Matching por teléfono limpio (principal) o nombre (fallback) */
const matchRecord = (
  recordPhone: string,
  recordNombre: string,
  recordApellidos: string,
  userPhone: string | undefined,
  userName: string
): boolean => {
  const recPhone = cleanPhone(recordPhone);
  const usrPhone = cleanPhone(userPhone);

  // Prioridad 1: teléfono como ID exacto
  if (recPhone && usrPhone) return recPhone === usrPhone;

  // Fallback: nombre completo si no hay teléfono en la sesión
  const full = normName(`${recordNombre} ${recordApellidos}`);
  return normName(userName).split(/\s+/).every(part => full.includes(part));
};

const WorkerRecords: React.FC<WorkerRecordsProps> = ({ user }) => {
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<UnifiedRecord[]>([]);
  const [filterType, setFilterType] = useState<'all' | RecordType>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [workers, normal, initial, handyman] = await Promise.all([
          appsScriptApi.getWorkers(),
          appsScriptApi.getNormalCleans(),
          appsScriptApi.getInitialCleans(),
          appsScriptApi.getHandymanRecords(),
        ]);

        // Buscar al trabajador para obtener su tarifa (por teléfono primero, luego nombre)
        const workerData: Worker | undefined = workers.find(w => {
          const wPhone = cleanPhone(w.telefono);
          const uPhone = cleanPhone(user.telefono);
          if (wPhone && uPhone) return wPhone === uPhone;
          return normName(w.fullName).includes(normName(user.name).split(/\s+/)[0]);
        });
        const pagoPorReserva = workerData?.pagoPorReserva ?? 0;
        const precioPorKm = workerData?.precioPorKm ?? 0;

        const unified: UnifiedRecord[] = [
          ...normal
            .filter(r => matchRecord(r.telefono, r.nombre, r.apellidos, user.telefono, user.name))
            .map((r: NormalCleanRecord) => {
              const pay = computeCleanPay(r.apartamento, r.horaEntrada, r.horaSalida, pagoPorReserva);
              const kmPay = (r.km || 0) * precioPorKm;
              return {
                id: r.id,
                type: 'Normal' as RecordType,
                date: r.checkoutFecha || r.checkinFecha,
                accommodation: r.apartamento,
                kms: r.km || 0,
                hoursWorked: pay.hoursWorked,
                earnings: pay.base + pay.extraPay + kmPay,
                observations: r.observaciones || '',
                horaEntrada: r.horaEntrada,
                horaSalida: r.horaSalida,
              };
            }),
          ...initial
            .filter(r => matchRecord(r.telefono, r.nombre, r.apellidos, user.telefono, user.name))
            .map((r: InitialCleanRecord) => {
              const pay = computeCleanPay(r.apartamento, r.horaEntrada, r.horaSalida, pagoPorReserva);
              const kmPay = (r.km || 0) * precioPorKm;
              return {
                id: r.id,
                type: 'Inicial' as RecordType,
                date: r.checkoutFecha || r.checkinFecha,
                accommodation: r.apartamento,
                kms: r.km || 0,
                hoursWorked: pay.hoursWorked,
                earnings: pay.base + pay.extraPay + kmPay,
                observations: r.observaciones || '',
                horaEntrada: r.horaEntrada,
                horaSalida: r.horaSalida,
              };
            }),
          ...handyman
            .filter(r => matchRecord(r.telefono, r.nombre, r.apellidos, user.telefono, user.name))
            .map((r: HandymanRecord) => {
              const hrs = computeHoursWorked(r.horaInicioTarea, r.horaFinTarea);
              const kms = r.cantidadMinutos || 0;
              return {
                id: r.id,
                type: 'Manitas' as RecordType,
                date: r.fechaFin || r.fechaLlegada,
                accommodation: r.alojamiento,
                kms,
                minutes: r.cantidadMinutos || 0,
                hoursWorked: hrs,
                earnings: kms * precioPorKm,
                observations: r.observacionesTarea || '',
                horaEntrada: r.horaInicioTarea,
                horaSalida: r.horaFinTarea,
              };
            }),
        ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        setRecords(unified);
      } catch (error) {
        console.error('Error fetching records:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user]);

  const filteredRecords = useMemo(() => {
    return records.filter(r => {
      const matchesType = filterType === 'all' || r.type === filterType;
      const matchesSearch =
        r.accommodation.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.observations.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesType && matchesSearch;
    });
  }, [records, filterType, searchTerm]);

  // Totales del resumen
  const totals = useMemo(() => ({
    earnings: filteredRecords.reduce((s, r) => s + r.earnings, 0),
    hours: filteredRecords.reduce((s, r) => s + r.hoursWorked, 0),
    count: filteredRecords.length,
  }), [filteredRecords]);

  if (loading) {
    return <LoadingSpinner message="Cargando tu historial de registros..." />;
  }

  const typeConfig: Record<RecordType, { label: string; badge: string; icon: React.ComponentType<any> }> = {
    Normal:  { label: 'Normal',  badge: 'bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-400',       icon: Home },
    Inicial: { label: 'Inicial', badge: 'bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400', icon: Sparkles },
    Manitas: { label: 'Manitas', badge: 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400',    icon: Wrench },
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">

      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 px-1">
        <div>
          <h1 className="text-2xl font-normal text-slate-800 dark:text-stone-200 tracking-tight font-display">
            Mis Registros
          </h1>
          <p className="text-sm text-slate-400 dark:text-stone-500 font-light">
            {records.length > 0 ? `${records.length} servicios realizados en total` : 'Sin registros encontrados'}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 size-4 group-focus-within:text-orange-500 transition-colors" />
            <input
              type="text"
              placeholder="Buscar alojamiento..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2.5 bg-white/60 dark:bg-stone-900/40 backdrop-blur-md border border-white/60 dark:border-stone-800/50 rounded-xl text-xs text-slate-700 dark:text-stone-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 transition-all w-full sm:w-56"
            />
          </div>
          <div className="relative">
            <select
              value={filterType}
              onChange={e => setFilterType(e.target.value as RecordType | 'all')}
              className={`appearance-none flex items-center justify-center gap-2 pl-9 pr-8 py-2.5 bg-white dark:bg-stone-900 backdrop-blur-md border border-white/60 dark:border-stone-700/50 rounded-xl text-xs font-normal transition-all outline-none cursor-pointer shadow-sm ${
                filterType !== 'all' ? 'text-orange-600 dark:text-orange-400 font-medium bg-white/90 dark:bg-stone-800/90 shadow-md' : 'text-orange-500/80 dark:text-orange-500/70 hover:text-orange-500 dark:hover:text-orange-400 hover:bg-white/80 dark:hover:bg-stone-800/60'
              }`}
            >
              <option value="all">Tipo: Todos</option>
              <option value="Normal">Tipo: Normal</option>
              <option value="Inicial">Tipo: Inicial</option>
              <option value="Manitas">Tipo: Manitas</option>
            </select>
            <Filter size={12} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-orange-500 pointer-events-none" />
            <ChevronDown size={12} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-orange-500 pointer-events-none" />
            {filterType !== 'all' && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-orange-600 text-white text-[10px] flex items-center justify-center rounded-full animate-in zoom-in-50 border border-white/50">
                1
              </span>
            )}
          </div>
        </div>
      </header>

      {/* ── Resumen de totales ── */}
      {filteredRecords.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Servicios', value: totals.count, suffix: '' },
            { label: 'Horas totales', value: totals.hours.toFixed(1), suffix: 'h' },
            { label: 'Total generado', value: totals.earnings.toFixed(2), suffix: '€', highlight: true },
          ].map(stat => (
            <div
              key={stat.label}
              className={`bg-white/60 dark:bg-stone-900/40 backdrop-blur-md rounded-3xl border border-white/60 dark:border-stone-800/50 p-5 flex flex-col gap-1 ${
                stat.highlight ? 'border-orange-200/60 dark:border-orange-800/30' : ''
              }`}
            >
              <p className="text-[11px] font-medium text-slate-500 dark:text-stone-500">{stat.label}</p>
              <p className={`text-2xl font-medium font-display tabular-nums tracking-tight ${stat.highlight ? 'text-amber-600 dark:text-amber-400' : 'text-slate-800 dark:text-stone-100'}`}>
                {stat.value}<span className="text-sm font-normal ml-0.5 text-slate-400 dark:text-stone-500">{stat.suffix}</span>
              </p>
            </div>
          ))}
        </div>
      )}

      {/* ── ESCRITORIO: Tabla ── */}
      <div className="hidden lg:flex bg-white/80 dark:bg-stone-900 backdrop-blur-md border border-white/60 dark:border-stone-700/50 rounded-2xl overflow-hidden flex-col">
        <div className="grid grid-cols-[1.5fr_1fr_2fr_1fr_1fr_1.5fr_2fr] gap-4 px-8 py-6 border-b border-stone-100 dark:border-stone-800">
           {['Fecha', 'Tipo', 'Alojamiento', 'Horas', 'KM', 'Generado', 'Notas'].map(col => (
             <span key={col} className="text-xs text-slate-400 dark:text-stone-500">
               {col}
             </span>
           ))}
        </div>
        
        <ul className="divide-y divide-stone-100 dark:divide-stone-800 flex-1 overflow-y-auto">
          {filteredRecords.length === 0 ? (
            <li className="flex items-center justify-center py-16">
              <span className="text-slate-400 dark:text-stone-500 text-sm">
                No se encontraron registros
              </span>
            </li>
          ) : (
            filteredRecords.map(record => {
              const cfg = typeConfig[record.type];
              return (
                <li
                  key={record.id}
                  className="group module-item grid grid-cols-[1.5fr_1fr_2fr_1fr_1fr_1.5fr_2fr] gap-4 px-8 py-4 items-center transition-colors hover:bg-stone-100/50 dark:hover:bg-stone-700/30"
                >
                  {/* Fecha */}
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm text-slate-800 dark:text-stone-200 truncate">
                      {record.date
                        ? new Date(record.date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
                        : '—'}
                    </span>
                    {record.horaEntrada && record.horaSalida && (
                      <span className="text-[10px] text-slate-400 tabular-nums truncate">{record.horaEntrada} – {record.horaSalida}</span>
                    )}
                  </div>
                  
                  <div className="min-w-0">
                    <span className={`inline-block px-2.5 py-1 rounded-md text-[10px] font-medium truncate max-w-full ${cfg.badge}`}>
                      {cfg.label}
                    </span>
                  </div>
                  
                  {/* Alojamiento */}
                  <p className="text-sm text-slate-800 dark:text-stone-200 truncate">
                    {record.accommodation ? formatName(record.accommodation) : '—'}
                  </p>
                  
                  {/* Horas */}
                  <p className="text-xs text-slate-500 dark:text-stone-400 tabular-nums truncate">
                    {record.hoursWorked > 0 ? `${record.hoursWorked.toFixed(1)}h` : '—'}
                  </p>
                  
                  {/* KM */}
                  <p className="text-xs text-slate-500 dark:text-stone-400 tabular-nums truncate">
                    {record.kms > 0 ? `${record.kms} km` : '—'}
                  </p>
                  
                  {/* Generado */}
                  <p className={`text-xs tabular-nums truncate ${record.earnings > 0 ? 'text-amber-600 dark:text-amber-400 font-medium' : 'text-slate-500 dark:text-stone-400'}`}>
                    {record.earnings > 0 ? `${record.earnings.toFixed(2)}€` : '—'}
                  </p>
                  
                  {/* Notas */}
                  <p className="text-xs text-slate-500 dark:text-stone-400 truncate" title={record.observations}>
                    {record.observations || <span className="opacity-40 italic">—</span>}
                  </p>
                </li>
              );
            })
          )}
        </ul>
      </div>

      {/* ── MÓVIL: Tarjetas ── */}
      <div className="lg:hidden space-y-3">
        {filteredRecords.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-16 bg-white/40 dark:bg-stone-900/40 backdrop-blur-md rounded-[32px] border border-slate-200 dark:border-stone-800">
            <Search size={32} className="text-slate-300 dark:text-stone-600 mb-4" />
            <p className="text-slate-500 dark:text-stone-400 font-medium">No se encontraron registros</p>
            <p className="text-xs text-slate-400 dark:text-stone-500 mt-1">Prueba a cambiar los filtros o el término de búsqueda.</p>
          </div>
        ) : (
          filteredRecords.map(record => {
            const cfg = typeConfig[record.type];
            const TypeIcon = cfg.icon;
            const isExpanded = expandedId === record.id;
            return (
              <div
                key={record.id}
                onClick={() => setExpandedId(isExpanded ? null : record.id)}
                className={`bg-white/80 dark:bg-stone-900/60 backdrop-blur-md rounded-3xl border border-white/60 dark:border-stone-800/50 overflow-hidden transition-all duration-300 ${
                  isExpanded ? 'ring-2 ring-orange-500/20 shadow-xl' : 'shadow-sm active:scale-[0.98]'
                }`}
              >
                {/* Card header */}
                <div className="p-5 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4 min-w-0">
                    {/* Fecha box */}
                    <div className="flex flex-col items-center justify-center w-12 h-12 rounded-2xl bg-stone-50 dark:bg-stone-800 shrink-0 border border-stone-100 dark:border-stone-800">
                      <span className="text-[9px] font-bold text-slate-400 uppercase leading-none mb-1">
                        {record.date ? new Date(record.date).toLocaleDateString('es-ES', { month: 'short' }) : '—'}
                      </span>
                      <span className="text-base font-bold text-slate-800 dark:text-stone-200">
                        {record.date ? new Date(record.date).getDate() : '—'}
                      </span>
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <TypeIcon size={11} className="shrink-0 text-slate-400" />
                        <span className={`px-2 py-0.5 rounded text-[9px] font-medium ${cfg.badge}`}>
                          {cfg.label}
                        </span>
                        {record.earnings > 0 && (
                          <span className="flex items-center gap-0.5 text-[10px] font-bold text-orange-600 dark:text-orange-400 ml-1">
                            <Banknote size={10} />
                            {record.earnings.toFixed(2)}€
                          </span>
                        )}
                      </div>
                      <h3 className="text-sm font-medium text-slate-800 dark:text-stone-100 truncate">
                        {record.accommodation ? formatName(record.accommodation) : '—'}
                      </h3>
                      {record.horaEntrada && record.horaSalida && (
                        <p className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                          <Clock size={9} />
                          {record.horaEntrada} – {record.horaSalida}
                          {record.hoursWorked > 0 && ` (${record.hoursWorked.toFixed(1)}h)`}
                        </p>
                      )}
                    </div>
                  </div>

                  <ChevronRight
                    size={20}
                    className={`text-slate-300 shrink-0 transition-transform duration-300 ${isExpanded ? 'rotate-90 text-orange-500' : ''}`}
                  />
                </div>

                {/* Detalle expandible */}
                <div className={`px-5 overflow-hidden transition-all duration-300 ease-in-out ${isExpanded ? 'max-h-80 pb-5 border-t border-slate-50 dark:border-stone-800/40 pt-4' : 'max-h-0'}`}>
                  <div className="grid grid-cols-3 gap-3 mb-3">
                    <div className="bg-stone-50/50 dark:bg-stone-800/30 p-3 rounded-2xl">
                      <p className="text-[9px] uppercase font-bold tracking-wider text-slate-400 mb-1">Generado</p>
                      <p className="text-xs font-bold text-orange-600 dark:text-orange-400">
                        {record.earnings > 0 ? `${record.earnings.toFixed(2)}€` : '—'}
                      </p>
                    </div>
                    <div className="bg-stone-50/50 dark:bg-stone-800/30 p-3 rounded-2xl">
                      <p className="text-[9px] uppercase font-bold tracking-wider text-slate-400 mb-1">Horas</p>
                      <p className="text-xs font-semibold text-slate-700 dark:text-stone-200">
                        {record.hoursWorked > 0 ? `${record.hoursWorked.toFixed(1)}h` : '—'}
                      </p>
                    </div>
                    <div className="bg-stone-50/50 dark:bg-stone-800/30 p-3 rounded-2xl">
                      <p className="text-[9px] uppercase font-bold tracking-wider text-slate-400 mb-1">
                        {record.type === 'Manitas' ? 'Min' : 'KM'}
                      </p>
                      <p className="text-xs font-semibold text-slate-700 dark:text-stone-200">
                        {record.type === 'Manitas'
                          ? record.minutes ? `${record.minutes}` : '—'
                          : record.kms ? `${record.kms}` : '—'}
                      </p>
                    </div>
                  </div>

                  {record.observations && (
                    <div className="bg-orange-50/30 dark:bg-orange-900/10 p-4 rounded-2xl border border-orange-100/30 dark:border-orange-800/20">
                      <div className="flex items-center gap-1.5 mb-2 text-orange-600 dark:text-orange-400">
                        <Info size={12} />
                        <span className="text-[9px] uppercase font-bold tracking-wider">Observaciones</span>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-stone-400 italic font-light leading-relaxed">
                        "{record.observations}"
                      </p>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default WorkerRecords;
