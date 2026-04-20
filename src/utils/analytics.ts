import { Worker, NormalCleanRecord, InitialCleanRecord, HandymanRecord } from '../services/mockData';
import { Period } from '../components/dashboard/DashboardFilterModal';

export interface ChartPoint {
  label: string;
  dinero: number;
  limpiezas: number;
  km: number;
}

export const aggregateDailyData = (
  workers: Worker[],
  normalCleans: NormalCleanRecord[],
  initialCleans: InitialCleanRecord[],
  handymanRecords: HandymanRecord[],
  period: Period,
  customDesde?: string,
  customHasta?: string,
  selectedWorkerId?: string | null
): ChartPoint[] => {
  const result: Record<string, ChartPoint> = {};
  
  // 1. Definir rango de fechas
  const today = new Date('2026-03-31'); // Fecha base del sistema para mocks/docs
  let iterations = 30;
  let step = 1;

  if (period === 'semanal') { iterations = 7; step = 1; }
  else if (period === 'mensual') { iterations = 30; step = 1; }
  else if (period === 'trimestral') { iterations = 12; step = 7; }
  else if (period === 'personalizado' && customDesde && customHasta) {
    const start = new Date(customDesde);
    const end = new Date(customHasta);
    iterations = Math.min(Math.round((end.getTime() - start.getTime()) / 86400000) + 1, 90);
  }

  // Inicializar mapa de resultados con labels vacíos
  for (let i = iterations - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i * step);
    const iso = d.toISOString().split('T')[0];
    const label = d.toLocaleString('es-ES', { day: 'numeric', month: 'short' });
    result[iso] = { label, dinero: 0, limpiezas: 0, km: 0 };
  }

  const selectedWorker = selectedWorkerId ? workers.find(w => w.id === selectedWorkerId) : null;

  // 2. Procesar registros
  const processRecord = (fecha: string, nombre: string, apellidos: string, km: number, isClean: boolean) => {
    const datePart = fecha.split(' ')[0]; // YYYY-MM-DD
    if (!result[datePart]) return;

    // Verificar si el registro pertenece al trabajador seleccionado (si hay uno)
    if (selectedWorker) {
      const match = `${nombre} ${apellidos}`.toLowerCase().trim() === selectedWorker.fullName.toLowerCase().trim();
      if (!match) return;
    }

    // Encontrar al trabajador para aplicar sus tarifas (o el del registro)
    const worker = workers.find(w => `${nombre} ${apellidos}`.toLowerCase().trim() === w.fullName.toLowerCase().trim());
    
    const pricePerReserva = worker?.pagoPorReserva ?? 20; // Default sensible
    const pricePerKm = worker?.precioPorKm ?? 0.19; // Default sensible

    result[datePart].dinero += (isClean ? pricePerReserva : 0) + (km * pricePerKm);
    result[datePart].km += km;
    if (isClean) result[datePart].limpiezas += 1;
  };

  normalCleans.forEach(r => processRecord(r.checkinFecha, r.nombre, r.apellidos, r.km, true));
  initialCleans.forEach(r => processRecord(r.checkinFecha, r.nombre, r.apellidos, r.km, true));
  handymanRecords.forEach(r => processRecord(r.fechaLlegada, r.nombre, r.apellidos, r.cantidadMinutos, false));

  return Object.values(result);
};
