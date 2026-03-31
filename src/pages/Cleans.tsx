import React, { useState, useEffect } from 'react';
import { 
  ClipboardList, 
  Sparkles, 
  Wrench, 
  Loader2, 
  Search,
  CheckCircle2,
  Clock,
  MapPin
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
        <Loader2 className="animate-spin text-blue-600" size={40} />
        <p className="text-slate-500 font-medium">Cargando registros...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Limpiezas</h1>
          <p className="text-slate-500 mt-1">Gestión de check-ins y check-outs de trabajadores.</p>
        </div>
        
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Buscar por apto o nombre..." 
            className="pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 w-full md:w-64 transition-all"
          />
        </div>
      </header>

      {/* Tab Navigation */}
      <div className="flex bg-slate-200/50 p-1 rounded-2xl w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as TabType)}
            className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              activeTab === tab.id 
                ? 'bg-white text-blue-600 shadow-sm' 
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Content Area */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          {activeTab === 'normal' && (
            <TableNormalCleans data={normalCleans} />
          )}
          {activeTab === 'initial' && (
            <TableInitialCleans data={initialCleans} />
          )}
          {activeTab === 'handyman' && (
            <TableHandyman data={handymanRecords} />
          )}
        </div>
      </div>
    </div>
  );
};

// Sub-components: Tables
const TableNormalCleans: React.FC<{ data: NormalCleanRecord[] }> = ({ data }) => (
  <table className="w-full text-left border-collapse min-w-[1200px]">
    <thead>
      <tr className="bg-slate-50/50 border-b border-slate-200">
        <th className="px-6 py-4 text-xs font-normal text-slate-500 uppercase">Trabajador</th>
        <th className="px-6 py-4 text-xs font-normal text-slate-500 uppercase">Apartamento</th>
        <th className="px-6 py-4 text-xs font-normal text-slate-500 uppercase">Check-in</th>
        <th className="px-6 py-4 text-xs font-normal text-slate-500 uppercase">Check-out</th>
        <th className="px-6 py-4 text-xs font-normal text-slate-500 uppercase">Horas (E/S)</th>
        <th className="px-6 py-4 text-xs font-normal text-slate-500 uppercase">Km</th>
        <th className="px-6 py-4 text-xs font-normal text-slate-500 uppercase">Ubicación</th>
        <th className="px-6 py-4 text-xs font-normal text-slate-500 uppercase text-center">Estado</th>
      </tr>
    </thead>
    <tbody className="divide-y divide-slate-100">
      {data.map((r) => (
        <tr key={r.id} className="hover:bg-slate-50 transition-colors text-sm">
          <td className="px-6 py-4">
            <div className="font-normal text-slate-900">{r.nombre} {r.apellidos}</div>
            <div className="text-xs text-slate-500">{r.telefono}</div>
          </td>
          <td className="px-6 py-4 font-normal text-blue-600">{r.apartamento}</td>
          <td className="px-6 py-4">
            <div className="flex items-center text-slate-600">
              <Clock size={14} className="mr-1.5 text-slate-400" />
              {r.checkinFecha}
            </div>
            <div className="flex items-center text-xs text-slate-400 mt-1">
              <MapPin size={12} className="mr-1" />
              {r.checkinUbicacion}
            </div>
          </td>
          <td className="px-6 py-4">
            <div className="flex items-center text-slate-600">
              <Clock size={14} className="mr-1.5 text-slate-400" />
              {r.checkoutFecha}
            </div>
            <div className="flex items-center text-xs text-slate-400 mt-1">
              <MapPin size={12} className="mr-1" />
              {r.checkoutUbicacion}
            </div>
          </td>
          <td className="px-6 py-4 text-slate-600">
            {r.horaEntrada} - {r.horaSalida}
          </td>
          <td className="px-6 py-4 text-slate-600">{r.km} km</td>
          <td className="px-6 py-4">
            <div className="flex items-center text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg w-fit border border-emerald-100/50">
              <CheckCircle2 size={12} className="mr-1.5" />
              <span className="text-[10px] uppercase font-normal tracking-wider">Gps Match</span>
            </div>
          </td>
          <td className="px-6 py-4 text-center">
            {r.checked ? <CheckCircle2 className="mx-auto text-emerald-500" size={20} /> : '-'}
          </td>
        </tr>
      ))}
    </tbody>
  </table>
);

