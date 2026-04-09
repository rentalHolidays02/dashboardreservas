import React, { useState, useMemo } from 'react';
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  X,
  Check,
  Key,
  KeyRound,
  BedDouble,
  ChevronDown,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface EntregaLlaves {
  id: string;
  // Contacto
  telefono: string;
  nombre: string;
  apellidos: string;
  // Reserva
  apartamento: string;
  nombreCliente: string;
  fechaEntradaReserva: string;
  fechaSalidaReserva: string;
  // Entrega
  fechaEntregaLlaves: string;
  ubicacionLlaves: string;
  entregaLlaves: boolean;
  sabanasToallas: boolean;
  km: string;
  observaciones: string;
  // Fianza monto
  fianzaMonto: string;
  bizumMonto: string;
  cantidadPagadaMonto: string;
  // Fianza garantía
  fianzaGarantia: string;
  bizumGarantia: string;
  cantidadPagadaGarantia: string;
  // Estado
  checked: boolean;
}

// ─── Mock data ────────────────────────────────────────────────────────────────

const MOCK_ENTREGAS: EntregaLlaves[] = [
  {
    id: '1',
    telefono: '612 345 678',
    nombre: 'Carlos',
    apellidos: 'Martínez López',
    apartamento: 'Apt. Retiro 4B',
    nombreCliente: 'Carlos Martínez',
    fechaEntradaReserva: '2026-04-10',
    fechaSalidaReserva: '2026-04-15',
    fechaEntregaLlaves: '2026-04-10',
    ubicacionLlaves: 'Conserjería Edificio',
    entregaLlaves: true,
    sabanasToallas: true,
    km: '12',
    observaciones: 'Llegar antes de las 15:00',
    fianzaMonto: '200',
    bizumMonto: '654321987',
    cantidadPagadaMonto: '200',
    fianzaGarantia: '300',
    bizumGarantia: '654321987',
    cantidadPagadaGarantia: '300',
    checked: true,
  },
  {
    id: '2',
    telefono: '698 765 432',
    nombre: 'Laura',
    apellidos: 'Sánchez Ruiz',
    apartamento: 'Apt. Sol 2A',
    nombreCliente: 'Laura Sánchez',
    fechaEntradaReserva: '2026-04-12',
    fechaSalidaReserva: '2026-04-18',
    fechaEntregaLlaves: '2026-04-12',
    ubicacionLlaves: 'Propietario en persona',
    entregaLlaves: false,
    sabanasToallas: false,
    km: '5',
    observaciones: '',
    fianzaMonto: '150',
    bizumMonto: '612987654',
    cantidadPagadaMonto: '0',
    fianzaGarantia: '250',
    bizumGarantia: '612987654',
    cantidadPagadaGarantia: '0',
    checked: false,
  },
  {
    id: '3',
    telefono: '677 111 222',
    nombre: 'Pedro',
    apellidos: 'Gómez Vidal',
    apartamento: 'Apt. Malasaña 1C',
    nombreCliente: 'Pedro Gómez',
    fechaEntradaReserva: '2026-04-20',
    fechaSalidaReserva: '2026-04-25',
    fechaEntregaLlaves: '2026-04-20',
    ubicacionLlaves: 'Caja fuerte portal',
    entregaLlaves: false,
    sabanasToallas: true,
    km: '8',
    observaciones: 'Código caja: 1234',
    fianzaMonto: '180',
    bizumMonto: '677111222',
    cantidadPagadaMonto: '180',
    fianzaGarantia: '200',
    bizumGarantia: '677111222',
    cantidadPagadaGarantia: '0',
    checked: false,
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtDate = (s: string) => {
  if (!s) return '—';
  const [y, m, d] = s.split('-');
  return `${d}/${m}/${y}`;
};

const emptyEntrega = (): Omit<EntregaLlaves, 'id'> => ({
  telefono: '',
  nombre: '',
  apellidos: '',
  apartamento: '',
  nombreCliente: '',
  fechaEntradaReserva: '',
  fechaSalidaReserva: '',
  fechaEntregaLlaves: '',
  ubicacionLlaves: '',
  entregaLlaves: false,
  sabanasToallas: false,
  km: '',
  observaciones: '',
  fianzaMonto: '',
  bizumMonto: '',
  cantidadPagadaMonto: '',
  fianzaGarantia: '',
  bizumGarantia: '',
  cantidadPagadaGarantia: '',
  checked: false,
});

// ─── BoolBadge ────────────────────────────────────────────────────────────────

const BoolBadge: React.FC<{ value: boolean }> = ({ value }) =>
  value ? (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400">
      <Check size={10} strokeWidth={2.5} /> Sí
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 dark:bg-stone-700/60 text-slate-400 dark:text-stone-500">
      <X size={10} strokeWidth={2.5} /> No
    </span>
  );

// ─── Modal ────────────────────────────────────────────────────────────────────

interface ModalProps {
  initial: Partial<EntregaLlaves> | null;
  onSave: (data: Omit<EntregaLlaves, 'id'>) => void;
  onClose: () => void;
  onDelete?: () => void;
}

const EntregaModal: React.FC<ModalProps> = ({ initial, onSave, onClose, onDelete }) => {
  const isEdit = !!initial?.id;
  const [form, setForm] = useState<Omit<EntregaLlaves, 'id'>>({ ...emptyEntrega(), ...initial });
  const [confirmDelete, setConfirmDelete] = useState(false);

  const set = (field: keyof Omit<EntregaLlaves, 'id'>, value: string | boolean) =>
    setForm(f => ({ ...f, [field]: value }));

  const inputCls = 'w-full rounded-lg border border-white/60 dark:border-stone-700/50 bg-white/80 dark:bg-stone-900 text-slate-700 dark:text-stone-300 px-3 py-1.5 text-xs focus:outline-none focus:border-stone-300 dark:focus:border-stone-600 placeholder:text-slate-300 dark:placeholder:text-stone-600 transition-all';
  const labelCls = 'block text-[11px] text-slate-400 dark:text-stone-500 mb-1';
  const sectionTitleCls = 'text-[10px] font-semibold text-slate-400 dark:text-stone-500 uppercase tracking-widest mb-2.5';

  const BoolToggle = ({ label, field }: { label: string; field: keyof Omit<EntregaLlaves, 'id'> }) => (
    <div>
      <label className={labelCls}>{label}</label>
      <button
        type="button"
        onClick={() => set(field, !(form[field] as boolean))}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs transition-all w-full
          ${form[field]
            ? 'border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
            : 'border-white/60 dark:border-stone-700/50 bg-white/80 dark:bg-stone-900 text-slate-400 dark:text-stone-500'
          }`}
      >
        <span className={`w-3.5 h-3.5 rounded border-2 flex items-center justify-center shrink-0 transition-all
          ${form[field] ? 'bg-green-500 border-green-500' : 'border-slate-300 dark:border-stone-500'}`}>
          {form[field] && <Check size={9} className="text-white" strokeWidth={3} />}
        </span>
        {form[field] ? 'Sí' : 'No'}
      </button>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
      <div className="bg-white/90 dark:bg-stone-900 backdrop-blur-md border border-white/60 dark:border-stone-700/50 rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100 dark:border-stone-800 sticky top-0 bg-white/90 dark:bg-stone-900 backdrop-blur-md z-10 rounded-t-2xl">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
              <Key size={14} className="text-orange-600 dark:text-orange-400" />
            </div>
            <h2 className="text-sm font-normal text-slate-800 dark:text-stone-200">
              {isEdit ? 'Editar entrega' : 'Nueva entrega de llaves'}
            </h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-stone-200 transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={e => { e.preventDefault(); onSave(form); }} className="px-6 py-5 space-y-5">

          {/* Contacto */}
          <div>
            <p className={sectionTitleCls}>Contacto</p>
            <div className="grid grid-cols-3 gap-2.5">
              <div>
                <label className={labelCls}>Teléfono</label>
                <input type="text" value={form.telefono} onChange={e => set('telefono', e.target.value)} placeholder="6XX XXX XXX" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Nombre</label>
                <input type="text" value={form.nombre} onChange={e => set('nombre', e.target.value)} placeholder="Nombre" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Apellidos</label>
                <input type="text" value={form.apellidos} onChange={e => set('apellidos', e.target.value)} placeholder="Apellidos" className={inputCls} />
              </div>
            </div>
          </div>

          {/* Reserva */}
          <div>
            <p className={sectionTitleCls}>Reserva</p>
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className={labelCls}>Apartamento</label>
                <input type="text" value={form.apartamento} onChange={e => set('apartamento', e.target.value)} placeholder="Nombre del apartamento" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Nombre cliente</label>
                <input type="text" value={form.nombreCliente} onChange={e => set('nombreCliente', e.target.value)} placeholder="Nombre en la reserva" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Fecha entrada reserva</label>
                <input type="date" value={form.fechaEntradaReserva} onChange={e => set('fechaEntradaReserva', e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Fecha salida reserva</label>
                <input type="date" value={form.fechaSalidaReserva} onChange={e => set('fechaSalidaReserva', e.target.value)} className={inputCls} />
              </div>
            </div>
          </div>

          {/* Entrega */}
          <div>
            <p className={sectionTitleCls}>Entrega de llaves</p>
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className={labelCls}>Fecha y ubicación</label>
                <input type="date" value={form.fechaEntregaLlaves} onChange={e => set('fechaEntregaLlaves', e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Ubicación llaves</label>
                <input type="text" value={form.ubicacionLlaves} onChange={e => set('ubicacionLlaves', e.target.value)} placeholder="Conserjería, Caja fuerte..." className={inputCls} />
              </div>
              <BoolToggle label="Llaves entregadas" field="entregaLlaves" />
              <BoolToggle label="Sábanas y Toallas" field="sabanasToallas" />
              <div>
                <label className={labelCls}>Km</label>
                <input type="number" min="0" value={form.km} onChange={e => set('km', e.target.value)} placeholder="0" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Observaciones</label>
                <input type="text" value={form.observaciones} onChange={e => set('observaciones', e.target.value)} placeholder="Notas adicionales..." className={inputCls} />
              </div>
            </div>
          </div>

          {/* Fianzas */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className={sectionTitleCls}>Fianza — Monto</p>
              <div className="space-y-2">
                <div>
                  <label className={labelCls}>Fianza (€)</label>
                  <input type="number" min="0" value={form.fianzaMonto} onChange={e => set('fianzaMonto', e.target.value)} placeholder="0.00" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Número Bizum</label>
                  <input type="text" value={form.bizumMonto} onChange={e => set('bizumMonto', e.target.value)} placeholder="6XX XXX XXX" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Cantidad pagada (€)</label>
                  <input type="number" min="0" value={form.cantidadPagadaMonto} onChange={e => set('cantidadPagadaMonto', e.target.value)} placeholder="0.00" className={inputCls} />
                </div>
              </div>
            </div>
            <div>
              <p className={sectionTitleCls}>Fianza — Garantía</p>
              <div className="space-y-2">
                <div>
                  <label className={labelCls}>Fianza (€)</label>
                  <input type="number" min="0" value={form.fianzaGarantia} onChange={e => set('fianzaGarantia', e.target.value)} placeholder="0.00" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Número Bizum</label>
                  <input type="text" value={form.bizumGarantia} onChange={e => set('bizumGarantia', e.target.value)} placeholder="6XX XXX XXX" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Cantidad pagada (€)</label>
                  <input type="number" min="0" value={form.cantidadPagadaGarantia} onChange={e => set('cantidadPagadaGarantia', e.target.value)} placeholder="0.00" className={inputCls} />
                </div>
              </div>
            </div>
          </div>

          {/* Checked */}
          <div className="grid grid-cols-2">
            <BoolToggle label="Verificado (Checked)" field="checked" />
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between pt-3 border-t border-stone-100 dark:border-stone-800">
            {isEdit && onDelete ? (
              confirmDelete ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-red-500">¿Eliminar?</span>
                  <button type="button" onClick={onDelete}
                    className="px-3 py-1.5 text-xs rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors">
                    Confirmar
                  </button>
                  <button type="button" onClick={() => setConfirmDelete(false)}
                    className="px-3 py-1.5 text-xs rounded-lg bg-slate-100 dark:bg-stone-700 text-slate-600 dark:text-stone-300 hover:bg-slate-200 dark:hover:bg-stone-600 transition-colors">
                    Cancelar
                  </button>
                </div>
              ) : (
                <button type="button" onClick={() => setConfirmDelete(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                  <Trash2 size={12} /> Eliminar
                </button>
              )
            ) : <div />}

            <div className="flex items-center gap-2">
              <button type="button" onClick={onClose}
                className="px-4 py-1.5 text-xs rounded-xl bg-slate-100 dark:bg-stone-700 text-slate-600 dark:text-stone-300 hover:bg-slate-200 dark:hover:bg-stone-600 transition-colors">
                Cancelar
              </button>
              <button type="submit"
                className="px-4 py-1.5 text-xs rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-medium transition-colors">
                {isEdit ? 'Guardar cambios' : 'Crear entrega'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

// ─── Expanded detail panel ────────────────────────────────────────────────────

const DetailPanel: React.FC<{ entrega: EntregaLlaves }> = ({ entrega: e }) => {
  const sectionLabel = 'text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-stone-500 mb-2.5';
  const fieldLabel = 'text-[11px] text-slate-400 dark:text-stone-500';
  const fieldValue = 'text-xs text-slate-700 dark:text-stone-300 mt-0.5';

  return (
    <div className="px-8 py-5 bg-stone-50/80 dark:bg-stone-800/40 border-t border-stone-100 dark:border-stone-800">
      <div className="grid grid-cols-3 gap-x-8 gap-y-5">

        {/* Col 1: Entrega */}
        <div className="space-y-3">
          <p className={sectionLabel}>Entrega</p>
          <div>
            <p className={fieldLabel}>Fecha entrega llaves</p>
            <p className={fieldValue}>{fmtDate(e.fechaEntregaLlaves)}</p>
          </div>
          <div>
            <p className={fieldLabel}>Ubicación llaves</p>
            <p className={fieldValue}>{e.ubicacionLlaves || '—'}</p>
          </div>
          <div>
            <p className={fieldLabel}>Km recorridos</p>
            <p className={fieldValue}>{e.km ? `${e.km} km` : '—'}</p>
          </div>
          <div className="flex items-center gap-4">
            <div>
              <p className={fieldLabel}>Llaves</p>
              <div className="mt-0.5"><BoolBadge value={e.entregaLlaves} /></div>
            </div>
            <div>
              <p className={fieldLabel}>Sábanas y Toallas</p>
              <div className="mt-0.5"><BoolBadge value={e.sabanasToallas} /></div>
            </div>
          </div>
          {e.observaciones && (
            <div>
              <p className={fieldLabel}>Observaciones</p>
              <p className={`${fieldValue} italic`}>{e.observaciones}</p>
            </div>
          )}
        </div>

        {/* Col 2: Fianza Monto */}
        <div className="space-y-3">
          <p className={sectionLabel}>Fianza — Monto</p>
          <div>
            <p className={fieldLabel}>Importe fianza</p>
            <p className={fieldValue}>{e.fianzaMonto ? `${e.fianzaMonto} €` : '—'}</p>
          </div>
          <div>
            <p className={fieldLabel}>Número Bizum</p>
            <p className={fieldValue}>{e.bizumMonto || '—'}</p>
          </div>
          <div>
            <p className={fieldLabel}>Cantidad pagada</p>
            <p className={`${fieldValue} font-medium ${e.cantidadPagadaMonto && e.fianzaMonto && e.cantidadPagadaMonto === e.fianzaMonto ? 'text-green-600 dark:text-green-400' : ''}`}>
              {e.cantidadPagadaMonto ? `${e.cantidadPagadaMonto} €` : '—'}
            </p>
          </div>
        </div>

        {/* Col 3: Fianza Garantía */}
        <div className="space-y-3">
          <p className={sectionLabel}>Fianza — Garantía</p>
          <div>
            <p className={fieldLabel}>Importe fianza</p>
            <p className={fieldValue}>{e.fianzaGarantia ? `${e.fianzaGarantia} €` : '—'}</p>
          </div>
          <div>
            <p className={fieldLabel}>Número Bizum</p>
            <p className={fieldValue}>{e.bizumGarantia || '—'}</p>
          </div>
          <div>
            <p className={fieldLabel}>Cantidad pagada</p>
            <p className={`${fieldValue} font-medium ${e.cantidadPagadaGarantia && e.fianzaGarantia && e.cantidadPagadaGarantia === e.fianzaGarantia ? 'text-green-600 dark:text-green-400' : ''}`}>
              {e.cantidadPagadaGarantia ? `${e.cantidadPagadaGarantia} €` : '—'}
            </p>
          </div>
        </div>

      </div>
    </div>
  );
};

// ─── COL layout ───────────────────────────────────────────────────────────────

const COLS = 'grid-cols-[2fr_1.1fr_1.2fr_0.9fr_0.9fr_100px]';

// ─── Main page ────────────────────────────────────────────────────────────────

const EntregaDeLlaves: React.FC = () => {
  const [entregas, setEntregas] = useState<EntregaLlaves[]>(MOCK_ENTREGAS);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [modalData, setModalData] = useState<Partial<EntregaLlaves> | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = searchTerm.toLowerCase();
    if (!q) return entregas;
    return entregas.filter(e =>
      e.nombre.toLowerCase().includes(q) ||
      e.apellidos.toLowerCase().includes(q) ||
      e.telefono.includes(q) ||
      e.apartamento.toLowerCase().includes(q)
    );
  }, [entregas, searchTerm]);

  const handleRowClick = (id: string) =>
    setSelectedId(prev => (prev === id ? null : id));

  const openNew = () => { setModalData(null); setIsModalOpen(true); };
  const openEdit = (e: EntregaLlaves, ev: React.MouseEvent) => {
    ev.stopPropagation();
    setModalData(e);
    setIsModalOpen(true);
  };

  const handleSave = (data: Omit<EntregaLlaves, 'id'>) => {
    if (modalData?.id) {
      setEntregas(prev => prev.map(e => e.id === modalData.id ? { ...data, id: modalData.id } : e));
    } else {
      setEntregas(prev => [...prev, { ...data, id: Date.now().toString() }]);
    }
    setIsModalOpen(false);
  };

  const handleDelete = () => {
    if (modalData?.id) {
      setEntregas(prev => prev.filter(e => e.id !== modalData.id));
      if (selectedId === modalData.id) setSelectedId(null);
      setIsModalOpen(false);
    }
  };

  return (
    <div className="flex flex-col animate-in fade-in slide-in-from-bottom-2 duration-700 space-y-4">

      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 px-1 mb-2">
        <h1 className="text-xl font-normal text-slate-800 dark:text-stone-200 tracking-tight font-display shrink-0">
          Entrega de Llaves
        </h1>

        <div className="flex flex-col md:flex-row gap-3 justify-end items-center flex-1">
          <div className="relative w-full md:w-72">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-stone-500 pointer-events-none" size={14} />
            <input
              type="text"
              placeholder="Buscar nombre, teléfono, apartamento..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-white/40 dark:bg-stone-900/40 backdrop-blur-md border border-white/60 dark:border-stone-700/50 rounded-xl text-slate-700 dark:text-stone-300 text-xs font-normal placeholder:text-slate-400 dark:placeholder:text-stone-500 focus:outline-none transition-all hover:bg-white/80 dark:hover:bg-stone-800/60 focus:bg-white dark:focus:bg-stone-900"
            />
          </div>

          <button
            onClick={openNew}
            className="flex items-center justify-center gap-2 px-6 py-2.5 bg-white dark:bg-stone-900 backdrop-blur-md border border-white/60 dark:border-stone-700/50 rounded-xl text-xs font-normal text-orange-500/80 dark:text-orange-500/70 hover:text-orange-500 dark:hover:text-orange-400 hover:bg-white/80 dark:hover:bg-stone-800/60 transition-all active:scale-[0.98]"
          >
            <Plus size={12} className="text-orange-500" />
            <span>Nueva entrega</span>
          </button>
        </div>
      </header>

      {/* Table */}
      <div className="bg-white/80 dark:bg-stone-900 backdrop-blur-md border border-white/60 dark:border-stone-700/50 rounded-2xl overflow-hidden flex flex-col">

        {/* Column headers */}
        <div className={`grid ${COLS} gap-4 px-8 py-4 border-b border-stone-100 dark:border-stone-800`}>
          <span className="text-xs text-slate-400 dark:text-stone-500">Nombre</span>
          <span className="text-xs text-slate-400 dark:text-stone-500">Teléfono</span>
          <span className="text-xs text-slate-400 dark:text-stone-500">Apartamento</span>
          <span className="text-xs text-slate-400 dark:text-stone-500">Entrada</span>
          <span className="text-xs text-slate-400 dark:text-stone-500">Salida</span>
          <span />
        </div>

        {/* Rows */}
        <ul className="divide-y divide-stone-100 dark:divide-stone-800">
          {filtered.length === 0 ? (
            <li className="flex items-center justify-center px-8 py-10">
              <span className="text-xs text-slate-400 dark:text-stone-500">Sin resultados</span>
            </li>
          ) : filtered.map(e => {
            const isSelected = selectedId === e.id;
            return (
              <React.Fragment key={e.id}>
                <li
                  onClick={() => handleRowClick(e.id)}
                  className={`group grid ${COLS} gap-4 items-center px-8 py-4 cursor-pointer transition-colors
                    ${isSelected
                      ? 'bg-stone-100/70 dark:bg-stone-700/40 hover:bg-stone-100/90 dark:hover:bg-stone-700/60'
                      : 'hover:bg-stone-100/50 dark:hover:bg-stone-700/30'
                    }`}
                >
                  {/* Nombre + estado llaves */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-7 h-7 rounded-full shrink-0 soft-shadow flex items-center justify-center text-xs bg-white dark:bg-stone-800 text-slate-500 dark:text-stone-400">
                      {e.nombre.charAt(0)}{e.apellidos.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <p className={`text-sm truncate transition-colors ${isSelected ? 'text-orange-500' : 'text-slate-800 dark:text-stone-200'}`}>
                          {e.nombre} {e.apellidos}
                        </p>
                        {e.entregaLlaves && (
                          <KeyRound size={12} className="shrink-0 text-orange-400 dark:text-orange-300" />
                        )}
                        {e.sabanasToallas && (
                          <BedDouble size={12} className="shrink-0 text-slate-400 dark:text-stone-400" />
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 dark:text-stone-500 truncate">{e.nombreCliente}</p>
                    </div>
                  </div>

                  {/* Teléfono */}
                  <p className="text-xs text-slate-500 dark:text-stone-400 tabular-nums">{e.telefono || '—'}</p>

                  {/* Apartamento */}
                  <span className="inline-block bg-white dark:bg-stone-800 text-slate-500 dark:text-stone-400 text-[11px] px-2.5 py-1 rounded-md max-w-[140px] truncate soft-shadow">
                    {e.apartamento || '—'}
                  </span>

                  {/* Fechas */}
                  <p className="text-xs text-slate-500 dark:text-stone-400 tabular-nums">{fmtDate(e.fechaEntradaReserva)}</p>
                  <p className="text-xs text-slate-500 dark:text-stone-400 tabular-nums">{fmtDate(e.fechaSalidaReserva)}</p>

                  {/* Acciones */}
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={ev => openEdit(e, ev)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex items-center gap-1.5 text-[11px] font-bold text-slate-600 dark:text-stone-300 hover:text-orange-600 bg-white dark:bg-stone-800 backdrop-blur-sm px-2.5 py-1.5 rounded-lg soft-shadow"
                    >
                      <Pencil size={12} /> Editar
                    </button>
                    <ChevronDown
                      size={14}
                      className={`text-slate-400 dark:text-stone-500 transition-transform duration-200 shrink-0 ${isSelected ? 'rotate-180 text-orange-500' : ''}`}
                    />
                  </div>
                </li>

                {/* Panel expandido */}
                {isSelected && <DetailPanel entrega={e} />}
              </React.Fragment>
            );
          })}
        </ul>
      </div>

      {/* Footer count */}
      <div className="px-1">
        <span className="text-xs text-slate-400 dark:text-stone-500">
          {filtered.length} de {entregas.length} registros
        </span>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <EntregaModal
          initial={modalData}
          onSave={handleSave}
          onClose={() => setIsModalOpen(false)}
          onDelete={modalData?.id ? handleDelete : undefined}
        />
      )}
    </div>
  );
};

export default EntregaDeLlaves;
