import React, { useEffect, useState, useMemo, useRef } from 'react';
import {
  ArrowLeft, Edit2, Phone, Mail, CreditCard, MapPin, Hash,
  ClipboardList, Car, Euro, CheckCircle2, Clock, Send, FileText,
  BarChart3, MessageSquare, Wrench, Sparkles, ChevronRight, Loader2,
  RotateCcw, CheckCheck, Landmark, Building2, Smartphone, User as UserIcon,
  Banknote, CalendarRange, X, TrendingUp, TrendingDown, Activity, Trash2
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  LineChart, Line,
} from 'recharts';
import { Worker, PagoRecord, NormalCleanRecord, InitialCleanRecord, HandymanRecord } from '../../services/mockData';
import { appsScriptApi, PaymentAction } from '../../services/api';
import { computeWorkerSeries, WorkerMetric } from '../../utils/payments';
import { useTheme } from '../../context/ThemeContext';
import { useNavigationGuard } from '../../context/NavigationGuardContext';
import { useAnimatedNumber } from '../../hooks/useAnimatedNumber';

// ─── Analytics types & helpers ───────────────────────────────────────────────

type AnalyticMetric = 'ingresos' | 'limpiezas' | 'km' | 'duracion' | 'eficiencia';
type AnalyticPeriod = 'semanal' | 'mensual' | 'trimestral' | 'personalizado';
type AnalyticPoint  = { label: string; valor: number };

const ANALYTIC_PERIODS: { id: AnalyticPeriod; label: string }[] = [
  { id: 'semanal',       label: 'Semanal' },
  { id: 'mensual',       label: 'Mensual' },
  { id: 'trimestral',    label: 'Trimestral' },
  { id: 'personalizado', label: 'Personalizado' },
];

// isAvg = display average instead of sum in the header
const METRIC_META: Record<AnalyticMetric, {
  label: string; shortLabel: string;
  format: (v: number) => string; totalLabel: string;
  icon: React.ReactNode; accent: string; isAvg: boolean;
}> = {
  ingresos:   { label: 'Ingresos',          shortLabel: '€',   format: v => v.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }), totalLabel: 'total',     icon: <Euro size={12} />,          accent: '#f97316', isAvg: false },
  limpiezas:  { label: 'Limpiezas',         shortLabel: 'uds', format: v => `${v}`,           totalLabel: 'total',     icon: <ClipboardList size={12} />, accent: '#fb923c', isAvg: false },
  km:         { label: 'Km recorridos',     shortLabel: 'km',  format: v => `${v} km`,        totalLabel: 'total',     icon: <Car size={12} />,           accent: '#ea580c', isAvg: false },
  duracion:   { label: 'Duración media',    shortLabel: 'min', format: v => `${v} min`,       totalLabel: 'media/tarea', icon: <Clock size={12} />,       accent: '#f97316', isAvg: true  },
  eficiencia: { label: 'Tasa verificación', shortLabel: '%',   format: v => `${v}%`,          totalLabel: 'media',     icon: <CheckCircle2 size={12} />,  accent: '#f97316', isAvg: true  },
};

// ─── PulseDot (dashboard style) ──────────────────────────────────────────────
const PulseDotAnalytic: React.FC<{ cx?: number; cy?: number; accent?: string }> = ({ cx, cy, accent = '#f97316' }) => {
  if (cx == null || cy == null) return null;
  return (
    <g>
      <circle cx={cx} cy={cy} r={5} fill="none" stroke={accent} strokeWidth={1.5}>
        <animate attributeName="r"       from="5"   to="16"  dur="0.55s" fill="freeze" />
        <animate attributeName="opacity" from="0.5" to="0"   dur="0.55s" fill="freeze" />
      </circle>
      <circle cx={cx} cy={cy} r={5} fill="none" stroke={accent} strokeWidth={1}>
        <animate attributeName="r"       from="5"   to="22"  begin="0.1s" dur="0.55s" fill="freeze" />
        <animate attributeName="opacity" from="0.25" to="0"  begin="0.1s" dur="0.55s" fill="freeze" />
      </circle>
      <circle cx={cx} cy={cy} r={4.5} fill={accent} stroke="#fff" strokeWidth={2.5} />
    </g>
  );
};