const TableInitialCleans: React.FC<{ data: InitialCleanRecord[] }> = ({ data }) => (
  <table className="w-full text-left border-collapse min-w-[1200px]">
    <thead>
      <tr className="bg-slate-50/50 border-b border-slate-200">
        <th className="px-6 py-4 text-xs font-normal text-slate-500 uppercase">Trabajador</th>
        <th className="px-6 py-4 text-xs font-normal text-slate-500 uppercase">Apartamento</th>
        <th className="px-6 py-4 text-xs font-normal text-slate-500 uppercase">Check-in</th>
        <th className="px-6 py-4 text-xs font-normal text-slate-500 uppercase">Check-out</th>
        <th className="px-6 py-4 text-xs font-normal text-slate-500 uppercase">Horas (E/S)</th>
        <th className="px-6 py-4 text-xs font-normal text-slate-500 uppercase">Km</th>
        <th className="px-6 py-4 text-xs font-normal text-slate-500 uppercase">Ubicación</th>
        <th className="px-6 py-4 text-xs font-normal text-slate-500 uppercase text-center">Estado</th>
      </tr>
    </thead>
    <tbody className="divide-y divide-slate-100">
      {data.map((r) => (
        <tr key={r.id} className="hover:bg-slate-50 transition-colors text-sm">
          <td className="px-6 py-4">
            <div className="font-normal text-slate-900">{r.nombre} {r.apellidos}</div>
            <div className="text-xs text-slate-500">{r.telefono}</div>
          </td>
          <td className="px-6 py-4 font-normal text-blue-600">{r.apartamento}</td>
          <td className="px-6 py-4">
            <div className="flex items-center text-slate-600">
              <Clock size={14} className="mr-1.5 text-slate-400" />
              {r.checkinFecha}
            </div>
          </td>
          <td className="px-6 py-4">
            <div className="flex items-center text-slate-600">
              <Clock size={14} className="mr-1.5 text-slate-400" />
              {r.checkoutFecha}
            </div>
          </td>
          <td className="px-6 py-4 text-slate-600">
            {r.horaEntrada} - {r.horaSalida}
          </td>
          <td className="px-6 py-4 text-slate-600">{r.km} km</td>
          <td className="px-6 py-4">
            <div className="flex items-center text-blue-600 bg-blue-50 px-2 py-1 rounded-lg w-fit border border-blue-100/50">
              <CheckCircle2 size={12} className="mr-1.5" />
              <span className="text-[10px] uppercase font-normal tracking-wider">Verificada</span>
            </div>
          </td>
          <td className="px-6 py-4 text-center">
            {r.checked ? <CheckCircle2 className="mx-auto text-emerald-500" size={20} /> : '-'}
          </td>
        </tr>
      ))}
    </tbody>
  </table>
);


const TableHandyman: React.FC<{ data: HandymanRecord[] }> = ({ data }) => (
  <table className="w-full text-left border-collapse min-w-[1200px]">
    <thead>
      <tr className="bg-slate-50/50 border-b border-slate-200">
        <th className="px-6 py-4 text-xs font-normal text-slate-500 uppercase">Operario</th>
        <th className="px-6 py-4 text-xs font-normal text-slate-500 uppercase">Alojamiento</th>
        <th className="px-6 py-4 text-xs font-normal text-slate-500 uppercase">Llegada</th>
        <th className="px-6 py-4 text-xs font-normal text-slate-500 uppercase">Fin</th>
        <th className="px-6 py-4 text-xs font-normal text-slate-500 uppercase">Tarea (E/S)</th>
        <th className="px-6 py-4 text-xs font-normal text-slate-500 uppercase">Minutos</th>
        <th className="px-6 py-4 text-xs font-normal text-slate-500 uppercase">Ubicación</th>
        <th className="px-6 py-4 text-xs font-normal text-slate-500 uppercase text-center">Estado</th>
      </tr>
    </thead>
    <tbody className="divide-y divide-slate-100">
      {data.map((r) => (
        <tr key={r.id} className="hover:bg-slate-50 transition-colors text-sm">
          <td className="px-6 py-4">
            <div className="font-normal text-slate-900">{r.nombre} {r.apellidos}</div>
            <div className="text-xs text-slate-500">{r.telefono}</div>
          </td>
          <td className="px-6 py-4 font-normal text-blue-600">{r.alojamiento}</td>
          <td className="px-6 py-4">
            <div className="flex items-center text-slate-600">
              <Clock size={14} className="mr-1.5 text-slate-400" />
              {r.fechaLlegada}
            </div>
            <div className="flex items-center text-xs text-slate-400 mt-1">
              <MapPin size={12} className="mr-1" />
              {r.ubicacionInicio}
            </div>
          </td>
          <td className="px-6 py-4">
            <div className="flex items-center text-slate-600">
              <Clock size={14} className="mr-1.5 text-slate-400" />
              {r.fechaFin}
            </div>
            <div className="flex items-center text-xs text-slate-400 mt-1">
              <MapPin size={12} className="mr-1" />
              {r.ubicacionFin}
            </div>
          </td>
          <td className="px-6 py-4 text-slate-600">
            {r.horaInicioTarea} - {r.horaFinTarea}
          </td>
          <td className="px-6 py-4 text-slate-600">{r.cantidadMinutos} min</td>
          <td className="px-6 py-4">
            <div className="flex items-center text-orange-600 bg-orange-50 px-2 py-1 rounded-lg w-fit border border-orange-100/50">
              <CheckCircle2 size={12} className="mr-1.5" />
              <span className="text-[10px] uppercase font-normal tracking-wider">Verificado Manitas</span>
            </div>
          </td>
          <td className="px-6 py-4 text-center">
            <span className="text-[10px] px-2 py-1 bg-emerald-50 text-emerald-600 rounded-full font-normal uppercase tracking-wider border border-emerald-100">
              {r.estadoCompletado}
            </span>
          </td>
        </tr>
      ))}
    </tbody>
  </table>
);


export default Cleans;
