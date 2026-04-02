import React, { useState, useEffect } from 'react';
import {
  ClipboardList,
  Sparkles,
  Wrench,
  Loader2,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
} from 'lucide-react';
import { appsScriptApi } from '../services/api';
import { NormalCleanRecord, InitialCleanRecord, HandymanRecord } from '../services/mockData';

type TabType = 'normal' | 'initial' | 'handyman';

const Cleans: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('normal');
  const [loading, setLoading] = useState(true);
  const [normalCleans, setNormalCleans] = useState<NormalCleanRecord[]>([]);
  const [initialCleans, setInitialCleans] = useState<InitialCleanRecord[]>([]);
  const [handymanRecords, setHandymanRecords] = useState<HandymanRecord[]>([]);

  useEffect(() => {
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

  const tabs = [
    { id: 'normal', label: 'Limpieza Normal', icon: <ClipboardList size={18} /> },
    { id: 'initial', label: 'Limpieza Inicial', icon: <Sparkles size={18} /> },
    { id: 'handyman', label: 'Manitas', icon: <Wrench size={18} /> },
  ] as const;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <Loader2 className="animate-spin text-orange-600" size={32} />
        <p className="text-slate-500 font-medium">Cargando registros...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-normal tracking-tight text-slate-600 font-display">Registros</h1>
          <p className="text-slate-500 mt-1 text-sm font-light">Gestión de check-ins y check-outs de trabajadores.</p>
        </div>

        <div className="relative group">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-orange-500 transition-colors" size={16} />
          <input
            type="text"
            placeholder="Buscar por apto o nombre..."
            className="pl-10 pr-4 py-2 bg-white/80 backdrop-blur-sm border border-stone-100/60 rounded-xl focus:outline-none focus:bg-white focus:border-orange-200 w-full md:w-64 transition-all soft-shadow placeholder:text-slate-400 text-sm"
          />
        </div>
      </header>

      {/* Tab Navigation */}
      <div className="flex items-center gap-8 border-b border-stone-100/20 w-full animate-in fade-in slide-in-from-left-4 duration-700">
        {tabs.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabType)}
              className={`relative flex items-center gap-2 pb-3.5 px-0.5 text-xs font-normal transition-all duration-300 group
                ${active ? 'text-slate-800' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <span className={`transition-transform duration-300 ${active ? 'scale-110' : 'group-hover:scale-105'}`}>
                {React.cloneElement(tab.icon as React.ReactElement, {
                  size: 16,
                  className: active ? 'text-orange-500' : 'text-slate-400'
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
      <div className="bg-white/60 backdrop-blur-md border border-white rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          {activeTab === 'normal' && <TableNormalCleans data={normalCleans} />}
          {activeTab === 'initial' && <TableInitialCleans data={initialCleans} />}
          {activeTab === 'handyman' && <TableHandyman data={handymanRecords} />}
        </div>
      </div>
    </div>
  );
};

// Shared cell for Ubicación column
const UbicacionCell: React.FC<{ verified: boolean }> = ({ verified }) => (
  <div className="flex items-center gap-2">
    {verified
      ? <CheckCircle2 size={15} className="text-slate-400 flex-shrink-0" />
      : <XCircle size={15} className="text-slate-400 flex-shrink-0" />
    }
    <button
      type="button"
      onClick={() => {}}
      className="text-xs text-slate-400 underline"
    >
      Mapa
    </button>
  </div>
);

const thClass = "px-6 py-5 sm:px-8 sm:py-6 text-xs font-normal text-slate-400 capitalize whitespace-nowrap";
const tdClass = "px-6 py-5 sm:px-8 sm:py-7";

// Sub-components: Tables
const TableNormalCleans: React.FC<{ data: NormalCleanRecord[] }> = ({ data }) => (
  <table className="w-full text-left border-collapse text-xs sm:text-sm">
    <thead>
      <tr className="border-b border-stone-100">
        <th className={thClass}>Trabajador</th>
        <th className={thClass}>Apartamento</th>
        <th className={thClass}>Check-in</th>
        <th className={thClass}>Check-out</th>
        <th className={thClass}>Horas (E/S)</th>
        <th className={thClass}>Duración</th>
        <th className={thClass}>Ubicación</th>
      </tr>
    </thead>
    <tbody className="divide-y divide-stone-100">
      {data.map((r) => (
        <tr key={r.id} className="hover:bg-stone-100/50 transition-colors duration-200">
          <td className={tdClass}>
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-white text-slate-500 flex items-center justify-center text-[10px] font-normal flex-shrink-0 soft-shadow">
                {r.nombre.charAt(0)}
              </div>
              <div>
                <div className="font-normal text-slate-800 leading-tight">{r.nombre} {r.apellidos}</div>
                <div className="text-[11px] text-slate-400 italic font-light mt-0.5">{r.telefono}</div>
              </div>
            </div>
          </td>
          <td className={tdClass}>
            <span className="inline-block bg-white text-slate-500 text-[11px] px-2 py-0.5 rounded-md soft-shadow font-normal">
              {r.apartamento}
            </span>
          </td>
          <td className={tdClass}>
            <div className="flex items-center text-slate-600 whitespace-nowrap">
              <Clock size={12} className="mr-1 text-slate-400 flex-shrink-0" />
              {r.checkinFecha}
            </div>
          </td>
          <td className={tdClass}>
            <div className="flex items-center text-slate-600 whitespace-nowrap">
              <Clock size={12} className="mr-1 text-slate-400 flex-shrink-0" />
              {r.checkoutFecha}
            </div>
          </td>
          <td className={`${tdClass} text-slate-600 tabular-nums whitespace-nowrap`}>
            {r.horaEntrada} — {r.horaSalida}
          </td>
          <td className={`${tdClass} text-slate-600 tabular-nums`}>{r.km} km</td>
          <td className={tdClass}>
            <UbicacionCell verified={r.checked} />
          </td>
        </tr>
      ))}
    </tbody>
  </table>
);

const TableInitialCleans: React.FC<{ data: InitialCleanRecord[] }> = ({ data }) => (
  <table className="w-full text-left border-collapse text-xs sm:text-sm">
    <thead>
      <tr className="border-b border-stone-100">
        <th className={thClass}>Trabajador</th>
        <th className={thClass}>Apartamento</th>
        <th className={thClass}>Check-in</th>
        <th className={thClass}>Check-out</th>
        <th className={thClass}>Horas (E/S)</th>
        <th className={thClass}>Duración</th>
        <th className={thClass}>Ubicación</th>
      </tr>
    </thead>
    <tbody className="divide-y divide-stone-100">
      {data.map((r) => (
        <tr key={r.id} className="hover:bg-stone-100/50 transition-colors duration-200">
          <td className={tdClass}>
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-white text-slate-500 flex items-center justify-center text-[10px] font-normal flex-shrink-0 soft-shadow">
                {r.nombre.charAt(0)}
              </div>
              <div>
                <div className="font-normal text-slate-800 leading-tight">{r.nombre} {r.apellidos}</div>
                <div className="text-[11px] text-slate-400 italic font-light mt-0.5">{r.telefono}</div>
              </div>
            </div>
          </td>
          <td className={tdClass}>
            <span className="inline-block bg-white text-slate-500 text-[11px] px-2 py-0.5 rounded-md soft-shadow font-normal">
              {r.apartamento}
            </span>
          </td>
          <td className={tdClass}>
            <div className="flex items-center text-slate-600 whitespace-nowrap">
              <Clock size={12} className="mr-1 text-slate-400 flex-shrink-0" />
              {r.checkinFecha}
            </div>
          </td>
          <td className={tdClass}>
            <div className="flex items-center text-slate-600 whitespace-nowrap">
              <Clock size={12} className="mr-1 text-slate-400 flex-shrink-0" />
              {r.checkoutFecha}
            </div>
          </td>
          <td className={`${tdClass} text-slate-600 tabular-nums whitespace-nowrap`}>
            {r.horaEntrada} — {r.horaSalida}
          </td>
          <td className={`${tdClass} text-slate-600 tabular-nums`}>{r.km} km</td>
          <td className={tdClass}>
            <UbicacionCell verified={r.checked} />
          </td>
        </tr>
      ))}
    </tbody>
  </table>
);

const TableHandyman: React.FC<{ data: HandymanRecord[] }> = ({ data }) => (
  <table className="w-full text-left border-collapse text-xs sm:text-sm">
    <thead>
      <tr className="border-b border-stone-100">
        <th className={thClass}>Trabajador</th>
        <th className={thClass}>Apartamento</th>
        <th className={thClass}>Check-in</th>
        <th className={thClass}>Check-out</th>
        <th className={thClass}>Horas (E/S)</th>
        <th className={thClass}>Duración</th>
        <th className={thClass}>Ubicación</th>
      </tr>
    </thead>
    <tbody className="divide-y divide-stone-100">
      {data.map((r) => (
        <tr key={r.id} className="hover:bg-stone-100/50 transition-colors duration-200">
          <td className={tdClass}>
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-white text-slate-500 flex items-center justify-center text-[10px] font-normal flex-shrink-0 soft-shadow">
                {r.nombre.charAt(0)}
              </div>
              <div>
                <div className="font-normal text-slate-800 leading-tight">{r.nombre} {r.apellidos}</div>
                <div className="text-[11px] text-slate-400 italic font-light mt-0.5">{r.telefono}</div>
              </div>
            </div>
          </td>
          <td className={tdClass}>
            <span className="inline-block bg-white text-slate-500 text-[11px] px-2 py-0.5 rounded-md soft-shadow font-normal">
              {r.alojamiento}
            </span>
          </td>
          <td className={tdClass}>
            <div className="flex items-center text-slate-600 whitespace-nowrap">
              <Clock size={12} className="mr-1 text-slate-400 flex-shrink-0" />
              {r.fechaLlegada}
            </div>
          </td>
          <td className={tdClass}>
            <div className="flex items-center text-slate-600 whitespace-nowrap">
              <Clock size={12} className="mr-1 text-slate-400 flex-shrink-0" />
              {r.fechaFin}
            </div>
          </td>
          <td className={`${tdClass} text-slate-600 tabular-nums whitespace-nowrap`}>
            {r.horaInicioTarea} — {r.horaFinTarea}
          </td>
          <td className={`${tdClass} text-slate-600 tabular-nums`}>{r.cantidadMinutos} min</td>
          <td className={tdClass}>
            <UbicacionCell verified={r.estadoCompletado === 'Completado'} />
          </td>
        </tr>
      ))}
    </tbody>
  </table>
);

export default Cleans;
