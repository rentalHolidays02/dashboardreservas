import React, { useEffect, useState } from 'react';
import SignaturePad from '../ui/SignaturePad';
import {
  ApartamentoAutocomplete,
  PagoSelector,
  SiNoToggle,
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
import WorkerFormSheet from './WorkerFormSheet';

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

const ast = <span className="text-stone-400 dark:text-stone-500">*</span>;

const EntregaLlavesFormModal: React.FC<EntregaLlavesFormModalProps> = ({
  isOpen,
  onClose,
  draftId,
  draftPayload,
}) => {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [dirty, setDirty] = useState(false);
  const accommodations = useAccommodations(isOpen);

  useEffect(() => {
    if (!isOpen) {
      setForm(emptyForm);
      setDirty(false);
    } else if (draftPayload) {
      setForm({ ...emptyForm, ...draftPayload });
    } else {
      const local = localDrafts.load<Partial<FormState>>('key_delivery');
      if (local) setForm({ ...emptyForm, ...local });
    }
  }, [isOpen, draftPayload]);

  const setF = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setDirty(true);
    setForm((prev) => ({ ...prev, [key]: value }));
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

  const handleSubmit = async () => {
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
  };

  const handleSaveDraft = async () => {
    // No metemos las firmas en el borrador para evitar payloads enormes.
    const { firmaTrabajador: _ft, firmaHuesped: _fh, ...rest } = form;
    await saveDraft('key_delivery', rest, draftId ?? undefined);
    localDrafts.clear('key_delivery');
  };

  const handleDiscard = async () => {
    if (draftId) {
      const { deleteDraft } = await import('../../services/reportsApi');
      await deleteDraft(draftId).catch(() => {});
    }
    localDrafts.clear('key_delivery');
    setForm(emptyForm);
    setDirty(false);
  };

  return (
    <WorkerFormSheet
      isOpen={isOpen}
      onClose={onClose}
      title="Entrega de llaves"
      subtitle="Datos del check-in del huésped."
      hasChanges={dirty}
      isValid={isValid}
      onSubmit={handleSubmit}
      onSaveDraft={handleSaveDraft}
      onDiscard={handleDiscard}
      successMessage="Entrega de llaves enviada correctamente."
    >
      <div>
        <label className={labelCls}>Apartamento {ast}</label>
        <ApartamentoAutocomplete
          value={form.apartamento}
          onChange={(v) => setF('apartamento', v)}
          options={accommodations}
        />
      </div>

      <div>
        <label className={labelCls}>Nombre y apellidos del cliente {ast}</label>
        <input
          type="text"
          value={form.nombreCliente}
          onChange={(e) => setF('nombreCliente', e.target.value)}
          className={inputCls}
          placeholder="Ej: Juan Pérez García"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="min-w-0">
          <label className={labelCls}>Entrada reserva {ast}</label>
          <input
            type="datetime-local"
            value={form.fechaEntradaReserva}
            onChange={(e) => setF('fechaEntradaReserva', e.target.value)}
            min="1900-01-01T00:00"
            max="9999-12-31T23:59"
            className={inputCls}
          />
        </div>
        <div className="min-w-0">
          <label className={labelCls}>Salida reserva {ast}</label>
          <input
            type="datetime-local"
            value={form.fechaSalidaReserva}
            onChange={(e) => setF('fechaSalidaReserva', e.target.value)}
            min="1900-01-01T00:00"
            max="9999-12-31T23:59"
            className={inputCls}
          />
        </div>
      </div>

      <div>
        <label className={labelCls}>¿Has entregado sábanas y toallas?</label>
        <SiNoToggle value={form.sabanasEntregadas} onChange={(v) => setF('sabanasEntregadas', v)} />
      </div>

      {form.sabanasEntregadas === 'Si' && (
        <div>
          <label className={labelCls}>Cantidad de personas (sábanas) {ast}</label>
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
        <label className={labelCls}>Fianza (Monto) {ast}</label>
        <PagoSelector value={form.fianzaMonto} onChange={(v) => setF('fianzaMonto', v)} />
      </div>

      {form.fianzaMonto === 'Bizum' && (
        <div>
          <label className={labelCls}>Número Bizum (Monto) {ast}</label>
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
        <label className={labelCls}>Cantidad pagada (Monto) {ast}</label>
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
        <label className={labelCls}>Fianza (Garantía) {ast}</label>
        <PagoSelector value={form.fianzaGarantia} onChange={(v) => setF('fianzaGarantia', v)} />
      </div>

      {form.fianzaGarantia === 'Bizum' && (
        <div>
          <label className={labelCls}>Número Bizum (Garantía) {ast}</label>
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
        <label className={labelCls}>Cantidad pagada (Garantía) {ast}</label>
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
    </WorkerFormSheet>
  );
};

export default EntregaLlavesFormModal;
