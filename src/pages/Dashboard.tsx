import React, { useEffect, useState } from 'react';
import AnalyticsCards from '../components/dashboard/AnalyticsCards';
import WorkersTable from '../components/dashboard/WorkersTable';
import { appsScriptApi } from '../services/api';
import { Worker, CheckInOut, NormalCleanRecord, InitialCleanRecord, HandymanRecord, EntregaLlaves } from '../services/mockData';
import { Loader2, Search, Filter } from 'lucide-react';
import DashboardFilterModal, { Period, Metric } from '../components/dashboard/DashboardFilterModal';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { computeWorkerEarningsInRange } from '../utils/payments';
import CleanCheckoutFormModal, { CheckoutTabType } from '../components/cleans/CleanCheckoutFormModal';
import { CheckoutContextModal } from '../components/dashboard/CheckoutContextModal';

type CheckoutRecord = NormalCleanRecord | InitialCleanRecord | HandymanRecord;

interface DashboardProps {
  userRole?: 'admin' | 'editor' | 'viewer' | 'trabajador';
}

const Dashboard: React.FC<DashboardProps> = ({ userRole }) => {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [checkIns, setCheckIns] = useState<CheckInOut[]>([]);
  const [normalCleans, setNormalCleans] = useState<NormalCleanRecord[]>([]);
  const [initialCleans, setInitialCleans] = useState<InitialCleanRecord[]>([]);
  const [handymanRecords, setHandymanRecords] = useState<HandymanRecord[]>([]);
  const [activeNormalCheckins, setActiveNormalCheckins] = useState<NormalCleanRecord[]>([]);
  const [activeInitialCheckins, setActiveInitialCheckins] = useState<InitialCleanRecord[]>([]);
  const [activeHandymanCheckins, setActiveHandymanCheckins] = useState<HandymanRecord[]>([]);
  const [entregaLlaves, setEntregaLlaves] = useState<EntregaLlaves[]>([]);
  const [accommodations, setAccommodations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedWorker, setSelectedWorker] = useState<Worker | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Period state
  const [period, setPeriod] = useState<Period>('mensual');
  const [metric, setMetric] = useState<Metric>('dinero');
  const [customDesde, setCustomDesde] = useState('');
  const [customHasta, setCustomHasta] = useState('');
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);

  // Checkout Context Modal
  const [contextModal, setContextModal] = useState<{
    open: boolean;
    type: CheckoutTabType;
    record: CheckoutRecord | null;
  }>({
    open: false,
    type: 'normal',
    record: null
  });

  // Checkout Form Modal state
  const [checkoutForm, setCheckoutForm] = useState<{
    open: boolean;
    type: CheckoutTabType;
    record: CheckoutRecord;
  }>({
    open: false,
    type: 'normal',
    record: {} as NormalCleanRecord,
  });
  const [isSavingCheckout, setIsSavingCheckout] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [
          workersData, checkInsData, normalData, initialData, handymanData,
          activeNormalData, activeInitialData, activeHandymanData, entregaData,
          accommodationsData
        ] = await Promise.all([
          appsScriptApi.getWorkers(),
          appsScriptApi.getRecentCheckIns(),
          appsScriptApi.getNormalCleans(),
          appsScriptApi.getInitialCleans(),
          appsScriptApi.getHandymanRecords(),
          appsScriptApi.getNormalCheckins(),
          appsScriptApi.getInitialCheckins(),
          appsScriptApi.getHandymanCheckins(),
          appsScriptApi.getEntregaLlaves().catch(() => [] as EntregaLlaves[]),
          appsScriptApi.getAccommodations().catch(() => []),
        ]);
        setWorkers(workersData);
        setCheckIns(checkInsData);
        setNormalCleans(normalData);
        setInitialCleans(initialData);
        setHandymanRecords(handymanData);
        setActiveNormalCheckins(activeNormalData);
        setActiveInitialCheckins(activeInitialData);
        setActiveHandymanCheckins(activeHandymanData);
        setEntregaLlaves(entregaData);
        setAccommodations(accommodationsData);
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const refreshDashboard = async () => {
    try {
      const [
        workersData, checkInsData, normalData, initialData, handymanData,
        activeNormalData, activeInitialData, activeHandymanData
      ] = await Promise.all([
        appsScriptApi.getWorkers(),
        appsScriptApi.getRecentCheckIns(),
        appsScriptApi.getNormalCleans(),
        appsScriptApi.getInitialCleans(),
        appsScriptApi.getHandymanRecords(),
        appsScriptApi.getNormalCheckins(),
        appsScriptApi.getInitialCheckins(),
        appsScriptApi.getHandymanCheckins(),
      ]);
      setWorkers(workersData);
      setCheckIns(checkInsData);
      setNormalCleans(normalData);
      setInitialCleans(initialData);
      setHandymanRecords(handymanData);
      setActiveNormalCheckins(activeNormalData);
      setActiveInitialCheckins(activeInitialData);
      setActiveHandymanCheckins(activeHandymanData);
    } catch (error) {
      console.error('Error refreshing dashboard:', error);
    }
  };

  const handleCheckoutRequested = (type: CheckoutTabType, record: CheckoutRecord) => {
    setContextModal({ open: true, type, record });
  };

  const handleContextFinish = (type: CheckoutTabType, record: CheckoutRecord) => {
    setContextModal(prev => ({ ...prev, open: false }));
    // Prepare pre-filled record with current date/time for checkout
    const now = new Date().toISOString().split('.')[0].replace('T', ' ');
    const nowTime = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    
    let preFilled: CheckoutRecord;

    if (type === 'handyman') {
      const r = record as HandymanRecord;
      preFilled = {
        ...r,
        fechaFin: now,
        horaFinTarea: nowTime,
        estadoCompletado: 'Completado'
      } as HandymanRecord;
    } else {
      const r = record as NormalCleanRecord | InitialCleanRecord;
      preFilled = {
        ...r,
        checkoutFecha: now,
        horaSalida: nowTime,
        checked: false
      } as NormalCleanRecord | InitialCleanRecord;
    }

    setCheckoutForm({
      open: true,
      type,
      record: preFilled
    });
  };

  const handleContextDelete = async (type: CheckoutTabType, record: CheckoutRecord) => {
    try {
      setIsSavingCheckout(true);
      const ok = await appsScriptApi.deleteCheckinRecord(type, record.id);
      if (!ok) throw new Error('No se pudo borrar el check-in');
      setContextModal(prev => ({ ...prev, open: false }));
      await refreshDashboard();
    } catch (error) {
      console.error(error);
      window.alert('Error al borrar el check-in.');
    } finally {
      setIsSavingCheckout(false);
    }
  };

  const handleCheckoutSubmit = async (record: CheckoutRecord) => {
    try {
      setIsSavingCheckout(true);
      const ok = await appsScriptApi.createCheckoutRecord(checkoutForm.type, record);
      if (!ok) throw new Error('No se pudo guardar el checkout');
      
      setCheckoutForm(prev => ({ ...prev, open: false }));
      await refreshDashboard();
    } catch (error) {
      console.error(error);
      window.alert('Error al guardar el checkout.');
    } finally {
      setIsSavingCheckout(false);
    }
  };

  const activeFiltersCount = React.useMemo(() => {
    let count = 0;
    if (period !== 'mensual') count++;
    if (customDesde || customHasta) count++;
    return count;
  }, [period, customDesde, customHasta]);

  const filteredWorkers = React.useMemo(() => {
    const matched = workers.filter(w =>
      w.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      w.accommodations.some(a => a.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    return matched.map(w => {
      const earnings = computeWorkerEarningsInRange(
        w, normalCleans, initialCleans, handymanRecords, entregaLlaves,
        period, customDesde, customHasta
      );
      return {
        ...w,
        cleansCountMonth: earnings.cleanCount,
        kmsMonth: Math.round(earnings.kms * 100) / 100,
        extraHoursMonth: Math.round(earnings.extraHours * 100) / 100,
        netMoneyMonth: Math.round(earnings.totalOwed * 100) / 100,
        owedMoney: Math.round(earnings.totalOwed * 100) / 100,
        efectivoRetenido: Math.round(earnings.efectivoRetenido * 100) / 100,
      };
    });
  }, [workers, searchTerm, normalCleans, initialCleans, handymanRecords, entregaLlaves, period, customDesde, customHasta]);

  if (loading) {
    return <LoadingSpinner message="Cargando datos del dashboard..." />;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      {/* Header & Toolbar unificados */}
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 px-1 mb-2">
        <h1 className="text-xl font-normal text-slate-800 dark:text-stone-200 tracking-tight font-display shrink-0">
          Dashboard
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
              <span>Periodo</span>
              {activeFiltersCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-orange-600 text-white text-[10px] flex items-center justify-center rounded-full animate-in zoom-in-50">
                  {activeFiltersCount}
                </span>
              )}
            </button>

            <DashboardFilterModal 
              isOpen={isFilterModalOpen}
              onClose={() => setIsFilterModalOpen(false)}
              period={period}
              metric={metric}
              customDesde={customDesde}
              customHasta={customHasta}
              onApply={(updates) => {
                if (updates.period) setPeriod(updates.period);
                if (updates.metric) setMetric(updates.metric);
                if (updates.customDesde !== undefined) setCustomDesde(updates.customDesde);
                if (updates.customHasta !== undefined) setCustomHasta(updates.customHasta);
              }}
            />
          </div>
        </div>
      </header>

      {/* Bloque A: Gráfica + Actividad */}
      <AnalyticsCards
        checkIns={checkIns}
        selectedWorker={selectedWorker}
        onWorkerSelect={setSelectedWorker}
        workers={workers}
        period={period}
        customDesde={customDesde}
        customHasta={customHasta}
        normalCleans={normalCleans}
        initialCleans={initialCleans}
        handymanRecords={handymanRecords}
        activeNormalCheckins={activeNormalCheckins}
        activeInitialCheckins={activeInitialCheckins}
        activeHandymanCheckins={activeHandymanCheckins}
        onCheckoutRequested={handleCheckoutRequested}
      />

      {/* Bloque B: Tabla de Trabajadores */}
      <section>
        <WorkersTable
          workers={filteredWorkers}
          selectedWorker={selectedWorker}
          onWorkerSelect={setSelectedWorker}
          userRole={userRole}
        />
      </section>

      <CleanCheckoutFormModal
        isOpen={checkoutForm.open}
        mode="create"
        type={checkoutForm.type}
        initialValues={checkoutForm.record}
        workers={workers}
        accommodations={accommodations}
        loading={isSavingCheckout}
        onClose={() => setCheckoutForm(prev => ({ ...prev, open: false }))}
        onSubmit={handleCheckoutSubmit}
      />

      <CheckoutContextModal
        isOpen={contextModal.open}
        type={contextModal.type}
        record={contextModal.record}
        onClose={() => setContextModal(prev => ({ ...prev, open: false }))}
        onFinish={handleContextFinish}
        onDelete={handleContextDelete}
        isProcessing={isSavingCheckout}
      />
    </div>
  );
};

export default Dashboard;
