import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { appsScriptApi } from '../../services/api';
import type { Accommodation } from '../../services/mockData';
import SignaturePad from '../ui/SignaturePad';
import { DuracionInput, formatBizumNumber, formatDuracionTotal, resolveAccommodationId } from './serviceFormHelpers';
import {
  saveDraft,
  submitServiceReport,
  submitKeyDelivery,
  submitIncidentReport,
} from '../../services/reportsApi';
import { localDrafts } from '../../utils/localDrafts';

interface ServiceFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  draftId?: string | null;
  draftPayload?: (Partial<FormState> & { tipo?: ServiceType }) | null;
  initialTipo?: ServiceType | null;
}

type ServiceType = 'reserva' | 'manitas';

type SiNo = 'Si' | 'No';

type MetodoPago = 'Efectivo' | 'Tarjeta' | 'Bizum';

interface FormState {
  apartamento: string;
  horaEntrada: string;
  horaSalida: string;
  km: string;
  observaciones: string; // sólo reserva
  descripcion: string;   // sólo manitas
  // Reserva
  recogeLlaves: SiNo;
  sigueHuesped: SiNo;
  horaSalidaReserva: string; // sólo si sigueHuesped === 'Si'
  horasExtra: string;        // HH:MM
  justificacionExtra: string;
  // Entrega de llaves (opcional, common a reserva y manitas)
  incluyeEntregaLlaves: boolean;
  el_nombreCliente: string;
  el_fechaEntradaReserva: string; // datetime-local
  el_fechaSalidaReserva: string;  // datetime-local
  el_sabanasEntregadas: SiNo;
  el_sabanasPersonas: string;     // cantidad de personas (si sabanasEntregadas === Si)
  el_fianzaMonto: MetodoPago | '';
  el_bizumMonto: string;          // sólo si fianzaMonto === Bizum
  el_cantidadPagadaMonto: string;
  el_fianzaGarantia: MetodoPago | '';
  el_bizumGarantia: string;       // sólo si fianzaGarantia === Bizum
  el_cantidadPagadaGarantia: string;
  el_firmaTrabajador: string;     // base64
  el_firmaHuesped: string;        // base64
  // Incidencia (opcional, common)
  incluyeIncidencia: boolean;
  inc_duracion: string;           // HH:MM
  inc_detalles: string;
}

const emptyForm: FormState = {
  apartamento: '',
  horaEntrada: '',
  horaSalida: '',
  km: '',
  observaciones: '',
  descripcion: '',
  recogeLlaves: 'No',
  sigueHuesped: 'No',
  horaSalidaReserva: '',
  horasExtra: '',
  justificacionExtra: '',
  incluyeEntregaLlaves: false,
  el_nombreCliente: '',
  el_fechaEntradaReserva: '',
  el_fechaSalidaReserva: '',
  el_sabanasEntregadas: 'No',
  el_sabanasPersonas: '',
  el_fianzaMonto: 'Efectivo',
  el_bizumMonto: '',
  el_cantidadPagadaMonto: '',
  el_fianzaGarantia: 'Efectivo',
  el_bizumGarantia: '',
  el_cantidadPagadaGarantia: '',
  el_firmaTrabajador: '',
  el_firmaHuesped: '',
  incluyeIncidencia: false,
  inc_duracion: '',
  inc_detalles: '',
};

// text-base (16px) evita el auto-zoom de iOS Safari al hacer focus en inputs.
// min-w-0 + appearance-none: iOS Safari aplica un min-width nativo a type=time/datetime-local
// que ignora width:100% si no anulamos el styling de UA con appearance:none.
// min-h-[3.5rem] + leading-6: type=time vacío en iOS colapsa su alto sin esto.
const inputCls =
  'w-full min-w-0 min-h-[3.5rem] appearance-none rounded-xl bg-transparent border-[1.5px] border-stone-200 dark:border-stone-700/60 px-4 py-4 text-base leading-6 text-slate-800 dark:text-stone-100 placeholder:text-stone-300 dark:placeholder:text-stone-600 focus:outline-none focus:border-stone-900 dark:focus:border-stone-100 transition-colors';

const labelCls = 'block text-xs font-medium text-slate-600 dark:text-stone-300 mb-1.5';

const SiNoToggle: React.FC<{
  value: SiNo;
  onChange: (v: SiNo) => void;
}> = ({ value, onChange }) => (
  <div className="grid grid-cols-2 gap-2">
    {(['Si', 'No'] as SiNo[]).map((opt) => {
      const active = value === opt;
      return (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          className={`w-full py-4 rounded-2xl text-sm font-medium border transition-all active:scale-[0.98] ${active
              ? 'bg-stone-900 text-white border-stone-900 dark:bg-stone-100 dark:text-stone-900 dark:border-stone-100 shadow-sm'
              : 'bg-stone-50 dark:bg-stone-800/50 text-slate-600 dark:text-stone-300 border-slate-100 dark:border-stone-700/50 hover:bg-stone-100 dark:hover:bg-stone-700/50'
            }`}
        >
          {opt === 'Si' ? 'Sí' : 'No'}
        </button>
      );
    })}
  </div>
);

