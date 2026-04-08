
import React, { useState, useEffect, useMemo } from 'react';
import {
  ClipboardList,
  Sparkles,
  Wrench,
  Loader2,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  Filter,
  Info,
} from 'lucide-react';
import { appsScriptApi } from '../services/api';
import { NormalCleanRecord, InitialCleanRecord, HandymanRecord, Worker } from '../services/mockData';
import CleanFilterModal, { CleanFilters } from '../components/cleans/CleanFilterModal';
import LoadingSpinner from '../components/ui/LoadingSpinner';

type TabType = 'normal' | 'initial' | 'handyman';

const Cleans: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('normal');
  const [loading, setLoading] = useState(true);
  const [normalCleans, setNormalCleans] = useState<NormalCleanRecord[]>([]);
  const [initialCleans, setInitialCleans] = useState<InitialCleanRecord[]>([]);
  const [handymanRecords, setHandymanRecords] = useState<HandymanRecord[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  // Filter Modal state
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [filters, setFilters] = useState<CleanFilters>({
    startDate: '',
    endDate: '',
    apartment: '',
    status: 'all'
  });

  const photoMap = useMemo(() => {
    const map: Record<string, string> = {};
    workers.forEach(w => { if (w.photo) map[w.fullName] = w.photo; });
    return map;
  }, [workers]);

  useEffect(() => {
    appsScriptApi.getWorkers().then(setWorkers);
    const fetchAllData = async () => {
      setLoading(true);
      try {
        const [nc, ic, hm] = await Promise.all([
          appsScriptApi.getNormalCleans(),
          appsScriptApi.getInitialCleans(),
          appsScriptApi.getHandymanRecords()
        ]);
        setNormalCleans(nc);
        setInitialCleans(ic);
        setHandymanRecords(hm);
      } catch (error) {
        console.error('Error fetching cleans data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchAllData();
  }, []);

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filters.startDate || filters.endDate) count++;
    if (filters.apartment) count++;
    if (filters.status !== 'all') count++;
    return count;
  }, [filters]);

  const applyFilters = (record: NormalCleanRecord | InitialCleanRecord | HandymanRecord) => {
    const s = searchTerm.toLowerCase();
    
    // Search matching
    let fullName = '';
    let telefono = '';
    let apt = '';
    let fecha = '';
    let checked = false;

    if ('nombre' in record) {
      fullName = `${record.nombre} ${record.apellidos}`.toLowerCase();
      telefono = record.telefono.toLowerCase();
      apt = ('apartamento' in record ? record.apartamento : record.alojamiento).toLowerCase();
      fecha = 'checkinFecha' in record ? record.checkinFecha : record.fechaLlegada;
      checked = 'checked' in record ? record.checked : record.estadoCompletado === 'Completado';
    }

    const matchSearch = 
      fullName.includes(s) || 
      telefono.includes(s) || 
      apt.includes(s);

    if (!matchSearch) return false;

    // Filter matching
    if (filters.apartment && !apt.includes(filters.apartment.toLowerCase())) return false;
    
    if (filters.status === 'verified' && !checked) return false;
    if (filters.status === 'unverified' && checked) return false;

    if (filters.startDate && fecha < filters.startDate) return false;
    if (filters.endDate && fecha > filters.endDate) return false;

    return true;
  };

  const filteredNormal = useMemo(() => normalCleans.filter(applyFilters), [normalCleans, searchTerm, filters]);
  const filteredInitial = useMemo(() => initialCleans.filter(applyFilters), [initialCleans, searchTerm, filters]);
  const filteredHandyman = useMemo(() => handymanRecords.filter(applyFilters), [handymanRecords, searchTerm, filters]);

  const tabs = [
    { id: 'normal', label: 'Limpieza Normal', icon: <ClipboardList size={18} /> },
    { id: 'initial', label: 'Limpieza Inicial', icon: <Sparkles size={18} /> },
    { id: 'handyman', label: 'Manitas', icon: <Wrench size={18} /> },
  ] as const;

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header & Toolbar unificados */}
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 px-1 mb-2">
        <h1 className="text-xl font-normal text-slate-800 dark:text-stone-200 tracking-tight font-display shrink-0">
          Registros de Limpieza
        </h1>

        <div className="flex flex-col md:flex-row gap-3 justify-end items-center flex-1">
          <div className="relative w-full md:w-72">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-stone-500 pointer-events-none" size={14} />
            <input
              type="text"
              placeholder="Buscar trabajador o apto..."
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

            <CleanFilterModal 
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

      {/* Content Area */}
      <div className="bg-white/60 dark:bg-stone-950 backdrop-blur-md border border-white dark:border-stone-800 rounded-2xl">
        <div className="overflow-x-auto">
          {activeTab === 'normal' && <TableNormalCleans data={filteredNormal} photoMap={photoMap} />}
          {activeTab === 'initial' && <TableInitialCleans data={filteredInitial} photoMap={photoMap} />}
          {activeTab === 'handyman' && <TableHandyman data={filteredHandyman} photoMap={photoMap} />}
        </div>
      </div>
    </div>
  );
};


