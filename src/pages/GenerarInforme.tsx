import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  FileText, Calendar, Users, Home, Settings,
  ChevronRight, AlertCircle, ChevronDown,
  Download, Loader2, CheckCircle2, Banknote,
  Sparkles, WrenchIcon, TriangleAlert,
  ZoomIn, ZoomOut,
} from 'lucide-react';
import { appsScriptApi } from '../services/api';
import { PagoRecord, Incidencia, NormalCleanRecord, HandymanRecord } from '../services/mockData';
import { generatePDF, ReportData } from '../services/pdfExport';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import logoSrc from '../assets/logo/LogoEstandar.png';

type ExportStep = 'idle' | 'collecting' | 'building' | 'done';

const fmt = (n: number) =>
  n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });

const fmtShort = (s: string) =>
  new Date(s.length === 10 ? s + 'T00:00:00' : s)
    .toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' });

const PERIOD_LABELS: Record<string, string> = {
  'este-mes':      'Este mes',
  'mes-pasado':    'Mes pasado',
  'trimestre':     'Último trimestre',
  'personalizado': 'Personalizado',
};

// ── Datos de muestra para la vista previa ─────────────────────────────────────
const SAMPLE = {
  pagos: [
    { w: 'María García',     d: '01/04/26', c: 'Liquidación mensual', v: '980,20 €',   paid: true  },
    { w: 'Juan Pérez',       d: '28/03/26', c: 'Liquidación mensual', v: '1.250,50 €', paid: false },
    { w: 'Carlos Rodríguez', d: '28/03/26', c: 'Liquidación mensual', v: '1.560,00 €', paid: true  },
    { w: 'Ana Martínez',     d: '25/03/26', c: 'Pago por reserva',    v: '1.100,00 €', paid: false },
  ],
  cleans: [
    { w: 'María García',     apt: 'Apt. Ramblas 12',    e: '09:00', s: '11:30', km: 5  },
    { w: 'Juan Pérez',       apt: 'Penthouse Diagonal', e: '10:00', s: '12:00', km: 12 },
    { w: 'Carlos Rodríguez', apt: 'Estudio Gracia 5',   e: '08:30', s: '10:45', km: 8  },
    { w: 'Ana Martínez',     apt: 'Ático Sol 7',        e: '11:00', s: '13:30', km: 15 },
  ],
  incidencias: [
    { w: 'María García',     apt: 'Apt. Ramblas 12',  desc: 'Persiana rota en hab. principal', v: '45,00 €' },
    { w: 'Juan Pérez',       apt: 'Casa Marina 3B',   desc: 'Mancha en el sofá',               v: '12,50 €' },
    { w: 'Carlos Rodríguez', apt: 'Estudio Gracia 5', desc: 'Grifo cocina con fuga leve',      v: '30,00 €' },
  ],
  handyman: [
    { w: 'Carlos Rodríguez', apt: 'Loft Born 2',    t: 'Reparación de persiana', min: 40 },
    { w: 'Juan Pérez',       apt: 'Casa Marina 3B', t: 'Cambio bombilla baño',   min: 15 },
  ],
};

