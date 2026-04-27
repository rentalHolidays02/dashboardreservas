import React, { useEffect, useState, useMemo, useRef } from 'react';
import {
  ArrowLeft, Edit2, Phone, Mail, CreditCard, MapPin, Hash,
  ClipboardList, Car, Euro, CheckCircle2, Clock, Send, FileText,
  BarChart3, MessageSquare, Wrench, Sparkles, ChevronRight, Loader2,
  RotateCcw, Check, Landmark, Building2, Smartphone, User as UserIcon,
  Banknote, CalendarRange, X, TrendingUp, TrendingDown, Activity, Trash2, Pencil, XCircle, Plus, CheckCheck
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  LineChart, Line,
} from 'recharts';
import { Worker, PagoRecord, NormalCleanRecord, InitialCleanRecord, HandymanRecord, Accommodation } from '../../services/mockData';
import { appsScriptApi, PaymentAction } from '../../services/api';
import AccommodationAssignmentModal from './AccommodationAssignmentModal';
import AccommodationDetailModal from '../accommodations/AccommodationDetailModal';
import AccommodationCard from '../accommodations/AccommodationCard';
import { computeWorkerSeries, WorkerMetric } from '../../utils/payments';
import { useTheme } from '../../context/ThemeContext';
import { useNavigationGuard } from '../../context/NavigationGuardContext';
import { useAnimatedNumber } from '../../hooks/useAnimatedNumber';
import defaultAccImage from '../../assets/default_accommodation.png';