const PagoSelector: React.FC<{
  value: MetodoPago | '';
  onChange: (v: MetodoPago) => void;
}> = ({ value, onChange }) => (
  <div className="grid grid-cols-3 gap-2">
    {(['Efectivo', 'Tarjeta', 'Bizum'] as MetodoPago[]).map((opt) => {
      const active = value === opt;
      return (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          className={`w-full py-4 rounded-2xl text-xs font-medium border transition-all active:scale-[0.98] ${active
              ? 'bg-stone-900 text-white border-stone-900 dark:bg-stone-100 dark:text-stone-900 dark:border-stone-100 shadow-sm'
              : 'bg-stone-50 dark:bg-stone-800/50 text-slate-600 dark:text-stone-300 border-slate-100 dark:border-stone-700/50 hover:bg-stone-100 dark:hover:bg-stone-700/50'
            }`}
        >
          {opt}
        </button>
      );
    })}
  </div>
);

const SectionToggle: React.FC<{
  title: string;
  subtitle?: string;
  enabled: boolean;
  onToggle: () => void;
  children?: React.ReactNode;
}> = ({ title, subtitle, enabled, onToggle, children }) => (
  <div className="space-y-4">
    {/* Pill cabecera (siempre aislada del contenido). Mismo borde/curva que los inputs. */}
    <div className={`rounded-xl border-[1.5px] bg-transparent transition-colors ${enabled
        ? 'border-stone-900 dark:border-stone-100'
        : 'border-stone-200 dark:border-stone-700/60'
      }`}>
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-4 text-left active:scale-[0.99] transition-transform"
      >
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-800 dark:text-stone-100">{title}</p>
          {subtitle && <p className="text-[11px] text-slate-400 dark:text-stone-500 truncate">{subtitle}</p>}
        </div>
        <div className={`w-10 h-6 rounded-full flex items-center transition-all ${enabled ? 'bg-stone-900 dark:bg-stone-100 justify-end' : 'bg-stone-300 dark:bg-stone-700 justify-start'}`}>
          <div className="w-5 h-5 rounded-full bg-white dark:bg-stone-900 shadow mx-0.5" />
        </div>
      </button>
    </div>
    {/* Expansión suave (grid-rows trick). Children al mismo nivel visual que el resto del form. */}
    <div
      className="grid transition-[grid-template-rows,opacity] duration-[350ms] ease-in-out"
      style={{ gridTemplateRows: enabled ? '1fr' : '0fr', opacity: enabled ? 1 : 0 }}
    >
      <div className="overflow-hidden">
        <div className="space-y-4">{children}</div>
      </div>
    </div>
  </div>
);