const GenerarInforme: React.FC = () => {
  const [workers, setWorkers]               = useState<{ id: string; fullName: string }[]>([]);
  const [accommodations, setAccommodations] = useState<{ id: string; name: string }[]>([]);
  const [pagos, setPagos]                   = useState<PagoRecord[]>([]);
  const [incidencias, setIncidencias]       = useState<Incidencia[]>([]);
  const [cleans, setCleans]                 = useState<NormalCleanRecord[]>([]);
  const [handyman, setHandyman]             = useState<HandymanRecord[]>([]);
  const [loading, setLoading]               = useState(true);
  const [exportStep, setExportStep]         = useState<ExportStep>('idle');
  const [zoom, setZoom]                     = useState(1);
  const [pan, setPan]                       = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging]         = useState(false);
  const dragOrigin = useRef<{ mx: number; my: number; px: number; py: number } | null>(null);
  const MIN_ZOOM = 0.5;
  const MAX_ZOOM = 2;
  const ZOOM_STEP = 0.15;

  const handleZoomChange = useCallback((delta: number) => {
    setZoom(z => {
      const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, +(z + delta).toFixed(2)));
      if (next === 1) setPan({ x: 0, y: 0 });
      return next;
    });
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    dragOrigin.current = { mx: e.clientX, my: e.clientY, px: pan.x, py: pan.y };
  }, [pan]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging || !dragOrigin.current) return;
    setPan({
      x: dragOrigin.current.px + (e.clientX - dragOrigin.current.mx),
      y: dragOrigin.current.py + (e.clientY - dragOrigin.current.my),
    });
  }, [isDragging]);

  const stopDrag = useCallback(() => {
    setIsDragging(false);
    dragOrigin.current = null;
  }, []);

  const [selectedPeriod, setSelectedPeriod] = useState('este-mes');
  const [selectedWorker, setSelectedWorker] = useState('all');
  const [selectedAcc, setSelectedAcc]       = useState('all');
  const [options, setOptions]               = useState({
    pagos: true, limpiezas: true, incidencias: true, handyman: false,
  });

  useEffect(() => {
    Promise.all([
      appsScriptApi.getWorkers(),
      appsScriptApi.getAccommodations(),
      appsScriptApi.getAllPagos(),
      appsScriptApi.getRecentIncidencias(50),
      appsScriptApi.getNormalCleans(),
      appsScriptApi.getHandymanRecords(),
    ]).then(([w, a, p, i, c, h]) => {
      setWorkers(w); setAccommodations(a);
      setPagos(p); setIncidencias(i as Incidencia[]);
      setCleans(c); setHandyman(h);
    }).finally(() => setLoading(false));
  }, []);

  const workerName = workers.find(w => w.id === selectedWorker)?.fullName ?? null;
  const accName    = accommodations.find(a => a.id === selectedAcc)?.name ?? null;

  const fPagos  = useMemo(() => pagos.filter(p => !workerName || p.workerName === workerName), [pagos, workerName]);
  const fCleans = useMemo(() => cleans.filter(c =>
    (!workerName || `${c.nombre} ${c.apellidos}` === workerName) &&
    (!accName    || c.apartamento === accName)),
  [cleans, workerName, accName]);
  const fIncid  = useMemo(() => incidencias.filter(i =>
    (!workerName || i.userName === workerName) &&
    (!accName    || i.accommodationName === accName)),
  [incidencias, workerName, accName]);
  const fHandy  = useMemo(() => handyman.filter(h =>
    (!workerName || `${h.nombre} ${h.apellidos}` === workerName) &&
    (!accName    || h.alojamiento === accName)),
  [handyman, workerName, accName]);

  const handleExport = async () => {
    setExportStep('collecting');
    await new Promise(r => setTimeout(r, 900));
    setExportStep('building');
    await new Promise(r => setTimeout(r, 700));
    await generatePDF(
      { pagos: fPagos, incidencias: fIncid, cleans: fCleans, handyman: fHandy },
      options,
      { periodo: selectedPeriod, workerName, accName },
      logoSrc,
    );
    setExportStep('done');
    setTimeout(() => setExportStep('idle'), 3000);
  };

  if (loading) return <LoadingSpinner />;

  const isExporting = exportStep === 'collecting' || exportStep === 'building';

  const periods = [
    { id: 'este-mes',      label: 'Este mes'         },
    { id: 'mes-pasado',    label: 'Mes pasado'       },
    { id: 'trimestre',     label: 'Último trimestre' },
    { id: 'personalizado', label: 'Personalizado'    },
  ];

  const contentOpts = [
    { id: 'pagos',       label: 'Pagos y Liquidaciones',   Icon: Banknote,      count: Math.max(fPagos.length,  SAMPLE.pagos.length)       },
    { id: 'limpiezas',   label: 'Registro de Limpiezas',   Icon: Sparkles,      count: Math.max(fCleans.length, SAMPLE.cleans.length)      },
    { id: 'incidencias', label: 'Reporte de Incidencias',  Icon: TriangleAlert, count: Math.max(fIncid.length,  SAMPLE.incidencias.length) },
    { id: 'handyman',    label: 'Tareas de Mantenimiento', Icon: WrenchIcon,    count: Math.max(fHandy.length,  SAMPLE.handyman.length)    },
  ];

  // Preview: usa datos reales si existen, si no muestra de ejemplo
  const previewPagos  = fPagos.length  > 0
    ? fPagos.slice(0, 4).map(p  => ({ w: p.workerName, d: fmtShort(p.fecha), c: p.concepto, v: fmt(p.importe), paid: p.estado === 'pagado' }))
    : SAMPLE.pagos;
  const previewCleans = fCleans.length > 0
    ? fCleans.slice(0, 4).map(c => ({ w: `${c.nombre} ${c.apellidos}`, apt: c.apartamento, e: c.horaEntrada, s: c.horaSalida, km: c.km }))
    : SAMPLE.cleans;
  const previewIncid  = fIncid.length  > 0
    ? fIncid.slice(0, 3).map(i  => ({ w: i.userName, apt: i.accommodationName, desc: i.description, v: fmt(i.coste) }))
    : SAMPLE.incidencias;
  const previewHandy  = fHandy.length  > 0
    ? fHandy.slice(0, 2).map(h  => ({ w: `${h.nombre} ${h.apellidos}`, apt: h.alojamiento, t: h.observacionesTarea, min: h.cantidadMinutos }))
    : SAMPLE.handyman;

  const today = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' });
  const todayShort = new Date().toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' });

  const totalPagado    = fPagos.filter(p => p.estado === 'pagado').reduce((s, p) => s + p.importe, 0);
  const totalPendiente = fPagos.filter(p => p.estado === 'pendiente').reduce((s, p) => s + p.importe, 0);

  const kpis = [
    { l: 'Total pagado',  v: fPagos.length > 0 ? fmt(totalPagado)    : '3.790,70 €' },
    { l: 'Pendiente',     v: fPagos.length > 0 ? fmt(totalPendiente) : '2.350,50 €' },
    { l: 'Limpiezas',     v: String(fCleans.length > 0 ? fCleans.length : SAMPLE.cleans.length)     },
    { l: 'Incidencias',   v: String(fIncid.length  > 0 ? fIncid.length  : SAMPLE.incidencias.length) },
  ];

  return (
    <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-2 duration-700 h-full">

      {/* Header */}
      <header className="flex items-baseline justify-between px-1 shrink-0">
        <h1 className="text-xl font-normal text-slate-800 dark:text-stone-200 tracking-tight font-display">
          Generar Informe
        </h1>
        <p className="text-xs text-slate-400 dark:text-stone-500">
          Configura los filtros y previsualiza el informe antes de exportar.
        </p>
      </header>

      {/* Body — 65 / 35 */}
      <div className="flex-1 grid gap-4 min-h-0" style={{ gridTemplateColumns: '1fr 1fr' }}>

        {/* ── Columna izquierda (65%): Filtros ── */}
        <div className="flex flex-col gap-4 min-h-0 overflow-y-auto">

          {/* Periodo + Filtros en una fila */}
          <div className="flex flex-col gap-4 shrink-0">

            {/* Periodo */}
            <div className="bg-white/80 dark:bg-stone-900 border border-white/60 dark:border-stone-700/50 rounded-2xl overflow-hidden">
              <div className="px-5 py-3 border-b border-stone-100 dark:border-stone-800 bg-stone-50/30 dark:bg-stone-800/20 flex items-center gap-2">
                <Calendar size={13} className="text-orange-500" />
                <span className="text-[11px] uppercase tracking-wider text-slate-400 dark:text-stone-500">Periodo</span>
              </div>
              <div className="p-3 grid grid-cols-2 gap-2">
                {periods.map(p => (
                  <button
                    key={p.id}
                    onClick={() => setSelectedPeriod(p.id)}
                    className={`py-2 rounded-lg text-xs font-normal transition-all border ${
                      selectedPeriod === p.id
                        ? 'bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-500/30'
                        : 'bg-stone-50/50 dark:bg-stone-800/30 text-slate-500 dark:text-stone-400 border-stone-100 dark:border-stone-700/50 hover:border-stone-200 hover:text-slate-700 dark:hover:text-stone-300'
                    }`}
                  >{p.label}</button>
                ))}
              </div>
            </div>

            {/* Filtros */}
            <div className="bg-white/80 dark:bg-stone-900 border border-white/60 dark:border-stone-700/50 rounded-2xl overflow-hidden">
              <div className="px-5 py-3 border-b border-stone-100 dark:border-stone-800 bg-stone-50/30 dark:bg-stone-800/20 flex items-center gap-2">
                <Users size={13} className="text-orange-500" />
                <span className="text-[11px] uppercase tracking-wider text-slate-400 dark:text-stone-500">Filtros</span>
              </div>
              <div className="p-3 flex flex-col gap-3">
                {[
                  { label: 'Trabajador',  Icon: Users, value: selectedWorker, set: setSelectedWorker,
                    opts: [{ v: 'all', l: 'Todos los trabajadores' }, ...workers.map(w => ({ v: w.id, l: w.fullName }))] },
                  { label: 'Alojamiento', Icon: Home,  value: selectedAcc,    set: setSelectedAcc,
                    opts: [{ v: 'all', l: 'Todos los alojamientos' }, ...accommodations.map(a => ({ v: a.id, l: a.name }))] },
                ].map(({ label, Icon, value, set, opts }) => (
                  <div key={label} className="space-y-1.5">
                    <label className="text-[11px] text-slate-400 dark:text-stone-500 flex items-center gap-1.5">
                      <Icon size={10} />{label}
                    </label>
                    <div className="relative">
                      <select
                        value={value}
                        onChange={e => set(e.target.value)}
                        className="w-full pr-7 pl-3 py-2 bg-stone-50/50 dark:bg-stone-800/30 border border-stone-100 dark:border-stone-700/50 rounded-lg text-xs text-slate-700 dark:text-stone-300 focus:outline-none focus:ring-2 focus:ring-orange-500/20 appearance-none cursor-pointer hover:border-stone-200 transition-all"
                      >
                        {opts.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
                      </select>
                      <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Contenido a incluir */}
          <div className="bg-white/80 dark:bg-stone-900 border border-white/60 dark:border-stone-700/50 rounded-2xl overflow-hidden shrink-0">
            <div className="px-5 py-3 border-b border-stone-100 dark:border-stone-800 bg-stone-50/30 dark:bg-stone-800/20 flex items-center gap-2">
              <Settings size={13} className="text-orange-500" />
              <span className="text-[11px] uppercase tracking-wider text-slate-400 dark:text-stone-500">Contenido</span>
              <span className="ml-auto text-[10px] text-slate-400 dark:text-stone-500">
                {Object.values(options).filter(Boolean).length} secciones
              </span>
            </div>
            <div className="flex flex-col divide-y divide-stone-100 dark:divide-stone-800">
              {contentOpts.map(({ id, label, Icon, count }) => {
                const active = options[id as keyof typeof options];
                return (
                  <div
                    key={id}
                    onClick={() => setOptions(p => ({ ...p, [id]: !p[id as keyof typeof p] }))}
                    className="flex items-center gap-3 px-5 py-3 cursor-pointer hover:bg-stone-50/50 dark:hover:bg-stone-800/30 group transition-colors"
                  >
                    <div className={`shrink-0 w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
                      active ? 'bg-orange-500 border-orange-500' : 'border-stone-300 dark:border-stone-600 group-hover:border-orange-400'
                    }`}>
                      {active && (
                        <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
                          <path d="M1 3L3 5L7 1" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </div>
                    <span className={`flex-1 text-xs transition-colors ${active ? 'text-slate-700 dark:text-stone-200' : 'text-slate-400 dark:text-stone-500'}`}>
                      {label}
                    </span>
                    <span className={`text-[10px] tabular-nums px-1.5 py-0.5 rounded-md ${
                      active ? 'text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-500/10'
                             : 'text-stone-400 dark:text-stone-600 bg-stone-100 dark:bg-stone-800'
                    }`}>{count}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Botón exportar — en la columna izquierda, siempre visible */}
          <div className="shrink-0 mt-auto">
            <button
              onClick={handleExport}
              disabled={isExporting || exportStep === 'done'}
              className={`w-full py-3 rounded-xl text-sm font-normal transition-all flex items-center justify-center gap-2 ${
                exportStep === 'done'
                  ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20 cursor-default'
                  : isExporting
                  ? 'bg-orange-400 text-white cursor-wait'
                  : 'bg-orange-500 hover:bg-orange-600 text-white shadow-lg shadow-orange-500/20 active:scale-[0.99]'
              }`}
            >
              {exportStep === 'done'       ? <><CheckCircle2 size={15}/> Informe descargado</>
               : exportStep === 'collecting'? <><Loader2 size={15} className="animate-spin"/> Recopilando datos...</>
               : exportStep === 'building'  ? <><Loader2 size={15} className="animate-spin"/> Generando PDF...</>
               :                              <><Download size={15}/> Exportar PDF <ChevronRight size={15} className="ml-0.5"/></>}
            </button>
            <p className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400 dark:text-stone-500 mt-2">
              <AlertCircle size={11}/>
              El PDF exportado usa los datos reales filtrados, no los de muestra.
            </p>
          </div>

        </div>

        {/* ── Columna derecha (35%): Preview A4 ── */}
        <div className="flex flex-col min-h-0">

          <div className="flex-1 bg-white/80 dark:bg-stone-900 border border-white/60 dark:border-stone-700/50 rounded-2xl overflow-hidden flex flex-col min-h-0">
            <div className="px-4 py-3 border-b border-stone-100 dark:border-stone-800 bg-stone-50/30 dark:bg-stone-800/20 flex items-center gap-2 shrink-0">
              <FileText size={13} className="text-orange-500" />
              <span className="text-[11px] uppercase tracking-wider text-slate-400 dark:text-stone-500">Vista previa</span>
              <span className="ml-auto flex items-center gap-1">
                <button
                  onClick={() => setZoom(z => Math.max(MIN_ZOOM, +(z - ZOOM_STEP).toFixed(2)))}
                  disabled={zoom <= MIN_ZOOM}
                  className="w-6 h-6 flex items-center justify-center rounded-md text-slate-400 dark:text-stone-500 hover:bg-stone-200 dark:hover:bg-stone-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ZoomOut size={13} />
                </button>
                <span className="text-[10px] tabular-nums text-slate-400 dark:text-stone-500 w-8 text-center select-none">
                  {Math.round(zoom * 100)}%
                </span>
                <button
                  onClick={() => setZoom(z => Math.min(MAX_ZOOM, +(z + ZOOM_STEP).toFixed(2)))}
                  disabled={zoom >= MAX_ZOOM}
                  className="w-6 h-6 flex items-center justify-center rounded-md text-slate-400 dark:text-stone-500 hover:bg-stone-200 dark:hover:bg-stone-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ZoomIn size={13} />
                </button>
              </span>
            </div>

            {/* Área fija — overflow hidden, cursor mano, drag para pan */}
            <div
              className="flex-1 min-h-0 relative overflow-hidden select-none"
              style={{
                background: 'radial-gradient(circle, #d1d5db 1px, transparent 1px)',
                backgroundSize: '16px 16px',
                backgroundColor: '#f3f4f6',
                cursor: isDragging ? 'grabbing' : 'grab',
              }}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={stopDrag}
              onMouseLeave={stopDrag}
              onDoubleClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}
            >
              {/* Capa de transformación — translate + scale sin afectar layout externo */}
              <div
                style={{
                  position: 'absolute', inset: 0,
                  display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
                  padding: '12px',
                  transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                  transformOrigin: 'top center',
                  transition: isDragging ? 'none' : 'transform 0.15s ease',
                  pointerEvents: 'none',
                }}
              >
              {/* Hoja A4 — ancho fijo 100%, ratio 210:297, containerType para cqw */}
              <div
                className="relative bg-white shadow-xl overflow-hidden"
                style={{ width: '100%', aspectRatio: '210 / 297', containerType: 'inline-size', flexShrink: 0 }}
              >
                {/* Cabecera */}
                <div style={{ padding: '4% 5% 2.5%', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                  <img src={logoSrc} alt="Logo" style={{ height: '6cqw', width: 'auto', objectFit: 'contain', display: 'block' }} />
                  <span style={{ fontSize: '1.8cqw', color: '#9ca3af' }}>{today}</span>
                </div>

                {/* Cuerpo */}
                <div style={{
                  position: 'absolute', left: 0, right: 0,
                  top: '13%', bottom: '7%',
                  padding: '0 5%',
                  display: 'flex', flexDirection: 'column', gap: '2%',
                  overflow: 'hidden',
                }}>
                  {/* Título */}
                  <div style={{ borderBottom: '1px solid #f5f5f5', paddingBottom: '1.5%' }}>
                    <p style={{ fontSize: '2.8cqw', fontWeight: 600, color: '#111', lineHeight: 1.2 }}>Informe de Actividad</p>
                    <p style={{ fontSize: '1.7cqw', color: '#9ca3af', marginTop: '1%' }}>
                      {PERIOD_LABELS[selectedPeriod]}
                      {workerName ? ` · ${workerName}` : ''}
                      {accName    ? ` · ${accName}`    : ''}
                      {' · '}{todayShort}
                    </p>
                  </div>

                  {/* KPIs */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.5%', flexShrink: 0 }}>
                    {kpis.map(k => (
                      <div key={k.l} style={{ background: '#f8f8f8', border: '1px solid #ebebeb', borderRadius: '4%', padding: '5% 6%' }}>
                        <p style={{ fontSize: '1.2cqw', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{k.l}</p>
                        <p style={{ fontSize: '2cqw', fontWeight: 600, color: '#111', marginTop: '8%' }}>{k.v}</p>
                      </div>
                    ))}
                  </div>

                  {/* Secciones */}
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2.5%', overflow: 'hidden' }}>

                    {options.pagos && (
                      <A4Section title="Pagos y Liquidaciones">
                        <A4Table
                          heads={['Trabajador', 'Fecha', 'Concepto', 'Importe', 'Estado']}
                          rows={previewPagos.map(p => [
                            p.w, p.d, p.c, p.v,
                            <span style={{ color: p.paid ? '#16a34a' : '#d97706', fontWeight: 500 }}>
                              {p.paid ? '● Pagado' : '○ Pendiente'}
                            </span>
                          ])}
                        />
                      </A4Section>
                    )}

                    {options.limpiezas && (
                      <A4Section title="Registro de Limpiezas">
                        <A4Table
                          heads={['Limpiador/a', 'Apartamento', 'Entrada', 'Salida', 'Km']}
                          rows={previewCleans.map(c => [c.w, c.apt, c.e, c.s, c.km])}
                        />
                      </A4Section>
                    )}

                    {options.incidencias && (
                      <A4Section title="Reporte de Incidencias">
                        <A4Table
                          heads={['Reportado por', 'Alojamiento', 'Descripción', 'Coste']}
                          rows={previewIncid.map(i => [i.w, i.apt, i.desc, i.v])}
                        />
                      </A4Section>
                    )}

                    {options.handyman && (
                      <A4Section title="Tareas de Mantenimiento">
                        <A4Table
                          heads={['Técnico', 'Alojamiento', 'Tarea', 'Min.']}
                          rows={previewHandy.map(h => [h.w, h.apt, h.t, h.min])}
                        />
                      </A4Section>
                    )}

                  </div>
                </div>

                {/* Footer anclado */}
                <div style={{
                  position: 'absolute', bottom: 0, left: 0, right: 0,
                  display: 'flex', justifyContent: 'space-between',
                  padding: '1.5% 5%',
                  borderTop: '1px solid #f0f0f0',
                }}>
                  <span style={{ fontSize: '1.4cqw', color: '#d1d5db' }}>RH Pagos — Documento confidencial</span>
                  <span style={{ fontSize: '1.4cqw', color: '#d1d5db' }}>1 / ...</span>
                </div>
              </div>
              </div>{/* /capa transformación */}
            </div>{/* /área fija */}
          </div>

        </div>
      </div>
    </div>
  );
};

// ── Subcomponentes del documento A4 ──────────────────────────────────────────

const A4Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div style={{ flexShrink: 0 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '1.5%', marginBottom: '1%' }}>
      <span style={{ fontSize: '1.3cqw', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>
        {title}
      </span>
      <div style={{ flex: 1, borderTop: '1px solid #f0f0f0' }} />
    </div>
    {children}
  </div>
);

const A4Table: React.FC<{ heads: string[]; rows: (string | number | React.ReactNode)[][] }> = ({ heads, rows }) => (
  <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
    <thead>
      <tr style={{ borderBottom: '1px solid #f0f0f0' }}>
        {heads.map(h => (
          <th key={h} style={{ textAlign: 'left', fontSize: '1.2cqw', color: '#9ca3af', fontWeight: 400, padding: '0.7% 0.5%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {h}
          </th>
        ))}
      </tr>
    </thead>
    <tbody>
      {rows.map((row, ri) => (
        <tr key={ri} style={{ background: ri % 2 !== 0 ? '#fafafa' : 'transparent' }}>
          {row.map((cell, ci) => (
            <td key={ci} style={{ fontSize: '1.4cqw', color: '#4b5563', padding: '0.6% 0.5%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {cell}
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  </table>
);

export default GenerarInforme;
