import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Calendar, 
  Users, 
  Home, 
  Settings, 
  ChevronRight, 
  Loader2,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { appsScriptApi } from '../services/api';
import { Worker, Accommodation } from '../services/mockData';

const GenerarInforme: React.FC = () => {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [accommodations, setAccommodations] = useState<Accommodation[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter States
  const [selectedPeriod, setSelectedPeriod] = useState('este-mes');
  const [selectedWorker, setSelectedWorker] = useState('all');
  const [selectedAcc, setSelectedAcc] = useState('all');
  const [reportOptions, setReportOptions] = useState({
    pagos: true,
    limpiezas: true,
    incidencias: true,
    handyman: false
  });

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [workersData, accData] = await Promise.all([
          appsScriptApi.getWorkers(),
          appsScriptApi.getAccommodations(),
        ]);
        setWorkers(workersData);
        setAccommodations(accData);
      } catch (error) {
        console.error('Error fetching filter data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleToggleOption = (key: keyof typeof reportOptions) => {
    setReportOptions(prev => ({ ...prev, [key]: !prev[key] }));
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <Loader2 className="animate-spin text-orange-600" size={32} />
        <p className="text-slate-500 font-medium">Cargando configurador de informes...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-700">
      
      {/* Header */}
      <header className="flex flex-col space-y-1 px-1">
        <h1 className="text-2xl font-normal text-slate-800 dark:text-stone-200 tracking-tight font-display">
          Generar Informe
        </h1>
        <p className="text-sm text-slate-400 dark:text-stone-500">
          Configura los filtros para exportar un resumen detallado de la actividad.
        </p>
      </header>

      {/* Main Config Card */}
      <div className="bg-white/40 dark:bg-stone-900/40 backdrop-blur-md border border-white/60 dark:border-stone-800/50 rounded-2xl overflow-hidden soft-shadow">
        <div className="p-8 space-y-8">
          
          {/* Section 1: Temporal */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 text-slate-800 dark:text-stone-200">
              <Calendar size={18} className="text-orange-500" />
              <h2 className="text-sm font-medium uppercase tracking-wider text-[11px]">Periodo del Informe</h2>
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { id: 'este-mes', label: 'Este Mes' },
                { id: 'mes-pasado', label: 'Mes Pasado' },
                { id: 'trimestre', label: 'Último Trimestre' },
                { id: 'personalizado', label: 'Personalizado' },
              ].map((p) => (
                <button
                  key={p.id}
                  onClick={() => setSelectedPeriod(p.id)}
                  className={`px-4 py-2.5 rounded-xl text-xs transition-all border ${
                    selectedPeriod === p.id
                      ? 'bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-800/40 font-medium'
                      : 'bg-white/50 dark:bg-stone-800/30 text-slate-500 dark:text-stone-400 border-transparent hover:border-slate-200 dark:hover:border-stone-700'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </section>

          <div className="h-px bg-slate-200/50 dark:bg-stone-800/40" />

          {/* Section 2: Entidades */}
          <section className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Trabajadores */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-slate-800 dark:text-stone-200">
                <Users size={18} className="text-orange-500" />
                <h2 className="text-sm font-medium uppercase tracking-wider text-[11px]">Filtrar por Trabajador</h2>
              </div>
              <select 
                value={selectedWorker}
                onChange={(e) => setSelectedWorker(e.target.value)}
                className="w-full px-4 py-3 bg-white/50 dark:bg-stone-800/30 border border-slate-200 dark:border-stone-700/50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 text-slate-700 dark:text-stone-300 transition-all appearance-none cursor-pointer"
              >
                <option value="all">Todos los trabajadores</option>
                {workers.map(w => (
                  <option key={w.id} value={w.id}>{w.fullName}</option>
                ))}
              </select>
            </div>

            {/* Alojamientos */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-slate-800 dark:text-stone-200">
                <Home size={18} className="text-orange-500" />
                <h2 className="text-sm font-medium uppercase tracking-wider text-[11px]">Filtrar por Alojamiento</h2>
              </div>
              <select 
                value={selectedAcc}
                onChange={(e) => setSelectedAcc(e.target.value)}
                className="w-full px-4 py-3 bg-white/50 dark:bg-stone-800/30 border border-slate-200 dark:border-stone-700/50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 text-slate-700 dark:text-stone-300 transition-all appearance-none cursor-pointer"
              >
                <option value="all">Todos los alojamientos</option>
                {accommodations.map(a => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
          </section>

          <div className="h-px bg-slate-200/50 dark:bg-stone-800/40" />

          {/* Section 3: Contenido */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 text-slate-800 dark:text-stone-200">
              <Settings size={18} className="text-orange-500" />
              <h2 className="text-sm font-medium uppercase tracking-wider text-[11px]">Detalles a incluir en el Informe</h2>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { id: 'pagos', label: 'Resumen de Pagos y Liquidaciones', desc: 'Incluye importes, estados y fechas' },
                { id: 'limpiezas', label: 'Registro de Limpiezas', desc: 'Detalle de entradas, salidas e intermedias' },
                { id: 'incidencias', label: 'Reporte de Incidencias', desc: 'Problemas registrados durante el periodo' },
                { id: 'handyman', label: 'Tareas de Mantenimiento', desc: 'Trabajos de reparaciones realizados' },
              ].map((opt) => (
                <div 
                  key={opt.id}
                  onClick={() => handleToggleOption(opt.id as keyof typeof reportOptions)}
                  className={`group p-4 rounded-2xl border cursor-pointer transition-all flex items-start gap-4 ${
                    reportOptions[opt.id as keyof typeof reportOptions]
                      ? 'bg-orange-50/50 dark:bg-orange-500/5 border-orange-200 dark:border-orange-500/30 ring-1 ring-orange-200 dark:ring-orange-500/20'
                      : 'bg-white/20 dark:bg-stone-800/20 border-slate-100 dark:border-stone-800/40 hover:bg-white/40 dark:hover:bg-stone-800/40'
                  }`}
                >
                  <div className={`mt-0.5 shrink-0 w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${
                    reportOptions[opt.id as keyof typeof reportOptions]
                      ? 'bg-orange-500 border-orange-500 text-white'
                      : 'border-slate-300 dark:border-stone-600 group-hover:border-orange-400'
                  }`}>
                    {reportOptions[opt.id as keyof typeof reportOptions] && <CheckCircle2 size={12} strokeWidth={3} />}
                  </div>
                  <div>
                    <p className={`text-xs font-medium ${
                      reportOptions[opt.id as keyof typeof reportOptions] ? 'text-slate-800 dark:text-stone-200' : 'text-slate-600 dark:text-stone-400'
                    }`}>{opt.label}</p>
                    <p className="text-[10px] text-slate-400 dark:text-stone-500 mt-0.5">{opt.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

        </div>

      </div>

      {/* Info Cards / Tips */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-5 rounded-2xl bg-white/20 dark:bg-stone-900/20 border border-white/60 dark:border-stone-800/40">
          <p className="text-xs font-semibold text-slate-800 dark:text-stone-200 flex items-center gap-2 mb-2">
            <CheckCircle2 size={14} className="text-green-500" />
            Precisión de Datos
          </p>
          <p className="text-[11px] text-slate-400 dark:text-stone-500 leading-relaxed">
            Los informes se basan en los registros validados de limpiezas y pagos realizados hasta la fecha.
          </p>
        </div>
        <div className="p-5 rounded-2xl bg-white/20 dark:bg-stone-900/20 border border-white/60 dark:border-stone-800/40">
          <p className="text-xs font-semibold text-slate-800 dark:text-stone-200 flex items-center gap-2 mb-2">
            <FileText size={14} className="text-blue-500" />
            Formatos Disponibles
          </p>
          <p className="text-[11px] text-slate-400 dark:text-stone-500 leading-relaxed">
            El sistema generará automáticamente una carpeta comprimida con resúmenes en formatos PDF (visual) y XLSX (datos).
          </p>
        </div>
        <div className="p-5 rounded-2xl bg-white/20 dark:bg-stone-900/20 border border-white/60 dark:border-stone-800/40">
          <p className="text-xs font-semibold text-slate-800 dark:text-stone-200 flex items-center gap-2 mb-2">
            <Users size={14} className="text-orange-500" />
            Uso Administrativo
          </p>
          <p className="text-[11px] text-slate-400 dark:text-stone-500 leading-relaxed">
            Esta herramienta está diseñada para facilitar la conciliación bancaria y el envío de liquidaciones a trabajadores.
          </p>
        </div>
      </div>

      {/* Action Tab (Final de la lista) */}
      <div className="pt-4">
        <button 
          className="w-full py-4 bg-orange-500 hover:bg-orange-600 text-white rounded-2xl text-base font-medium shadow-xl shadow-orange-500/20 hover:shadow-orange-500/40 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
        >
          <FileText size={18} />
          Generar Informe
          <ChevronRight size={18} className="ml-1" />
        </button>
        <div className="flex items-center justify-center gap-2 text-slate-500 dark:text-stone-400 text-xs mt-4">
          <AlertCircle size={14} />
          <span>Se generará un archivo PDF y Excel con los datos seleccionados.</span>
        </div>
      </div>

      <div className="pb-16" />
    </div>
  );
};

export default GenerarInforme;
