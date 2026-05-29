import React, { useEffect, useState, useMemo } from 'react';
import type { User, Worker, NormalCleanRecord, InitialCleanRecord, HandymanRecord, Incidencia, EntregaLlaves } from '../services/mockData';
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
  CheckCircle2,
  AlertTriangle,
  Key,
} from 'lucide-react';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { formatName } from '../utils/formatters';
import WorkerRecordsFilterModal, { WorkerRecordsFilters } from '../components/workers/WorkerRecordsFilterModal';
import { useAnimatedNumber } from '../hooks/useAnimatedNumber';

interface WorkerPanelProps {
  user: User;
}

type RecordType = 'Normal' | 'Inicial' | 'Manitas' | 'Incidencia' | 'Llaves';

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
  checked?: boolean;
  // Campos extra para Incidencias
  description?: string;
  coste?: number;
  pagadoPor?: string;
  // Campos extra para Entrega de Llaves
  nombreCliente?: string;
  fechaEntrada?: string;
  fechaSalida?: string;
}

const normName = (s: string) =>
  s.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

const matchRecord = (
  recordPhone: string,
  recordNombre: string,
  recordApellidos: string,
  userPhone: string | undefined,
  userName: string
): boolean => {
  const recPhone = cleanPhone(recordPhone);
  const usrPhone = cleanPhone(userPhone);

  if (recPhone && usrPhone) return recPhone === usrPhone;

  const full = normName(`${recordNombre} ${recordApellidos}`);
  return normName(userName).split(/\s+/).every(part => full.includes(part));
};

