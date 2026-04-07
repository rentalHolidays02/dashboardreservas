import React, { useEffect, useState, useMemo } from 'react';
import {
  ArrowLeft, Edit2, Phone, Mail, CreditCard, MapPin, Hash,
  ClipboardList, Car, Euro, CheckCircle2, Clock, Send, FileText,
  BarChart3, MessageSquare, Wrench, Sparkles, ChevronRight, Loader2,
  RotateCcw, CheckCheck, Landmark, Building2, Smartphone, User as UserIcon,
  Banknote,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  LineChart, Line,
} from 'recharts';
import { Worker, PagoRecord, NormalCleanRecord, InitialCleanRecord, HandymanRecord } from '../../services/mockData';
import { appsScriptApi, PaymentAction } from '../../services/api';
import { useTheme } from '../../context/ThemeContext';
import { useNavigationGuard } from '../../context/NavigationGuardContext';

interface WorkerProfileProps {
  worker: Worker;
  onBack: () => void;
  onSave?: (worker: Worker) => Promise<void>;
  initialEditing?: boolean;
}

type MainTab = 'datos' | 'registros' | 'analiticas';
type RecordsTab = 'normal' | 'initial' | 'handyman';
type PayTab = 'pending' | 'history';

const PAGO_LABEL: Record<string, string> = {
  bizum: 'Bizum', tarjeta: 'Transferencia', efectivo: 'Efectivo',
};

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
}

const fmtCurrency = (n: number) =>
  n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });

const fmtDate = (s: string) =>
  new Date(s + 'T00:00:00').toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });

const fmtDatetime = (iso: string) =>
  new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

// ─── Sub-components ──────────────────────────────────────────────────────────

const DataRow: React.FC<{ icon: React.ReactNode; label: string; value?: string | null; mono?: boolean }> = ({ icon, label, value, mono }) => (
  <div className="flex items-center gap-3 py-2.5 border-b border-stone-50 dark:border-stone-800/60 last:border-0">
    <span className="w-6 h-6 rounded-md bg-stone-50 dark:bg-stone-800 flex items-center justify-center text-slate-400 dark:text-stone-500 flex-shrink-0">
      {icon}
    </span>
    <span className="text-[11px] text-slate-400 dark:text-stone-500 w-28 flex-shrink-0">{label}</span>
    <span className={`text-xs text-slate-700 dark:text-stone-300 truncate ${mono ? 'font-mono' : ''}`}>
      {value || <span className="text-stone-300 dark:text-stone-600">—</span>}
    </span>
  </div>
);

const EditableRow: React.FC<{
  icon: React.ReactNode; label: string; value?: string | null; mono?: boolean;
  isEditing: boolean; onChange: (v: string) => void; type?: string; placeholder?: string;
}> = ({ icon, label, value, mono, isEditing, onChange, type = 'text', placeholder }) => {
  if (!isEditing) return <DataRow icon={icon} label={label} value={value} mono={mono} />;
  return (
    <div className="flex items-center gap-3 py-2 border-b border-stone-50 dark:border-stone-800/60 last:border-0">
      <span className="w-6 h-6 rounded-md bg-orange-50 dark:bg-orange-900/20 flex items-center justify-center text-orange-400 flex-shrink-0">
        {icon}
      </span>
      <span className="text-[11px] text-slate-400 dark:text-stone-500 w-28 flex-shrink-0">{label}</span>
      <input
        type={type}
        value={value ?? ''}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder ?? label}
        className={`flex-1 min-w-0 text-xs bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded px-2 py-1.5 text-slate-700 dark:text-stone-300 focus:outline-none focus:ring-1 focus:ring-orange-300 dark:focus:ring-orange-800 transition-all ${mono ? 'font-mono' : ''}`}
      />
    </div>
  );
};

const SelectRow: React.FC<{
  icon: React.ReactNode; label: string; value?: string | null;
  options: { value: string; label: string }[];
  isEditing: boolean; onChange: (v: string) => void;
}> = ({ icon, label, value, options, isEditing, onChange }) => {
  if (!isEditing) {
    const opt = options.find(o => o.value === value);
    return <DataRow icon={icon} label={label} value={opt?.label} />;
  }
  return (
    <div className="flex items-center gap-3 py-2 border-b border-stone-50 dark:border-stone-800/60 last:border-0">
      <span className="w-6 h-6 rounded-md bg-orange-50 dark:bg-orange-900/20 flex items-center justify-center text-orange-400 flex-shrink-0">
        {icon}
      </span>
      <span className="text-[11px] text-slate-400 dark:text-stone-500 w-28 flex-shrink-0">{label}</span>
      <select
        value={value ?? ''}
        onChange={e => onChange(e.target.value)}
        className="flex-1 min-w-0 text-xs bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded px-2 py-1.5 text-slate-700 dark:text-stone-300 focus:outline-none focus:ring-1 focus:ring-orange-300 dark:focus:ring-orange-800 transition-all appearance-none cursor-pointer"
      >
        <option value="">Sin especificar</option>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
};

const SectionTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="text-[10px] font-medium text-slate-400 dark:text-stone-500 uppercase tracking-widest mb-3 mt-5 first:mt-0">{children}</p>
);

// ─── Main component ───────────────────────────────────────────────────────────