const ApartamentoAutocomplete: React.FC<{
  value: string;
  onChange: (v: string) => void;
  options: Accommodation[];
}> = ({ value, onChange, options }) => {
  const [focused, setFocused] = useState(false);
  const matches = useMemo(() => {
    const q = value.trim().toLowerCase();
    if (!q) return options.slice(0, 8);
    return options
      .filter((o) => o.name.toLowerCase().includes(q))
      .slice(0, 8);
  }, [value, options]);

  return (
    <div className="relative">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => setFocused(false), 150)}
        placeholder="Buscar alojamiento..."
        className={inputCls}
        autoComplete="off"
      />
      {focused && matches.length > 0 && (
        <ul className="absolute z-10 mt-1 w-full max-h-56 overflow-y-auto rounded-2xl bg-white dark:bg-stone-900 border border-slate-100 dark:border-stone-700/50 shadow-lg">
          {matches.map((m) => (
            <li
              key={m.id}
              onMouseDown={(e) => {
                e.preventDefault();
                onChange(m.name);
                setFocused(false);
              }}
              className="px-4 py-2.5 text-sm text-slate-700 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800/60 cursor-pointer truncate"
            >
              {m.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

const parseHHMM = (s: string): number => {
  const m = s.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return 0;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
};

const ServiceFormModal: React.FC<ServiceFormModalProps> = ({
  isOpen,
  onClose,
  draftId,
  draftPayload,
  initialTipo,
}) => {
  const [tipo, setTipo] = useState<ServiceType | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [accommodations, setAccommodations] = useState<Accommodation[]>([]);
  // dirty: marca true cuando el usuario toca cualquier campo. Se resetea al abrir.
  // En estado para que el footer (Guardar en borrador) reaccione.
  const [dirty, setDirty] = useState(false);
  const [confirmCloseOpen, setConfirmCloseOpen] = useState(false);
  // Animación entrada/salida del popup de confirmación (replica el picker).
  const [confirmRender, setConfirmRender] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  useEffect(() => {
    if (confirmCloseOpen) {
      setConfirmRender(true);
      const id = requestAnimationFrame(() => setConfirmVisible(true));
      return () => cancelAnimationFrame(id);
    } else if (confirmRender) {
      setConfirmVisible(false);
      const t = window.setTimeout(() => setConfirmRender(false), 320);
      return () => window.clearTimeout(t);
    }
  }, [confirmCloseOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // Popup informativo tras guardar borrador.
  const [draftSavedOpen, setDraftSavedOpen] = useState(false);
  const [draftSavedRender, setDraftSavedRender] = useState(false);
  const [draftSavedVisible, setDraftSavedVisible] = useState(false);
  useEffect(() => {
    if (draftSavedOpen) {
      setDraftSavedRender(true);
      const id = requestAnimationFrame(() => setDraftSavedVisible(true));
      return () => cancelAnimationFrame(id);
    } else if (draftSavedRender) {
      setDraftSavedVisible(false);
      const t = window.setTimeout(() => setDraftSavedRender(false), 320);
      return () => window.clearTimeout(t);
    }
  }, [draftSavedOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // Animación de entrada/salida (slide-up estilo bottom-sheet).
  const [render, setRender] = useState(isOpen);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (isOpen) {
      setRender(true);
      const id = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(id);
    } else if (render) {
      setVisible(false);
      const t = window.setTimeout(() => setRender(false), 320);
      return () => window.clearTimeout(t);
    }
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!isOpen) return;
    appsScriptApi.getAccommodations().then(setAccommodations).catch(() => setAccommodations([]));
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setTipo(null);
      setForm(emptyForm);
      setStatus(null);
      setConfirmCloseOpen(false);
      setDraftSavedOpen(false);
      setDirty(false);
    } else if (draftPayload) {
      const { tipo: draftTipo, ...rest } = draftPayload;
      if (draftTipo) setTipo(draftTipo);
      setForm((prev) => ({ ...prev, ...(rest as Partial<FormState>) }));
    } else {
      const local = localDrafts.load<Partial<FormState> & { tipo?: ServiceType }>('service');
      if (local) {
        const { tipo: localTipo, ...rest } = local;
        if (localTipo) setTipo(localTipo);
        else if (initialTipo) setTipo(initialTipo);
        setForm((prev) => ({ ...prev, ...(rest as Partial<FormState>) }));
      } else if (initialTipo) {
        setTipo(initialTipo);
      }
    }
  }, [isOpen, draftPayload, initialTipo]);

  const setF = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setDirty(true);
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ type: 'ok' | 'error'; message: string } | null>(null);

  // hasAnyData controla habilitar "Guardar en borrador". Sólo cuando el usuario ha tocado algo.
  const hasAnyData = dirty;

  const horasExtraMin = parseHHMM(form.horasExtra);
  const requiresJustificacion = horasExtraMin > 0;

  const isValid = useMemo(() => {
    if (!tipo) return false;
    if (!form.apartamento.trim()) return false;
    if (!form.horaEntrada || !form.horaSalida) return false;
    if (tipo === 'manitas') {
      if (!form.descripcion.trim()) return false;
    } else {
      if (form.sigueHuesped === 'Si' && !form.horaSalidaReserva) return false;
      if (requiresJustificacion && !form.justificacionExtra.trim()) return false;
    }
    if (form.incluyeEntregaLlaves) {
      if (!form.el_nombreCliente.trim()) return false;
      if (!form.el_fechaEntradaReserva || !form.el_fechaSalidaReserva) return false;
      if (form.el_sabanasEntregadas === 'Si' && !form.el_sabanasPersonas) return false;
      if (!form.el_fianzaMonto) return false;
      if (form.el_fianzaMonto === 'Bizum' && !form.el_bizumMonto.trim()) return false;
      if (!form.el_cantidadPagadaMonto) return false;
      if (!form.el_fianzaGarantia) return false;
      if (form.el_fianzaGarantia === 'Bizum' && !form.el_bizumGarantia.trim()) return false;
      if (!form.el_cantidadPagadaGarantia) return false;
      if (!form.el_firmaTrabajador || !form.el_firmaHuesped) return false;
    }
    if (form.incluyeIncidencia) {
      if (!form.inc_duracion) return false;
      if (!form.inc_detalles.trim()) return false;
    }
    return true;
  }, [tipo, form, requiresJustificacion]);

  const handleSubmit = async () => {
    if (!tipo) return;
    setBusy(true);
    setStatus(null);
    try {
      // 1) Servicio principal
      const accId = resolveAccommodationId(form.apartamento, accommodations);
      const parentId = await submitServiceReport({
        kind: tipo,
        accommodationId: accId,
        accommodationName: form.apartamento,
        horaEntrada: form.horaEntrada,
        horaSalida: form.horaSalida,
        km: form.km ? Number(form.km) : 0,
        notas: tipo === 'manitas' ? form.descripcion : form.observaciones,
        recogeLlaves: tipo === 'reserva' ? form.recogeLlaves === 'Si' : false,
        sigueHuesped: tipo === 'reserva' ? form.sigueHuesped === 'Si' : false,
        horaSalidaHuesped:
          tipo === 'reserva' && form.sigueHuesped === 'Si' ? form.horaSalidaReserva : '',
        horasExtra: tipo === 'reserva' ? form.horasExtra : '',
        justificacionExtra:
          tipo === 'reserva' && requiresJustificacion ? form.justificacionExtra : '',
      });

      // 2) Llaves anidadas (opcional)
      if (form.incluyeEntregaLlaves) {
        await submitKeyDelivery({
          parentServiceId: parentId,
          accommodationId: accId,
          accommodationName: form.apartamento,
          nombreCliente: form.el_nombreCliente,
          fechaEntradaReserva: form.el_fechaEntradaReserva,
          fechaSalidaReserva: form.el_fechaSalidaReserva,
          sabanasEntregadas: form.el_sabanasEntregadas === 'Si',
          sabanasPersonas: form.el_sabanasPersonas ? Number(form.el_sabanasPersonas) : null,
          fianzaMontoMetodo: form.el_fianzaMonto as MetodoPago,
          bizumMonto: form.el_bizumMonto,
          cantidadPagadaMonto: form.el_cantidadPagadaMonto ? Number(form.el_cantidadPagadaMonto) : 0,
          fianzaGarantiaMetodo: form.el_fianzaGarantia as MetodoPago,
          bizumGarantia: form.el_bizumGarantia,
          cantidadPagadaGarantia: form.el_cantidadPagadaGarantia
            ? Number(form.el_cantidadPagadaGarantia)
            : 0,
          firmaTrabajadorBase64: form.el_firmaTrabajador,
          firmaHuespedBase64: form.el_firmaHuesped,
        });
      }

      // 3) Incidencia anidada (opcional)
      if (form.incluyeIncidencia) {
        await submitIncidentReport({
          parentServiceId: parentId,
          accommodationId: accId,
          accommodationName: form.apartamento,
          duracion: form.inc_duracion,
          detalles: form.inc_detalles,
        });
      }

      if (draftId) {
        const { deleteDraft } = await import('../../services/reportsApi');
        await deleteDraft(draftId).catch(() => { });
      }
      localDrafts.clear('service');
      setStatus({ type: 'ok', message: 'Informe enviado correctamente.' });
      setTimeout(onClose, 900);
    } catch (e: any) {
      setStatus({ type: 'error', message: e?.message || 'Error al enviar el informe.' });
    } finally {
      setBusy(false);
    }
  };

  const handleSaveDraft = async () => {
    setBusy(true);
    setStatus(null);
    try {
      await saveDraft('service', { tipo, ...form }, draftId ?? undefined);
      localDrafts.clear('service');
      // En lugar de cerrar directo: popup informativo. El usuario debe entender que NO se ha enviado.
      setDraftSavedOpen(true);
    } catch (e: any) {
      setStatus({ type: 'error', message: e?.message || 'Error al guardar.' });
    } finally {
      setBusy(false);
    }
  };

  // X o backdrop: persistimos sólo en localStorage.
  // Sólo para formularios NUEVOS (sin draftId): si editas un borrador existente no ensuciamos
  // el slot local, para que "Realizar trabajo" abra siempre en blanco.
  const handleCancelOrClose = () => {
    if (!draftId && tipo !== null && status?.type !== 'ok') {
      localDrafts.save('service', { tipo, ...form });
    }
    onClose();
  };

  // Botón "Cancelar": descarta local + Supabase draft y cierra.
  const handleCancel = async () => {
    setBusy(true);
    setStatus(null);
    try {
      if (draftId) {
        const { deleteDraft } = await import('../../services/reportsApi');
        await deleteDraft(draftId).catch(() => { });
      }
      localDrafts.clear('service');
      setTipo(null);
      setForm(emptyForm);
      onClose();
    } catch (e: any) {
      setStatus({ type: 'error', message: e?.message || 'Error al descartar datos.' });
    } finally {
      setBusy(false);
    }
  };

  if (!render) return null;

  return createPortal(
    <div className="fixed inset-0 z-[120] flex items-end justify-center">
      {/* Backdrop (no click-to-close: la única salida es el botón Cancelar). */}
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity duration-300"
        style={{ opacity: visible ? 1 : 0 }}
      />

      {/* Sheet — bg ligeramente translúcido + backdrop-blur para suavizar el borde superior. */}
      <div
        className="relative w-full sm:max-w-md h-[92vh] flex flex-col bg-white/95 dark:bg-stone-900/95 backdrop-blur-2xl rounded-t-3xl shadow-2xl border-t border-white/70 dark:border-stone-800/60 font-dm"
        style={{
          transform: visible ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 320ms cubic-bezier(0.4, 0, 0.2, 1)',
          willChange: 'transform',
        }}
      >
        {/* Header — mismo estilo que el picker, más compacto. */}
        <div className="px-6 pt-6 pb-6 text-center shrink-0">
          <h2 className="text-2xl font-medium text-slate-800 dark:text-stone-100 font-dm tracking-tight leading-snug">
            {tipo === 'reserva' ? 'Limpieza de reserva' : tipo === 'manitas' ? 'Manitas' : ''}
          </h2>
          <p className="text-sm text-slate-500 dark:text-stone-400 font-light font-dm mt-2">
            Rellena los datos del informe.
          </p>
        </div>

        {/* Scrollable */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden px-6 py-4 space-y-5">
          {tipo && (
            <>
              {/* Apartamento */}
              <div>
                <label className={labelCls}>
                  Apartamento <span className="text-stone-400 dark:text-stone-500">*</span>
                </label>
                <ApartamentoAutocomplete
                  value={form.apartamento}
                  onChange={(v) => setF('apartamento', v)}
                  options={accommodations}
                />
              </div>

              {/* ─── Entrega de llaves (opcional) — debajo de alojamiento ─── */}
              <SectionToggle
                title="¿Entregas las llaves?"
                enabled={form.incluyeEntregaLlaves}
                onToggle={() => setF('incluyeEntregaLlaves', !form.incluyeEntregaLlaves)}
              >
                <div>
                  <label className={labelCls}>
                    Nombre y apellidos del cliente <span className="text-stone-400 dark:text-stone-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.el_nombreCliente}
                    onChange={(e) => setF('el_nombreCliente', e.target.value)}
                    className={inputCls}
                    placeholder="Ej: Juan Pérez García"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="min-w-0">
                    <label className={labelCls}>
                      Entrada reserva <span className="text-stone-400 dark:text-stone-500">*</span>
                    </label>
                    /*esto son hora  */
                    <input
                      type="datetime-local"
                      value={form.el_fechaEntradaReserva}
                      onChange={(e) => setF('el_fechaEntradaReserva', e.target.value)}
                      min="1900-01-01T00:00"
                      max="9999-12-31T23:59"
                      className={inputCls}
                    />
                  </div>
                  <div className="min-w-0">
                    <label className={labelCls}>
                      Salida reserva <span className="text-stone-400 dark:text-stone-500">*</span>
                    </label>
                    <input
                      type="datetime-local"
                      value={form.el_fechaSalidaReserva}
                      onChange={(e) => setF('el_fechaSalidaReserva', e.target.value)}
                      min="1900-01-01T00:00"
                      max="9999-12-31T23:59"
                      className={inputCls}
                    />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>¿Has entregado sábanas y toallas?</label>
                  <SiNoToggle
                    value={form.el_sabanasEntregadas}
                    onChange={(v) => setF('el_sabanasEntregadas', v)}
                  />
                </div>
                {form.el_sabanasEntregadas === 'Si' && (
                  <div>
                    <label className={labelCls}>
                      Cantidad de personas (sábanas) <span className="text-stone-400 dark:text-stone-500">*</span>
                    </label>
                    <input
                      type="number"
                      min={1}
                      step={1}
                      value={form.el_sabanasPersonas}
                      onChange={(e) => setF('el_sabanasPersonas', e.target.value)}
                      className={inputCls}
                      placeholder="Ej: 2"
                    />
                  </div>
                )}
                {/* Fianza Monto */}
                <div>
                  <label className={labelCls}>
                    Fianza (Monto) <span className="text-stone-400 dark:text-stone-500">*</span>
                  </label>
                  <PagoSelector
                    value={form.el_fianzaMonto}
                    onChange={(v) => setF('el_fianzaMonto', v)}
                  />
                </div>
                {form.el_fianzaMonto === 'Bizum' && (
                  <div>
                    <label className={labelCls}>
                      Número Bizum (Monto) <span className="text-stone-400 dark:text-stone-500">*</span>
                    </label>
                    <input
                      type="tel"
                      inputMode="numeric"
                      value={form.el_bizumMonto}
                      onChange={(e) => setF('el_bizumMonto', formatBizumNumber(e.target.value))}
                      className={inputCls}
                      placeholder="612 34 56 78"
                      maxLength={12}
                    />
                  </div>
                )}
                <div>
                  <label className={labelCls}>
                    Cantidad pagada (Monto) <span className="text-stone-400 dark:text-stone-500">*</span>
                  </label>
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step={0.01}
                    value={form.el_cantidadPagadaMonto}
                    onChange={(e) => setF('el_cantidadPagadaMonto', e.target.value)}
                    className={inputCls}
                    placeholder="Ej: 40.00"
                  />
                </div>
                {/* Fianza Garantía */}
                <div>
                  <label className={labelCls}>
                    Fianza (Garantía) <span className="text-stone-400 dark:text-stone-500">*</span>
                  </label>
                  <PagoSelector
                    value={form.el_fianzaGarantia}
                    onChange={(v) => setF('el_fianzaGarantia', v)}
                  />
                </div>
                {form.el_fianzaGarantia === 'Bizum' && (
                  <div>
                    <label className={labelCls}>
                      Número Bizum (Garantía) <span className="text-stone-400 dark:text-stone-500">*</span>
                    </label>
                    <input
                      type="tel"
                      inputMode="numeric"
                      value={form.el_bizumGarantia}
                      onChange={(e) => setF('el_bizumGarantia', formatBizumNumber(e.target.value))}
                      className={inputCls}
                      placeholder="612 34 56 78"
                      maxLength={12}
                    />
                  </div>
                )}
                <div>
                  <label className={labelCls}>
                    Cantidad pagada (Garantía) <span className="text-stone-400 dark:text-stone-500">*</span>
                  </label>
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step={0.01}
                    value={form.el_cantidadPagadaGarantia}
                    onChange={(e) => setF('el_cantidadPagadaGarantia', e.target.value)}
                    className={inputCls}
                    placeholder="Ej: 10.00"
                  />
                </div>
                {/* Firmas */}
                <SignaturePad
                  label="Firma del trabajador *"
                  value={form.el_firmaTrabajador}
                  onChange={(b64) => setF('el_firmaTrabajador', b64)}
                />
                <SignaturePad
                  label="Firma del huésped *"
                  value={form.el_firmaHuesped}
                  onChange={(b64) => setF('el_firmaHuesped', b64)}
                />
              </SectionToggle>

              {/* Horas entrada/salida */}
              <div className="grid grid-cols-2 gap-3">
                <div className="min-w-0">
                  <label className={labelCls}>
                    Hora entrada {tipo === 'reserva' ? 'limpieza' : 'manitas'} <span className="text-stone-400 dark:text-stone-500">*</span>
                  </label>
                  <input
                    type="time"
                    value={form.horaEntrada}
                    onChange={(e) => setF('horaEntrada', e.target.value)}
                    className={inputCls}
                  />
                </div>
                <div className="min-w-0">
                  <label className={labelCls}>
                    Hora salida {tipo === 'reserva' ? 'limpieza' : 'manitas'} <span className="text-stone-400 dark:text-stone-500">*</span>
                  </label>
                  <input
                    type="time"
                    value={form.horaSalida}
                    onChange={(e) => setF('horaSalida', e.target.value)}
                    className={inputCls}
                  />
                </div>
              </div>

              {/* Reserva-only: horas extra debajo del rango */}
              {tipo === 'reserva' && (
                <>
                  <div>
                    <div className="flex items-baseline justify-between mb-1.5">
                      <label className="block text-xs font-medium text-slate-600 dark:text-stone-300">
                        Horas extra realizadas
                      </label>
                      <span className="text-[11px] text-slate-500 dark:text-stone-400">
                        Total: <span className="font-medium text-slate-700 dark:text-stone-200">{formatDuracionTotal(form.horasExtra)}</span>
                      </span>
                    </div>
                    <DuracionInput
                      hideTotal
                      value={form.horasExtra}
                      onChange={(v) => setF('horasExtra', v)}
                    />
                  </div>
                  {requiresJustificacion && (
                    <div>
                      <label className={labelCls}>
                        Justificación horas extra <span className="text-stone-400 dark:text-stone-500">*</span>
                      </label>
                      <textarea
                        rows={3}
                        value={form.justificacionExtra}
                        onChange={(e) => setF('justificacionExtra', e.target.value)}
                        className={inputCls}
                        placeholder="Explica por qué hubo horas extra…"
                      />
                    </div>
                  )}
                </>
              )}

              {/* Km */}
              <div>
                <label className={labelCls}>Km ida y vuelta</label>
                <input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step={0.1}
                  value={form.km}
                  onChange={(e) => setF('km', e.target.value)}
                  className={inputCls}
                  placeholder="0"
                />
                <p className="mt-1.5 text-[10px] text-slate-400 dark:text-stone-500">
                  Sólo si has usado coche. Déjalo en 0 si has ido andando o en transporte público.
                </p>
              </div>

              {/* Reserva-only: Recoge llaves, Sigue huésped */}
              {tipo === 'reserva' && (
                <>
                  <div>
                    <label className={labelCls}>¿Recoges las llaves?</label>
                    <SiNoToggle
                      value={form.recogeLlaves}
                      onChange={(v) => setF('recogeLlaves', v)}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>¿Sigue el huésped tras checkout?</label>
                    <SiNoToggle
                      value={form.sigueHuesped}
                      onChange={(v) => setF('sigueHuesped', v)}
                    />
                  </div>
                  {form.sigueHuesped === 'Si' && (
                    <div>
                      <label className={labelCls}>
                        Hora salida del huésped <span className="text-stone-400 dark:text-stone-500">*</span>
                      </label>
                      <input
                        type="time"
                        value={form.horaSalidaReserva}
                        onChange={(e) => setF('horaSalidaReserva', e.target.value)}
                        className={inputCls}
                      />
                    </div>
                  )}
                </>
              )}

              {/* Observaciones (reserva) / Descripción (manitas) */}
              {tipo === 'reserva' ? (
                <div>
                  <label className={labelCls}>Observaciones</label>
                  <textarea
                    rows={4}
                    value={form.observaciones}
                    onChange={(e) => setF('observaciones', e.target.value)}
                    className={inputCls}
                    placeholder="¿Algo especial que comentar?"
                  />
                </div>
              ) : (
                <div>
                  <label className={labelCls}>
                    Descripción del trabajo <span className="text-stone-400 dark:text-stone-500">*</span>
                  </label>
                  <textarea
                    rows={4}
                    value={form.descripcion}
                    onChange={(e) => setF('descripcion', e.target.value)}
                    className={inputCls}
                    placeholder="Ej: cambié bombilla del baño, arreglé tirador persiana…"
                  />
                </div>
              )}

              {/* ─── Incidencia (opcional) ─── */}
              <SectionToggle
                title="¿Reportas una incidencia?"
                enabled={form.incluyeIncidencia}
                onToggle={() => setF('incluyeIncidencia', !form.incluyeIncidencia)}
              >
                <div>
                  <label className={labelCls}>
                    Duración de la incidencia <span className="text-stone-400 dark:text-stone-500">*</span>
                  </label>
                  <DuracionInput
                    value={form.inc_duracion}
                    onChange={(v) => setF('inc_duracion', v)}
                  />
                </div>
                <div>
                  <label className={labelCls}>
                    Detalles de la incidencia <span className="text-stone-400 dark:text-stone-500">*</span>
                  </label>
                  <textarea
                    rows={4}
                    value={form.inc_detalles}
                    onChange={(e) => setF('inc_detalles', e.target.value)}
                    className={inputCls}
                    placeholder="Ej: persiana rota en habitación principal…"
                  />
                </div>
              </SectionToggle>
            </>
          )}
        </div>

        {/* Footer neutro (sticky abajo). 3 estados: idle / draft / send. */}
        {(() => {
          const mode: 'idle' | 'draft' | 'send' = isValid ? 'send' : hasAnyData ? 'draft' : 'idle';
          const handleClick = () => {
            if (busy) return;
            if (mode === 'send') handleSubmit();
            else if (mode === 'draft') handleSaveDraft();
          };
          const label = busy
            ? mode === 'draft' ? 'Guardando…' : 'Enviando…'
            : mode === 'draft' ? 'Guardar en borrador' : 'Enviar informe';
          const helper =
            mode === 'send'
              ? 'Listo para enviar. Pulsa para enviar el informe.'
              : mode === 'draft'
                ? 'Faltan campos obligatorios. Se guardará como borrador.'
                : 'Rellena los campos para empezar.';
          return (
            <div className="px-6 pt-3 pb-[calc(env(safe-area-inset-bottom)+1rem)] border-t border-slate-100 dark:border-stone-800/60 shrink-0 bg-white/80 dark:bg-stone-900/80 backdrop-blur-sm">
              {status && (
                <div className={`mb-2 px-3 py-2 rounded-xl text-[11px] font-medium text-center border ${status.type === 'ok'
                    ? 'bg-stone-50 dark:bg-stone-800/40 text-slate-700 dark:text-stone-200 border-stone-200 dark:border-stone-700/50'
                    : 'bg-stone-100 dark:bg-stone-800/60 text-slate-800 dark:text-stone-100 border-stone-300 dark:border-stone-600'
                  }`}>
                  {status.message}
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    if (dirty) setConfirmCloseOpen(true);
                    else handleCancel();
                  }}
                  disabled={busy}
                  className="w-full py-4 rounded-2xl text-sm font-medium text-slate-600 dark:text-stone-300 bg-stone-100 dark:bg-stone-800/60 hover:bg-stone-200 dark:hover:bg-stone-700/60 transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleClick}
                  disabled={busy || mode === 'idle'}
                  className={`w-full py-4 rounded-2xl text-sm font-medium transition-colors disabled:cursor-not-allowed ${mode === 'idle'
                      ? 'bg-stone-200 dark:bg-stone-800/60 text-slate-400 dark:text-stone-500'
                      : 'bg-stone-900 hover:bg-stone-800 dark:bg-stone-100 dark:hover:bg-white text-white dark:text-stone-900'
                    } ${busy ? 'opacity-60 cursor-wait' : ''}`}
                >
                  {label}
                </button>
              </div>
              <p className="mt-2 text-[11px] text-center text-slate-400 dark:text-stone-500">
                {helper}
              </p>
            </div>
          );
        })()}

        {/* Popup confirmación al cancelar con cambios. Replica picker (slide-up + fade). */}
        {confirmRender && (
          <div className="absolute inset-0 z-10 flex items-end justify-center">
            <div
              onClick={() => setConfirmCloseOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity duration-300"
              style={{ opacity: confirmVisible ? 1 : 0 }}
            />
            <div
              className="relative w-full sm:max-w-md bg-white dark:bg-stone-900 rounded-t-3xl shadow-2xl border-t border-white/60 dark:border-stone-800/50 pb-[calc(env(safe-area-inset-bottom)+1rem)] font-dm"
              style={{
                transform: confirmVisible ? 'translateY(0)' : 'translateY(100%)',
                transition: 'transform 320ms cubic-bezier(0.4, 0, 0.2, 1)',
                willChange: 'transform',
              }}
            >
              <div className="px-6 pt-12 pb-14 text-center">
                <h2 className="text-2xl font-medium text-slate-800 dark:text-stone-100 font-dm tracking-tight leading-snug">
                  ¿Descartar los cambios?
                </h2>
                <p className="text-sm text-slate-500 dark:text-stone-400 font-light font-dm mt-3">
                  Puedes guardar lo que llevas como borrador y seguir luego.
                </p>
              </div>
              <div className="px-6 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setConfirmCloseOpen(false);
                    handleCancel();
                  }}
                  disabled={busy}
                  className="w-full py-4 rounded-2xl text-sm font-medium text-slate-600 dark:text-stone-300 bg-stone-100 dark:bg-stone-800/60 hover:bg-stone-200 dark:hover:bg-stone-700/60 transition-colors disabled:opacity-50"
                >
                  Descartar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setConfirmCloseOpen(false);
                    handleSaveDraft();
                  }}
                  disabled={busy}
                  className="w-full py-4 rounded-2xl text-sm font-medium text-white bg-stone-900 hover:bg-stone-800 dark:bg-stone-100 dark:hover:bg-white dark:text-stone-900 transition-colors disabled:opacity-50"
                >
                  Guardar borrador
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Popup informativo tras guardar borrador. Texto pensado para que cualquiera entienda
            que el informe NO se ha enviado todavía. */}
        {draftSavedRender && (
          <div className="absolute inset-0 z-20 flex items-end justify-center">
            <div
              className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm transition-opacity duration-300"
              style={{ opacity: draftSavedVisible ? 1 : 0 }}
            />
            <div
              className="relative w-full sm:max-w-md bg-white dark:bg-stone-900 rounded-t-3xl shadow-2xl border-t border-white/60 dark:border-stone-800/50 pb-[calc(env(safe-area-inset-bottom)+1rem)] font-dm"
              style={{
                transform: draftSavedVisible ? 'translateY(0)' : 'translateY(100%)',
                transition: 'transform 320ms cubic-bezier(0.4, 0, 0.2, 1)',
                willChange: 'transform',
              }}
            >
              <div className="px-6 pt-12 pb-10 text-center">
                <h2 className="text-2xl font-medium text-slate-800 dark:text-stone-100 font-dm tracking-tight leading-snug">
                  Atención: tu informe NO se ha enviado
                </h2>
                <p className="text-sm text-slate-600 dark:text-stone-300 font-light font-dm mt-4 leading-relaxed">
                  Lo hemos guardado como <span className="font-medium text-slate-800 dark:text-stone-100">borrador</span> para que no pierdas lo que llevas escrito.
                </p>
                <p className="text-sm text-slate-600 dark:text-stone-300 font-light font-dm mt-3 leading-relaxed">
                  Para enviarlo de verdad tienes que volver a abrirlo desde <span className="font-medium text-slate-800 dark:text-stone-100">"Mis borradores"</span>, rellenar los campos que faltan y pulsar <span className="font-medium text-slate-800 dark:text-stone-100">"Enviar informe"</span>.
                </p>
              </div>
              <div className="px-6">
                <button
                  type="button"
                  onClick={() => {
                    setDraftSavedOpen(false);
                    // Espera al fin de la animación de salida antes de cerrar el form.
                    window.setTimeout(onClose, 320);
                  }}
                  className="w-full py-4 rounded-2xl text-sm font-medium text-white bg-stone-900 hover:bg-stone-800 dark:bg-stone-100 dark:hover:bg-white dark:text-stone-900 transition-colors"
                >
                  Entendido
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};

export default ServiceFormModal;