// Verification cell component with green/red buttons
const VerificationCell: React.FC<{ verified: boolean; onClick: (verified: boolean) => void }> = ({ verified, onClick }) => (
  <button
    type="button"
    onClick={() => onClick(!verified)}
    className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-medium transition ${verified
      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/70 dark:text-emerald-200 hover:bg-emerald-200 dark:hover:bg-emerald-900'
      : 'bg-red-100 text-red-700 dark:bg-red-900/70 dark:text-red-200 hover:bg-red-200 dark:hover:bg-red-900'}`}
  >
    {verified ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
    <span>{verified ? 'Verificado' : 'No Verificado'}</span>
  </button>
);

// Location verification modal component
const LocationVerificationModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-[105] transition-opacity duration-300 ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      {/* Popover Content - Small 1x1 modal */}
      <div className={`absolute z-[110] bg-white/90 dark:bg-stone-900/95 backdrop-blur-xl w-32 h-32 rounded-2xl overflow-hidden border border-white/60 dark:border-stone-800/50 soft-shadow transition-all duration-300 ease-out origin-top-left ${
        isOpen
          ? 'opacity-100 scale-100 pointer-events-auto'
          : 'opacity-0 scale-95 pointer-events-none'
      }`}>

        {/* Empty content for now */}
        <div className="p-4 flex items-center justify-center h-full">
          <div className="text-xs text-slate-400 dark:text-stone-500 text-center">
            Modal vacío
          </div>
        </div>
      </div>
    </>
  );
};

const thClass = "px-6 py-5 sm:px-8 sm:py-6 text-xs font-normal text-slate-400 dark:text-stone-500 capitalize whitespace-nowrap";
const tdClass = "px-6 py-5 sm:px-8 sm:py-7";

// Observation button component
const ObservationButton: React.FC<{ text?: string }> = ({ text }) => {
  const baseButton = (
    <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-white dark:bg-stone-950">
      <Info size={20} className="text-orange-500" />
    </div>
  );

  if (!text || text.trim() === '') {
    return (
      <div className="inline-flex items-center justify-center w-10 h-10 rounded-full opacity-50 bg-white dark:bg-stone-950">
        <Info size={20} className="text-orange-300" />
      </div>
    );
  }

  return baseButton;
};

// Sub-components: Tables
// Sub-components: Tables
const TableNormalCleans: React.FC<{ data: NormalCleanRecord[]; photoMap: Record<string, string> }> = ({ data }) => {
  const [locationModalOpen, setLocationModalOpen] = useState(false);

  return (
    <>
      <table className="w-full text-left border-collapse text-xs sm:text-sm">
        <thead>
          <tr className="border-b border-stone-100 dark:border-stone-800">
            <th className={thClass}>Nombres y Apellidos</th>
            <th className={thClass}>Verificar Fecha</th>
            <th className={thClass}>Verificar Ubicación</th>
            <th className={thClass}>Apartamento</th>
            <th className={thClass}>Horario</th>
            <th className={thClass}>Km</th>
            <th className={thClass}>Observaciones</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
          {data.map((r) => (
            <tr key={r.id} className="hover:bg-stone-100/50 dark:hover:bg-stone-700/30 transition-colors duration-200">
              <td className={tdClass}>
                <div className="font-normal text-slate-800 dark:text-stone-200">{r.nombre} {r.apellidos}</div>
              </td>
              <td className={tdClass}>
                <VerificationCell verified={r.checked} onClick={() => {}} />
              </td>
              <td className={tdClass}>
                <div className="relative">
                  <VerificationCell verified={r.checked} onClick={() => setLocationModalOpen(true)} />
                  <LocationVerificationModal isOpen={locationModalOpen} onClose={() => setLocationModalOpen(false)} />
                </div>
              </td>
              <td className={tdClass}>
                <span className="inline-block bg-white dark:bg-stone-800 text-slate-500 dark:text-stone-400 text-[11px] px-2 py-0.5 rounded-md soft-shadow font-normal">
                  {r.apartamento}
                </span>
              </td>
              <td className={`${tdClass} text-slate-600 dark:text-stone-400 text-sm`}>
                {r.horaEntrada} - {r.horaSalida}
              </td>
              <td className={`${tdClass} text-slate-600 dark:text-stone-400 tabular-nums`}>{r.km} km</td>
              <td className={`${tdClass} text-center`}>
                <ObservationButton text={r.observaciones} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
};

const TableInitialCleans: React.FC<{ data: InitialCleanRecord[]; photoMap: Record<string, string> }> = ({ data }) => {
  const [locationModalOpen, setLocationModalOpen] = useState(false);

  return (
    <>
      <table className="w-full text-left border-collapse text-xs sm:text-sm">
        <thead>
          <tr className="border-b border-stone-100 dark:border-stone-800">
            <th className={thClass}>Nombres y Apellidos</th>
            <th className={thClass}>Verificar Fecha</th>
            <th className={thClass}>Verificar Ubicación</th>
            <th className={thClass}>Apartamento</th>
            <th className={thClass}>Horario</th>
            <th className={thClass}>Km</th>
            <th className={thClass}>Observaciones</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
          {data.map((r) => (
            <tr key={r.id} className="hover:bg-stone-100/50 dark:hover:bg-stone-700/30 transition-colors duration-200">
              <td className={tdClass}>
                <div className="font-normal text-slate-800 dark:text-stone-200">{r.nombre} {r.apellidos}</div>
              </td>
              <td className={tdClass}>
                <VerificationCell verified={r.checked} onClick={() => {}} />
              </td>
              <td className={tdClass}>
                <div className="relative">
                  <VerificationCell verified={r.checked} onClick={() => setLocationModalOpen(true)} />
                  <LocationVerificationModal isOpen={locationModalOpen} onClose={() => setLocationModalOpen(false)} />
                </div>
              </td>
              <td className={tdClass}>
                <span className="inline-block bg-white dark:bg-stone-800 text-slate-500 dark:text-stone-400 text-[11px] px-2 py-0.5 rounded-md soft-shadow font-normal">
                  {r.apartamento}
                </span>
              </td>
              <td className={`${tdClass} text-slate-600 dark:text-stone-400 text-sm`}>
                {r.horaEntrada} - {r.horaSalida}
              </td>
              <td className={`${tdClass} text-slate-600 dark:text-stone-400 tabular-nums`}>{r.km} km</td>
              <td className={`${tdClass} text-center`}>
                <ObservationButton text={r.observaciones} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
};

const TableHandyman: React.FC<{ data: HandymanRecord[]; photoMap: Record<string, string> }> = ({ data }) => {
  const [locationModalOpen, setLocationModalOpen] = useState(false);

  return (
    <>
      <table className="w-full text-left border-collapse text-xs sm:text-sm">
        <thead>
          <tr className="border-b border-stone-100 dark:border-stone-800">
            <th className={thClass}>Nombres y Apellidos</th>
            <th className={thClass}>Verificar Fecha</th>
            <th className={thClass}>Verificar Ubicación</th>
            <th className={thClass}>Alojamiento</th>
            <th className={thClass}>Horario</th>
            <th className={thClass}>Km</th>
            <th className={thClass}>Detalles del Trabajo</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
          {data.map((r) => (
            <tr key={r.id} className="hover:bg-stone-100/50 dark:hover:bg-stone-700/30 transition-colors duration-200">
              <td className={tdClass}>
                <div className="font-normal text-slate-800 dark:text-stone-200">{r.nombre} {r.apellidos}</div>
              </td>
              <td className={tdClass}>
                <VerificationCell verified={r.estadoCompletado === 'Completado'} onClick={() => {}} />
              </td>
              <td className={tdClass}>
                <div className="relative">
                  <VerificationCell verified={r.estadoCompletado === 'Completado'} onClick={() => setLocationModalOpen(true)} />
                  <LocationVerificationModal isOpen={locationModalOpen} onClose={() => setLocationModalOpen(false)} />
                </div>
              </td>
              <td className={tdClass}>
                <span className="inline-block bg-white dark:bg-stone-800 text-slate-500 dark:text-stone-400 text-[11px] px-2 py-0.5 rounded-md soft-shadow font-normal">
                  {r.alojamiento}
                </span>
              </td>
              <td className={`${tdClass} text-slate-600 dark:text-stone-400 text-sm`}>
                {r.horaInicioTarea} - {r.horaFinTarea}
              </td>
              <td className={`${tdClass} text-slate-600 dark:text-stone-400 tabular-nums`}>{r.cantidadMinutos} km</td>
              <td className={`${tdClass} text-center`}>
                <ObservationButton text={r.observacionesTarea} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
};

export default Cleans;