// ─── Analytic tooltip ─────────────────────────────────────────────────────────
const AnalyticTooltip: React.FC<{
  active?: boolean; payload?: { value: number }[]; label?: string; metric: AnalyticMetric;
}> = ({ active, payload, label, metric }) => {
  if (!active || !payload?.length) return null;
  const meta = METRIC_META[metric];
  return (
    <div className="bg-white dark:bg-stone-800 border-2 border-white dark:border-stone-700 rounded-xl px-3 py-2 text-xs soft-shadow">
      <p className="text-slate-400 dark:text-stone-500 mb-0.5">{label}</p>
      <p className="font-medium text-slate-800 dark:text-stone-200">{meta.format(payload[0].value)}</p>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────

interface WorkerProfileProps {
  worker: Worker;
  onBack: () => void;
  onSave?: (worker: Worker) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  initialEditing?: boolean;
}

type MainTab = 'datos' | 'registros' | 'analiticas' | 'alojamientos';
type RecordsTab = 'normal' | 'initial' | 'handyman';
type PayTab = 'pending' | 'history';

const PAGO_LABEL: Record<string, string> = {
  bizum: 'Bizum', tarjeta: 'Transferencia', efectivo: 'Efectivo',
};

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
}

function toTitleCase(str: string): string {
  return str.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
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

const WorkerProfile: React.FC<WorkerProfileProps> = ({ worker, onBack, onSave, onDelete, initialEditing = false }) => {
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

  // Analytics state
  const [analyticsMetric, setAnalyticsMetric] = useState<AnalyticMetric>('ingresos');
  const [analyticsPeriod, setAnalyticsPeriod] = useState<AnalyticPeriod>('mensual');
  const [analyticsDesde, setAnalyticsDesde] = useState('');
  const [analyticsHasta, setAnalyticsHasta] = useState('');
  const [analyticsChartKey, setAnalyticsChartKey] = useState(0);
  const prevAnalyticsCustom = useRef('');

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
  const cleansCost = (worker.cleansCountMonth ?? 0) * (worker.pagoPorReserva ?? 0);
  const extraHoursCost = (worker.extraHoursMonth ?? 0) * 10;
  // owedMoney ya contiene el total derivado (reservas + extras + km). Si no hay datos, usamos el cálculo clásico.
  const totalDue = worker.owedMoney && worker.owedMoney > 0
    ? worker.owedMoney
    : kmCost + cleansCost + extraHoursCost;
  // paidPagos ya está memoizado; lo usamos directamente
  const currentCyclePaid = paidPagos.reduce((a, p) => a + p.importe, 0);
  const remainingDue = Math.max(0, totalDue - currentCyclePaid);

  // Desglose inteligente: prioridad limpiezas → km. Solo muestra km si tiene precio.
  function computeBreakdown(remaining: number) {
    if (remaining <= 0) return { limpiezas: 0, km: 0 };
    const pricePerClean = worker.pagoPorReserva ?? 0;
    const pricePerKm    = worker.precioPorKm   ?? 0;
    if (remaining <= cleansCost) {
      const pendingCleans = pricePerClean > 0 ? Math.ceil(remaining / pricePerClean) : 0;
      // Solo añade km si tiene precio configurado (contribuye a la deuda)
      const pendingKm = pricePerKm > 0 ? worker.kmsMonth : 0;
      return { limpiezas: pendingCleans, km: pendingKm };
    } else {
      const remainingKmCost = remaining - cleansCost;
      const pendingKm = pricePerKm > 0 ? Math.ceil(remainingKmCost / pricePerKm) : 0;
      return { limpiezas: 0, km: Math.min(pendingKm, worker.kmsMonth) };
    }
  }
  const remainingBreakdown = computeBreakdown(remainingDue);

  // Animated numbers para el stats strip
  const animRemainingDue       = useAnimatedNumber(remainingDue);
  const animRemainingLimpiezas = useAnimatedNumber(remainingBreakdown.limpiezas);
  const animRemainingKm        = useAnimatedNumber(remainingBreakdown.km);
  const animKmsMonth           = useAnimatedNumber(worker.kmsMonth);
  const animCleansMonth        = useAnimatedNumber(worker.cleansCountMonth);

  // Pago modal state
  const [showPayModal, setShowPayModal] = useState(false);
  const [payAsunto, setPayAsunto]       = useState('');
  const [payAmount, setPayAmount]       = useState('');
  const [paying2, setPaying2]           = useState(false);

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

  const handleDirectPay = async () => {
    const amount = parseFloat(payAmount.replace(',', '.'));
    if (!amount || amount <= 0) return;
    setPaying2(true);
    try {
      // Calcular cuántas limpiezas y km cubre este pago
      const pricePerClean = worker.pagoPorReserva ?? 0;
      const pricePerKm    = worker.precioPorKm   ?? 0;
      let limpiezasPaid: number;
      let kmPaid: number;
      if (amount <= cleansCost) {
        limpiezasPaid = pricePerClean > 0 ? Math.floor(amount / pricePerClean) : 0;
        kmPaid = 0;
      } else {
        limpiezasPaid = worker.cleansCountMonth;
        const kmAmount = amount - cleansCost;
        kmPaid = pricePerKm > 0 ? Math.floor(kmAmount / pricePerKm) : 0;
      }
      const today = new Date().toISOString().slice(0, 10);
      await appsScriptApi.createPago({
        workerId:   worker.id,
        workerName: worker.fullName,
        telefono:   worker.telefono ?? '',
        dni:        worker.dni      ?? '',
        email:      worker.email    ?? '',
        fecha:      today,
        concepto:   payAsunto || 'Pago directo',
        importe:    amount,
        limpiezas:  limpiezasPaid,
        km:         kmPaid,
        estado:     'pagado',
      });
      await loadPagos();
      setShowPayModal(false);
      setPayAsunto('');
      setPayAmount('');
    } finally {
      setPaying2(false);
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

  const handleDelete = async () => {
    if (!onDelete) return;
    if (window.confirm(`¿Estás seguro de que deseas eliminar permanentemente a ${worker.fullName}? Esta acción borrará su fila en el Excel.`)) {
      setSaving(true);
      try {
        await onDelete(worker.id);
      } catch (error) {
        console.error('Error deleting worker from profile:', error);
      } finally {
        setSaving(false);
      }
    }
  };

  const totalRecords = normalCleans.length + initialCleans.length + handymanRecords.length;

  // Analytics chart data — construido desde los registros reales del trabajador
  const analyticsChartData = useMemo<AnalyticPoint[]>(() => {
    const series = computeWorkerSeries(
      worker,
      normalCleans,
      initialCleans,
      handymanRecords,
      {
        period: analyticsPeriod,
        metric: analyticsMetric as WorkerMetric,
        desde: analyticsDesde,
        hasta: analyticsHasta,
      }
    );
    return series.map(s => ({ label: s.label, valor: s.valor }));
  }, [analyticsPeriod, analyticsMetric, analyticsDesde, analyticsHasta, worker, normalCleans, initialCleans, handymanRecords]);

  // Trigger re-animation on custom date change
  useEffect(() => {
    if (analyticsPeriod !== 'personalizado') return;
    const key = analyticsDesde + analyticsHasta;
    if (key !== prevAnalyticsCustom.current && analyticsDesde && analyticsHasta) {
      prevAnalyticsCustom.current = key;
      setAnalyticsChartKey(k => k + 1);
    }
  }, [analyticsDesde, analyticsHasta, analyticsPeriod]);

  const analyticsTotal = analyticsChartData.reduce((a, d) => a + d.valor, 0);
  const analyticsAvg = analyticsChartData.length > 0 ? Math.round(analyticsTotal / analyticsChartData.length) : 0;
  const analyticsAnimatedTotal = useAnimatedNumber(analyticsTotal);
  const analyticsAnimatedAvg = useAnimatedNumber(analyticsAvg);
  const analyticsXInterval =
    analyticsPeriod === 'mensual' ? 4 :
    analyticsPeriod === 'trimestral' ? 1 :
    analyticsPeriod === 'personalizado' && analyticsChartData.length > 30 ? Math.floor(analyticsChartData.length / 10) : 0;

  // Trend: compare last half vs first half of data
  const analyticsTrend = useMemo(() => {
    if (analyticsChartData.length < 4) return 0;
    const half = Math.floor(analyticsChartData.length / 2);
    const firstHalf  = analyticsChartData.slice(0, half).reduce((a, d) => a + d.valor, 0) / half;
    const secondHalf = analyticsChartData.slice(half).reduce((a, d) => a + d.valor, 0) / (analyticsChartData.length - half);
    return firstHalf === 0 ? 0 : Math.round(((secondHalf - firstHalf) / firstHalf) * 100);
  }, [analyticsChartData]);

  // Monthly breakdown for bar chart (sólo datos reales del trabajador)
  const monthlyBreakdown = useMemo(() => {
    const map: Record<string, { normal: number; initial: number; handyman: number }> = {};
    const add = (fecha: string, type: 'normal' | 'initial' | 'handyman') => {
      if (!fecha) return;
      const m = fecha.slice(0, 7);
      if (!/^\d{4}-\d{2}$/.test(m)) return;
      if (!map[m]) map[m] = { normal: 0, initial: 0, handyman: 0 };
      map[m][type]++;
    };
    normalCleans.forEach(r => add(r.checkinFecha, 'normal'));
    initialCleans.forEach(r => add(r.checkinFecha, 'initial'));
    handymanRecords.forEach(r => add(r.fechaLlegada, 'handyman'));
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([m, v]) => ({
        label: new Date(m + '-01').toLocaleDateString('es-ES', { month: 'short' }),
        ...v,
      }));
  }, [normalCleans, initialCleans, handymanRecords]);

  const gridColor = theme === 'dark' ? '#44403c' : '#e7e5e4';
  const tickColor = theme === 'dark' ? '#78716c' : '#a8a29e';

  const tabs: { id: MainTab; label: string }[] = [
    { id: 'datos', label: 'Datos trabajador' },
    { id: 'registros', label: 'Registros' },
    { id: 'analiticas', label: 'Analíticas' },
    { id: 'alojamientos', label: 'Alojamientos' },
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
        <span className="text-slate-700 dark:text-stone-300 font-medium truncate">{toTitleCase(worker.fullName)}</span>
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
              {toTitleCase(worker.fullName)}
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
              <div className="flex items-center gap-2">
                <button
                  onClick={handleDelete}
                  disabled={saving}
                  className="p-2.5 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 transition-all border border-transparent disabled:opacity-50"
                  title="Eliminar trabajador"
                >
                  {saving ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                </button>
                <button
                  onClick={() => { setDraft(worker); setIsEditing(true); }}
                  className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-xl bg-stone-100 dark:bg-stone-800 text-slate-500 dark:text-stone-400 hover:text-orange-500 dark:hover:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-all border border-transparent"
                >
                  <Edit2 size={13} />Editar
                </button>
              </div>
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
          {/* Por cobrar + Sábanas/Toallas */}
          <div className="px-5 py-4">
            <div className="flex items-start gap-6">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 mb-1">
                  <Euro size={12} className={remainingDue > 0 ? 'text-amber-500' : 'text-emerald-500'} />
                  <span className="text-[10px] text-slate-400 dark:text-stone-500 uppercase tracking-wide">Por cobrar</span>
                </div>
                <div className="flex items-center gap-2">
                  <p className={`text-lg font-medium tabular-nums ${remainingDue > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                    {fmtCurrency(animRemainingDue)}
                  </p>
                  {remainingDue > 0 && (
                    <button
                      onClick={() => { setPayAmount(remainingDue.toFixed(2)); setShowPayModal(true); }}
                      className="text-[11px] font-medium px-2.5 py-1 rounded-lg bg-orange-500 text-white hover:bg-orange-600 active:scale-95 transition-all flex-shrink-0"
                    >
                      Pagar
                    </button>
                  )}
                </div>
                <p className="text-[10px] text-slate-400 dark:text-stone-500 mt-0.5">
                  {remainingDue <= 0
                    ? 'Al día'
                    : animRemainingLimpiezas > 0 && animRemainingKm > 0
                      ? `${animRemainingLimpiezas} limpiezas · ${animRemainingKm} km`
                      : animRemainingLimpiezas > 0
                        ? `${animRemainingLimpiezas} limpiezas pendientes`
                        : animRemainingKm > 0
                          ? `${animRemainingKm} km pendientes`
                          : 'Configura tarifas para ver el desglose'
                  }
                </p>
              </div>

              <div
                className="min-w-0 pl-4 border-l border-stone-100 dark:border-stone-800"
                title="Sábanas y toallas pagadas en efectivo. No resta del 'Por cobrar'."
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <Banknote size={12} className={(worker.sabanasToallasDebidas ?? 0) > 0 ? 'text-amber-500' : 'text-slate-400 dark:text-stone-500'} />
                  <span className="text-[10px] text-slate-400 dark:text-stone-500 uppercase tracking-wide">Sábanas/Toallas</span>
                </div>
                <p className={`text-lg font-medium tabular-nums ${(worker.sabanasToallasDebidas ?? 0) > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400 dark:text-stone-500'}`}>
                  {fmtCurrency(worker.sabanasToallasDebidas ?? 0)}
                </p>
                <p className="text-[10px] text-slate-400 dark:text-stone-500 mt-0.5">En efectivo · aparte</p>
              </div>
            </div>
          </div>

          {/* KM */}
          <div className="px-5 py-4">
            <div className="flex items-center gap-1.5 mb-1">
              <Car size={12} className="text-slate-400 dark:text-stone-500" />
              <span className="text-[10px] text-slate-400 dark:text-stone-500 uppercase tracking-wide">Km este mes</span>
            </div>
            <p className="text-lg font-medium tabular-nums text-slate-800 dark:text-stone-100">{animKmsMonth} km</p>
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
            <p className="text-lg font-medium tabular-nums text-slate-800 dark:text-stone-100">{animCleansMonth}</p>
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
            className={`px-4 py-3 text-xs font-normal border-b-2 transition-colors -mb-px ${
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
            <SelectRow 
              icon={<UserIcon size={12} />} label="Tipo de trab." 
              value={draft.tipoTrabajador || 'Limpiador'} isEditing={isEditing} 
              options={[{ value: 'Limpiador', label: 'Limpiador' }, { value: 'Manitas', label: 'Manitas' }]} 
              onChange={v => setDraftField('tipoTrabajador', v as Worker['tipoTrabajador'])} 
            />
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
            <SectionTitle>Actividad del mes</SectionTitle>
            <EditableRow icon={<ClipboardList size={12} />} label="Limpiezas" value={String(draft.cleansCountMonth ?? 0)} isEditing={isEditing} onChange={v => setDraftField('cleansCountMonth', v === '' ? 0 : Number(v))} type="number" placeholder="0" />
            <EditableRow icon={<Car size={12} />} label="Km recorridos" value={String(draft.kmsMonth ?? 0)} isEditing={isEditing} onChange={v => setDraftField('kmsMonth', v === '' ? 0 : Number(v))} type="number" placeholder="0" />
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

          {/* ── Historial de pagos ── */}
          <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-100 dark:border-stone-800 overflow-hidden">
            <div className="px-5 py-4 border-b border-stone-100 dark:border-stone-800 flex items-center justify-between">
              <h3 className="text-xs font-medium text-slate-500 dark:text-stone-400 uppercase tracking-wider">Historial de pagos</h3>
              <span className="text-[11px] text-slate-400 dark:text-stone-500">{paidPagos.length} registro{paidPagos.length !== 1 ? 's' : ''}</span>
            </div>
            {paidPagos.length === 0 ? (
              <div className="px-5 py-10 flex flex-col items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-orange-50 dark:bg-orange-900/30 flex items-center justify-center">
                  <Banknote size={18} className="text-orange-400" />
                </div>
                <p className="text-xs text-slate-400 dark:text-stone-500">Sin pagos registrados</p>
                <p className="text-[11px] text-slate-300 dark:text-stone-600">Usa el botón Pagar del resumen superior</p>
              </div>
            ) : (
              <div className="divide-y divide-stone-50 dark:divide-stone-800 max-h-80 overflow-y-auto">
                {paidPagos.map(p => (
                  <div key={p.id} className="px-5 py-3.5 flex items-center justify-between gap-4 hover:bg-stone-50 dark:hover:bg-stone-800/50 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-7 h-7 rounded-lg bg-orange-50 dark:bg-orange-900/30 flex items-center justify-center flex-shrink-0">
                        <CheckCheck size={13} className="text-orange-500" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-slate-700 dark:text-stone-300 truncate">{p.concepto}</p>
                        <p className="text-[11px] text-slate-400 dark:text-stone-500 mt-0.5">
                          {fmtDate(p.fecha)}
                          {p.limpiezas > 0 && ` · ${p.limpiezas} limpiezas`}
                          {p.km > 0 && ` · ${p.km} km`}
                        </p>
                      </div>
                    </div>
                    <span className="text-sm font-medium tabular-nums text-slate-800 dark:text-stone-100 flex-shrink-0">{fmtCurrency(p.importe)}</span>
                  </div>
                ))}
              </div>
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

          {/* ── Selector de métrica (fuera del card) ── */}
          <div className="flex items-center bg-white dark:bg-stone-900 border border-stone-100 dark:border-stone-800 rounded-xl p-1 gap-0.5 flex-wrap">
            {(Object.keys(METRIC_META) as AnalyticMetric[]).map(m => {
              const meta = METRIC_META[m];
              const active = analyticsMetric === m;
              return (
                <button
                  key={m}
                  onClick={() => { setAnalyticsMetric(m); setAnalyticsChartKey(k => k + 1); }}
                  className={`flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg font-normal transition-all duration-200 flex-1 justify-center ${
                    active
                      ? 'bg-orange-50 dark:bg-orange-900/30 shadow-sm'
                      : 'text-slate-400 dark:text-stone-500 hover:text-slate-700 dark:hover:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-800'
                  }`}
                  style={active ? { color: meta.accent } : {}}
                >
                  <span style={{ color: active ? meta.accent : undefined }}>{meta.icon}</span>
                  {meta.label}
                </button>
              );
            })}
          </div>

          {/* ── Gráfica principal ── */}
          <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-100 dark:border-stone-800 p-5">

            {/* Header: total/media + periodo tabs */}
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="text-xl font-normal tracking-tight tabular-nums font-display"
                  style={{ color: METRIC_META[analyticsMetric].accent }}>
                  {METRIC_META[analyticsMetric].isAvg
                    ? METRIC_META[analyticsMetric].format(analyticsAnimatedAvg)
                    : METRIC_META[analyticsMetric].format(Math.round(analyticsAnimatedTotal))
                  }
                </span>
                <span className="text-xs text-slate-400 dark:text-stone-500">
                  {METRIC_META[analyticsMetric].totalLabel} · {
                    analyticsPeriod === 'personalizado' && analyticsDesde && analyticsHasta
                      ? `${analyticsDesde} — ${analyticsHasta}`
                      : ANALYTIC_PERIODS.find(p => p.id === analyticsPeriod)?.label.toLowerCase()
                  }
                </span>
                {METRIC_META[analyticsMetric].isAvg && analyticsTotal > 0 && (
                  <span className="text-xs text-slate-300 dark:text-stone-600 tabular-nums">
                    {METRIC_META[analyticsMetric].format(Math.round(analyticsTotal))} total
                  </span>
                )}
                {analyticsTrend !== 0 && (
                  <span className={`flex items-center gap-0.5 text-[11px] font-medium px-1.5 py-0.5 rounded-md ${
                    analyticsTrend > 0
                      ? 'text-orange-600 bg-orange-50 dark:text-orange-400 dark:bg-orange-900/30'
                      : 'text-orange-400 bg-orange-50/60 dark:text-orange-500 dark:bg-orange-900/20'
                  }`}>
                    {analyticsTrend > 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                    {Math.abs(analyticsTrend)}%
                  </span>
                )}
              </div>

              <div className="flex items-center bg-white/40 dark:bg-stone-800/60 backdrop-blur-md border border-stone-200/60 dark:border-stone-700/50 rounded-lg p-0.5 gap-0.5">
                {ANALYTIC_PERIODS.map(p => (
                  <button
                    key={p.id}
                    onClick={() => { setAnalyticsPeriod(p.id); setAnalyticsChartKey(k => k + 1); }}
                    className={`text-xs px-2.5 py-1 rounded-md font-normal transition-all duration-200 ${
                      analyticsPeriod === p.id
                        ? 'bg-stone-100 dark:bg-stone-900 text-slate-700 dark:text-stone-200 shadow-sm'
                        : 'text-slate-400 dark:text-stone-500 hover:text-slate-700 dark:hover:text-stone-300'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Selector rango personalizado */}
            {analyticsPeriod === 'personalizado' && (
              <div className="flex items-center gap-2 mb-3 animate-in fade-in slide-in-from-top-1 duration-200">
                <div className="flex items-center gap-2 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg px-3 py-1.5">
                  <CalendarRange size={13} className="text-slate-400 dark:text-stone-500 flex-shrink-0" />
                  <input type="date" value={analyticsDesde} onChange={e => setAnalyticsDesde(e.target.value)}
                    className="text-xs text-slate-700 dark:text-stone-300 focus:outline-none bg-transparent" />
                  <span className="text-slate-300 dark:text-stone-600 text-xs">—</span>
                  <input type="date" value={analyticsHasta} min={analyticsDesde} onChange={e => setAnalyticsHasta(e.target.value)}
                    className="text-xs text-slate-700 dark:text-stone-300 focus:outline-none bg-transparent" />
                </div>
                {(analyticsDesde || analyticsHasta) && (
                  <button onClick={() => { setAnalyticsDesde(''); setAnalyticsHasta(''); }}
                    className="text-slate-400 dark:text-stone-500 hover:text-slate-600 dark:hover:text-stone-300 transition-colors">
                    <X size={13} />
                  </button>
                )}
              </div>
            )}

            {/* Chart */}
            {analyticsPeriod === 'personalizado' && (!analyticsDesde || !analyticsHasta) ? (
              <div className="flex flex-col items-center justify-center text-slate-300 dark:text-stone-700 gap-2 h-64">
                <CalendarRange size={28} />
                <p className="text-xs text-slate-400 dark:text-stone-500">Selecciona un rango de fechas</p>
              </div>
            ) : (
              <div key={analyticsChartKey} className="chart-enter h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={analyticsChartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 10, fill: tickColor }}
                      axisLine={false} tickLine={false}
                      interval={analyticsXInterval} dy={4}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: tickColor }}
                      axisLine={false} tickLine={false}
                      width={analyticsMetric === 'ingresos' ? 44 : 32}
                      tickFormatter={(v: number) =>
                        analyticsMetric === 'ingresos' ? (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${v}`) :
                        analyticsMetric === 'eficiencia' ? `${v}%` : `${v}`
                      }
                      domain={['auto', (dataMax: number) => Math.ceil(dataMax * 1.15)]}
                    />
                    <Tooltip
                      content={<AnalyticTooltip metric={analyticsMetric} />}
                      cursor={{ stroke: gridColor, strokeWidth: 1 }}
                    />
                    <Line
                      type="monotone" dataKey="valor"
                      stroke={METRIC_META[analyticsMetric].accent}
                      strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"
                      dot={false}
                      activeDot={<PulseDotAnalytic accent={METRIC_META[analyticsMetric].accent} />}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* ── Segunda fila: Actividad por tipo + Rendimiento ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

            {/* Actividad por tipo de trabajo */}
            <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-100 dark:border-stone-800 p-5">
              <h3 className="text-[10px] font-medium text-slate-400 dark:text-stone-500 uppercase tracking-wider mb-4">Actividad por tipo · últimos 6 meses</h3>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={monthlyBreakdown} barSize={8} barGap={3}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: tickColor }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: tickColor }} axisLine={false} tickLine={false} width={20} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ background: theme === 'dark' ? '#1c1917' : '#fff', border: `1px solid ${gridColor}`, borderRadius: 10, fontSize: 11 }}
                    cursor={{ fill: theme === 'dark' ? '#292524' : '#f5f5f4' }}
                  />
                  <Bar dataKey="normal"   name="Normales" fill="#f97316" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="initial"  name="Iniciales" fill="#fdba74" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="handyman" name="Manitas"   fill="#ea580c" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
              <div className="flex items-center gap-4 mt-3 justify-center">
                {[{ color: '#f97316', label: 'Normales' }, { color: '#fdba74', label: 'Iniciales' }, { color: '#ea580c', label: 'Manitas' }].map(l => (
                  <span key={l.label} className="flex items-center gap-1.5 text-[11px] text-slate-400 dark:text-stone-500">
                    <span className="w-2.5 h-2.5 rounded-sm inline-block flex-shrink-0" style={{ background: l.color }} />{l.label}
                  </span>
                ))}
              </div>
            </div>

            {/* Métricas de rendimiento */}
            <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-100 dark:border-stone-800 p-5">
              <h3 className="text-[10px] font-medium text-slate-400 dark:text-stone-500 uppercase tracking-wider mb-4">Métricas de rendimiento</h3>
              <div className="grid grid-cols-2 gap-3">
                {[
                  {
                    label: '€ por limpieza',
                    value: worker.cleansCountMonth > 0
                      ? fmtCurrency(worker.netMoneyMonth / worker.cleansCountMonth)
                      : '—',
                    sub: 'ingreso medio/tarea',
                    icon: <Euro size={13} />,
                    iconCls: 'text-orange-500',
                    bg: 'bg-orange-50 dark:bg-orange-900/30',
                  },
                  {
                    label: 'Km por limpieza',
                    value: worker.cleansCountMonth > 0
                      ? `${Math.round(worker.kmsMonth / worker.cleansCountMonth)} km`
                      : '—',
                    sub: 'desplazamiento medio',
                    icon: <Car size={13} />,
                    iconCls: 'text-orange-600',
                    bg: 'bg-orange-100/50 dark:bg-orange-900/20',
                  },
                  {
                    label: 'Tasa verificación',
                    value: normalCleans.length > 0
                      ? `${Math.round((normalCleans.filter(r => r.checked).length / normalCleans.length) * 100)}%`
                      : '—',
                    sub: `${normalCleans.filter(r => r.checked).length}/${normalCleans.length} verificadas`,
                    icon: <CheckCircle2 size={13} />,
                    iconCls: 'text-orange-400',
                    bg: 'bg-orange-50/60 dark:bg-orange-900/15',
                  },
                  {
                    label: 'Coste km mes',
                    value: fmtCurrency(kmCost),
                    sub: `${worker.kmsMonth} km × ${worker.precioPorKm ?? 0}€`,
                    icon: <Activity size={13} />,
                    iconCls: 'text-orange-500/70',
                    bg: 'bg-orange-50/40 dark:bg-orange-900/10',
                  },
                ].map(k => (
                  <div key={k.label} className={`${k.bg} rounded-xl p-3`}>
                    <div className={`${k.iconCls} mb-1`}>{k.icon}</div>
                    <p className="text-base font-medium tabular-nums text-slate-800 dark:text-stone-100">{k.value}</p>
                    <p className="text-[10px] text-slate-400 dark:text-stone-500 mt-0.5 leading-tight">{k.label}</p>
                    <p className="text-[10px] text-slate-300 dark:text-stone-600 mt-0.5 leading-tight">{k.sub}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════
          TAB: ALOJAMIENTOS
      ═══════════════════════════════════════════════════════════ */}
      {activeTab === 'alojamientos' && (
        <div className="animate-in fade-in duration-300">
          <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-100 dark:border-stone-800 overflow-hidden">
            <div className="px-5 py-4 border-b border-stone-100 dark:border-stone-800 flex items-center justify-between">
              <h3 className="text-xs font-medium text-slate-500 dark:text-stone-400 uppercase tracking-wider">Alojamientos asignados</h3>
              <span className="text-[11px] text-slate-400 dark:text-stone-500">{worker.accommodations.length} total</span>
            </div>
            {worker.accommodations.length === 0 ? (
              <div className="px-5 py-12 flex flex-col items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-orange-50 dark:bg-orange-900/30 flex items-center justify-center">
                  <MapPin size={18} className="text-orange-400" />
                </div>
                <p className="text-xs text-slate-400 dark:text-stone-500">Sin alojamientos asignados</p>
              </div>
            ) : (
              <div className="divide-y divide-stone-50 dark:divide-stone-800">
                {worker.accommodations.map((acc, i) => (
                  <div key={acc} className="px-5 py-3.5 flex items-center gap-3 hover:bg-stone-50 dark:hover:bg-stone-800/50 transition-colors">
                    <div
                      className="w-7 h-7 rounded-lg flex-shrink-0 flex items-center justify-center text-xs font-medium"
                      style={{
                        background: ['#fff7ed','#ffedd5','#fed7aa','#fdba74','#fb923c','#f97316'][i % 6],
                        color: i < 3 ? '#ea580c' : '#c2410c',
                      }}
                    >
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-700 dark:text-stone-300 truncate">{acc}</p>
                    </div>
                    <MapPin size={13} className="text-slate-300 dark:text-stone-600 flex-shrink-0" />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Modal de pago directo ── */}
      {showPayModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30 dark:bg-black/50 backdrop-blur-sm" onClick={() => setShowPayModal(false)} />
          <div className="relative bg-white dark:bg-stone-900 rounded-2xl border border-stone-100 dark:border-stone-800 shadow-xl w-full max-w-sm p-6 animate-in fade-in zoom-in-95 duration-150">

            {/* Header */}
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2.5">
                <span className="w-8 h-8 rounded-xl bg-orange-50 dark:bg-orange-900/30 flex items-center justify-center">
                  <Banknote size={15} className="text-orange-500" />
                </span>
                <div>
                  <p className="text-sm font-medium text-slate-800 dark:text-stone-100">Registrar pago</p>
                  <p className="text-[11px] text-slate-400 dark:text-stone-500">{toTitleCase(worker.fullName)}</p>
                </div>
              </div>
              <button onClick={() => setShowPayModal(false)} className="text-slate-300 dark:text-stone-600 hover:text-slate-500 dark:hover:text-stone-400 transition-colors">
                <X size={16} />
              </button>
            </div>

            {/* Resumen pendiente */}
            <div className="mb-5 px-3 py-2.5 bg-stone-50 dark:bg-stone-800 rounded-xl">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-400 dark:text-stone-500">Total pendiente</span>
                <span className="text-sm font-medium tabular-nums text-slate-800 dark:text-stone-100">{fmtCurrency(remainingDue)}</span>
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-[10px] text-slate-300 dark:text-stone-600">
                  {remainingBreakdown.limpiezas > 0 && `${remainingBreakdown.limpiezas} limpiezas`}
                  {remainingBreakdown.limpiezas > 0 && remainingBreakdown.km > 0 && ' · '}
                  {remainingBreakdown.km > 0 && `${remainingBreakdown.km} km`}
                </span>
                {(() => {
                  const afterPay = Math.max(0, remainingDue - (parseFloat(payAmount.replace(',', '.')) || 0));
                  const afterBreakdown = computeBreakdown(afterPay);
                  const payNum = parseFloat(payAmount.replace(',', '.')) || 0;
                  if (payNum <= 0) return null;
                  return (
                    <span className="text-[10px] text-orange-500 dark:text-orange-400 font-medium">
                      {afterPay <= 0
                        ? '✓ Al día'
                        : `Queda: ${afterBreakdown.limpiezas > 0 ? `${afterBreakdown.limpiezas} limp` : ''}${afterBreakdown.limpiezas > 0 && afterBreakdown.km > 0 ? ' · ' : ''}${afterBreakdown.km > 0 ? `${afterBreakdown.km} km` : ''}`
                      }
                    </span>
                  );
                })()}
              </div>
            </div>

            {/* Campos */}
            <div className="space-y-3 mb-5">
              <div>
                <label className="text-[11px] text-slate-400 dark:text-stone-500 font-medium uppercase tracking-wide block mb-1.5">Asunto</label>
                <input
                  type="text"
                  value={payAsunto}
                  onChange={e => setPayAsunto(e.target.value)}
                  placeholder="Ej. Nómina abril 2026"
                  className="w-full px-3 py-2.5 text-xs bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-slate-700 dark:text-stone-300 placeholder:text-stone-300 dark:placeholder:text-stone-600 focus:outline-none focus:ring-2 focus:ring-orange-200 dark:focus:ring-orange-900/50 transition-all"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-400 dark:text-stone-500 font-medium uppercase tracking-wide block mb-1.5">Cantidad</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 dark:text-stone-500">€</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    max={remainingDue}
                    value={payAmount}
                    onChange={e => setPayAmount(e.target.value)}
                    className="w-full pl-7 pr-3 py-2.5 text-xs bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-slate-700 dark:text-stone-300 focus:outline-none focus:ring-2 focus:ring-orange-200 dark:focus:ring-orange-900/50 transition-all tabular-nums"
                  />
                </div>
                <button
                  onClick={() => setPayAmount(remainingDue.toFixed(2))}
                  className="text-[10px] text-orange-500 hover:text-orange-600 transition-colors mt-1"
                >
                  Pagar todo ({fmtCurrency(remainingDue)})
                </button>
              </div>
            </div>

            {/* Acción */}
            <button
              onClick={handleDirectPay}
              disabled={paying2 || !payAmount || parseFloat(payAmount.replace(',', '.')) <= 0}
              className="w-full flex items-center justify-center gap-2 py-3 bg-orange-500 hover:bg-orange-600 text-white text-xs font-medium rounded-xl transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {paying2 ? <Loader2 size={14} className="animate-spin" /> : <CheckCheck size={14} />}
              Realizar pago
            </button>
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