const WorkerProfile: React.FC<WorkerProfileProps> = ({ worker, onBack, onSave, initialEditing = false }) => {
  const { theme } = useTheme();
  const [activeTab, setActiveTab] = useState<MainTab>('datos');

  // Data
  const [pagos, setPagos] = useState<PagoRecord[]>([]);
  const [normalCleans, setNormalCleans] = useState<NormalCleanRecord[]>([]);
  const [initialCleans, setInitialCleans] = useState<InitialCleanRecord[]>([]);
  const [handymanRecords, setHandymanRecords] = useState<HandymanRecord[]>([]);
  const [paymentActions, setPaymentActions] = useState<PaymentAction[]>([]);

  // UI state
  const [recordsTab, setRecordsTab] = useState<RecordsTab>('normal');
  const [payTab, setPayTab] = useState<PayTab>('pending');
  const [selectedPagoIds, setSelectedPagoIds] = useState<Set<string>>(new Set());
  const [paying, setPaying] = useState(false);
  const [undoingId, setUndoingId] = useState<string | null>(null);
  const [msgType, setMsgType] = useState<string | null>(null);
  const [msgText, setMsgText] = useState('');
  const [isEditing, setIsEditing] = useState(initialEditing);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<Worker>(worker);
  const [discardTarget, setDiscardTarget] = useState<null | { type: 'back' } | { type: 'tab'; tab: MainTab }>(null);

  const { registerGuard } = useNavigationGuard();

  // Register/unregister sidebar navigation guard
  useEffect(() => {
    registerGuard(isEditing ? () => true : null);
    return () => registerGuard(null);
  }, [isEditing]);

  // Block browser refresh / tab close when editing
  useEffect(() => {
    if (!isEditing) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isEditing]);

  const setDraftField = <K extends keyof Worker>(key: K, value: Worker[K]) =>
    setDraft(prev => ({ ...prev, [key]: value }));

  const guardedBack = () => {
    if (isEditing) { setDiscardTarget({ type: 'back' }); return; }
    onBack();
  };

  const guardedSetTab = (tab: MainTab) => {
    if (isEditing && tab !== activeTab) { setDiscardTarget({ type: 'tab', tab }); return; }
    setActiveTab(tab);
  };

  const showDiscardDialog = discardTarget !== null;

  const confirmDiscard = () => {
    setIsEditing(false);
    setDraft(worker);
    if (discardTarget?.type === 'back') onBack();
    else if (discardTarget?.type === 'tab') setActiveTab(discardTarget.tab);
    setDiscardTarget(null);
  };

  const cancelDiscard = () => {
    setDiscardTarget(null);
  };

  const loadPagos = async () => {
    const [data, actions] = await Promise.all([
      appsScriptApi.getWorkerPagos(worker.id),
      appsScriptApi.getWorkerPaymentActions(worker.id),
    ]);
    setPagos(data);
    setPaymentActions(actions);
  };

  useEffect(() => {
    loadPagos();
    appsScriptApi.getWorkerCleans(worker.fullName).then(data => {
      setNormalCleans(data.normal);
      setInitialCleans(data.initial);
      setHandymanRecords(data.handyman);
    });
  }, [worker.id, worker.fullName]);

  const pendingPagos = useMemo(() => pagos.filter(p => p.estado === 'pendiente'), [pagos]);
  const paidPagos = useMemo(() => pagos.filter(p => p.estado === 'pagado'), [pagos]);
  const pendingAmount = useMemo(() => pendingPagos.reduce((a, p) => a + p.importe, 0), [pendingPagos]);
  const selectedAmount = useMemo(() => pagos.filter(p => selectedPagoIds.has(p.id)).reduce((a, p) => a + p.importe, 0), [pagos, selectedPagoIds]);
  const kmCost = (worker.kmsMonth ?? 0) * (worker.precioPorKm ?? 0);

  // Auto-select all pending when they load
  useEffect(() => {
    setSelectedPagoIds(new Set(pendingPagos.map(p => p.id)));
  }, [pendingPagos.length]);

  const togglePago = (id: string) => {
    setSelectedPagoIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };
  const toggleAll = () => {
    setSelectedPagoIds(
      selectedPagoIds.size === pendingPagos.length
        ? new Set()
        : new Set(pendingPagos.map(p => p.id))
    );
  };

  const handlePay = async () => {
    if (selectedPagoIds.size === 0) return;
    setPaying(true);
    try {
      await appsScriptApi.markPagosAsPaid([...selectedPagoIds]);
      await loadPagos();
      setPayTab('history');
    } finally {
      setPaying(false);
    }
  };

  const handleUndo = async (actionId: string) => {
    setUndoingId(actionId);
    try {
      await appsScriptApi.undoPayment(actionId);
      await loadPagos();
      setPayTab('pending');
    } finally {
      setUndoingId(null);
    }
  };

  const handleSaveInline = async () => {
    setSaving(true);
    try {
      await appsScriptApi.updateWorker(draft);
      await onSave?.(draft);
      setIsEditing(false);
    } finally {
      setSaving(false);
    }
  };

  // Chart data
  const earningsChartData = useMemo(() => {
    const map: Record<string, number> = {};
    pagos.forEach(p => {
      const month = p.fecha.slice(0, 7);
      map[month] = (map[month] ?? 0) + p.importe;
    });
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, total]) => ({
        label: new Date(month + '-01').toLocaleDateString('es-ES', { month: 'short', year: '2-digit' }),
        total,
      }));
  }, [pagos]);

  const cleansChartData = useMemo(() => {
    const map: Record<string, { normal: number; initial: number; handyman: number }> = {};
    const add = (fecha: string, type: 'normal' | 'initial' | 'handyman') => {
      const month = fecha.slice(0, 7);
      if (!map[month]) map[month] = { normal: 0, initial: 0, handyman: 0 };
      map[month][type]++;
    };
    normalCleans.forEach(r => add(r.checkinFecha, 'normal'));
    initialCleans.forEach(r => add(r.checkinFecha, 'initial'));
    handymanRecords.forEach(r => add(r.fechaLlegada, 'handyman'));
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, v]) => ({
        label: new Date(month + '-01').toLocaleDateString('es-ES', { month: 'short', year: '2-digit' }),
        ...v,
      }));
  }, [normalCleans, initialCleans, handymanRecords]);

  const totalRecords = normalCleans.length + initialCleans.length + handymanRecords.length;

  const gridColor = theme === 'dark' ? '#44403c' : '#e7e5e4';
  const tickColor = theme === 'dark' ? '#78716c' : '#a8a29e';

  const tabs: { id: MainTab; label: string }[] = [
    { id: 'datos', label: 'Datos trabajador' },
    { id: 'registros', label: 'Registros' },
    { id: 'analiticas', label: 'Analíticas' },
  ];

  const recordTabs = [
    { id: 'normal' as RecordsTab, label: 'Normales', icon: <ClipboardList size={13} />, count: normalCleans.length },
    { id: 'initial' as RecordsTab, label: 'Iniciales', icon: <Sparkles size={13} />, count: initialCleans.length },
    { id: 'handyman' as RecordsTab, label: 'Manitas', icon: <Wrench size={13} />, count: handymanRecords.length },
  ];

  const msgTemplates = [
    { id: 'invoice', icon: <FileText size={14} />, label: 'Enviar factura', placeholder: 'Adjuntar detalles de la factura...' },
    { id: 'summary', icon: <BarChart3 size={14} />, label: 'Resumen mensual', placeholder: 'Resumen del mes de trabajo...' },
    { id: 'custom', icon: <MessageSquare size={14} />, label: 'Mensaje personalizado', placeholder: 'Escribe tu mensaje...' },
  ];

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-500">

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm px-1">
        <button onClick={guardedBack} className="flex items-center gap-1.5 text-slate-400 dark:text-stone-500 hover:text-orange-500 dark:hover:text-orange-400 transition-colors">
          <ArrowLeft size={14} /><span>Trabajadores</span>
        </button>
        <ChevronRight size={13} className="text-slate-300 dark:text-stone-600" />
        <span className="text-slate-700 dark:text-stone-300 font-medium truncate">{worker.fullName}</span>
      </div>

      {/* ═══════════════════════════════════════════════════════════
          PANEL FIJO — siempre visible
      ═══════════════════════════════════════════════════════════ */}
      <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-100 dark:border-stone-800 overflow-hidden">

        {/* Top row: identity + edit button */}
        <div className="p-5 flex items-center gap-4 border-b border-stone-50 dark:border-stone-800">
          {/* Avatar */}
          <div className="w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 bg-orange-100 dark:bg-orange-900/40">
            {worker.photo ? (
              <img src={worker.photo} alt={worker.fullName} className="w-full h-full object-cover" />
            ) : (
              <span className="w-full h-full flex items-center justify-center text-lg font-medium text-orange-700 dark:text-orange-300">
                {getInitials(worker.fullName)}
              </span>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <h2 className="text-base font-medium text-slate-800 dark:text-stone-100 leading-tight truncate">
              {worker.fullName}
            </h2>
            <div className="flex flex-wrap items-center gap-3 mt-1">
              {worker.telefono && (
                <span className="flex items-center gap-1 text-xs text-slate-400 dark:text-stone-500">
                  <Phone size={10} />{worker.telefono}
                </span>
              )}
              {worker.email && (
                <span className="flex items-center gap-1 text-xs text-slate-400 dark:text-stone-500">
                  <Mail size={10} />{worker.email}
                </span>
              )}
              {worker.tipoPago && (
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 border border-orange-100 dark:border-orange-800/50">
                  {PAGO_LABEL[worker.tipoPago]}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {!isEditing && msgTemplates.map(t => (
              <button
                key={t.id}
                onClick={() => setMsgType(msgType === t.id ? null : t.id)}
                className={`flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-xl transition-all ${
                  msgType === t.id
                    ? 'bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 border border-orange-200 dark:border-orange-800/50'
                    : 'bg-stone-100 dark:bg-stone-800 text-slate-500 dark:text-stone-400 hover:text-orange-500 dark:hover:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20 border border-transparent'
                }`}
              >
                {t.icon}{t.label}
              </button>
            ))}
            {isEditing ? (
              <>
                <button
                  onClick={() => { setIsEditing(false); setDraft(worker); }}
                  className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-xl bg-stone-100 dark:bg-stone-800 text-slate-500 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-stone-700 transition-all border border-transparent"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveInline}
                  disabled={saving}
                  className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-xl bg-orange-500 text-white hover:bg-orange-600 transition-all border border-transparent disabled:opacity-70"
                >
                  {saving ? <Loader2 size={13} className="animate-spin" /> : <CheckCheck size={13} />}
                  Guardar
                </button>
              </>
            ) : (
              <button
                onClick={() => { setDraft(worker); setIsEditing(true); }}
                className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-xl bg-stone-100 dark:bg-stone-800 text-slate-500 dark:text-stone-400 hover:text-orange-500 dark:hover:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-all border border-transparent"
              >
                <Edit2 size={13} />Editar
              </button>
            )}
          </div>
        </div>

        {/* Message composer — shown when a communication button is active */}
        {msgType && (
          <div className="px-5 py-3 border-b border-stone-50 dark:border-stone-800 space-y-2 animate-in fade-in duration-200">
            <textarea
              rows={3}
              value={msgText}
              onChange={e => setMsgText(e.target.value)}
              placeholder={msgTemplates.find(t => t.id === msgType)?.placeholder}
              className="w-full px-3 py-2.5 text-xs bg-stone-50 dark:bg-stone-800/50 rounded-xl text-slate-700 dark:text-stone-300 placeholder:text-stone-400 dark:placeholder:text-stone-500 focus:outline-none focus:ring-2 focus:ring-orange-200 dark:focus:ring-orange-900/50 resize-none border border-stone-100 dark:border-stone-800"
            />
            <button
              className="flex items-center justify-center gap-2 py-2.5 px-4 bg-orange-600 text-white text-xs font-medium rounded-xl hover:bg-orange-700 transition-all active:scale-95"
              onClick={() => { setMsgText(''); setMsgType(null); }}
            >
              <Send size={13} />Enviar
            </button>
          </div>
        )}

        {/* Stats strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-stone-50 dark:divide-stone-800">
          {/* Pendiente de cobro */}
          <div className="px-5 py-4">
            <div className="flex items-center gap-1.5 mb-1">
              <Euro size={12} className={pendingAmount > 0 ? 'text-amber-500' : 'text-emerald-500'} />
              <span className="text-[10px] text-slate-400 dark:text-stone-500 uppercase tracking-wide">Por cobrar</span>
            </div>
            <p className={`text-lg font-medium tabular-nums ${pendingAmount > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
              {fmtCurrency(pendingAmount)}
            </p>
            <p className="text-[10px] text-slate-400 dark:text-stone-500 mt-0.5">
              {pendingPagos.length > 0 ? `${pendingPagos.length} factura${pendingPagos.length !== 1 ? 's' : ''} pendiente${pendingPagos.length !== 1 ? 's' : ''}` : 'Al día'}
            </p>
          </div>

          {/* KM */}
          <div className="px-5 py-4">
            <div className="flex items-center gap-1.5 mb-1">
              <Car size={12} className="text-slate-400 dark:text-stone-500" />
              <span className="text-[10px] text-slate-400 dark:text-stone-500 uppercase tracking-wide">Km este mes</span>
            </div>
            <p className="text-lg font-medium tabular-nums text-slate-800 dark:text-stone-100">{worker.kmsMonth} km</p>
            <p className="text-[10px] text-slate-400 dark:text-stone-500 mt-0.5">
              {worker.precioPorKm ? `${fmtCurrency(kmCost)} · ${worker.precioPorKm}€/km` : 'Precio no configurado'}
            </p>
          </div>

          {/* Limpiezas */}
          <div className="px-5 py-4">
            <div className="flex items-center gap-1.5 mb-1">
              <ClipboardList size={12} className="text-slate-400 dark:text-stone-500" />
              <span className="text-[10px] text-slate-400 dark:text-stone-500 uppercase tracking-wide">Limpiezas</span>
            </div>
            <p className="text-lg font-medium tabular-nums text-slate-800 dark:text-stone-100">{worker.cleansCountMonth}</p>
            <p className="text-[10px] text-slate-400 dark:text-stone-500 mt-0.5">
              {worker.pagoPorReserva ? `${fmtCurrency(worker.pagoPorReserva)} por reserva` : 'Tarifa no configurada'}
            </p>
          </div>

          {/* Alojamientos (chips) */}
          <div className="px-5 py-4">
            <div className="flex items-center gap-1.5 mb-1">
              <MapPin size={12} className="text-slate-400 dark:text-stone-500" />
              <span className="text-[10px] text-slate-400 dark:text-stone-500 uppercase tracking-wide">Alojamientos</span>
            </div>
            {worker.accommodations.length === 0 ? (
              <p className="text-xs text-slate-300 dark:text-stone-600">Sin asignar</p>
            ) : (
              <div className="flex flex-wrap gap-1 mt-1">
                {worker.accommodations.slice(0, 2).map(acc => (
                  <span key={acc} className="text-[10px] px-1.5 py-0.5 bg-stone-100 dark:bg-stone-800 text-slate-500 dark:text-stone-400 rounded-md truncate max-w-[90px]">{acc}</span>
                ))}
                {worker.accommodations.length > 2 && (
                  <span className="text-[10px] px-1.5 py-0.5 bg-orange-50 dark:bg-orange-900/30 text-orange-500 rounded-md font-medium">
                    +{worker.accommodations.length - 2}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════
          TABS
      ═══════════════════════════════════════════════════════════ */}
      <div className="flex border-b border-stone-200 dark:border-stone-800">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => guardedSetTab(tab.id)}
            className={`px-4 py-3 text-xs font-medium border-b-2 transition-colors -mb-px ${
              activeTab === tab.id
                ? 'border-orange-500 text-orange-500'
                : 'border-transparent text-slate-400 dark:text-stone-500 hover:text-slate-600 dark:hover:text-stone-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ═══════════════════════════════════════════════════════════
          TAB: DATOS TRABAJADOR
      ═══════════════════════════════════════════════════════════ */}
      {activeTab === 'datos' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 animate-in fade-in duration-300">

          {/* Columna 1 — Datos personales */}
          <div className={`bg-white dark:bg-stone-900 rounded-2xl border border-stone-100 dark:border-stone-800 p-5`}>
            <SectionTitle>Datos personales</SectionTitle>
            <EditableRow icon={<UserIcon size={12} />} label="Nombre completo" value={draft.fullName} isEditing={isEditing} onChange={v => setDraftField('fullName', v)} />
            <EditableRow icon={<Hash size={12} />} label="DNI / NIE" value={draft.dni} mono isEditing={isEditing} onChange={v => setDraftField('dni', v)} />
            <EditableRow icon={<Phone size={12} />} label="Teléfono" value={draft.telefono} isEditing={isEditing} onChange={v => setDraftField('telefono', v)} type="tel" />
            <EditableRow icon={<Mail size={12} />} label="Email" value={draft.email} isEditing={isEditing} onChange={v => setDraftField('email', v)} type="email" />
          </div>

          {/* Columna 2 — Método de pago */}
          <div className={`bg-white dark:bg-stone-900 rounded-2xl border border-stone-100 dark:border-stone-800 p-5`}>
            <SectionTitle>Método de pago</SectionTitle>
            <SelectRow
              icon={<CreditCard size={12} />} label="Tipo"
              value={draft.tipoPago} isEditing={isEditing}
              options={[{ value: 'bizum', label: 'Bizum' }, { value: 'tarjeta', label: 'Transferencia' }, { value: 'efectivo', label: 'Efectivo' }]}
              onChange={v => setDraftField('tipoPago', v as Worker['tipoPago'])}
            />
            <EditableRow icon={<Euro size={12} />} label="Por reserva" value={draft.pagoPorReserva != null ? String(draft.pagoPorReserva) : null} isEditing={isEditing} onChange={v => setDraftField('pagoPorReserva', v === '' ? undefined : Number(v))} type="number" placeholder="0" />
            <EditableRow icon={<Car size={12} />} label="Por km" value={draft.precioPorKm != null ? String(draft.precioPorKm) : null} isEditing={isEditing} onChange={v => setDraftField('precioPorKm', v === '' ? undefined : Number(v))} type="number" placeholder="0" />
          </div>

          {/* Columna 3 — Detalle según tipo de pago */}
          <div className={`bg-white dark:bg-stone-900 rounded-2xl border border-stone-100 dark:border-stone-800 p-5`}>
            {draft.tipoPago === 'bizum' && (
              <>
                <SectionTitle>Bizum</SectionTitle>
                <EditableRow icon={<Phone size={12} />} label="Teléfono Bizum" value={draft.telefonoBizum} isEditing={isEditing} onChange={v => setDraftField('telefonoBizum', v)} type="tel" />
              </>
            )}
            {draft.tipoPago === 'tarjeta' && (
              <>
                <SectionTitle>Transferencia bancaria</SectionTitle>
                <EditableRow icon={<Landmark size={12} />} label="IBAN" value={draft.iban} mono isEditing={isEditing} onChange={v => setDraftField('iban', v)} />
                <EditableRow icon={<Building2 size={12} />} label="Banco" value={draft.banco} isEditing={isEditing} onChange={v => setDraftField('banco', v)} />
                <EditableRow icon={<UserIcon size={12} />} label="Titular" value={draft.titularCuenta} isEditing={isEditing} onChange={v => setDraftField('titularCuenta', v)} />
              </>
            )}
            {draft.tipoPago === 'efectivo' && (
              <>
                <SectionTitle>Efectivo</SectionTitle>
                <p className="text-xs text-slate-400 dark:text-stone-500">Pago en mano. Sin datos bancarios adicionales.</p>
              </>
            )}
            {!draft.tipoPago && (
              <p className="text-xs text-slate-300 dark:text-stone-600">Sin método de pago configurado.</p>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════
          TAB: REGISTROS
      ═══════════════════════════════════════════════════════════ */}
      {activeTab === 'registros' && (
        <div className="space-y-5 animate-in fade-in duration-300">

          {/* ── Gestión de pagos ── */}
          <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-100 dark:border-stone-800 overflow-hidden">
            <div className="px-5 py-4 border-b border-stone-100 dark:border-stone-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h3 className="text-xs font-medium text-slate-500 dark:text-stone-400 uppercase tracking-wider">Gestión de pagos</h3>
                {pendingPagos.length > 0 && (
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-800/40">
                    {pendingPagos.length} pendiente{pendingPagos.length !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
              <div className="flex bg-stone-100 dark:bg-stone-800 rounded-lg p-0.5 gap-0.5">
                {(['pending', 'history'] as PayTab[]).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setPayTab(tab)}
                    className={`px-3 py-1.5 text-[11px] font-medium rounded-md transition-all ${
                      payTab === tab
                        ? 'bg-white dark:bg-stone-700 text-slate-700 dark:text-stone-200 shadow-sm'
                        : 'text-slate-400 dark:text-stone-500 hover:text-slate-600 dark:hover:text-stone-300'
                    }`}
                  >
                    {tab === 'pending' ? 'Pendientes' : 'Historial'}
                  </button>
                ))}
              </div>
            </div>

            {/* Pending */}
            {payTab === 'pending' && (
              pendingPagos.length === 0 ? (
                <div className="px-5 py-10 flex flex-col items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center">
                    <CheckCheck size={18} className="text-emerald-500" />
                  </div>
                  <p className="text-xs text-slate-400 dark:text-stone-500">Sin pagos pendientes</p>
                </div>
              ) : (
                <>
                  <div className="px-5 py-2.5 border-b border-stone-50 dark:border-stone-800 flex items-center gap-3">
                    <input type="checkbox" checked={selectedPagoIds.size === pendingPagos.length} onChange={toggleAll} className="w-3.5 h-3.5 accent-orange-500 cursor-pointer" />
                    <span className="text-[11px] text-slate-400 dark:text-stone-500">Seleccionar todo</span>
                    <span className="ml-auto text-[11px] text-slate-400 dark:text-stone-500">{selectedPagoIds.size}/{pendingPagos.length} seleccionados</span>
                  </div>
                  <div className="divide-y divide-stone-50 dark:divide-stone-800 max-h-56 overflow-y-auto">
                    {pendingPagos.map(p => (
                      <label key={p.id} className={`px-5 py-3 flex items-center gap-3 cursor-pointer transition-colors ${selectedPagoIds.has(p.id) ? 'bg-orange-50/50 dark:bg-orange-900/10' : 'hover:bg-stone-50 dark:hover:bg-stone-800/50'}`}>
                        <input type="checkbox" checked={selectedPagoIds.has(p.id)} onChange={() => togglePago(p.id)} className="w-3.5 h-3.5 accent-orange-500 cursor-pointer flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-slate-700 dark:text-stone-300 truncate">{p.concepto}</p>
                          <p className="text-[11px] text-slate-400 dark:text-stone-500 mt-0.5">{fmtDate(p.fecha)} · {p.limpiezas} limpiezas · {p.km} km</p>
                        </div>
                        <span className="text-sm font-medium tabular-nums text-slate-800 dark:text-stone-100 flex-shrink-0">{fmtCurrency(p.importe)}</span>
                      </label>
                    ))}
                  </div>
                  <div className="px-5 py-4 border-t border-stone-100 dark:border-stone-800 bg-stone-50/50 dark:bg-stone-800/30 flex items-center justify-between gap-4">
                    <div>
                      <p className="text-[11px] text-slate-400 dark:text-stone-500">A pagar ahora</p>
                      <p className={`text-lg font-medium tabular-nums ${selectedPagoIds.size > 0 ? 'text-slate-800 dark:text-stone-100' : 'text-slate-300 dark:text-stone-600'}`}>
                        {fmtCurrency(selectedAmount)}
                      </p>
                    </div>
                    <button
                      onClick={handlePay}
                      disabled={selectedPagoIds.size === 0 || paying}
                      className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white text-xs font-medium rounded-xl hover:bg-emerald-700 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {paying ? <><Loader2 size={14} className="animate-spin" />Registrando...</> : <><CheckCheck size={14} />Registrar pago</>}
                    </button>
                  </div>
                </>
              )
            )}

            {/* History */}
            {payTab === 'history' && (
              paidPagos.length === 0 && paymentActions.length === 0 ? (
                <div className="px-5 py-8 text-center text-xs text-slate-400 dark:text-stone-500">Sin historial de pagos</div>
              ) : (
                <>
                  {paymentActions.length > 0 && (
                    <div className="px-5 py-3 border-b border-stone-100 dark:border-stone-800">
                      <p className="text-[10px] font-medium text-slate-400 dark:text-stone-500 uppercase tracking-wider mb-2">Pagos recientes</p>
                      <div className="space-y-2">
                        {paymentActions.map(action => (
                          <div key={action.id} className="flex items-center justify-between gap-3 px-3 py-2.5 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-100 dark:border-emerald-800/30">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <CheckCircle2 size={14} className="text-emerald-500 flex-shrink-0" />
                              <div className="min-w-0">
                                <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">{fmtCurrency(action.amount)} pagados</p>
                                <p className="text-[10px] text-emerald-600/70 dark:text-emerald-500/70 mt-0.5">{fmtDatetime(action.timestamp)} · {action.pagoIds.length} factura{action.pagoIds.length !== 1 ? 's' : ''}</p>
                              </div>
                            </div>
                            <button
                              onClick={() => handleUndo(action.id)}
                              disabled={undoingId === action.id}
                              className="flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1.5 rounded-lg bg-white dark:bg-stone-800 text-slate-500 dark:text-stone-400 hover:text-orange-500 dark:hover:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20 border border-stone-200 dark:border-stone-700 transition-all active:scale-95 disabled:opacity-50 flex-shrink-0"
                            >
                              {undoingId === action.id ? <Loader2 size={11} className="animate-spin" /> : <RotateCcw size={11} />}
                              Deshacer
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="divide-y divide-stone-50 dark:divide-stone-800 max-h-64 overflow-y-auto">
                    {paidPagos.map(p => (
                      <div key={p.id} className="px-5 py-3 flex items-center justify-between gap-4 hover:bg-stone-50 dark:hover:bg-stone-800/50 transition-colors">
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-slate-700 dark:text-stone-300 truncate">{p.concepto}</p>
                          <p className="text-[11px] text-slate-400 dark:text-stone-500 mt-0.5">{fmtDate(p.fecha)} · {p.limpiezas} limpiezas · {p.km} km</p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-sm font-medium tabular-nums text-slate-800 dark:text-stone-100">{fmtCurrency(p.importe)}</span>
                          <CheckCircle2 size={14} className="text-emerald-500" />
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )
            )}
          </div>

          {/* ── Registros de actividad ── */}
          <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-100 dark:border-stone-800 overflow-hidden">
            <div className="px-5 py-4 border-b border-stone-100 dark:border-stone-800 flex items-center justify-between">
              <h3 className="text-xs font-medium text-slate-500 dark:text-stone-400 uppercase tracking-wider">Registros de actividad</h3>
              <span className="text-[11px] text-slate-400 dark:text-stone-500">{totalRecords} total</span>
            </div>
            <div className="flex border-b border-stone-100 dark:border-stone-800 px-5">
              {recordTabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setRecordsTab(tab.id)}
                  className={`flex items-center gap-1.5 px-1 py-3 mr-5 text-xs font-medium border-b-2 transition-colors ${
                    recordsTab === tab.id
                      ? 'border-orange-500 text-orange-500'
                      : 'border-transparent text-slate-400 dark:text-stone-500 hover:text-slate-600 dark:hover:text-stone-300'
                  }`}
                >
                  {tab.icon}{tab.label}
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md ${recordsTab === tab.id ? 'bg-orange-50 dark:bg-orange-900/30 text-orange-500' : 'bg-stone-100 dark:bg-stone-800 text-slate-400 dark:text-stone-500'}`}>
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>
            <div className="max-h-72 overflow-y-auto">
              {recordsTab === 'normal' && (
                normalCleans.length === 0 ? (
                  <div className="px-5 py-8 text-center text-xs text-slate-400 dark:text-stone-500">Sin registros</div>
                ) : normalCleans.map(r => (
                  <div key={r.id} className="px-5 py-3 border-b border-stone-50 dark:border-stone-800 last:border-0 hover:bg-stone-50 dark:hover:bg-stone-800/50 transition-colors">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium text-slate-700 dark:text-stone-300">{r.apartamento}</p>
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-md ${r.checked ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600' : 'bg-amber-50 dark:bg-amber-900/30 text-amber-600'}`}>
                        {r.checked ? 'Verificado' : 'Pendiente'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 dark:text-stone-500 mt-0.5">{r.checkinFecha} · {r.horaEntrada}–{r.horaSalida} · {r.km} km</p>
                  </div>
                ))
              )}
              {recordsTab === 'initial' && (
                initialCleans.length === 0 ? (
                  <div className="px-5 py-8 text-center text-xs text-slate-400 dark:text-stone-500">Sin registros</div>
                ) : initialCleans.map(r => (
                  <div key={r.id} className="px-5 py-3 border-b border-stone-50 dark:border-stone-800 last:border-0 hover:bg-stone-50 dark:hover:bg-stone-800/50 transition-colors">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium text-slate-700 dark:text-stone-300">{r.apartamento}</p>
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-md ${r.checked ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600' : 'bg-amber-50 dark:bg-amber-900/30 text-amber-600'}`}>
                        {r.checked ? 'Verificado' : 'Pendiente'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 dark:text-stone-500 mt-0.5">{r.checkinFecha} · {r.horaEntrada}–{r.horaSalida} · {r.km} km</p>
                  </div>
                ))
              )}
              {recordsTab === 'handyman' && (
                handymanRecords.length === 0 ? (
                  <div className="px-5 py-8 text-center text-xs text-slate-400 dark:text-stone-500">Sin registros</div>
                ) : handymanRecords.map(r => (
                  <div key={r.id} className="px-5 py-3 border-b border-stone-50 dark:border-stone-800 last:border-0 hover:bg-stone-50 dark:hover:bg-stone-800/50 transition-colors">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium text-slate-700 dark:text-stone-300">{r.alojamiento}</p>
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-md ${r.estadoCompletado === 'Completado' ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600' : 'bg-amber-50 dark:bg-amber-900/30 text-amber-600'}`}>
                        {r.estadoCompletado}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 dark:text-stone-500 mt-0.5">{r.fechaLlegada} · {r.horaInicioTarea}–{r.horaFinTarea} · {r.cantidadMinutos} min</p>
                    {r.observacionesTarea && <p className="text-[11px] text-slate-400 dark:text-stone-500 italic mt-0.5">"{r.observacionesTarea}"</p>}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════
          TAB: ANALÍTICAS
      ═══════════════════════════════════════════════════════════ */}
      {activeTab === 'analiticas' && (
        <div className="space-y-5 animate-in fade-in duration-300">

          {/* KPIs rápidos */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Total cobrado', value: fmtCurrency(paidPagos.reduce((a, p) => a + p.importe, 0)), sub: `${paidPagos.length} pagos`, color: 'text-emerald-600 dark:text-emerald-400' },
              { label: 'Pendiente', value: fmtCurrency(pendingAmount), sub: `${pendingPagos.length} facturas`, color: pendingAmount > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400' },
              { label: 'Ingreso km mes', value: fmtCurrency(kmCost), sub: `${worker.kmsMonth} km × ${worker.precioPorKm ?? 0}€`, color: 'text-slate-800 dark:text-stone-100' },
              { label: 'Total registros', value: totalRecords.toString(), sub: `${normalCleans.length} norm. · ${initialCleans.length} inic. · ${handymanRecords.length} man.`, color: 'text-slate-800 dark:text-stone-100' },
            ].map(k => (
              <div key={k.label} className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-100 dark:border-stone-800 p-4">
                <p className="text-[11px] text-slate-400 dark:text-stone-500 mb-1">{k.label}</p>
                <p className={`text-xl font-medium tabular-nums ${k.color}`}>{k.value}</p>
                <p className="text-[10px] text-slate-400 dark:text-stone-500 mt-0.5">{k.sub}</p>
              </div>
            ))}
          </div>

          {/* Gráfica de ingresos */}
          <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-100 dark:border-stone-800 p-5">
            <h3 className="text-xs font-medium text-slate-500 dark:text-stone-400 uppercase tracking-wider mb-4">Evolución de ingresos</h3>
            {earningsChartData.length === 0 ? (
              <div className="h-40 flex items-center justify-center text-xs text-slate-400 dark:text-stone-500">Sin datos</div>
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={earningsChartData} barSize={28}>
                  <CartesianGrid vertical={false} stroke={gridColor} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: tickColor }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: tickColor }} axisLine={false} tickLine={false} tickFormatter={v => `${v}€`} width={48} />
                  <Tooltip
                    formatter={(v: number) => [fmtCurrency(v), 'Importe']}
                    contentStyle={{ background: theme === 'dark' ? '#1c1917' : '#fff', border: `1px solid ${gridColor}`, borderRadius: 10, fontSize: 11 }}
                    cursor={{ fill: theme === 'dark' ? '#292524' : '#f5f5f4' }}
                  />
                  <Bar dataKey="total" fill="#ea580c" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Gráfica de actividad */}
          <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-100 dark:border-stone-800 p-5">
            <h3 className="text-xs font-medium text-slate-500 dark:text-stone-400 uppercase tracking-wider mb-4">Actividad por mes</h3>
            {cleansChartData.length === 0 ? (
              <div className="h-40 flex items-center justify-center text-xs text-slate-400 dark:text-stone-500">Sin datos de actividad</div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={cleansChartData}>
                    <CartesianGrid vertical={false} stroke={gridColor} />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: tickColor }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: tickColor }} axisLine={false} tickLine={false} width={28} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{ background: theme === 'dark' ? '#1c1917' : '#fff', border: `1px solid ${gridColor}`, borderRadius: 10, fontSize: 11 }}
                      cursor={{ stroke: gridColor }}
                    />
                    <Line type="monotone" dataKey="normal" name="Normales" stroke="#ea580c" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="initial" name="Iniciales" stroke="#3b82f6" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="handyman" name="Manitas" stroke="#8b5cf6" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
                <div className="flex items-center gap-4 mt-3 justify-center">
                  {[{ color: '#ea580c', label: 'Normales' }, { color: '#3b82f6', label: 'Iniciales' }, { color: '#8b5cf6', label: 'Manitas' }].map(l => (
                    <span key={l.label} className="flex items-center gap-1.5 text-[11px] text-slate-400 dark:text-stone-500">
                      <span className="w-3 h-0.5 rounded-full inline-block" style={{ background: l.color }} />{l.label}
                    </span>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Discard changes dialog ── */}
      {showDiscardDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/30 dark:bg-black/50 backdrop-blur-sm"
            onClick={cancelDiscard}
          />
          {/* Panel */}
          <div className="relative bg-white dark:bg-stone-900 rounded-2xl border border-stone-100 dark:border-stone-800 shadow-xl w-full max-w-sm p-6 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3 mb-5">
              <span className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0">
                <Edit2 size={14} className="text-amber-500" />
              </span>
              <div>
                <p className="text-sm font-medium text-slate-800 dark:text-stone-100">Cambios sin guardar</p>
                <p className="text-xs text-slate-400 dark:text-stone-500 mt-0.5">Si continúas perderás las modificaciones realizadas.</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={cancelDiscard}
                className="flex-1 py-2.5 text-xs font-medium rounded-xl bg-stone-100 dark:bg-stone-800 text-slate-600 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700 transition-all"
              >
                Seguir editando
              </button>
              <button
                onClick={confirmDiscard}
                className="flex-1 py-2.5 text-xs font-medium rounded-xl bg-red-500 text-white hover:bg-red-600 transition-all"
              >
                Descartar cambios
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkerProfile;
