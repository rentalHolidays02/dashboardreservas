import React, { useEffect, useMemo, useState } from 'react';
import { X, Home, Wrench, Sparkles, Search, Key, AlertTriangle, type LucideIcon } from 'lucide-react';
import { appsScriptApi } from '../../services/api';
import type { Accommodation } from '../../services/mockData';
import SignaturePad from '../ui/SignaturePad';

interface ServiceFormModalProps {
  isOpen: boolean;
  onClose: () => void;
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

const inputCls =
  'w-full rounded-2xl bg-stone-50 dark:bg-stone-800/50 border border-slate-100 dark:border-stone-700/50 px-4 py-3 text-sm text-slate-800 dark:text-stone-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-300 transition-all';

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
          className={`px-4 py-2.5 rounded-2xl text-sm font-medium border transition-all active:scale-[0.98] ${
            active
              ? 'bg-orange-500 text-white border-orange-500 shadow-sm'
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
          className={`px-3 py-2.5 rounded-2xl text-xs font-medium border transition-all active:scale-[0.98] ${
            active
              ? 'bg-orange-500 text-white border-orange-500 shadow-sm'
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
  Icon: LucideIcon;
  title: string;
  subtitle: string;
  enabled: boolean;
  onToggle: () => void;
  iconWrap: string;
  iconColor: string;
  children?: React.ReactNode;
}> = ({ Icon, title, subtitle, enabled, onToggle, iconWrap, iconColor, children }) => (
  <div className={`rounded-3xl border transition-all overflow-hidden ${
    enabled
      ? 'border-orange-200 dark:border-orange-800/40 bg-orange-50/30 dark:bg-orange-400/5'
      : 'border-slate-100 dark:border-stone-800/50 bg-stone-50/50 dark:bg-stone-800/30'
  }`}>
    <button
      type="button"
      onClick={onToggle}
      className="w-full flex items-center gap-3 px-4 py-3.5 text-left active:scale-[0.99] transition-transform"
    >
      <div className={`p-2 rounded-xl ${iconWrap} ${iconColor} shrink-0`}>
        <Icon size={18} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-800 dark:text-stone-100">{title}</p>
        <p className="text-[11px] text-slate-400 dark:text-stone-500 truncate">{subtitle}</p>
      </div>
      <div className={`w-10 h-6 rounded-full flex items-center transition-all ${enabled ? 'bg-orange-500 justify-end' : 'bg-stone-300 dark:bg-stone-700 justify-start'}`}>
        <div className="w-5 h-5 rounded-full bg-white shadow mx-0.5" />
      </div>
    </button>
    {enabled && (
      <div className="px-4 pb-4 pt-1 space-y-4 border-t border-orange-100 dark:border-orange-900/30">
        {children}
      </div>
    )}
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
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 size-4" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => setFocused(false), 150)}
        placeholder="Buscar alojamiento..."
        className={`${inputCls} pl-10`}
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
              className="px-4 py-2.5 text-sm text-slate-700 dark:text-stone-200 hover:bg-orange-50 dark:hover:bg-orange-400/10 cursor-pointer truncate"
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

const ServiceFormModal: React.FC<ServiceFormModalProps> = ({ isOpen, onClose }) => {
  const [tipo, setTipo] = useState<ServiceType | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [accommodations, setAccommodations] = useState<Accommodation[]>([]);

  useEffect(() => {
    if (!isOpen) return;
    appsScriptApi.getAccommodations().then(setAccommodations).catch(() => setAccommodations([]));
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setTipo(null);
      setForm(emptyForm);
    }
  }, [isOpen]);

  const setF = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full sm:max-w-lg max-h-[95vh] sm:max-h-[90vh] flex flex-col bg-white dark:bg-stone-900 sm:rounded-3xl rounded-t-3xl shadow-2xl border border-white/60 dark:border-stone-800/50 animate-in zoom-in-95 slide-in-from-bottom-4 duration-300">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-stone-800/60 shrink-0">
          <div>
            <h2 className="text-base font-medium text-slate-800 dark:text-stone-100 font-display">
              Rellenar informe
            </h2>
            <p className="text-xs text-slate-400 dark:text-stone-500 font-light">
              {tipo === 'reserva'
                ? 'Limpieza de reserva'
                : tipo === 'manitas'
                  ? 'Manitas'
                  : 'Elige tipo de servicio'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-stone-800/60 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Selector tipo */}
          <div>
            <label className={labelCls}>Tipo de servicio</label>
            <div className="grid grid-cols-2 gap-3">
              {([
                { id: 'reserva' as ServiceType, label: 'Limpieza de reserva', Icon: Home },
                { id: 'manitas' as ServiceType, label: 'Manitas',              Icon: Wrench },
              ]).map(({ id, label, Icon }) => {
                const active = tipo === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setTipo(id)}
                    className={`flex flex-col items-center justify-center gap-2 py-4 rounded-2xl border transition-all active:scale-[0.98] ${
                      active
                        ? 'bg-orange-50 dark:bg-orange-400/10 border-orange-300 dark:border-orange-700/50 text-orange-600 dark:text-orange-400 shadow-sm'
                        : 'bg-stone-50 dark:bg-stone-800/50 border-slate-100 dark:border-stone-700/50 text-slate-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-700/50'
                    }`}
                  >
                    <Icon size={22} />
                    <span className="text-xs font-medium text-center leading-tight">{label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {tipo && (
            <>
              {/* Apartamento */}
              <div>
                <label className={labelCls}>
                  Apartamento <span className="text-orange-500">*</span>
                </label>
                <ApartamentoAutocomplete
                  value={form.apartamento}
                  onChange={(v) => setF('apartamento', v)}
                  options={accommodations}
                />
              </div>

              {/* Horas entrada/salida */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>
                    Hora entrada <span className="text-orange-500">*</span>
                  </label>
                  <input
                    type="time"
                    value={form.horaEntrada}
                    onChange={(e) => setF('horaEntrada', e.target.value)}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>
                    Hora salida <span className="text-orange-500">*</span>
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
                    <label className={labelCls}>
                      Horas extra (HH:MM)
                    </label>
                    <input
                      type="time"
                      value={form.horasExtra}
                      onChange={(e) => setF('horasExtra', e.target.value)}
                      className={inputCls}
                      placeholder="00:00"
                    />
                  </div>
                  {requiresJustificacion && (
                    <div>
                      <label className={labelCls}>
                        Justificación horas extra <span className="text-orange-500">*</span>
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
                        Hora salida del huésped <span className="text-orange-500">*</span>
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
                    Descripción del trabajo <span className="text-orange-500">*</span>
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

              {/* ─── Entrega de llaves (opcional) ─── */}
              <SectionToggle
                Icon={Key}
                title="Entrega de llaves"
                subtitle="Datos del check-in del huésped"
                enabled={form.incluyeEntregaLlaves}
                onToggle={() => setF('incluyeEntregaLlaves', !form.incluyeEntregaLlaves)}
                iconWrap="bg-blue-100 dark:bg-blue-400/10"
                iconColor="text-blue-600 dark:text-blue-400"
              >
                <div>
                  <label className={labelCls}>
                    Nombre y apellidos del cliente <span className="text-orange-500">*</span>
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
                  <div>
                    <label className={labelCls}>
                      Entrada reserva <span className="text-orange-500">*</span>
                    </label>
                    <input
                      type="datetime-local"
                      value={form.el_fechaEntradaReserva}
                      onChange={(e) => setF('el_fechaEntradaReserva', e.target.value)}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>
                      Salida reserva <span className="text-orange-500">*</span>
                    </label>
                    <input
                      type="datetime-local"
                      value={form.el_fechaSalidaReserva}
                      onChange={(e) => setF('el_fechaSalidaReserva', e.target.value)}
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
                      Cantidad de personas (sábanas) <span className="text-orange-500">*</span>
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
                    Fianza (Monto) <span className="text-orange-500">*</span>
                  </label>
                  <PagoSelector
                    value={form.el_fianzaMonto}
                    onChange={(v) => setF('el_fianzaMonto', v)}
                  />
                </div>
                {form.el_fianzaMonto === 'Bizum' && (
                  <div>
                    <label className={labelCls}>
                      Número Bizum (Monto) <span className="text-orange-500">*</span>
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={form.el_bizumMonto}
                      onChange={(e) => setF('el_bizumMonto', e.target.value)}
                      className={inputCls}
                      placeholder="Ej: 612345678"
                    />
                  </div>
                )}
                <div>
                  <label className={labelCls}>
                    Cantidad pagada (Monto) <span className="text-orange-500">*</span>
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
                    Fianza (Garantía) <span className="text-orange-500">*</span>
                  </label>
                  <PagoSelector
                    value={form.el_fianzaGarantia}
                    onChange={(v) => setF('el_fianzaGarantia', v)}
                  />
                </div>
                {form.el_fianzaGarantia === 'Bizum' && (
                  <div>
                    <label className={labelCls}>
                      Número Bizum (Garantía) <span className="text-orange-500">*</span>
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={form.el_bizumGarantia}
                      onChange={(e) => setF('el_bizumGarantia', e.target.value)}
                      className={inputCls}
                      placeholder="Ej: 612345678"
                    />
                  </div>
                )}
                <div>
                  <label className={labelCls}>
                    Cantidad pagada (Garantía) <span className="text-orange-500">*</span>
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

              {/* ─── Incidencia (opcional) ─── */}
              <SectionToggle
                Icon={AlertTriangle}
                title="Reportar incidencia"
                subtitle="Reporta una incidencia en el alojamiento"
                enabled={form.incluyeIncidencia}
                onToggle={() => setF('incluyeIncidencia', !form.incluyeIncidencia)}
                iconWrap="bg-red-100 dark:bg-red-400/10"
                iconColor="text-red-600 dark:text-red-400"
              >
                <div>
                  <label className={labelCls}>
                    Duración (HH:MM) <span className="text-orange-500">*</span>
                  </label>
                  <input
                    type="time"
                    value={form.inc_duracion}
                    onChange={(e) => setF('inc_duracion', e.target.value)}
                    className={inputCls}
                    placeholder="00:00"
                  />
                </div>
                <div>
                  <label className={labelCls}>
                    Detalles de la incidencia <span className="text-orange-500">*</span>
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

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 dark:border-stone-800/60 shrink-0 bg-white/80 dark:bg-stone-900/80 backdrop-blur-sm rounded-b-3xl">
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-3 rounded-2xl bg-stone-100 dark:bg-stone-800/40 border border-stone-200 dark:border-stone-700/40 text-slate-600 dark:text-stone-300 text-sm font-medium hover:bg-stone-50 dark:hover:bg-stone-700/40 transition-all active:scale-[0.98]"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled
              title="Pendiente: persistencia en Supabase"
              className={`px-5 py-3 rounded-2xl text-sm font-medium shadow-sm transition-all flex items-center justify-center gap-2 cursor-not-allowed ${
                isValid
                  ? 'bg-orange-500/40 text-white'
                  : tipo
                    ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/50'
                    : 'bg-stone-200 dark:bg-stone-700 text-slate-400 dark:text-stone-500'
              }`}
            >
              <Sparkles size={14} />
              {isValid ? 'Enviar informe' : tipo ? 'Guardar en borrador' : 'Enviar informe'}
            </button>
          </div>
          <p className="mt-2 text-[10px] text-center text-slate-400 dark:text-stone-500">
            {isValid
              ? 'Listo para enviar. (Persistencia Supabase pendiente)'
              : tipo
                ? 'Faltan campos obligatorios. Se guardará como borrador.'
                : 'Elige tipo de servicio para empezar.'}
          </p>
        </div>
      </div>
    </div>
  );
};

export default ServiceFormModal;