const WorkerPanel: React.FC<WorkerPanelProps> = ({ user }) => {
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<UnifiedRecord[]>([]);
  const [workerData, setWorkerData] = useState<Worker | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [filters, setFilters] = useState<WorkerRecordsFilters>({
    startDate: '',
    endDate: '',
    type: 'all'
  });

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [workers, normal, initial, handyman, incidencias, llaves] = await Promise.all([
          appsScriptApi.getWorkers(),
          appsScriptApi.getNormalCleans(),
          appsScriptApi.getInitialCleans(),
          appsScriptApi.getHandymanRecords(),
          appsScriptApi.getRecentIncidencias(200).catch(() => [] as Incidencia[]),
          appsScriptApi.getEntregaLlaves().catch(() => [] as EntregaLlaves[]),
        ]);

        const worker: Worker | undefined = workers.find(w => {
          const wPhone = cleanPhone(w.telefono);
          const uPhone = cleanPhone(user.telefono);
          if (wPhone && uPhone) return wPhone === uPhone;
          return normName(w.fullName).includes(normName(user.name).split(/\s+/)[0]);
        });
        
        if (worker) setWorkerData(worker);

        const pagoPorReserva = worker?.pagoPorReserva ?? 0;
        const precioPorKm = worker?.precioPorKm ?? 0;

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
                checked: r.checked,
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
                checked: r.checked,
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
          ...incidencias
            .filter(r => matchRecord(
              r.telefono || '',
              r.nombre || '',
              r.apellidos || '',
              user.telefono,
              user.name
            ))
            .map((r: Incidencia) => {
              // Calcular horas si hay paradaInicial y paradaFinal o paradas con hora
              let calculatedHours = 0;
              const extractTime = (stopStr?: string): string | null => {
                if (!stopStr) return null;
                const m = stopStr.match(/\((\d{1,2}:\d{2})\)/);
                return m ? m[1] : null;
              };
              const tIni = extractTime(r.paradaInicial);
              const tFin = extractTime(r.paradaFinal);
              if (tIni && tFin) {
                calculatedHours = computeHoursWorked(tIni, tFin);
              }

              return {
                id: r.id,
                type: 'Incidencia' as RecordType,
                date: r.timestamp || new Date().toISOString(),
                accommodation: r.accommodationName,
                kms: r.kms || 0,
                hoursWorked: calculatedHours,
                earnings: 0,
                observations: r.observaciones || '',
                checked: r.checked,
                description: r.description,
                coste: r.coste,
                pagadoPor: r.pagadoPor,
                horaEntrada: tIni || undefined,
                horaSalida: tFin || undefined,
              };
            }),
          ...llaves
            .filter(r => matchRecord(r.telefono, r.nombre, r.apellidos, user.telefono, user.name))
            .map((r: EntregaLlaves) => {
              return {
                id: r.id,
                type: 'Llaves' as RecordType,
                date: r.fechaEntradaReserva || r.fechaUbicacionEntrega || new Date().toISOString(),
                accommodation: r.apartamento,
                kms: r.km || 0,
                hoursWorked: 0, // No se calcula tiempo de trabajo desde fechas de reserva del cliente
                earnings: 0,
                observations: r.observaciones || '',
                checked: r.checked,
                nombreCliente: r.nombreCliente,
                fechaEntrada: r.fechaEntradaReserva,
                fechaSalida: r.fechaSalidaReserva,
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
      const matchesType = filters.type === 'all' || r.type === filters.type;
      const matchesSearch =
        r.accommodation?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.observations?.toLowerCase().includes(searchTerm.toLowerCase());
        
      let matchesDate = true;
      if (filters.startDate || filters.endDate) {
        const recordDate = (r.date || '').split('T')[0].split(' ')[0];
        if (filters.startDate && recordDate < filters.startDate) matchesDate = false;
        if (filters.endDate && recordDate > filters.endDate) matchesDate = false;
      }
      
      return matchesType && matchesSearch && matchesDate;
    });
  }, [records, filters, searchTerm]);

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filters.type !== 'all') count++;
    if (filters.startDate || filters.endDate) count++;
    return count;
  }, [filters]);

  const totals = useMemo(() => {
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    
    const recordsThisMonth = records.filter(r => {
      const d = new Date(r.date || '');
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });

    const totalHours = recordsThisMonth.reduce((acc, curr) => acc + (curr.hoursWorked || 0), 0);

    return {
        owed: workerData?.owedMoney || 0,
        cleans: workerData?.cleansCountMonth || 0,
        hours: totalHours
    };
  }, [workerData, records]);

  if (loading) {
    return <LoadingSpinner message="Preparando tu historial..." />;
  }

  const typeConfig: Record<RecordType, { label: string; badge: string; icon: React.ComponentType<any> }> = {
    Normal:     { label: 'Normal',     badge: 'bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-400',       icon: Home },
    Inicial:    { label: 'Inicial',    badge: 'bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400', icon: Sparkles },
    Manitas:    { label: 'Manitas',    badge: 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400',    icon: Wrench },
    Incidencia: { label: 'Incidencia', badge: 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400',            icon: AlertTriangle },
    Llaves:     { label: 'Llaves',     badge: 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400',        icon: Key },
  };

  return (
    <div className="space-y-0 md:pb-20">
      
      {/* ── BLOQUE STICKY MÓVIL ── */}
      <div className="relative sticky top-0 z-30 pt-0 lg:pt-0 pb-4 lg:pb-0 mb-4 lg:mb-6 lg:static flex flex-col gap-6 -mx-4 px-4 lg:mx-0 lg:px-0 bg-[#F5F4F2] dark:bg-[#1c1a18] lg:bg-transparent animate-in fade-in slide-in-from-bottom-4 duration-700">
        
        {/* Centered Greeting con mas espaciado */}
        <header className="flex flex-col items-center lg:items-start justify-center lg:justify-start text-center lg:text-left gap-2 pt-8 pb-6 lg:pt-4 lg:pb-2">
          <h1 className="text-2xl font-normal text-slate-800 dark:text-stone-200 tracking-tight font-display">
            Hola, {(workerData?.fullName || user.name).split(' ')[0]} 👋
          </h1>
          <p className="text-sm text-slate-400 dark:text-stone-500 font-light">
            Resumen de tu actividad y pagos recientes
          </p>
        </header>

        {/* Stats Boxes (Saldo, Limpiezas, Horas) */}
        <div className="grid grid-cols-3 gap-2 sm:gap-4">
          {[
            { label: 'Dinero Debido', value: totals.owed.toFixed(2), suffix: '€', highlight: true },
            { label: 'Servicios este Mes', value: totals.cleans, suffix: '' },
            { label: 'Horas Totales', value: totals.hours.toFixed(1), suffix: 'h' },
          ].map(stat => (
            <div
              key={stat.label}
              className="bg-white/60 dark:bg-stone-900/40 backdrop-blur-md rounded-2xl sm:rounded-3xl border border-white/60 dark:border-stone-800/50 p-3 sm:p-5 flex-col justify-center items-center sm:items-start flex shadow-sm"
            >
              <div className="flex flex-col items-start justify-center text-left w-fit gap-0.5 sm:gap-1">
                <p className="text-[10px] sm:text-[11px] font-medium text-slate-500 dark:text-stone-500">
                  <span className="hidden sm:inline">{stat.label}</span>
                  <span className="sm:hidden leading-tight flex flex-col">
                    {stat.label.split(' ').map((word, idx) => (
                      <span key={idx} className="block">{word}</span>
                    ))}
                  </span>
                </p>
                <p className={`text-lg sm:text-2xl font-normal font-display tabular-nums tracking-tight ${stat.highlight ? 'text-amber-600 dark:text-amber-400' : 'text-slate-800 dark:text-stone-100'}`}>
                  {stat.value}<span className="text-[10px] sm:text-sm font-normal ml-0.5 text-slate-400 dark:text-stone-500">{stat.suffix}</span>
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Search bar - sticky alongside stats */}
        <div className="flex items-center gap-3 pb-3 lg:hidden">
          <div className="relative group flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 size-4 group-focus-within:text-orange-500 transition-colors" />
            <input
              type="text"
              placeholder="Buscar alojamiento..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-3 bg-white/60 dark:bg-stone-900/40 backdrop-blur-md border border-white/60 dark:border-stone-800/50 rounded-xl text-sm text-slate-700 dark:text-stone-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 transition-all w-full shadow-sm"
            />
          </div>
        </div>

        {/* Gradient fade border */}
        <div className="absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-b from-transparent to-[#F5F4F2] dark:to-[#1c1a18] pointer-events-none lg:hidden" />
      </div>


      {/* ── CONTENIDO SCROLLABLE ── */}
      <div className="flex-1 w-full lg:overflow-visible pb-24 space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-150 fill-mode-both">
        <section className="space-y-4">
          

          
          <WorkerRecordsFilterModal 
            isOpen={isFilterModalOpen}
            onClose={() => setIsFilterModalOpen(false)}
            filters={filters}
            onApply={(newFilters) => {
              setFilters(newFilters);
            }}
          />

          {/* Desktop Table */}
          <div className="hidden lg:flex bg-white/80 dark:bg-stone-900 backdrop-blur-md border border-white/60 dark:border-stone-700/50 rounded-2xl overflow-hidden flex-col">
            <div className="grid grid-cols-[1.2fr_1fr_1.8fr_0.8fr_0.8fr_1.2fr_3fr_1.2fr_0.5fr] gap-4 px-8 py-6 border-b border-stone-100 dark:border-stone-800">
               {['Fecha', 'Tipo', 'Alojamiento', 'Horas', 'KM', 'Generado', 'Detalle / Observaciones', 'Estado', ''].map(col => (
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
                  const isExpanded = expandedId === record.id;
                  return (
                    <li
                      key={record.id}
                      className={`transition-all duration-300 hover:bg-stone-100/50 dark:hover:bg-stone-700/30 cursor-pointer ${
                        isExpanded ? 'bg-stone-50/80 dark:bg-stone-850/50' : ''
                      }`}
                      onClick={() => setExpandedId(isExpanded ? null : record.id)}
                    >
                      <div className="group module-item grid grid-cols-[1.2fr_1fr_1.8fr_0.8fr_0.8fr_1.2fr_3fr_1.2fr_0.5fr] gap-4 px-8 py-4 items-center">
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
                        
                        <p className="text-sm text-slate-800 dark:text-stone-200 truncate font-medium">
                          {record.accommodation ? formatName(record.accommodation) : '—'}
                        </p>
                        
                        <p className="text-xs text-slate-500 dark:text-stone-400 tabular-nums truncate">
                          {record.hoursWorked > 0 ? `${record.hoursWorked.toFixed(1)}h` : '—'}
                        </p>
                        
                        <p className="text-xs text-slate-500 dark:text-stone-400 tabular-nums truncate">
                          {record.kms > 0 ? `${record.kms} km` : '—'}
                        </p>
                        
                        <p className={`text-sm tabular-nums truncate ${record.earnings > 0 ? 'text-amber-600 dark:text-amber-400 font-semibold' : 'text-slate-500 dark:text-stone-400'}`}>
                          {record.earnings > 0 ? `${record.earnings.toFixed(2)}€` : '—'}
                        </p>
                        
                        {/* Detalle/Observaciones */}
                        <div className="min-w-0 pr-4">
                          {record.type === 'Incidencia' ? (
                            <div className="flex flex-col min-w-0">
                              <span className="text-[11px] text-slate-600 dark:text-stone-300 truncate w-full" title={record.description}>
                                {record.description || '—'}
                              </span>
                              {record.coste != null && record.coste > 0 && (
                                <span className="text-[10px] text-red-500">{record.coste.toFixed(2)}€ · {record.pagadoPor === 'empresa' ? 'Empresa' : 'Limpiador'}</span>
                              )}
                            </div>
                          ) : record.type === 'Llaves' ? (
                            <div className="flex flex-col min-w-0">
                              <span className="text-[11px] text-slate-600 dark:text-stone-300 truncate w-full" title={`Cliente: ${record.nombreCliente || '—'}`}>
                                Cliente: {record.nombreCliente || '—'}
                              </span>
                            </div>
                          ) : (
                            <span className="text-[11px] text-slate-500 dark:text-stone-400 truncate w-full block" title={record.observations}>
                              {record.observations || <span className="opacity-40 italic">—</span>}
                            </span>
                          )}
                        </div>
                        
                        {/* Estado */}
                        <div className="flex items-center min-w-0">
                          {record.type === 'Normal' || record.type === 'Inicial' ? (
                            <span className={`text-[10px] font-medium truncate ${record.checked ? 'text-green-600' : 'text-amber-600'}`}>
                              {record.checked ? 'Pagado' : 'Pendiente'}
                            </span>
                          ) : record.type === 'Incidencia' || record.type === 'Llaves' ? (
                            <span className={`text-[10px] font-medium truncate ${record.checked ? 'text-green-600' : 'text-amber-600'}`}>
                              {record.checked ? 'Revisado' : 'Pendiente'}
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-400">—</span>
                          )}
                        </div>

                        {/* Chevron icon */}
                        <div className="flex justify-end pr-2 text-slate-400">
                          <ChevronRight size={16} className={`transition-transform duration-300 ${isExpanded ? 'rotate-90 text-orange-500' : ''}`} />
                        </div>
                      </div>

                      {/* Panel de detalles en escritorio del Dashboard */}
                      <div className={`overflow-hidden transition-all duration-300 ease-in-out px-8 ${
                        isExpanded ? 'max-h-96 pb-6 pt-2 border-t border-stone-100 dark:border-stone-800/40 bg-white/40 dark:bg-stone-900/40' : 'max-h-0'
                      }`}
                      onClick={(e) => e.stopPropagation()} // Evitar colapsar al hacer clic en detalles
                      >
                        <div className="grid grid-cols-4 gap-4 bg-stone-50/50 dark:bg-stone-850/40 p-4 rounded-2xl border border-stone-100 dark:border-stone-800/60">
                          <div className="space-y-1">
                            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Fecha Completa</span>
                            <p className="text-xs text-slate-700 dark:text-stone-200">
                              {record.date ? new Date(record.date).toLocaleString('es-ES', { dateStyle: 'long', timeStyle: 'short' }) : '—'}
                            </p>
                          </div>

                          <div className="col-span-3 space-y-1">
                            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Alojamiento Completo</span>
                            <p className="text-xs text-slate-700 dark:text-stone-200 font-medium break-words leading-relaxed">
                              {record.accommodation ? record.accommodation : '—'}
                            </p>
                          </div>

                          {record.type === 'Incidencia' && (
                            <>
                              <div className="space-y-1">
                                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Coste Estimado</span>
                                <p className="text-xs text-red-500 font-semibold">
                                  {record.coste != null && record.coste > 0 ? `${record.coste.toFixed(2)}€` : '—'}
                                </p>
                              </div>
                              <div className="space-y-1">
                                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Pagado Por</span>
                                <p className="text-xs text-slate-700 dark:text-stone-200 capitalize">
                                  {record.pagadoPor || '—'}
                                </p>
                              </div>
                            </>
                          )}

                          {record.type === 'Llaves' && (
                            <>
                              <div className="space-y-1">
                                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Cliente</span>
                                <p className="text-xs text-slate-700 dark:text-stone-200 font-medium">
                                  {record.nombreCliente || '—'}
                                </p>
                              </div>
                              {record.fechaEntrada && (
                                <div className="space-y-1">
                                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Entrada de Reserva</span>
                                  <p className="text-xs text-slate-700 dark:text-stone-200">
                                    {new Date(record.fechaEntrada).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })}
                                  </p>
                                </div>
                              )}
                            </>
                          )}

                          {(record.type === 'Normal' || record.type === 'Inicial' || record.type === 'Manitas') && (
                            <>
                              <div className="space-y-1">
                                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Horario del Registro</span>
                                <p className="text-xs text-slate-700 dark:text-stone-200 font-mono">
                                  {record.horaEntrada && record.horaSalida ? `${record.horaEntrada} – ${record.horaSalida}` : '—'}
                                </p>
                              </div>
                              <div className="space-y-1">
                                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                                  {record.type === 'Manitas' ? 'Minutos Trabajados' : 'Kilómetros totales'}
                                </span>
                                <p className="text-xs text-slate-700 dark:text-stone-200">
                                  {record.type === 'Manitas' ? `${record.minutes || 0} min` : `${record.kms || 0} km`}
                                </p>
                              </div>
                            </>
                          )}

                          <div className="col-span-2 space-y-1">
                            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Detalles / Observaciones</span>
                            <p className="text-xs text-slate-600 dark:text-stone-400 italic font-light">
                              "{record.description || record.observations || 'Sin anotaciones adicionales'}"
                            </p>
                          </div>
                        </div>
                      </div>
                    </li>
                  );
                })
              )}
            </ul>
          </div>

          {/* Mobile Cards (Misma UI que Registros pero con el "Estado" de WorkerPanel) */}
          <div className="lg:hidden space-y-3">
            {filteredRecords.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 bg-white/30 dark:bg-stone-900/30 rounded-3xl border-2 border-dashed border-slate-200 dark:border-stone-800 mt-4">
                <Search size={40} className="text-slate-300 dark:text-stone-700 mb-3" />
                <p className="text-slate-500 dark:text-stone-400 font-medium">No se encontraron registros</p>
                <p className="text-xs text-slate-400 dark:text-stone-500">Prueba con otra búsqueda o filtros.</p>
              </div>
            ) : (
              filteredRecords.map(record => {
                const cfg = typeConfig[record.type];
                const isExpanded = expandedId === record.id;
                return (
                  <div
                    key={record.id}
                    onClick={() => setExpandedId(isExpanded ? null : record.id)}
                    className={`bg-white/80 dark:bg-stone-900/60 backdrop-blur-md rounded-3xl border border-white/60 dark:border-stone-800/50 overflow-hidden transition-all duration-300 ${
                      isExpanded ? 'pb-1 shadow-sm bg-white dark:bg-stone-900/80' : 'active:scale-[0.98]'
                    }`}
                  >
                    <div className="p-4 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex flex-col items-center justify-center w-[52px] h-[52px] rounded-xl bg-stone-50 dark:bg-stone-800 shrink-0 border border-stone-100 dark:border-stone-800">
                          <span className="text-[10px] font-normal text-slate-500 capitalize leading-none mb-1">
                            {record.date ? new Date(record.date).toLocaleDateString('es-ES', { month: 'short' }) : '—'}
                          </span>
                          <span className="text-base font-bold text-slate-800 dark:text-stone-200 leading-none">
                            {record.date ? new Date(record.date).getDate() : '—'}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-[13px] font-medium text-slate-800 dark:text-stone-100 truncate">
                            {record.accommodation ? formatName(record.accommodation) : '—'}
                          </h3>

                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-[13px] tabular-nums font-medium ${record.earnings > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400'}`}>
                          {record.earnings > 0 ? `${record.earnings.toFixed(2)}€` : '—'}
                        </span>
                        <ChevronRight size={18} className={`text-slate-300 transition-transform duration-300 ${isExpanded ? 'rotate-90 text-slate-700 dark:text-stone-300' : ''}`} />
                      </div>
                    </div>

                    <div className={`px-4 overflow-hidden transition-all duration-300 ease-in-out ${isExpanded ? 'max-h-96 pb-4 border-t border-slate-50 dark:border-stone-800/40 pt-4' : 'max-h-0'}`}>
                        <div className="grid grid-cols-3 gap-2 mb-3">
                          <div className="bg-stone-50/50 dark:bg-stone-800/30 p-2.5 rounded-2xl flex flex-col items-center text-center">
                            <p className="text-[9px] uppercase font-bold tracking-wider text-slate-400 mb-1">Tipo</p>
                            <p className="text-xs font-semibold text-slate-700 dark:text-stone-200 truncate w-full">{cfg.label}</p>
                          </div>

                          {(record.type === 'Normal' || record.type === 'Inicial' || record.type === 'Manitas') && (
                            <>
                              <div className="bg-stone-50/50 dark:bg-stone-800/30 p-2.5 rounded-2xl flex flex-col items-center text-center">
                                <p className="text-[9px] uppercase font-bold tracking-wider text-slate-400 mb-1">Horario</p>
                                <p className="text-[11px] font-semibold text-slate-700 dark:text-stone-200 tabular-nums">
                                  {record.horaEntrada && record.horaSalida ? `${record.horaEntrada}-${record.horaSalida}` : '—'}
                                </p>
                              </div>
                              <div className="bg-stone-50/50 dark:bg-stone-800/30 p-2.5 rounded-2xl flex flex-col items-center text-center">
                                <p className="text-[9px] uppercase font-bold tracking-wider text-slate-400 mb-1">
                                  {record.type === 'Manitas' ? 'Min' : 'KM'}
                                </p>
                                <p className="text-xs font-semibold text-slate-700 dark:text-stone-200 tabular-nums">
                                  {record.type === 'Manitas' ? (record.minutes || 0) : (record.kms || 0)}
                                </p>
                              </div>
                            </>
                          )}

                          {record.type === 'Incidencia' && (
                            <>
                              <div className="bg-stone-50/50 dark:bg-stone-800/30 p-2.5 rounded-2xl flex flex-col items-center text-center">
                                <p className="text-[9px] uppercase font-bold tracking-wider text-slate-400 mb-1">Coste</p>
                                <p className="text-xs font-semibold text-red-500 tabular-nums">
                                  {record.coste != null && record.coste > 0 ? `${record.coste.toFixed(2)}€` : '—'}
                                </p>
                              </div>
                              <div className="bg-stone-50/50 dark:bg-stone-800/30 p-2.5 rounded-2xl flex flex-col items-center text-center">
                                <p className="text-[9px] uppercase font-bold tracking-wider text-slate-400 mb-1">Pagado</p>
                                <p className="text-xs font-semibold text-slate-700 dark:text-stone-200 truncate w-full">
                                  {record.pagadoPor === 'empresa' ? 'Empresa' : record.pagadoPor === 'limpiador' ? 'Limpiador' : '—'}
                                </p>
                              </div>
                            </>
                          )}

                          {record.type === 'Llaves' && (
                            <>
                              <div className="bg-stone-50/50 dark:bg-stone-800/30 p-2.5 rounded-2xl flex flex-col items-center text-center">
                                <p className="text-[9px] uppercase font-bold tracking-wider text-slate-400 mb-1">Cliente</p>
                                <p className="text-[11px] font-semibold text-slate-700 dark:text-stone-200 truncate w-full">{record.nombreCliente || '—'}</p>
                              </div>
                              <div className="bg-stone-50/50 dark:bg-stone-800/30 p-2.5 rounded-2xl flex flex-col items-center text-center">
                                <p className="text-[9px] uppercase font-bold tracking-wider text-slate-400 mb-1">KM</p>
                                <p className="text-xs font-semibold text-slate-700 dark:text-stone-200 tabular-nums">{record.kms || 0}</p>
                              </div>
                            </>
                          )}
                        </div>

                      {record.type === 'Incidencia' && record.description && (
                        <div className="bg-red-50/50 dark:bg-red-900/10 p-3.5 rounded-2xl border border-red-100/50 dark:border-red-800/30 mb-2">
                          <div className="flex items-center gap-1.5 mb-1.5 text-red-500">
                            <AlertTriangle size={12} />
                            <span className="text-[9px] uppercase font-bold tracking-wider">Descripción</span>
                          </div>
                          <p className="text-[11px] text-slate-600 dark:text-stone-400 italic font-light leading-relaxed">
                            "{record.description}"
                          </p>
                        </div>
                      )}

                      {record.observations && (
                        <div className="bg-stone-50 dark:bg-stone-900/40 p-3.5 rounded-2xl border border-stone-100/50 dark:border-stone-800/50">
                          <div className="flex items-center gap-1.5 mb-1.5 text-slate-500 dark:text-stone-400">
                            <Info size={12} />
                            <span className="text-[9px] uppercase font-bold tracking-wider">Observaciones</span>
                          </div>
                          <p className="text-[11px] text-slate-600 dark:text-stone-400 italic font-light leading-relaxed">
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

        </section>
      </div>
      
      {/* BOTON FILTRO FLOTANTE MÓVIL (Solo se muestra en movil como en Registros) */}
      <div className="fixed bottom-16 right-4 z-50 sm:hidden animate-in fade-in zoom-in duration-300">
        <button
          onClick={() => setIsFilterModalOpen(true)}
          className={`flex items-center justify-center w-[52px] h-[52px] rounded-full shadow-2xl transition-all active:scale-[0.92] border ${
            activeFiltersCount > 0 
              ? 'bg-orange-500 border-orange-400 text-white' 
              : 'bg-white dark:bg-stone-800 border-stone-200 dark:border-stone-700 text-slate-600 dark:text-stone-300'
          }`}
        >
          <Filter size={20} className={activeFiltersCount > 0 ? "text-white" : "text-orange-500"} />
          {activeFiltersCount > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold flex items-center justify-center rounded-full border-2 border-white dark:border-stone-900">
              {activeFiltersCount}
            </span>
          )}
        </button>
      </div>

    </div>
  );
};

export default WorkerPanel;
