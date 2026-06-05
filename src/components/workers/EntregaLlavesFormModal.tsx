import React, { useEffect, useState } from 'react';
import { X, Key } from 'lucide-react';
import SignaturePad from '../ui/SignaturePad';
import {
  ApartamentoAutocomplete,
  PagoSelector,
  SiNoToggle,
  SubmitFooter,
  formatBizumNumber,
  inputCls,
  labelCls,
  resolveAccommodationId,
  useAccommodations,
  type MetodoPago,
  type SiNo,
} from './serviceFormHelpers';
import { saveDraft, submitKeyDelivery } from '../../services/reportsApi';
import { localDrafts } from '../../utils/localDrafts';

interface EntregaLlavesFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  draftId?: string | null;
  draftPayload?: Partial<FormState> | null;
}

interface FormState {
  apartamento: string;
  nombreCliente: string;
  fechaEntradaReserva: string;
  fechaSalidaReserva: string;
  sabanasEntregadas: SiNo;
  sabanasPersonas: string;
  fianzaMonto: MetodoPago | '';
  bizumMonto: string;
  cantidadPagadaMonto: string;
  fianzaGarantia: MetodoPago | '';
  bizumGarantia: string;
  cantidadPagadaGarantia: string;
  km: string;
  observaciones: string;
  firmaTrabajador: string;
  firmaHuesped: string;
}

const emptyForm: FormState = {
  apartamento: '',
  nombreCliente: '',
  fechaEntradaReserva: '',
  fechaSalidaReserva: '',
  sabanasEntregadas: 'No',
  sabanasPersonas: '',
  fianzaMonto: 'Efectivo',
  bizumMonto: '',
  cantidadPagadaMonto: '',
  fianzaGarantia: 'Efectivo',
  bizumGarantia: '',
  cantidadPagadaGarantia: '',
  km: '',
  observaciones: '',
  firmaTrabajador: '',
  firmaHuesped: '',
};

