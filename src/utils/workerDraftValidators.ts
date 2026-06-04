import type { FeedbackTipo } from '../components/sugerencias/SugerenciaFormModal';

export interface ServiceDraftState {
  tipo: 'reserva' | 'manitas' | null;
  form: object;
}

export interface EntregaLlavesDraftState {
  apartamento: string;
  nombreCliente: string;
  fechaEntradaReserva: string;
  fechaSalidaReserva: string;
  sabanasEntregadas: string;
  sabanasPersonas: string;
  fianzaMonto: string;
  bizumMonto: string;
  cantidadPagadaMonto: string;
  fianzaGarantia: string;
  bizumGarantia: string;
  cantidadPagadaGarantia: string;
  km: string;
  observaciones: string;
  firmaTrabajador: string;
  firmaHuesped: string;
}

export interface IncidenciaDraftState {
  apartamento: string;
  duracion: string;
  detalles: string;
}

export interface SugerenciaDraftState {
  tipo: FeedbackTipo;
  descripcion: string;
  telefono: string;
}

export function isServiceDraftEmpty(d: ServiceDraftState): boolean {
  if (d.tipo) return false;
  const f = d.form as Record<string, unknown>;
  const textFields = [
    'apartamento', 'horaEntrada', 'horaSalida', 'km', 'observaciones', 'descripcion',
    'horaSalidaReserva', 'horasExtra', 'justificacionExtra', 'el_nombreCliente',
    'el_fechaEntradaReserva', 'el_fechaSalidaReserva', 'el_sabanasPersonas',
    'el_bizumMonto', 'el_cantidadPagadaMonto', 'el_bizumGarantia', 'el_cantidadPagadaGarantia',
    'el_firmaTrabajador', 'el_firmaHuesped', 'inc_duracion', 'inc_detalles',
  ];
  if (textFields.some((k) => String(f[k] ?? '').trim().length > 0)) return false;
  if (f.recogeLlaves === 'Si' || f.sigueHuesped === 'Si') return false;
  if (f.el_sabanasEntregadas === 'Si') return false;
  if (f.incluyeEntregaLlaves || f.incluyeIncidencia) return false;
  return true;
}

export function isEntregaLlavesDraftEmpty(f: EntregaLlavesDraftState): boolean {
  return !(
    f.apartamento.trim() ||
    f.nombreCliente.trim() ||
    f.fechaEntradaReserva ||
    f.fechaSalidaReserva ||
    f.sabanasEntregadas === 'Si' ||
    f.sabanasPersonas ||
    f.cantidadPagadaMonto ||
    f.cantidadPagadaGarantia ||
    f.bizumMonto ||
    f.bizumGarantia ||
    f.km ||
    f.observaciones ||
    f.firmaTrabajador ||
    f.firmaHuesped
  );
}

export function isIncidenciaDraftEmpty(f: IncidenciaDraftState): boolean {
  return !(f.apartamento.trim() || f.duracion || f.detalles.trim());
}

export function isSugerenciaDraftEmpty(f: SugerenciaDraftState, defaultTelefono = ''): boolean {
  return !(
    f.descripcion.trim() ||
    (f.telefono.trim() && f.telefono.trim() !== defaultTelefono.trim()) ||
    f.tipo !== 'sugerencia'
  );
}

export const workerDraftEmptyChecks = {
  servicio: (d: unknown) => isServiceDraftEmpty(d as ServiceDraftState),
  'entrega-llaves': (d: unknown) => isEntregaLlavesDraftEmpty(d as EntregaLlavesDraftState),
  incidencia: (d: unknown) => isIncidenciaDraftEmpty(d as IncidenciaDraftState),
  sugerencia: (d: unknown) => isSugerenciaDraftEmpty(d as SugerenciaDraftState),
};