const DEFAULT_IMAGE = defaultAccImage;

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
      <p className="font-normal text-slate-800 dark:text-stone-200">{meta.format(payload[0].value)}</p>
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
    <span className="w-6 h-6 rounded-md bg-stone-50 dark:bg-stone-800 flex items-center justify-center text-orange-500 flex-shrink-0">
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
  <p className="text-[10px] font-normal text-slate-400 dark:text-stone-500 tracking-widest mb-3 mt-5 first:mt-0">{children}</p>
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
  const [allAccommodations, setAllAccommodations] = useState<Accommodation[]>([]);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);

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
  const [viewingAccommodation, setViewingAccommodation] = useState<Accommodation | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isWorkerModalOpen, setIsWorkerModalOpen] = useState(false);
  const [allWorkers, setAllWorkers] = useState<Worker[]>([]);
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
    appsScriptApi.getWorkerCleans(worker.telefono ?? '').then(data => {
      setNormalCleans(data.normal);
      setInitialCleans(data.initial);
      setHandymanRecords(data.handyman);
    });
  }, [worker.id, worker.telefono]);

  useEffect(() => {
    appsScriptApi.getAccommodations().then(setAllAccommodations);
    appsScriptApi.getWorkers().then(setAllWorkers);
  }, []);

  const pendingPagos = useMemo(() => pagos.filter(p => p.estado === 'pendiente'), [pagos]);
  const paidPagos = useMemo(() => pagos.filter(p => p.estado === 'pagado'), [pagos]);
  const pendingAmount = useMemo(() => pendingPagos.reduce((a, p) => a + p.importe, 0), [pendingPagos]);
  const currentCyclePaid = useMemo(() => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    return paidPagos
      .filter(p => new Date(p.fecha) >= firstDay)
      .reduce((a, p) => a + p.importe, 0);
  }, [paidPagos]);
  const selectedAmount = useMemo(() => pagos.filter(p => selectedPagoIds.has(p.id)).reduce((a, p) => a + p.importe, 0), [pagos, selectedPagoIds]);
  const kmCost = (worker.kmsMonth ?? 0) * (worker.precioPorKm ?? 0);
  const cleansCost = (worker.cleansCountMonth ?? 0) * (worker.pagoPorReserva ?? 0);
  const extraHoursCost = (worker.extraHoursMonth ?? 0) * 10;
  // owedMoney ya contiene el total derivado (reservas + extras + km). Si no hay datos, usamos el cálculo clásico.
  const remainingDue = worker.owedMoney !== undefined && worker.owedMoney !== null
    ? Math.max(0, worker.owedMoney)
    : Math.max(0, (kmCost + cleansCost + extraHoursCost) - currentCyclePaid);

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

  // Edit balance manually
  const [showEditOwed, setShowEditOwed]         = useState(false);
  const [editOwedVal, setEditOwedVal]           = useState('');
  const [showEditRetenido, setShowEditRetenido] = useState(false);
  const [editRetenidoVal, setEditRetenidoVal]   = useState('');
  const [savingBalance, setSavingBalance]       = useState(false);
  
  // Revert / Undo functionality
  const [lastWorkerState, setLastWorkerState]   = useState<Worker | null>(null);
  const [lastPaymentId, setLastPaymentId]       = useState<string | null>(null);
  const [showRevertSuccess, setShowRevertSuccess] = useState(false);

  // Pay modal specialized
  const [payMode, setPayMode] = useState<'debt' | 'retained'>('debt');

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
    
    // Guardamos estado para revertir
    setLastWorkerState({ ...worker });

    try {
      if (payMode === 'debt') {
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
        const newPago = await appsScriptApi.createPago({
          workerId:   worker.id,
          workerName: worker.fullName,
          telefono:   worker.telefono ?? '',
          dni:        worker.dni      ?? '',
          email:      worker.email    ?? '',
          fecha:      today,
          concepto:   payAsunto || 'Pago directo (Deuda)',
          importe:    amount,
          limpiezas:  limpiezasPaid,
          km:         kmPaid,
          estado:     'pagado',
        });
        
        setLastPaymentId(newPago.id);

        const updated = { ...worker, owedMoney: Math.max(0, (worker.owedMoney || 0) - amount) };
        await appsScriptApi.updateWorker(updated);
        await onSave?.(updated);
      } else {
        const today = new Date().toISOString().slice(0, 10);
        const newPago = await appsScriptApi.createPago({
          workerId:   worker.id,
          workerName: worker.fullName,
          telefono:   worker.telefono ?? '',
          dni:        worker.dni      ?? '',
          email:      worker.email    ?? '',
          fecha:      today,
          concepto:   payAsunto || 'Liquidación Efectivo Retenido',
          importe:    amount,
          limpiezas:  0,
          km:         0,
          estado:     'pagado',
        });
        
        setLastPaymentId(newPago.id);

        const updated = { ...worker, efectivoRetenido: Math.max(0, (worker.efectivoRetenido || 0) - amount) };
        await appsScriptApi.updateWorker(updated);
        await onSave?.(updated);
      }

      await loadPagos();
      setShowPayModal(false);
      setPayAsunto('');
      setPayAmount('');
    } finally {
      setPaying2(false);
    }
  };

  const handleRevert = async () => {
    if (!lastWorkerState) return;
    setSavingBalance(true);
    try {
      await appsScriptApi.updateWorker(lastWorkerState);
      await onSave?.(lastWorkerState);
      setLastWorkerState(null);
      setLastPaymentId(null);
      setShowRevertSuccess(true);
      setTimeout(() => setShowRevertSuccess(false), 3000);
    } finally {
      setSavingBalance(false);
    }
  };

  const handleSaveOwed = async () => {
    const val = parseFloat(editOwedVal.replace(',', '.'));
    if (isNaN(val) || val < 0) return;
    setSavingBalance(true);
    try {
      const updated = { ...worker, owedMoney: val };
      await appsScriptApi.updateWorker(updated);
      await onSave?.(updated);
      setShowEditOwed(false);
      setEditOwedVal('');
    } finally {
      setSavingBalance(false);
    }
  };

  const handleSaveRetenido = async () => {
    const val = parseFloat(editRetenidoVal.replace(',', '.'));
    if (isNaN(val) || val < 0) return;
    setSavingBalance(true);
    try {
      const updated = { ...worker, efectivoRetenido: val };
      await appsScriptApi.updateWorker(updated);
      await onSave?.(updated);
      setShowEditRetenido(false);
      setEditRetenidoVal('');
    } finally {
      setSavingBalance(false);
    }
  };

  const handlePaidRetenido = async () => {
    setPayMode('retained');
    setPayAmount((worker.efectivoRetenido ?? 0).toFixed(2));
    setShowPayModal(true);
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

  const handleSaveAssignments = async (details: import('../../services/mockData').WorkerAccommodationDetails[]) => {
    const updated = {
      ...worker,
      accommodationDetails: details,
      accommodations: details.map(d => d.accommodationName),
    };
    await appsScriptApi.updateWorker(updated);
    if (onSave) await onSave(updated);
  };

  const handleViewAccommodation = (acc: Accommodation) => {
    setViewingAccommodation(acc);
    setIsViewModalOpen(true);
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

  const analyticsTrend = useMemo(() => {
    if (analyticsChartData.length < 4) return 0;
    const half = Math.floor(analyticsChartData.length / 2);
    const firstHalf  = analyticsChartData.slice(0, half).reduce((a, d) => a + d.valor, 0) / half;
    const secondHalf = analyticsChartData.slice(half).reduce((a, d) => a + d.valor, 0) / (analyticsChartData.length - half);
    return firstHalf === 0 ? 0 : Math.round(((secondHalf - firstHalf) / firstHalf) * 100);
  }, [analyticsChartData]);

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
    { id: 'analiticas', label: 'Resumen' },
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
        <span className="text-slate-700 dark:text-stone-300 font-normal truncate">{toTitleCase(worker.fullName)}</span>
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
              <span className="w-full h-full flex items-center justify-center text-lg font-normal text-orange-700 dark:text-orange-300">
                {getInitials(worker.fullName)}
              </span>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <h2 className="text-base font-normal text-slate-800 dark:text-stone-100 leading-tight truncate">
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
                <span className="text-[10px] font-normal px-2 py-0.5 rounded-md bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 border border-orange-100 dark:border-orange-800/50">
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
                className={`flex items-center gap-1.5 text-xs font-normal px-3 py-2 rounded-xl transition-all ${
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
                  className="flex items-center gap-1.5 text-xs font-normal px-3 py-2 rounded-xl bg-stone-100 dark:bg-stone-800 text-slate-500 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-stone-700 transition-all border border-transparent"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveInline}
                  disabled={saving}
                  className="flex items-center gap-1.5 text-xs font-normal px-3 py-2 rounded-xl bg-orange-500 text-white hover:bg-orange-600 transition-all border border-transparent disabled:opacity-70"
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
                  className="flex items-center gap-1.5 text-xs font-normal px-3 py-2 rounded-xl bg-stone-100 dark:bg-stone-800 text-slate-500 dark:text-stone-400 hover:text-orange-500 dark:hover:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-all border border-transparent"
                >
                  <Edit2 size={13} />Editar
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Message composer */}
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
              className="flex items-center justify-center gap-2 py-2.5 px-4 bg-orange-600 text-white text-xs font-normal rounded-xl hover:bg-orange-700 transition-all active:scale-95"
              onClick={() => { setMsgText(''); setMsgType(null); }}
            >
              <Send size={13} />Enviar
            </button>
          </div>
        )}

        {/* Stats strip */}
        <div className="grid grid-cols-2 sm:grid-cols-5 divide-x divide-y sm:divide-y-0 divide-stone-50 dark:divide-stone-800">
          <div className="px-5 py-4">
            <div className="flex items-center gap-1.5 mb-1">
              <Euro size={12} className={remainingDue > 0 ? 'text-amber-500' : 'text-emerald-500'} />
              <span className="text-[10px] text-slate-400 dark:text-stone-500 tracking-wide">Por cobrar</span>
            </div>
            <div className="flex items-center gap-2 flex-wrap min-h-[32px]">
              {!showEditOwed ? (
                <>
                  <p className={`text-lg font-normal tabular-nums ${remainingDue > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                    {fmtCurrency(animRemainingDue)}
                  </p>
                  <button
                    onClick={() => { setEditOwedVal(worker.owedMoney?.toFixed(2) ?? '0'); setShowEditOwed(true); }}
                    disabled={showEditRetenido}
                    className="p-1 text-slate-300 hover:text-orange-500 transition-colors"
                  >
                    <Pencil size={11} />
                  </button>
                  {lastWorkerState && (
                    <button
                      onClick={handleRevert}
                      disabled={savingBalance}
                      className="p-1 text-amber-500 hover:text-amber-600 transition-colors"
                      title="Revertir último pago"
                    >
                      <RotateCcw size={11} className={savingBalance ? 'animate-spin' : ''} />
                    </button>
                  )}
                </>
              ) : (
                <div className="flex items-center gap-1 animate-in fade-in slide-in-from-left-1 duration-200">
                  <input
                    autoFocus
                    value={editOwedVal}
                    onChange={e => setEditOwedVal(e.target.value)}
                    className="w-20 px-1.5 py-0.5 bg-stone-50 dark:bg-stone-800 border border-orange-200 dark:border-orange-900/50 rounded text-sm text-slate-700 dark:text-stone-200 focus:outline-none focus:ring-1 focus:ring-orange-300"
                    onKeyDown={e => e.key === 'Enter' && handleSaveOwed()}
                  />
                  <button onClick={handleSaveOwed} disabled={savingBalance} className="p-1 text-emerald-500 hover:text-emerald-600"><Check size={14} /></button>
                  <button onClick={() => setShowEditOwed(false)} className="p-1 text-red-400 hover:text-red-500"><X size={14} /></button>
                </div>
              )}
            </div>
            <p className="text-[10px] text-slate-300 dark:text-stone-600 mt-1">
              {remainingBreakdown.limpiezas > 0 && `${remainingBreakdown.limpiezas} limpiezas`}
              {remainingBreakdown.limpiezas > 0 && remainingBreakdown.km > 0 && ' · '}
              {remainingBreakdown.km > 0 && `${remainingBreakdown.km} km`}
            </p>
          </div>

          <div className="px-5 py-4">
            <div className="flex items-center gap-1.5 mb-1">
              <Banknote size={12} className="text-orange-400" />
              <span className="text-[10px] text-slate-400 dark:text-stone-500 tracking-wide">Efectivo retenido</span>
            </div>
            <div className="flex items-center gap-2 flex-wrap min-h-[32px]">
              {!showEditRetenido ? (
                <>
                  <p className="text-lg font-normal tabular-nums text-slate-700 dark:text-stone-300">{fmtCurrency(worker.efectivoRetenido ?? 0)}</p>
                  <button
                    onClick={() => { setEditRetenidoVal((worker.efectivoRetenido ?? 0).toFixed(2)); setShowEditRetenido(true); }}
                    disabled={showEditOwed}
                    className="p-1 text-slate-300 hover:text-orange-500 transition-colors"
                  >
                    <Pencil size={11} />
                  </button>
                  {(worker.efectivoRetenido ?? 0) > 0 && (
                    <button
                      onClick={handlePaidRetenido}
                      className="ml-auto text-[10px] text-orange-500 hover:text-orange-600 font-normal underline underline-offset-4"
                    >
                      Liquidar
                    </button>
                  )}
                </>
              ) : (
                <div className="flex items-center gap-1 animate-in fade-in slide-in-from-left-1 duration-200">
                  <input
                    autoFocus
                    value={editRetenidoVal}
                    onChange={e => setEditRetenidoVal(e.target.value)}
                    className="w-20 px-1.5 py-0.5 bg-stone-50 dark:bg-stone-800 border border-orange-200 dark:border-orange-900/50 rounded text-sm text-slate-700 dark:text-stone-200 focus:outline-none focus:ring-1 focus:ring-orange-300"
                    onKeyDown={e => e.key === 'Enter' && handleSaveRetenido()}
                  />
                  <button onClick={handleSaveRetenido} disabled={savingBalance} className="p-1 text-emerald-500 hover:text-emerald-600"><Check size={14} /></button>
                  <button onClick={() => setShowEditRetenido(false)} className="p-1 text-red-400 hover:text-red-500"><X size={14} /></button>
                </div>
              )}
            </div>
            <p className="text-[10px] text-slate-300 dark:text-stone-600 mt-1">Dinero cobrado en mano</p>
          </div>

          <div className="px-5 py-4 hidden sm:block">
            <div className="flex items-center gap-1.5 mb-1">
              <ClipboardList size={12} className="text-slate-400" />
              <span className="text-[10px] text-slate-400 dark:text-stone-500 tracking-wide">Limpiezas mes</span>
            </div>
            <p className="text-lg font-normal tabular-nums text-slate-700 dark:text-stone-300">{animCleansMonth}</p>
            <p className="text-[10px] text-slate-300 dark:text-stone-600 mt-1">Este ciclo de facturación</p>
          </div>

          <div className="px-5 py-4 hidden sm:block">
            <div className="flex items-center gap-1.5 mb-1">
              <Car size={12} className="text-slate-400" />
              <span className="text-[10px] text-slate-400 dark:text-stone-500 tracking-wide">Km totales mes</span>
            </div>
            <p className="text-lg font-normal tabular-nums text-slate-700 dark:text-stone-300">{animKmsMonth}</p>
            <p className="text-[10px] text-slate-300 dark:text-stone-600 mt-1">Acumulados en reservas</p>
          </div>

          <div className="px-5 py-4 flex items-center justify-center sm:block">
            <button
              onClick={() => { setPayMode('debt'); setPayAmount(remainingDue.toFixed(2)); setShowPayModal(true); }}
              className="w-full h-full sm:h-auto flex flex-col items-center justify-center gap-1.5 group"
            >
              <div className="w-10 h-10 rounded-full bg-orange-500 group-hover:bg-orange-600 transition-colors flex items-center justify-center text-white shadow-sm active:scale-95 transition-transform">
                <Euro size={18} />
              </div>
              <span className="text-[11px] font-normal text-orange-600 dark:text-orange-400">Registrar pago</span>
            </button>
          </div>
        </div>

        {/* Tabs navigation */}
        <div className="flex px-5 border-t border-stone-50 dark:border-stone-800">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => guardedSetTab(tab.id)}
              className={`py-3.5 px-1 mr-8 text-xs font-normal border-b-2 transition-all ${
                activeTab === tab.id
                  ? 'border-orange-500 text-orange-500'
                  : 'border-transparent text-slate-400 dark:text-stone-500 hover:text-slate-600 dark:hover:text-stone-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════
          CONTENT — cambia según la tab
      ═══════════════════════════════════════════════════════════ */}

      {/* ── TAB: DATOS ── */}
      {activeTab === 'datos' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 animate-in fade-in duration-300">
          <div className="md:col-span-2 bg-white dark:bg-stone-900 rounded-2xl border border-stone-100 dark:border-stone-800 p-6">
            <SectionTitle>Información personal</SectionTitle>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-12">
              <EditableRow icon={<UserIcon size={12} />} label="Nombre completo" value={draft.fullName} isEditing={isEditing} onChange={v => setDraftField('fullName', v)} />
              <EditableRow icon={<Hash size={12} />} label="DNI / NIE" value={draft.dni} mono isEditing={isEditing} onChange={v => setDraftField('dni', v)} />
              <EditableRow icon={<Phone size={12} />} label="Teléfono" value={draft.telefono} isEditing={isEditing} onChange={v => setDraftField('telefono', v)} type="tel" />
              <EditableRow icon={<Mail size={12} />} label="Email" value={draft.email} isEditing={isEditing} onChange={v => setDraftField('email', v)} type="email" />
              <EditableRow icon={<MapPin size={12} />} label="Dirección" value={(draft as any).direccion} isEditing={isEditing} onChange={v => setDraftField('direccion' as any, v)} />
              <EditableRow icon={<Smartphone size={12} />} label="Ubicación real-time" value={(draft as any).location} isEditing={isEditing} onChange={v => setDraftField('location' as any, v)} />
            </div>

            <SectionTitle>Configuración de pagos</SectionTitle>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-12">
              <SelectRow icon={<CreditCard size={12} />} label="Método de pago" value={draft.tipoPago} isEditing={isEditing} onChange={v => setDraftField('tipoPago', v as any)} options={[
                { value: 'bizum', label: 'Bizum' },
                { value: 'tarjeta', label: 'Transferencia bancaria' },
                { value: 'efectivo', label: 'Efectivo' },
              ]} />
              <EditableRow icon={<Banknote size={12} />} label="Pago por reserva" value={String(draft.pagoPorReserva ?? 0)} isEditing={isEditing} onChange={v => setDraftField('pagoPorReserva', v === '' ? 0 : Number(v))} type="number" placeholder="0" />
              <EditableRow icon={<Activity size={12} />} label="Precio por Km" value={String(draft.precioPorKm ?? 0)} isEditing={isEditing} onChange={v => setDraftField('precioPorKm', v === '' ? 0 : Number(v))} type="number" placeholder="0" />
            </div>

            <SectionTitle>Actividad del mes</SectionTitle>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-12">
              <EditableRow icon={<ClipboardList size={12} />} label="Limpiezas" value={String(draft.cleansCountMonth ?? 0)} isEditing={isEditing} onChange={v => setDraftField('cleansCountMonth', v === '' ? 0 : Number(v))} type="number" placeholder="0" />
              <EditableRow icon={<Car size={12} />} label="Km recorridos" value={String(draft.kmsMonth ?? 0)} isEditing={isEditing} onChange={v => setDraftField('kmsMonth', v === '' ? 0 : Number(v))} type="number" placeholder="0" />
            </div>
          </div>

          <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-100 dark:border-stone-800 p-5">
            {draft.tipoPago === 'bizum' && (
              <>
                <SectionTitle>Bizum</SectionTitle>
                <div className="space-y-4">
                  <EditableRow icon={<Phone size={12} />} label="Teléfono Bizum" value={draft.telefonoBizum} isEditing={isEditing} onChange={v => setDraftField('telefonoBizum', v)} type="tel" />
                </div>
              </>
            )}
            {draft.tipoPago === 'tarjeta' && (
              <>
                <SectionTitle>Transferencia bancaria</SectionTitle>
                <div className="space-y-4">
                  <EditableRow icon={<Landmark size={12} />} label="IBAN" value={draft.iban} mono isEditing={isEditing} onChange={v => setDraftField('iban', v)} />
                  <EditableRow icon={<Building2 size={12} />} label="Banco" value={draft.banco} isEditing={isEditing} onChange={v => setDraftField('banco', v)} />
                  <EditableRow icon={<UserIcon size={12} />} label="Titular" value={draft.titularCuenta} isEditing={isEditing} onChange={v => setDraftField('titularCuenta', v)} />
                </div>
              </>
            )}
            {draft.tipoPago === 'efectivo' && (
              <>
                <SectionTitle>Efectivo</SectionTitle>
                <p className="text-xs text-slate-400 dark:text-stone-500">Pago en mano. Sin datos bancarios adicionales.</p>
              </>
            )}
            {!draft.tipoPago && (
              <div className="py-10 flex flex-col items-center justify-center text-center px-4">
                <CreditCard className="text-stone-200 dark:text-stone-800 mb-3" size={32} />
                <p className="text-xs text-slate-400 dark:text-stone-500">Sin método de pago configurado.</p>
                <p className="text-[10px] text-slate-300 dark:text-stone-600 mt-1">Pulsa en Editar para configurar cómo cobra este operario.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TAB: REGISTROS ── */}
      {activeTab === 'registros' && (
        <div className="space-y-5 animate-in fade-in duration-300">
          <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-100 dark:border-stone-800 overflow-hidden">
            <div className="px-5 py-4 border-b border-stone-100 dark:border-stone-800 flex items-center justify-between">
              <h3 className="text-xs font-normal text-slate-500 dark:text-stone-400 tracking-wider">Historial de pagos</h3>
              <span className="text-[11px] text-slate-400 dark:text-stone-500">{paidPagos.length} registro{paidPagos.length !== 1 ? 's' : ''}</span>
            </div>
            {paidPagos.length === 0 ? (
              <div className="px-5 py-12 flex flex-col items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-orange-50 dark:bg-orange-900/30 flex items-center justify-center">
                  <Banknote size={18} className="text-orange-400" />
                </div>
                <p className="text-xs text-slate-400 dark:text-stone-500">Sin pagos registrados</p>
                <p className="text-[10px] text-slate-300 dark:text-stone-600">Usa el botón Pagar del resumen superior</p>
              </div>
            ) : (
              <div className="divide-y divide-stone-50 dark:divide-stone-800 max-h-80 overflow-y-auto custom-scrollbar">
                {paidPagos.map(p => (
                  <div key={p.id} className="flex items-center justify-between p-5 hover:bg-stone-50 dark:hover:bg-stone-800/50 transition-colors group">
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-orange-50 dark:bg-orange-900/30 flex items-center justify-center flex-shrink-0 group-hover:scale-95 transition-transform">
                        <CheckCheck size={13} className="text-orange-500" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-normal text-slate-700 dark:text-stone-300 truncate">{p.concepto}</p>
                        <p className="text-[11px] text-slate-400 dark:text-stone-500 mt-0.5">
                          {fmtDate(p.fecha)}
                          {p.limpiezas > 0 && ` · ${p.limpiezas} limpiezas`}
                          {p.km > 0 && ` · ${p.km} km acumulados`}
                        </p>
                      </div>
                    </div>
                    <span className="text-sm font-normal tabular-nums text-slate-800 dark:text-stone-100 flex-shrink-0">{fmtCurrency(p.importe)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-100 dark:border-stone-800 overflow-hidden">
            <div className="px-5 py-4 border-b border-stone-100 dark:border-stone-800 flex items-center justify-between">
              <h3 className="text-xs font-normal text-slate-500 dark:text-stone-400 tracking-wider">Registros de actividad</h3>
              <span className="text-[11px] text-slate-400 dark:text-stone-500">{totalRecords} total</span>
            </div>
            <div className="flex border-b border-stone-100 dark:border-stone-800 px-5 overflow-x-auto no-scrollbar">
              {recordTabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setRecordsTab(tab.id)}
                  className={`flex items-center gap-1.5 px-1 py-3 mr-8 text-xs font-normal border-b-2 transition-colors whitespace-nowrap shrink-0 ${
                    recordsTab === tab.id
                      ? 'border-orange-500 text-orange-500'
                      : 'border-transparent text-slate-400 dark:text-stone-500 hover:text-slate-600 dark:hover:text-stone-300'
                  }`}
                >
                  {tab.icon}{tab.label}
                  <span className={`text-[10px] font-normal px-1.5 py-0.5 rounded-md ${recordsTab === tab.id ? 'bg-orange-50 dark:bg-orange-900/30 text-orange-500' : 'bg-stone-100 dark:bg-stone-800 text-slate-400 dark:text-stone-500'}`}>
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>
            <div className="max-h-96 overflow-y-auto divide-y divide-stone-50 dark:divide-stone-800 custom-scrollbar">
              {recordsTab === 'normal' ? (
                normalCleans.length === 0 ? (
                  <div className="py-20 text-center text-[11px] text-slate-400 dark:text-stone-600">Sin registros normales</div>
                ) : normalCleans.map(r => (
                  <div key={r.id} className="px-5 py-4 hover:bg-stone-50 dark:hover:bg-stone-800/50 transition-colors">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs font-normal text-slate-700 dark:text-stone-300">{r.apartamento}</p>
                      <span className={`text-[10px] font-normal px-2 py-0.5 rounded-md ${r.checked ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600' : 'bg-amber-50 dark:bg-amber-900/30 text-amber-600'}`}>
                        {r.checked ? 'Verificado' : 'Pendiente'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-slate-400 dark:text-stone-500">
                      <CalendarRange size={10} />{fmtDatetime(r.checkinFecha)}
                      <span className="mx-1 opacity-30">|</span>
                      <Euro size={10} />{fmtCurrency((r as any).cobro ?? 0)}
                    </div>
                  </div>
                ))
              ) : recordsTab === 'initial' ? (
                initialCleans.length === 0 ? (
                  <div className="py-20 text-center text-[11px] text-slate-400 dark:text-stone-600">Sin registros iniciales</div>
                ) : initialCleans.map(r => (
                  <div key={r.id} className="px-5 py-4 hover:bg-stone-50 dark:hover:bg-stone-800/50 transition-colors">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs font-normal text-slate-700 dark:text-stone-300">{r.apartamento}</p>
                      <span className={`text-[10px] font-normal px-2 py-0.5 rounded-md ${r.checked ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600' : 'bg-amber-50 dark:bg-amber-900/30 text-amber-600'}`}>
                        {r.checked ? 'Verificado' : 'Pendiente'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-slate-400 dark:text-stone-500">
                      <CalendarRange size={10} />{fmtDatetime(r.checkinFecha)}
                      <span className="mx-1 opacity-30">|</span>
                      <Euro size={10} />{fmtCurrency((r as any).cobro ?? 0)}
                    </div>
                  </div>
                ))
              ) : (
                handymanRecords.length === 0 ? (
                  <div className="py-20 text-center text-[11px] text-slate-400 dark:text-stone-600">Sin registros de manitas</div>
                ) : handymanRecords.map(r => (
                  <div key={r.id} className="px-5 py-4 hover:bg-stone-50 dark:hover:bg-stone-800/50 transition-colors">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs font-normal text-slate-700 dark:text-stone-300 truncate pr-4">{r.alojamiento}</p>
                      <span className={`text-[10px] font-normal px-2 py-0.5 rounded-md ${r.estadoCompletado === 'Completado' ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600' : 'bg-amber-50 dark:bg-amber-900/30 text-amber-600'}`}>
                        {r.estadoCompletado}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-slate-400 dark:text-stone-500">
                      <CalendarRange size={10} />{fmtDate(r.fechaLlegada)}
                      <span className="mx-1 opacity-30">|</span>
                      <Clock size={10} />{(r as any).cantidadMinutos ?? (r as any).tiempoDuracion ?? 0} min
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── TAB: ANALÍTICAS ── */}
      {activeTab === 'analiticas' && (
        <div className="space-y-5 animate-in fade-in duration-300">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
            <div className="md:col-span-3 bg-white dark:bg-stone-900 rounded-2xl border border-stone-100 dark:border-stone-800 p-6 flex flex-col">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
                <div>
                  <h3 className="text-base font-normal text-slate-800 dark:text-stone-100">Tendencia de {METRIC_META[analyticsMetric].label}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[11px] text-slate-400 dark:text-stone-500 leading-none">
                      {METRIC_META[analyticsMetric].isAvg ? 'Media:' : 'Total:'}
                    </span>
                    <span className="text-lg font-normal tabular-nums text-slate-800 dark:text-stone-100 leading-none">
                      {METRIC_META[analyticsMetric].format(METRIC_META[analyticsMetric].isAvg ? analyticsAnimatedAvg : analyticsAnimatedTotal)}
                    </span>
                    {analyticsTrend !== 0 && (
                      <span className={`flex items-center gap-0.5 text-[11px] font-normal px-1.5 py-0.5 rounded-md ${
                        analyticsTrend > 0
                          ? 'text-orange-600 bg-orange-50 dark:text-orange-400 dark:bg-orange-900/30'
                          : 'text-orange-400 bg-orange-50/60 dark:text-orange-500 dark:bg-orange-900/20'
                      }`}>
                        {analyticsTrend > 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                        {Math.abs(analyticsTrend)}%
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 bg-stone-50 dark:bg-stone-800/60 p-1 rounded-xl w-full sm:w-auto overflow-x-auto no-scrollbar">
                  {ANALYTIC_PERIODS.map(p => (
                    <button
                      key={p.id}
                      onClick={() => setAnalyticsPeriod(p.id)}
                      className={`px-3 py-1.5 text-[10px] font-normal rounded-lg transition-all whitespace-nowrap ${
                        analyticsPeriod === p.id
                          ? 'bg-white dark:bg-stone-700 text-orange-600 dark:text-orange-400 shadow-sm'
                          : 'text-slate-400 dark:text-stone-500 hover:text-slate-600 dark:hover:text-stone-300'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {analyticsPeriod === 'personalizado' && (
                <div className="flex items-center gap-3 mb-6 bg-orange-50/40 dark:bg-orange-900/10 p-3 rounded-xl animate-in zoom-in-95 duration-200">
                  <div className="flex flex-col gap-1">
                    <span className="text-[9px] text-orange-400 font-normal uppercase tracking-wider">Desde</span>
                    <input type="date" value={analyticsDesde} onChange={e => setAnalyticsDesde(e.target.value)} className="bg-transparent border-0 text-xs text-slate-700 dark:text-stone-200 p-0 focus:ring-0" />
                  </div>
                  <div className="w-px h-6 bg-orange-100 dark:bg-orange-900/30" />
                  <div className="flex flex-col gap-1">
                    <span className="text-[9px] text-orange-400 font-normal uppercase tracking-wider">Hasta</span>
                    <input type="date" value={analyticsHasta} onChange={e => setAnalyticsHasta(e.target.value)} className="bg-transparent border-0 text-xs text-slate-700 dark:text-stone-200 p-0 focus:ring-0" />
                  </div>
                </div>
              )}

              <div className="flex-1 min-h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={analyticsChartData} key={analyticsChartKey}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                    <XAxis
                      dataKey="label"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: tickColor, fontSize: 10 }}
                      interval={analyticsXInterval}
                      dy={10}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: tickColor, fontSize: 10 }}
                      dx={-10}
                      tickFormatter={METRIC_META[analyticsMetric].format}
                    />
                    <Tooltip content={<AnalyticTooltip metric={analyticsMetric} />} cursor={{ stroke: tickColor, strokeWidth: 1, strokeDasharray: '4 4' }} />
                    <Line
                      type="monotone"
                      dataKey="valor"
                      stroke={METRIC_META[analyticsMetric].accent}
                      strokeWidth={2.5}
                      dot={<PulseDotAnalytic accent={METRIC_META[analyticsMetric].accent} />}
                      activeDot={{ r: 0 }}
                      animationDuration={1000}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="grid grid-cols-5 gap-4 mt-8">
                {(Object.entries(METRIC_META) as [AnalyticMetric, any][]).map(([m, meta]) => (
                  <button
                    key={m}
                    onClick={() => setAnalyticsMetric(m)}
                    className={`flex flex-col items-center gap-2 p-3 rounded-2xl transition-all border ${
                      analyticsMetric === m
                        ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-100 dark:border-orange-900/50'
                        : 'border-transparent hover:bg-stone-50 dark:hover:bg-stone-800'
                    }`}
                  >
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center transition-transform ${
                      analyticsMetric === m ? 'bg-orange-500 text-white shadow-sm' : 'bg-stone-100 dark:bg-stone-800 text-slate-400'
                    }`}>
                      {meta.icon}
                    </div>
                    <span className={`text-[10px] font-normal transition-colors ${analyticsMetric === m ? 'text-orange-600 dark:text-orange-400' : 'text-slate-400 dark:text-stone-500'}`}>
                      {meta.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-5">
              <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-100 dark:border-stone-800 p-5">
                <h3 className="text-[10px] font-normal text-slate-400 dark:text-stone-500 uppercase tracking-wider mb-4">Actividad por tipo · 6 meses</h3>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={monthlyBreakdown} barSize={8} barGap={3}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                    <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: tickColor, fontSize: 9 }} />
                    <Tooltip cursor={{ fill: 'transparent' }} content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      return (
                        <div className="bg-white dark:bg-stone-800 border-2 border-white dark:border-stone-700 rounded-xl px-2 py-1.5 text-[10px] soft-shadow">
                          {payload.map((p: any) => (
                            <div key={p.name} className="flex items-center gap-2">
                              <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: p.color }} />
                              <span className="text-slate-400">{p.name}:</span>
                              <span className="text-slate-800 dark:text-stone-200 font-normal">{p.value}</span>
                            </div>
                          ))}
                        </div>
                      );
                    }} />
                    <Bar dataKey="normal" name="Normal" fill="#f97316" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="initial" name="Inicial" fill="#fb923c" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="handyman" name="Manitas" fill="#fdba74" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-100 dark:border-stone-800 p-5">
                <h3 className="text-[10px] font-normal text-slate-400 dark:text-stone-500 uppercase tracking-wider mb-4">Métricas de rendimiento</h3>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    {
                      label: 'Días trabajados',
                      value: analyticsChartData.filter(d => d.valor > 0).length,
                      sub: 'en este periodo',
                      icon: <CalendarRange size={14} />,
                      bg: 'bg-orange-50 dark:bg-orange-900/10',
                      iconCls: 'text-orange-500'
                    },
                    {
                      label: 'Verificado',
                      value: `${Math.round((normalCleans.filter(r => r.checked).length / (normalCleans.length || 1)) * 100)}%`,
                      sub: 'tasa histórica',
                      icon: <CheckCircle2 size={14} />,
                      bg: 'bg-emerald-50 dark:bg-emerald-900/10',
                      iconCls: 'text-emerald-500'
                    },
                    {
                      label: 'Media ingresos',
                      value: fmtCurrency(analyticsAvg),
                      sub: 'por ' + (analyticsPeriod === 'semanal' ? 'día' : (analyticsPeriod === 'mensual' ? 'mes' : 'dia')),
                      icon: <TrendingUp size={14} />,
                      bg: 'bg-blue-50 dark:bg-blue-900/10',
                      iconCls: 'text-blue-500'
                    },
                    {
                      label: 'Tiempo total',
                      value: `${handymanRecords.reduce((a, r) => a + ((r as any).cantidadMinutos ?? (r as any).tiempoDuracion ?? 0), 0)} min`,
                      sub: 'solo manitas',
                      icon: <Clock size={14} />,
                      bg: 'bg-purple-50 dark:bg-purple-900/10',
                      iconCls: 'text-purple-500'
                    }
                  ].map(k => (
                    <div key={k.label} className={`${k.bg} rounded-xl p-3`}>
                      <div className={`${k.iconCls} mb-1`}>{k.icon}</div>
                      <p className="text-base font-normal tabular-nums text-slate-800 dark:text-stone-100">{k.value}</p>
                      <p className="text-[10px] text-slate-400 dark:text-stone-500 mt-0.5 leading-tight">{k.label}</p>
                      <p className="text-[10px] text-slate-300 dark:text-stone-600 mt-0.5 leading-tight">{k.sub}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB: ALOJAMIENTOS ── */}
      {activeTab === 'alojamientos' && (
        <div className="animate-in fade-in duration-300">
          <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-100 dark:border-stone-800 overflow-hidden">
            <div className="px-5 py-4 border-b border-stone-100 dark:border-stone-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h3 className="text-xs font-normal text-slate-500 dark:text-stone-400 tracking-wider">Alojamientos asignados</h3>
                <span className="text-[10px] font-normal px-2 py-0.5 rounded-md bg-stone-100 dark:bg-stone-800 text-slate-400 dark:text-stone-500">
                  {worker.accommodations.length}
                </span>
              </div>
              <button
                onClick={() => setIsAssignModalOpen(true)}
                className="flex items-center gap-2 px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white text-[11px] font-normal rounded-lg transition-all shadow-sm active:scale-95"
              >
                <Plus size={12} />
                Editar Alojamientos
              </button>
            </div>
            {worker.accommodations.length === 0 ? (
              <div className="px-5 py-16 flex flex-col items-center gap-3 text-center">
                <div className="w-12 h-12 rounded-full bg-stone-50 dark:bg-stone-800 flex items-center justify-center">
                  <MapPin size={22} className="text-stone-200 dark:text-stone-700" />
                </div>
                <p className="text-xs text-slate-400 dark:text-stone-500">Sin alojamientos asignados</p>
                <p className="text-[10px] text-slate-300 dark:text-stone-600 max-w-[200px]">Asigna alojamientos para que el trabajador aparezca en sus respectivos calendarios.</p>
              </div>
            ) : (
              <div className="p-6 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
                {worker.accommodations.map((accName) => {
                  const accData = allAccommodations.find(a => a.name === accName);
                  if (!accData) return null;
                  return (
                    <div 
                      key={accData.id} 
                      onClick={() => handleViewAccommodation(accData)}
                      className="cursor-pointer"
                    >
                      <AccommodationCard
                        accommodation={accData}
                        assignedWorkersCount={allWorkers.filter(w => w.accommodations?.includes(accData.name)).length}
                        onEdit={() => {}} 
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Modal de pago directo ── */}
      {showPayModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-white/20 dark:bg-stone-950/40 backdrop-blur-sm" onClick={() => setShowPayModal(false)} />
          <div className="relative bg-white dark:bg-stone-900 rounded-2xl border border-stone-100 dark:border-stone-800 shadow-xl w-full max-w-sm p-6 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2.5">
                <span className="w-8 h-8 rounded-xl bg-orange-50 dark:bg-orange-900/30 flex items-center justify-center">
                  <Banknote size={15} className="text-orange-500" />
                </span>
                <div>
                  <p className="text-sm font-normal text-slate-800 dark:text-stone-100">
                    {payMode === 'debt' ? 'Registrar pago de deuda' : 'Liquidar Efectivo Retenido'}
                  </p>
                  <p className="text-[11px] text-slate-400 dark:text-stone-500">{toTitleCase(worker.fullName)}</p>
                </div>
              </div>
              <button onClick={() => setShowPayModal(false)} className="text-slate-300 dark:text-stone-600 hover:text-slate-500 dark:hover:text-stone-400 transition-colors">
                <X size={16} />
              </button>
            </div>

            <div className="mb-5 px-3 py-2.5 bg-stone-50 dark:bg-stone-800 rounded-xl">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-400 dark:text-stone-500">
                  {payMode === 'debt' ? 'Total pendiente' : 'Efectivo retenido'}
                </span>
                <span className="text-sm font-normal tabular-nums text-slate-800 dark:text-stone-100">
                  {payMode === 'debt' ? fmtCurrency(remainingDue) : fmtCurrency(worker.efectivoRetenido ?? 0)}
                </span>
              </div>
              <div className="mt-1">
                <span className="text-[10px] text-slate-300 dark:text-stone-600">
                  {remainingBreakdown.limpiezas > 0 && `${remainingBreakdown.limpiezas} limpiezas`}
                  {remainingBreakdown.limpiezas > 0 && remainingBreakdown.km > 0 && ' · '}
                  {remainingBreakdown.km > 0 && `${remainingBreakdown.km} km`}
                </span>
              </div>
            </div>

            <div className="space-y-3 mb-5">
              <div>
                <label className="text-[11px] text-slate-400 dark:text-stone-500 font-normal tracking-wide block mb-1.5">Asunto</label>
                <input
                  type="text"
                  value={payAsunto}
                  onChange={e => setPayAsunto(e.target.value)}
                  placeholder="Ej. Nómina abril 2026"
                  className="w-full px-3 py-2.5 text-xs bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-slate-700 dark:text-stone-300 placeholder:text-stone-300 dark:placeholder:text-stone-600 focus:outline-none transition-all"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-400 dark:text-stone-500 font-normal tracking-wide block mb-1.5">Cantidad</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 dark:text-stone-500">€</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    max={remainingDue}
                    value={payAmount}
                    onChange={e => setPayAmount(e.target.value)}
                    className="w-full pl-7 pr-3 py-2.5 text-xs bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-slate-700 dark:text-stone-300 focus:outline-none transition-all tabular-nums"
                  />
                </div>
              </div>
            </div>

            <button
              onClick={handleDirectPay}
              disabled={paying2 || !payAmount || parseFloat(payAmount.replace(',', '.')) <= 0}
              className="w-full flex items-center justify-center gap-2 py-3 bg-orange-500 hover:bg-orange-600 text-white text-xs font-normal rounded-xl transition-all disabled:opacity-50"
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
          <div className="fixed inset-0 bg-white/20 dark:bg-stone-950/40 backdrop-blur-sm" onClick={cancelDiscard} />
          <div className="relative bg-white dark:bg-stone-900 rounded-2xl border border-stone-100 dark:border-stone-800 shadow-xl w-full max-w-sm p-6 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3 mb-5">
              <span className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0">
                <Edit2 size={14} className="text-amber-500" />
              </span>
              <div>
                <p className="text-sm font-normal text-slate-800 dark:text-stone-100">Cambios sin guardar</p>
                <p className="text-xs text-slate-400 dark:text-stone-500 mt-0.5">Si continúas perderás las modificaciones realizadas.</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={cancelDiscard}
                className="flex-1 py-2.5 text-xs font-normal rounded-xl bg-stone-100 dark:bg-stone-800 text-slate-600 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700 transition-all"
              >
                Seguir editando
              </button>
              <button
                onClick={confirmDiscard}
                className="flex-1 py-2.5 text-xs font-normal rounded-xl bg-red-500 text-white hover:bg-red-600 transition-all"
              >
                Descartar cambios
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Toast: Reversión exitosa ── */}
      {showRevertSuccess && (
        <div className="fixed bottom-6 right-6 z-[60] bg-emerald-600 text-white px-4 py-2.5 rounded-xl shadow-lg flex items-center gap-2 animate-in slide-in-from-right-4 duration-300">
          <RotateCcw size={14} />
          <span className="text-xs font-normal">Operación revertida con éxito</span>
        </div>
      )}

      {/* ── Modal de asignación de alojamientos ── */}
      <AccommodationAssignmentModal
        isOpen={isAssignModalOpen}
        onClose={() => setIsAssignModalOpen(false)}
        allAccommodations={allAccommodations}
        selectedAccommodationDetails={worker.accommodationDetails || worker.accommodations.map(name => ({ accommodationName: name, precio: 0, sabanasIncluidas: false, toallasIncluidas: false }))}
        onSave={handleSaveAssignments}
        workerName={worker.fullName}
      />

      {/* Modal de visualización compartido */}
      <AccommodationDetailModal
        accommodation={viewingAccommodation}
        isOpen={isViewModalOpen}
        onClose={() => setIsViewModalOpen(false)}
        assignedWorkers={allWorkers.filter(w => viewingAccommodation && w.accommodations?.includes(viewingAccommodation.name))}
        onManageWorkers={() => setIsViewModalOpen(false)} 
      />
    </div>
  );
};

export default WorkerProfile;