const EntregaLlavesFormModal: React.FC<EntregaLlavesFormModalProps> = ({
  isOpen,
  onClose,
  draftId,
  draftPayload,
}) => {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ type: 'ok' | 'error'; message: string } | null>(null);
  const accommodations = useAccommodations(isOpen);

  useEffect(() => {
    if (!isOpen) {
      setForm(emptyForm);
      setStatus(null);
    } else if (draftPayload) {
      setForm({ ...emptyForm, ...draftPayload });
    } else {
      const local = localDrafts.load<Partial<FormState>>('key_delivery');
      if (local) setForm({ ...emptyForm, ...local });
    }
  }, [isOpen, draftPayload]);

  const setF = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async () => {
    if (!form.fianzaMonto || !form.fianzaGarantia) return;
    setBusy(true);
    setStatus(null);
    try {
      await submitKeyDelivery({
        accommodationId: resolveAccommodationId(form.apartamento, accommodations),
        accommodationName: form.apartamento,
        nombreCliente: form.nombreCliente,
        fechaEntradaReserva: form.fechaEntradaReserva,
        fechaSalidaReserva: form.fechaSalidaReserva,
        sabanasEntregadas: form.sabanasEntregadas === 'Si',
        sabanasPersonas: form.sabanasPersonas ? Number(form.sabanasPersonas) : null,
        fianzaMontoMetodo: form.fianzaMonto as MetodoPago,
        bizumMonto: form.bizumMonto,
        cantidadPagadaMonto: form.cantidadPagadaMonto ? Number(form.cantidadPagadaMonto) : 0,
        fianzaGarantiaMetodo: form.fianzaGarantia as MetodoPago,
        bizumGarantia: form.bizumGarantia,
        cantidadPagadaGarantia: form.cantidadPagadaGarantia ? Number(form.cantidadPagadaGarantia) : 0,
        km: form.km ? Number(form.km) : 0,
        observaciones: form.observaciones,
        firmaTrabajadorBase64: form.firmaTrabajador,
        firmaHuespedBase64: form.firmaHuesped,
      });
      if (draftId) {
        const { deleteDraft } = await import('../../services/reportsApi');
        await deleteDraft(draftId).catch(() => {});
      }
      localDrafts.clear('key_delivery');
      setStatus({ type: 'ok', message: 'Entrega de llaves enviada correctamente.' });
      setTimeout(onClose, 900);
    } catch (e: any) {
      setStatus({ type: 'error', message: e?.message || 'Error al enviar la entrega.' });
    } finally {
      setBusy(false);
    }
  };

  const handleSaveDraft = async () => {
    setBusy(true);
    setStatus(null);
    try {
      // No metemos las firmas en el borrador para evitar payloads enormes.
      const { firmaTrabajador: _ft, firmaHuesped: _fh, ...rest } = form;
      await saveDraft('key_delivery', rest, draftId ?? undefined);
      localDrafts.clear('key_delivery');
      setStatus({ type: 'ok', message: 'Borrador guardado.' });
      setTimeout(onClose, 900);
    } catch (e: any) {
      setStatus({ type: 'error', message: e?.message || 'Error al guardar.' });
    } finally {
      setBusy(false);
    }
  };

  // Al salir sin pulsar "Guardar en borrador": persistimos sólo en localStorage.
  const handleCancelOrClose = () => {
    if (!draftId && hasData && status?.type !== 'ok') {
      // Las firmas son base64 pesado: las omitimos del local también.
      const { firmaTrabajador: _ft, firmaHuesped: _fh, ...rest } = form;
      localDrafts.save('key_delivery', rest);
    }
    onClose();
  };

  const handleDiscardDraft = async () => {
    setBusy(true);
    setStatus(null);
    try {
      if (draftId) {
        const { deleteDraft } = await import('../../services/reportsApi');
        await deleteDraft(draftId);
      }
      localDrafts.clear('key_delivery');
      setForm(emptyForm);
      setStatus({ type: 'ok', message: 'Datos descartados.' });
      setTimeout(onClose, 900);
    } catch (e: any) {
      setStatus({ type: 'error', message: e?.message || 'Error al descartar datos.' });
    } finally {
      setBusy(false);
    }
  };

  const isValid =
    !!form.apartamento.trim() &&
    !!form.nombreCliente.trim() &&
    !!form.fechaEntradaReserva &&
    !!form.fechaSalidaReserva &&
    (form.sabanasEntregadas === 'No' || !!form.sabanasPersonas) &&
    !!form.fianzaMonto &&
    (form.fianzaMonto !== 'Bizum' || !!form.bizumMonto.trim()) &&
    !!form.cantidadPagadaMonto &&
    !!form.fianzaGarantia &&
    (form.fianzaGarantia !== 'Bizum' || !!form.bizumGarantia.trim()) &&
    !!form.cantidadPagadaGarantia &&
    !!form.firmaTrabajador &&
    !!form.firmaHuesped;

  const hasData =
    form.apartamento.trim().length > 0 ||
    form.nombreCliente.trim().length > 0 ||
    form.fechaEntradaReserva.length > 0 ||
    form.fechaSalidaReserva.length > 0 ||
    form.sabanasEntregadas === 'Si' ||
    form.sabanasPersonas.length > 0 ||
    form.cantidadPagadaMonto.length > 0 ||
    form.cantidadPagadaGarantia.length > 0 ||
    form.bizumMonto.length > 0 ||
    form.bizumGarantia.length > 0 ||
    form.km.length > 0 ||
    form.observaciones.length > 0 ||
    !!form.firmaTrabajador ||
    !!form.firmaHuesped;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={handleCancelOrClose} />
      <div className="relative w-full sm:max-w-lg max-h-[95vh] sm:max-h-[90vh] flex flex-col bg-white dark:bg-stone-900 sm:rounded-3xl rounded-t-3xl shadow-2xl border border-white/60 dark:border-stone-800/50 animate-in zoom-in-95 slide-in-from-bottom-4 duration-300">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-stone-800/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-100 dark:bg-blue-400/10 text-blue-600 dark:text-blue-400">
              <Key size={18} />
            </div>
            <div>
              <h2 className="text-base font-medium text-slate-800 dark:text-stone-100 font-display">
                Entrega de llaves
              </h2>
              <p className="text-xs text-slate-400 dark:text-stone-500 font-light">
                Check-in del huésped
              </p>
            </div>
          </div>
          <button
            onClick={handleCancelOrClose}
            className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-stone-800/60 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
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

          <div>
            <label className={labelCls}>
              Nombre y apellidos del cliente <span className="text-orange-500">*</span>
            </label>
            <input
              type="text"
              value={form.nombreCliente}
              onChange={(e) => setF('nombreCliente', e.target.value)}
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
                value={form.fechaEntradaReserva}
                onChange={(e) => setF('fechaEntradaReserva', e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>
                Salida reserva <span className="text-orange-500">*</span>
              </label>
              <input
                type="datetime-local"
                value={form.fechaSalidaReserva}
                onChange={(e) => setF('fechaSalidaReserva', e.target.value)}
                className={inputCls}
              />
            </div>
          </div>

          <div>
            <label className={labelCls}>¿Has entregado sábanas y toallas?</label>
            <SiNoToggle
              value={form.sabanasEntregadas}
              onChange={(v) => setF('sabanasEntregadas', v)}
            />
          </div>

          {form.sabanasEntregadas === 'Si' && (
            <div>
              <label className={labelCls}>
                Cantidad de personas (sábanas) <span className="text-orange-500">*</span>
              </label>
              <input
                type="number"
                min={1}
                step={1}
                value={form.sabanasPersonas}
                onChange={(e) => setF('sabanasPersonas', e.target.value)}
                className={inputCls}
                placeholder="Ej: 2"
              />
            </div>
          )}

          <div>
            <label className={labelCls}>
              Fianza (Monto) <span className="text-orange-500">*</span>
            </label>
            <PagoSelector value={form.fianzaMonto} onChange={(v) => setF('fianzaMonto', v)} />
          </div>

          {form.fianzaMonto === 'Bizum' && (
            <div>
              <label className={labelCls}>
                Número Bizum (Monto) <span className="text-orange-500">*</span>
              </label>
              <input
                type="tel"
                inputMode="numeric"
                value={form.bizumMonto}
                onChange={(e) => setF('bizumMonto', formatBizumNumber(e.target.value))}
                className={inputCls}
                placeholder="612 34 56 78"
                maxLength={12}
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
              value={form.cantidadPagadaMonto}
              onChange={(e) => setF('cantidadPagadaMonto', e.target.value)}
              className={inputCls}
              placeholder="Ej: 40.00"
            />
          </div>

          <div>
            <label className={labelCls}>
              Fianza (Garantía) <span className="text-orange-500">*</span>
            </label>
            <PagoSelector
              value={form.fianzaGarantia}
              onChange={(v) => setF('fianzaGarantia', v)}
            />
          </div>

          {form.fianzaGarantia === 'Bizum' && (
            <div>
              <label className={labelCls}>
                Número Bizum (Garantía) <span className="text-orange-500">*</span>
              </label>
              <input
                type="tel"
                inputMode="numeric"
                value={form.bizumGarantia}
                onChange={(e) => setF('bizumGarantia', formatBizumNumber(e.target.value))}
                className={inputCls}
                placeholder="612 34 56 78"
                maxLength={12}
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
              value={form.cantidadPagadaGarantia}
              onChange={(e) => setF('cantidadPagadaGarantia', e.target.value)}
              className={inputCls}
              placeholder="Ej: 10.00"
            />
          </div>

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
              Sólo si has usado coche.
            </p>
          </div>

          <div>
            <label className={labelCls}>Observaciones</label>
            <textarea
              rows={3}
              value={form.observaciones}
              onChange={(e) => setF('observaciones', e.target.value)}
              className={inputCls}
              placeholder="¿Algo especial que comentar?"
            />
          </div>

          <SignaturePad
            label="Firma del trabajador *"
            value={form.firmaTrabajador}
            onChange={(b64) => setF('firmaTrabajador', b64)}
          />
          <SignaturePad
            label="Firma del huésped *"
            value={form.firmaHuesped}
            onChange={(b64) => setF('firmaHuesped', b64)}
          />
        </div>

        <SubmitFooter
          isValid={isValid}
          hasData={hasData}
          busy={busy}
          status={status}
          onCancel={handleDiscardDraft}
          onSubmit={handleSubmit}
          onSaveDraft={handleSaveDraft}
        />
      </div>
    </div>
  );
};

export default EntregaLlavesFormModal;
