// ─────────────────────────────────────────────────────────────────────────────
// ChatBot.tsx — Asistente Cristóbal
//
// Este archivo contiene TODO lo relacionado con el chatbot:
//   1. Constantes y tipos de datos
//   2. Prompt del sistema que le dice a la IA cómo comportarse
//   3. Componentes visuales reutilizables (WizardCard, WizardLabel)
//   4. Widgets interactivos activados por la IA (EditWorkerWidget)
//   5. Wizards activados por botones (pasos guiados sin pasar por la IA)
//   6. El componente principal ChatBot con toda la lógica
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useRef, useEffect, KeyboardEvent } from 'react';
import {
  MessageCircle, X, Send, Loader2, Check, Pencil,
  FileText, UserCog, AlertTriangle, CreditCard, User, ChevronRight, Mic,
} from 'lucide-react';
import { Worker, Accommodation, Incidencia, PagoRecord } from '../../services/mockData';
import { appsScriptApi } from '../../services/api';
import { generatePDF } from '../../services/pdfExport';
import logoSrc from '../../assets/logo/LogoEstandar.png';
import chatbotAvatar from '../../assets/chatbot-avatar.jpeg';

// Tipos auxiliares para el estado de datos externos del bot

// ─── 1. CONSTANTES ────────────────────────────────────────────────────────────

// Clave de API de Groq (servicio de IA que procesa los mensajes de texto)
const GROQ_API_KEY = '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';

// URL del endpoint de Groq (compatible con el formato de OpenAI)
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

// Diccionario que traduce los nombres de campos técnicos a etiquetas legibles
// Se usa para mostrar nombres amigables en los formularios del wizard
const FIELD_LABELS: Record<string, string> = {
  fullName:       'Nombre completo',
  telefono:       'Teléfono',
  email:          'Email',
  dni:            'DNI',
  tipoPago:       'Tipo de pago',
  pagoPorReserva: 'Pago por reserva (€)',
  precioPorKm:    'Precio por km (€)',
  telefonoBizum:  'Teléfono Bizum',
  iban:           'IBAN',
  banco:          'Banco',
  titularCuenta:  'Titular de cuenta',
};

// ─── 2. TIPOS DE MENSAJES ─────────────────────────────────────────────────────
//
// En lugar de usar un solo tipo de mensaje, definimos tres tipos distintos:
//
//   TextMessage     → mensaje de texto normal (usuario o asistente escribiendo)
//   EditWorkerMessage → formulario de edición activado por la IA al detectar intención
//   WizardMessage   → flujo paso a paso activado por los botones de acción rápida
//
// ChatMessage es la unión de los tres: cualquier mensaje puede ser uno de estos.
// TypeScript nos obliga a comprobar cuál es antes de acceder a sus campos únicos.

type TextMessage = {
  id: number;
  role: 'user' | 'assistant';
  kind: 'text';          // discriminador: es un mensaje de texto
  content: string;
};

type EditWorkerMessage = {
  id: number;
  role: 'assistant';
  kind: 'edit_worker';   // discriminador: es un formulario de edición por IA
  workerId: string;      // qué trabajador editar
  fields: string[];      // qué campos mostrar en el formulario
  message: string;       // texto introductorio que muestra el widget
  resolution?: 'saved' | 'cancelled';         // estado final una vez que el usuario actúa
  savedValues?: Record<string, string>;        // valores guardados (para mostrar en el resumen)
};

type WizardMessage = {
  id: number;
  role: 'assistant';
  kind: 'wizard';        // discriminador: es un wizard de botones
  action: 'edit_worker' | 'pagos_pendientes' | 'ver_incidencias' | 'generar_informe'; // qué wizard mostrar
  resolution?: 'completed' | 'cancelled';     // estado final una vez que el usuario actúa
  resolvedData?: Record<string, unknown>;      // datos del resultado para el resumen final
};

// Unión de los tres tipos: cualquier elemento del array de mensajes es uno de estos
type ChatMessage = TextMessage | EditWorkerMessage | WizardMessage;

// ─── 3. PROMPT DEL SISTEMA ────────────────────────────────────────────────────
//
// El "system prompt" es un texto invisible que se envía a la IA al principio
// de cada conversación para darle contexto y personalidad.
// Aquí le decimos quién es, qué datos tiene y cómo debe responder.
//
// Es una función (no una constante) porque recibe el estado actual de `workers`,
// así la IA siempre trabaja con los datos más recientes aunque se hayan editado.

const buildSystemPrompt = (workers: Worker[], accommodations: Accommodation[], incidencias: Incidencia[]) => `
Eres Cristóbal, el asistente de un sistema de gestión de Rental Holidays y Pagos para una empresa de limpieza de alojamientos turísticos. Eres amable, conciso y profesional. Responde siempre en español.

TRABAJADORES (${workers.length}):
${workers.map(w => `- [id:${w.id}] ${w.fullName}: ${w.cleansCountMonth} limpiezas, ${w.kmsMonth} km, ${w.netMoneyMonth}€ neto, pago por ${w.tipoPago ?? 'sin definir'}`).join('\n')}

ALOJAMIENTOS (${accommodations.filter((a: Accommodation) => a.active).length} activos de ${accommodations.length}):
${accommodations.map((a: Accommodation) => `- ${a.name} (${a.city}) — ${a.active ? 'activo' : 'inactivo'}`).join('\n')}

INCIDENCIAS RECIENTES:
${incidencias.map((i: Incidencia) => `- ${i.userName} en ${i.accommodationName}: "${i.description}" — ${i.coste}€`).join('\n')}

Responde de forma directa y breve.
Cuando menciones datos relevantes como cantidades de dinero, números, nombres de trabajadores, fechas o palabras clave importantes, márcalos con **texto** (doble asterisco). Ejemplo: "Se le deben **450€** a **Juan García** por **12 limpiezas**."
`.trim();

// Convierte **texto** en spans naranjas para destacar datos clave en las respuestas
const renderHighlighted = (text: string) => {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  return parts.map((part, i) =>
    i % 2 === 1
      ? <span key={i} className="text-orange-500 font-medium">{part}</span>
      : <span key={i}>{part}</span>
  );
};

// ─── 4. COMPONENTES VISUALES COMPARTIDOS ─────────────────────────────────────
//
// WizardCard y WizardLabel son pequeños componentes reutilizados por todos
// los wizards para mantener un diseño consistente.

// Contenedor visual para todos los wizards: fondo blanco, borde sutil,
// y una franja naranja en la parte superior que los distingue de los mensajes de texto
const WizardCard = ({ children }: { children: React.ReactNode }) => (
  <div className="w-full bg-white dark:bg-stone-900 rounded-xl overflow-hidden border border-stone-200/60 dark:border-stone-700/40 shadow-sm">
    {children}
  </div>
);

// Etiqueta de sección en mayúsculas, usada como título de cada grupo de campos
const WizardLabel = ({ children }: { children: React.ReactNode }) => (
  <p className="text-[10px] text-slate-400 dark:text-stone-500 uppercase tracking-widest mb-2">{children}</p>
);

// ─── 5. WIDGET DE EDICIÓN ACTIVADO POR IA ────────────────────────────────────
//
// Este widget aparece cuando el usuario escribe algo como "edita el teléfono de Juan"
// y la IA lo detecta. La IA responde con un bloque JSON especial (<CRISTOBAL_ACTION>)
// que el código convierte en este formulario en lugar de texto plano.
//
// Tiene tres estados visuales:
//   - Activo: muestra el formulario editable
//   - Guardado (resolution='saved'): muestra resumen verde con los cambios
//   - Cancelado (resolution='cancelled'): muestra mensaje gris de cancelación

interface EditWorkerWidgetProps {
  msg: EditWorkerMessage;
  workers: Worker[];
  onSave:   (workerId: string, updates: Partial<Worker>, msgId: number, labels: Record<string, string>) => void;
  onCancel: (msgId: number) => void;
}

const EditWorkerWidget = ({ msg, workers, onSave, onCancel }: EditWorkerWidgetProps) => {
  // Buscamos el trabajador en el array por su ID
  const worker = workers.find(w => w.id === msg.workerId);
  if (!worker) return null;

  // Estado local del formulario: un objeto { campo: valor } inicializado
  // con los valores actuales del trabajador para que el input no empiece vacío
  const [values, setValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    // El doble cast (as unknown as Record<...>) es necesario porque TypeScript
    // no sabe que Worker tiene un índice de strings genérico
    msg.fields.forEach(f => { init[f] = String((worker as unknown as Record<string, unknown>)[f] ?? ''); });
    return init;
  });

  // Estado: ya guardado → resumen gris discreto (igual que cancelado pero con detalle)
  if (msg.resolution === 'saved') {
    return (
      <div className="bg-stone-50/60 dark:bg-stone-800/20 border border-stone-200/40 dark:border-stone-700/20 rounded-xl rounded-tl-sm px-3.5 py-2.5 max-w-[280px]">
        <p className="text-[11px] text-slate-500 dark:text-stone-400 mb-1">Datos actualizados</p>
        {/* Listamos cada campo guardado con su nuevo valor */}
        {msg.savedValues && (
          <div className="space-y-0.5">
            {Object.entries(msg.savedValues).map(([k, v]) => (
              <p key={k} className="text-[11px] text-slate-400 dark:text-stone-500">
                <span className="text-slate-400 dark:text-stone-500">{k}:</span> {v}
              </p>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Estado: cancelado → mostramos mensaje discreto gris
  if (msg.resolution === 'cancelled') {
    return (
      <div className="bg-stone-50/60 dark:bg-stone-800/20 border border-stone-200/40 dark:border-stone-700/20 rounded-xl rounded-tl-sm px-3.5 py-2.5 max-w-[280px]">
        <p className="text-[11px] text-slate-400 dark:text-stone-500">Edición cancelada</p>
      </div>
    );
  }

  // Estado: activo → mostramos el formulario editable
  return (
    <div className="bg-white dark:bg-stone-900 border border-stone-200/70 dark:border-stone-700/50 rounded-xl rounded-tl-sm overflow-hidden max-w-[288px] shadow-sm">
      {/* Cabecera del widget con nombre del trabajador y mensaje introductorio */}
      <div className="flex items-center gap-2 px-3.5 pt-3 pb-2.5 border-b border-stone-100 dark:border-stone-800/60">
        <div className="w-5 h-5 rounded-lg bg-orange-50 dark:bg-orange-900/20 border border-orange-100 dark:border-orange-800/30 flex items-center justify-center shrink-0">
          <Pencil size={10} className="text-orange-500" />
        </div>
        <div>
          <p className="text-[11px] font-medium text-slate-700 dark:text-stone-200 leading-none">{worker.fullName}</p>
          <p className="text-[10px] text-slate-400 dark:text-stone-500 mt-0.5 leading-none">{msg.message}</p>
        </div>
      </div>

      {/* Campos del formulario — iteramos sobre los campos que pidió la IA */}
      <div className="px-3.5 py-3 space-y-2.5">
        {msg.fields.map(field => (
          <div key={field}>
            <p className="text-[10px] text-slate-400 dark:text-stone-500 uppercase tracking-widest mb-1">{FIELD_LABELS[field] ?? field}</p>

            {/* tipoPago es especial: en lugar de un input de texto mostramos 3 botones */}
            {field === 'tipoPago' ? (
              <div className="flex gap-1.5">
                {(['bizum', 'tarjeta', 'efectivo'] as const).map(opt => (
                  <button key={opt} onClick={() => setValues(p => ({ ...p, tipoPago: opt }))}
                    className={`flex-1 py-1.5 rounded-lg text-[11px] border transition-all ${values['tipoPago'] === opt ? 'bg-orange-500 text-white border-orange-500' : 'bg-stone-50 dark:bg-stone-800/40 text-slate-500 dark:text-stone-400 border-stone-200/60 dark:border-stone-700/30 hover:border-orange-200'}`}>
                    {opt.charAt(0).toUpperCase() + opt.slice(1)}
                  </button>
                ))}
              </div>
            ) : (
              // Para campos numéricos usamos type="number", para el resto type="text"
              <input type={['pagoPorReserva', 'precioPorKm'].includes(field) ? 'number' : 'text'}
                value={values[field] ?? ''}
                // Cuando el usuario escribe, actualizamos solo ese campo en el estado
                onChange={e => setValues(p => ({ ...p, [field]: e.target.value }))}
                className="w-full bg-stone-50/80 dark:bg-stone-800/40 border border-stone-200/60 dark:border-stone-700/30 rounded-lg px-2.5 py-1.5 text-[12px] text-slate-700 dark:text-stone-300 outline-none focus:border-orange-300 dark:focus:border-orange-700/50 transition-colors" />
            )}
          </div>
        ))}
      </div>

      {/* Botones de acción */}
      <div className="flex gap-2 px-3.5 pb-3">
        <button onClick={() => onCancel(msg.id)} className="flex-1 py-1.5 rounded-lg text-[11px] text-slate-500 dark:text-stone-400 bg-stone-100/80 dark:bg-stone-800/60 hover:bg-stone-200/60 border border-stone-200/60 dark:border-stone-700/30 transition-all active:scale-[0.98]">
          Cancelar
        </button>
        {/* Al guardar, pasamos al padre los valores del formulario como Partial<Worker> */}
        <button onClick={() => onSave(msg.workerId, values as Partial<Worker>, msg.id, FIELD_LABELS)} className="flex-1 py-1.5 rounded-lg text-[11px] text-white bg-orange-500 hover:bg-orange-600 border border-orange-500 transition-all active:scale-[0.98]">
          Guardar
        </button>
      </div>
    </div>
  );
};

// ─── 6. WIZARD: EDITAR TRABAJADOR (activado por botón) ───────────────────────
//
// Flujo de 3 pasos guiados que no necesita que el usuario escriba nada:
//   Paso 1 → Elegir trabajador (grid de tarjetas)
//   Paso 2 → Elegir qué campos editar (pills seleccionables)
//   Paso 3 → Rellenar el formulario con los campos elegidos
//
// El estado interno (step, selectedId, fields, values) vive DENTRO de este
// componente — el padre solo se entera cuando el wizard termina (onComplete)
// o se cancela (onCancel).

interface EditWorkerWizardProps {
  workers: Worker[];
  onComplete: (r: { workerId: string; updates: Partial<Worker>; workerName: string; savedLabels: Record<string, string> }) => void;
  onCancel: () => void;
}

const EditWorkerWizard = ({ workers, onComplete, onCancel }: EditWorkerWizardProps) => {
  const [step, setStep]             = useState(0);          // paso actual (0, 1 o 2)
  const [selectedId, setSelectedId] = useState('');         // ID del trabajador seleccionado
  const [fields, setFields]         = useState<string[]>([]); // campos elegidos en el paso 2
  const [values, setValues]         = useState<Record<string, string>>({}); // valores del formulario del paso 3

  // Buscamos el objeto del trabajador seleccionado para mostrar su nombre, etc.
  const worker = workers.find(w => w.id === selectedId);

  // Alterna la selección de un campo: si ya está seleccionado lo quita, si no lo añade
  const toggleField = (f: string) =>
    setFields(prev => prev.includes(f) ? prev.filter(x => x !== f) : [...prev, f]);

  // Al pasar al paso 2→3, pre-cargamos los valores actuales del trabajador en el formulario
  const toStep2 = () => {
    const init: Record<string, string> = {};
    fields.forEach(f => { init[f] = String((worker as unknown as Record<string, unknown>)[f] ?? ''); });
    setValues(init);
    setStep(2);
  };

  // Al pulsar Guardar en el paso 3, construimos el objeto de cambios y llamamos a onComplete
  const save = () => {
    if (!worker) return;
    const updates: Partial<Worker> = {};
    const savedLabels: Record<string, string> = {};
    fields.forEach(f => {
      // Los campos numéricos los convertimos con Number(), el resto son strings
      (updates as Record<string, unknown>)[f] = ['pagoPorReserva', 'precioPorKm'].includes(f) ? Number(values[f]) : values[f];
      // savedLabels: { 'Teléfono': '+34 600 111 222' } — para el resumen final
      savedLabels[FIELD_LABELS[f] ?? f] = values[f];
    });
    onComplete({ workerId: worker.id, updates, workerName: worker.fullName, savedLabels });
  };

  // Helper para el badge "1 / 3" que aparece en la esquina del header
  const stepBadge = (n: number) => (
    <span className="text-[10px] text-slate-400 dark:text-stone-500 bg-stone-100 dark:bg-stone-800/80 px-2 py-0.5 rounded-full">{n} / 3</span>
  );

  // Helper para la cabecera común de los 3 pasos (icono + título + badge)
  const header = (title: string, n: number) => (
    <div className="flex items-center justify-between px-3.5 pt-3 pb-2.5 border-b border-stone-100 dark:border-stone-800/60">
      <div className="flex items-center gap-2">
        <Pencil size={11} className="text-orange-500" />
        <p className="text-[12px] font-medium text-slate-700 dark:text-stone-200">{title}</p>
      </div>
      {stepBadge(n)}
    </div>
  );

  // ── PASO 0: selección del trabajador ──────────────────────────────────────
  // Mostramos todos los trabajadores como tarjetas clicables en una cuadrícula 2x2.
  // La tarjeta seleccionada se resalta en naranja.
  if (step === 0) return (
    <WizardCard>
      {header('Editar trabajador', 1)}
      <div className="px-3.5 py-3">
        <WizardLabel>Selecciona el trabajador</WizardLabel>
        <div className="grid grid-cols-2 gap-1.5">
          {workers.map(w => (
            <button key={w.id} onClick={() => setSelectedId(w.id)}
              className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-left transition-all active:scale-[0.98] ${
                selectedId === w.id
                  ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800/40'
                  : 'bg-stone-50/60 dark:bg-stone-800/30 border-stone-200/50 dark:border-stone-700/30 hover:border-stone-300 dark:hover:border-stone-600/40'
              }`}>
              <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${selectedId === w.id ? 'bg-orange-100 dark:bg-orange-900/30' : 'bg-stone-100 dark:bg-stone-800'}`}>
                <User size={11} className={selectedId === w.id ? 'text-orange-500' : 'text-slate-400 dark:text-stone-500'} />
              </div>
              <div>
                {/* Dividimos el nombre en nombre + apellidos para mostrarlo en dos líneas */}
                <p className="text-[11px] font-medium text-slate-700 dark:text-stone-200 leading-none">{w.fullName.split(' ')[0]}</p>
                <p className="text-[10px] text-slate-400 dark:text-stone-500 mt-0.5 leading-none">{w.fullName.split(' ').slice(1).join(' ')}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
      <div className="flex gap-2 px-3.5 pb-3">
        <button onClick={onCancel} className="flex-1 py-1.5 rounded-lg text-[11px] text-slate-500 dark:text-stone-400 bg-stone-100/80 dark:bg-stone-800/60 border border-stone-200/60 dark:border-stone-700/30 transition-all active:scale-[0.98]">Cancelar</button>
        {/* disabled si no se ha seleccionado ningún trabajador todavía */}
        <button onClick={() => setStep(1)} disabled={!selectedId}
          className="flex-1 py-1.5 rounded-lg text-[11px] text-white bg-orange-500 hover:bg-orange-600 disabled:opacity-40 border border-orange-500 transition-all active:scale-[0.98] flex items-center justify-center gap-1">
          Siguiente <ChevronRight size={11} />
        </button>
      </div>
    </WizardCard>
  );

  // ── PASO 1: selección de campos a editar ──────────────────────────────────
  // Mostramos todos los campos disponibles como pills (botones pequeños).
  // El usuario puede seleccionar varios. Los seleccionados se ponen en naranja.
  if (step === 1 && worker) return (
    <WizardCard>
      {header(worker.fullName, 2)}
      <div className="px-3.5 py-3">
        <WizardLabel>¿Qué campos quieres editar?</WizardLabel>
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(FIELD_LABELS).map(([f, label]) => (
            <button key={f} onClick={() => toggleField(f)}
              className={`px-2.5 py-1 rounded-lg text-[11px] border transition-all active:scale-[0.97] ${
                fields.includes(f)
                  ? 'bg-orange-500 text-white border-orange-500'
                  : 'bg-stone-50 dark:bg-stone-800/40 text-slate-500 dark:text-stone-400 border-stone-200/60 dark:border-stone-700/30 hover:border-orange-200 dark:hover:border-orange-800/40'
              }`}>
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="flex gap-2 px-3.5 pb-3">
        {/* Volver regresa al paso anterior */}
        <button onClick={() => setStep(0)} className="px-3 py-1.5 rounded-lg text-[11px] text-slate-500 dark:text-stone-400 bg-stone-100/80 dark:bg-stone-800/60 border border-stone-200/60 dark:border-stone-700/30 transition-all active:scale-[0.98]">← Volver</button>
        {/* disabled si no se ha seleccionado ningún campo todavía */}
        <button onClick={toStep2} disabled={!fields.length}
          className="flex-1 py-1.5 rounded-lg text-[11px] text-white bg-orange-500 hover:bg-orange-600 disabled:opacity-40 border border-orange-500 transition-all active:scale-[0.98] flex items-center justify-center gap-1">
          Siguiente <ChevronRight size={11} />
        </button>
      </div>
    </WizardCard>
  );

  // ── PASO 2: formulario de edición ─────────────────────────────────────────
  // Solo mostramos los campos que el usuario seleccionó en el paso anterior.
  // tipoPago sigue siendo especial y muestra 3 botones en lugar de un input.
  if (step === 2 && worker) return (
    <WizardCard>
      {header(worker.fullName, 3)}
      <div className="px-3.5 py-3 space-y-2.5">
        {fields.map(f => (
          <div key={f}>
            <p className="text-[10px] text-slate-400 dark:text-stone-500 uppercase tracking-widest mb-1">{FIELD_LABELS[f] ?? f}</p>
            {f === 'tipoPago' ? (
              <div className="flex gap-1.5">
                {(['bizum', 'tarjeta', 'efectivo'] as const).map(opt => (
                  <button key={opt} onClick={() => setValues(p => ({ ...p, tipoPago: opt }))}
                    className={`flex-1 py-1.5 rounded-lg text-[11px] border transition-all ${values['tipoPago'] === opt ? 'bg-orange-500 text-white border-orange-500' : 'bg-stone-50 dark:bg-stone-800/40 text-slate-500 dark:text-stone-400 border-stone-200/60 dark:border-stone-700/30 hover:border-orange-200'}`}>
                    {opt.charAt(0).toUpperCase() + opt.slice(1)}
                  </button>
                ))}
              </div>
            ) : (
              <input type={['pagoPorReserva', 'precioPorKm'].includes(f) ? 'number' : 'text'}
                value={values[f] ?? ''}
                onChange={e => setValues(p => ({ ...p, [f]: e.target.value }))}
                className="w-full bg-stone-50/80 dark:bg-stone-800/40 border border-stone-200/60 dark:border-stone-700/30 rounded-lg px-2.5 py-1.5 text-[12px] text-slate-700 dark:text-stone-300 outline-none focus:border-orange-300 dark:focus:border-orange-700/50 transition-colors" />
            )}
          </div>
        ))}
      </div>
      <div className="flex gap-2 px-3.5 pb-3">
        <button onClick={() => setStep(1)} className="px-3 py-1.5 rounded-lg text-[11px] text-slate-500 dark:text-stone-400 bg-stone-100/80 dark:bg-stone-800/60 border border-stone-200/60 dark:border-stone-700/30 transition-all active:scale-[0.98]">← Volver</button>
        <button onClick={save} className="flex-1 py-1.5 rounded-lg text-[11px] text-white bg-orange-500 hover:bg-orange-600 border border-orange-500 transition-all active:scale-[0.98] flex items-center justify-center gap-1">
          <Check size={11} /> Guardar
        </button>
      </div>
    </WizardCard>
  );

  return null; // defensa: no debería llegar aquí
};

// ─── 7. WIZARD: PAGOS PENDIENTES ──────────────────────────────────────────────
//
// Carga los PagoRecords pendientes reales, los agrupa por trabajador,
// y al confirmar llama a appsScriptApi.markPagosAsPaid con los IDs reales.

const PagosPendientesWizard = ({ onComplete, onCancel }: {
  onComplete: (r: { count: number; total: number }) => void;
  onCancel: () => void;
}) => {
  const [pagos,    setPagos]    = useState<PagoRecord[]>([]);
  const [selected, setSelected] = useState<string[]>([]);  // IDs de trabajadores seleccionados
  const [loading,  setLoading]  = useState(true);

  // Agrupamos pagos pendientes por nombre de trabajador para mostrar resumen
  const byWorker: Record<string, { nombre: string; ids: string[]; total: number }> = {};
  pagos.filter(p => p.estado === 'pendiente').forEach(p => {
    if (!byWorker[p.workerId]) byWorker[p.workerId] = { nombre: p.workerName, ids: [], total: 0 };
    byWorker[p.workerId].ids.push(p.id);
    byWorker[p.workerId].total += p.importe;
  });
  const workerEntries = Object.entries(byWorker);

  useEffect(() => {
    appsScriptApi.getAllPagos().then(all => {
      setPagos(all);
      // Seleccionamos por defecto todos los trabajadores con pagos pendientes
      const pendienteIds = [...new Set(all.filter(p => p.estado === 'pendiente').map(p => p.workerId))];
      setSelected(pendienteIds);
    }).finally(() => setLoading(false));
  }, []);

  const toggle = (id: string) =>
    setSelected(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);

  const total = workerEntries
    .filter(([id]) => selected.includes(id))
    .reduce((s, [, v]) => s + v.total, 0);

  const confirm = async () => {
    const ids = workerEntries
      .filter(([id]) => selected.includes(id))
      .flatMap(([, v]) => v.ids);
    if (ids.length > 0) await appsScriptApi.markPagosAsPaid(ids);
    onComplete({ count: selected.length, total });
  };

  return (
    <WizardCard>
      <div className="flex items-center justify-between px-3.5 pt-3 pb-2.5 border-b border-stone-100 dark:border-stone-800/60">
        <div className="flex items-center gap-2">
          <CreditCard size={11} className="text-orange-500" />
          <p className="text-[12px] font-medium text-slate-700 dark:text-stone-200">Pagos pendientes</p>
        </div>
      </div>
      <div className="px-3.5 py-3 space-y-1.5">
        {loading ? (
          <div className="flex justify-center py-4">
            <Loader2 size={16} className="text-orange-400 animate-spin" />
          </div>
        ) : workerEntries.length === 0 ? (
          <p className="text-[12px] text-slate-400 dark:text-stone-500 text-center py-3">No hay pagos pendientes</p>
        ) : (
          <>
            <WizardLabel>Selecciona a quién marcar como pagado</WizardLabel>
            {workerEntries.map(([id, { nombre, total: t }]) => (
              <button key={id} onClick={() => toggle(id)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl border transition-all active:scale-[0.98] ${
                  selected.includes(id)
                    ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800/40'
                    : 'bg-stone-50/60 dark:bg-stone-800/30 border-stone-200/50 dark:border-stone-700/30 hover:border-stone-300'
                }`}>
                <div className="flex items-center gap-2">
                  <div className={`w-4 h-4 rounded-md border-2 flex items-center justify-center transition-all ${selected.includes(id) ? 'bg-orange-500 border-orange-500' : 'border-stone-300 dark:border-stone-600'}`}>
                    {selected.includes(id) && <Check size={9} className="text-white" />}
                  </div>
                  <p className="text-[12px] text-slate-700 dark:text-stone-200">{nombre}</p>
                </div>
                <p className={`text-[12px] font-medium ${selected.includes(id) ? 'text-orange-500' : 'text-slate-500 dark:text-stone-400'}`}>
                  {t.toFixed(2)}€
                </p>
              </button>
            ))}
            {selected.length > 0 && (
              <div className="flex justify-between items-center pt-1.5 px-1">
                <p className="text-[10px] text-slate-400 dark:text-stone-500">{selected.length} seleccionado{selected.length !== 1 ? 's' : ''}</p>
                <p className="text-[12px] font-medium text-orange-500">{total.toFixed(2)}€ total</p>
              </div>
            )}
          </>
        )}
      </div>
      <div className="flex gap-2 px-3.5 pb-3">
        <button onClick={onCancel} className="flex-1 py-1.5 rounded-lg text-[11px] text-slate-500 dark:text-stone-400 bg-stone-100/80 dark:bg-stone-800/60 border border-stone-200/60 dark:border-stone-700/30 transition-all active:scale-[0.98]">Cancelar</button>
        <button onClick={confirm} disabled={!selected.length || loading}
          className="flex-1 py-1.5 rounded-lg text-[11px] text-white bg-orange-500 hover:bg-orange-600 disabled:opacity-40 border border-orange-500 transition-all active:scale-[0.98] flex items-center justify-center gap-1">
          <Check size={11} /> Confirmar
        </button>
      </div>
    </WizardCard>
  );
};

// ─── 8. WIZARD: VER INCIDENCIAS ───────────────────────────────────────────────
//
// Componente de solo lectura: muestra las incidencias recientes en tarjetas.
// No tiene pasos ni estado local, simplemente lee MOCK_INCIDENCIAS.
// El botón "Cerrar" llama a onClose, que en el padre marca el wizard como cancelado.

const VerIncidenciasCard = ({ onClose, incidencias }: { onClose: () => void; incidencias: Incidencia[] }) => (
  <WizardCard>
    <div className="flex items-center justify-between px-3.5 pt-3 pb-2.5 border-b border-stone-100 dark:border-stone-800/60">
      <div className="flex items-center gap-2">
        <AlertTriangle size={11} className="text-orange-500" />
        <p className="text-[12px] font-medium text-slate-700 dark:text-stone-200">Incidencias recientes</p>
      </div>
      <span className="text-[10px] text-slate-400 dark:text-stone-500 bg-stone-100 dark:bg-stone-800/80 px-2 py-0.5 rounded-full">{incidencias.length}</span>
    </div>
    <div className="px-3.5 py-3 space-y-2">
      {incidencias.map(inc => (
        <div key={inc.id} className="flex items-start gap-2.5 px-2.5 py-2 rounded-xl bg-stone-50/60 dark:bg-stone-800/30 border border-stone-100/80 dark:border-stone-700/30">
          <div className="w-4 h-4 rounded-md bg-orange-50 dark:bg-orange-900/20 border border-orange-100 dark:border-orange-800/30 flex items-center justify-center shrink-0 mt-0.5">
            <AlertTriangle size={9} className="text-orange-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] text-slate-600 dark:text-stone-300 leading-snug">{inc.description}</p>
            <div className="flex items-center justify-between mt-1">
              {/* truncate evita que nombres largos rompan el layout */}
              <p className="text-[10px] text-slate-400 dark:text-stone-500 truncate">{inc.userName} · {inc.accommodationName}</p>
              <p className="text-[10px] font-medium text-orange-500 shrink-0 ml-2">{inc.coste}€</p>
            </div>
          </div>
        </div>
      ))}
    </div>
    <div className="px-3.5 pb-3">
      <button onClick={onClose} className="w-full py-1.5 rounded-lg text-[11px] text-slate-500 dark:text-stone-400 bg-stone-100/80 dark:bg-stone-800/60 border border-stone-200/60 dark:border-stone-700/30 transition-all active:scale-[0.98]">Cerrar</button>
    </div>
  </WizardCard>
);

// ─── 9. WIZARD: GENERAR INFORME ──────────────────────────────────────────────
//
// Flujo de 3 pasos para configurar y generar un informe:
//   Paso 1 → Tipo de informe (pills)
//   Paso 2 → Período de tiempo (presets + fechas personalizadas)
//   Paso 3 → Trabajadores a incluir (checkboxes)

const TIPOS_INFORME = ['Pagos', 'Limpiezas', 'Incidencias', 'Completo'] as const;
const PERIODOS_PRESET = ['Este mes', 'Último trimestre', 'Este año'] as const;

interface GenerarInformeResult {
  tipo: string;
  periodo: string;
  trabajadores: string;
  downloadUrl: string;
  fileName: string;
}

const GenerarInformeWizard = ({ workers, onComplete, onCancel }: {
  workers: Worker[];
  onComplete: (r: GenerarInformeResult) => void;
  onCancel: () => void;
}) => {
  const [step, setStep]           = useState(0);
  const [tipo, setTipo]           = useState('');
  const [periodo, setPeriodo]     = useState('');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [selected, setSelected]   = useState<string[]>(workers.map(w => w.id));

  const toggle = (id: string) =>
    setSelected(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);

  // Texto legible del período para el resumen final
  const periodoLabel = periodo === 'Personalizado' && fechaDesde && fechaHasta
    ? `${fechaDesde} – ${fechaHasta}`
    : periodo;

  // Texto legible de los trabajadores seleccionados para el resumen final
  const trabajadoresLabel = selected.length === workers.length
    ? 'Todos los trabajadores'
    : workers.filter(w => selected.includes(w.id)).map(w => w.fullName.split(' ')[0]).join(', ');

  const header = (title: string, n: number) => (
    <div className="flex items-center justify-between px-3.5 pt-3 pb-2.5 border-b border-stone-100 dark:border-stone-800/60">
      <div className="flex items-center gap-2">
        <FileText size={11} className="text-orange-500" />
        <p className="text-[12px] font-medium text-slate-700 dark:text-stone-200">{title}</p>
      </div>
      <span className="text-[10px] text-slate-400 dark:text-stone-500 bg-stone-100 dark:bg-stone-800/80 px-2 py-0.5 rounded-full">{n} / 3</span>
    </div>
  );

  // ── PASO 0: tipo de informe ────────────────────────────────────────────────
  if (step === 0) return (
    <WizardCard>
      {header('Generar informe', 1)}
      <div className="px-3.5 py-3">
        <WizardLabel>¿Qué tipo de informe?</WizardLabel>
        <div className="grid grid-cols-2 gap-1.5">
          {TIPOS_INFORME.map(t => (
            <button key={t} onClick={() => setTipo(t)}
              className={`py-2.5 rounded-xl border text-[11px] font-normal transition-all active:scale-[0.98] ${
                tipo === t
                  ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800/40 text-orange-600 dark:text-orange-400'
                  : 'bg-stone-50/60 dark:bg-stone-800/30 border-stone-200/50 dark:border-stone-700/30 text-slate-500 dark:text-stone-400 hover:border-stone-300'
              }`}>
              {t}
            </button>
          ))}
        </div>
      </div>
      <div className="flex gap-2 px-3.5 pb-3">
        <button onClick={onCancel} className="flex-1 py-1.5 rounded-lg text-[11px] text-slate-500 dark:text-stone-400 bg-stone-100/80 dark:bg-stone-800/60 border border-stone-200/60 dark:border-stone-700/30 transition-all active:scale-[0.98]">Cancelar</button>
        <button onClick={() => setStep(1)} disabled={!tipo}
          className="flex-1 py-1.5 rounded-lg text-[11px] text-white bg-orange-500 hover:bg-orange-600 disabled:opacity-40 border border-orange-500 transition-all active:scale-[0.98] flex items-center justify-center gap-1">
          Siguiente <ChevronRight size={11} />
        </button>
      </div>
    </WizardCard>
  );

  // ── PASO 1: período de tiempo ─────────────────────────────────────────────
  if (step === 1) return (
    <WizardCard>
      {header('Generar informe', 2)}
      <div className="px-3.5 py-3 space-y-3">
        <div>
          <WizardLabel>Período</WizardLabel>
          <div className="flex flex-wrap gap-1.5">
            {([...PERIODOS_PRESET, 'Personalizado'] as const).map(p => (
              <button key={p} onClick={() => setPeriodo(p)}
                className={`px-2.5 py-1 rounded-lg text-[11px] border transition-all active:scale-[0.97] ${
                  periodo === p
                    ? 'bg-orange-500 text-white border-orange-500'
                    : 'bg-stone-50 dark:bg-stone-800/40 text-slate-500 dark:text-stone-400 border-stone-200/60 dark:border-stone-700/30 hover:border-orange-200'
                }`}>
                {p}
              </button>
            ))}
          </div>
        </div>
        {/* Si elige Personalizado, mostramos dos date pickers */}
        {periodo === 'Personalizado' && (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="text-[10px] text-slate-400 dark:text-stone-500 uppercase tracking-widest mb-1">Desde</p>
              <input type="date" value={fechaDesde} onChange={e => setFechaDesde(e.target.value)}
                className="w-full bg-stone-50/80 dark:bg-stone-800/40 border border-stone-200/60 dark:border-stone-700/30 rounded-lg px-2.5 py-1.5 text-[11px] text-slate-700 dark:text-stone-300 outline-none focus:border-orange-300 transition-colors" />
            </div>
            <div>
              <p className="text-[10px] text-slate-400 dark:text-stone-500 uppercase tracking-widest mb-1">Hasta</p>
              <input type="date" value={fechaHasta} onChange={e => setFechaHasta(e.target.value)}
                className="w-full bg-stone-50/80 dark:bg-stone-800/40 border border-stone-200/60 dark:border-stone-700/30 rounded-lg px-2.5 py-1.5 text-[11px] text-slate-700 dark:text-stone-300 outline-none focus:border-orange-300 transition-colors" />
            </div>
          </div>
        )}
      </div>
      <div className="flex gap-2 px-3.5 pb-3">
        <button onClick={() => setStep(0)} className="px-3 py-1.5 rounded-lg text-[11px] text-slate-500 dark:text-stone-400 bg-stone-100/80 dark:bg-stone-800/60 border border-stone-200/60 dark:border-stone-700/30 transition-all active:scale-[0.98]">← Volver</button>
        <button
          onClick={() => setStep(2)}
          disabled={!periodo || (periodo === 'Personalizado' && (!fechaDesde || !fechaHasta))}
          className="flex-1 py-1.5 rounded-lg text-[11px] text-white bg-orange-500 hover:bg-orange-600 disabled:opacity-40 border border-orange-500 transition-all active:scale-[0.98] flex items-center justify-center gap-1">
          Siguiente <ChevronRight size={11} />
        </button>
      </div>
    </WizardCard>
  );

  // ── PASO 2: selección de trabajadores ─────────────────────────────────────
  if (step === 2) return (
    <WizardCard>
      {header('Generar informe', 3)}
      <div className="px-3.5 py-3 space-y-1.5">
        <WizardLabel>Trabajadores a incluir</WizardLabel>
        {workers.map(w => (
          <button key={w.id} onClick={() => toggle(w.id)}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl border transition-all active:scale-[0.98] ${
              selected.includes(w.id)
                ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800/40'
                : 'bg-stone-50/60 dark:bg-stone-800/30 border-stone-200/50 dark:border-stone-700/30 hover:border-stone-300'
            }`}>
            <div className={`w-4 h-4 rounded-md border-2 flex items-center justify-center transition-all shrink-0 ${selected.includes(w.id) ? 'bg-orange-500 border-orange-500' : 'border-stone-300 dark:border-stone-600'}`}>
              {selected.includes(w.id) && <Check size={9} className="text-white" />}
            </div>
            <p className="text-[12px] text-slate-700 dark:text-stone-200">{w.fullName}</p>
          </button>
        ))}
      </div>
      <div className="flex gap-2 px-3.5 pb-3">
        <button onClick={() => setStep(1)} className="px-3 py-1.5 rounded-lg text-[11px] text-slate-500 dark:text-stone-400 bg-stone-100/80 dark:bg-stone-800/60 border border-stone-200/60 dark:border-stone-700/30 transition-all active:scale-[0.98]">← Volver</button>
        <button
          onClick={async () => {
            const selectedWorkerNames = new Set(workers.filter(w => selected.includes(w.id)).map(w => w.fullName));
            const workerName = selected.length === 1
              ? workers.find(w => w.id === selected[0])?.fullName ?? null
              : null;

            // Cargamos todos los datos igual que la página de generar informe
            const [allPagos, allIncid, allCleans, allHandyman] = await Promise.all([
              appsScriptApi.getAllPagos(),
              appsScriptApi.getRecentIncidencias(200),
              appsScriptApi.getNormalCleans(),
              appsScriptApi.getHandymanRecords(),
            ]);

            const fPagos  = allPagos.filter(p => selectedWorkerNames.has(p.workerName));
            const fIncid  = allIncid.filter(i => selectedWorkerNames.has(i.userName));
            const fCleans = allCleans.filter(c => selectedWorkerNames.has(`${c.nombre} ${c.apellidos}`));
            const fHandy  = allHandyman.filter(h => selectedWorkerNames.has(`${h.nombre} ${h.apellidos}`));

            const options = {
              pagos:       tipo === 'Pagos'       || tipo === 'Completo',
              limpiezas:   tipo === 'Limpiezas'   || tipo === 'Completo',
              incidencias: tipo === 'Incidencias' || tipo === 'Completo',
              handyman:    tipo === 'Completo',
            };

            // Mapeamos el periodo del wizard al formato que espera generatePDF
            const periodoKey = periodo === 'Este mes' ? 'este-mes'
              : periodo === 'Último trimestre'        ? 'trimestre'
              : periodo === 'Este año'                ? 'trimestre'
              : 'personalizado';

            const result = await generatePDF(
              { pagos: fPagos, incidencias: fIncid, cleans: fCleans, handyman: fHandy },
              options,
              { periodo: periodoKey, workerName, accName: null },
              logoSrc,
              true,
            );

            const downloadUrl = URL.createObjectURL(result.blob);
            onComplete({ tipo, periodo: periodoLabel, trabajadores: trabajadoresLabel, downloadUrl, fileName: result.fileName });
          }}
          disabled={!selected.length}
          className="flex-1 py-1.5 rounded-lg text-[11px] text-white bg-orange-500 hover:bg-orange-600 disabled:opacity-40 border border-orange-500 transition-all active:scale-[0.98] flex items-center justify-center gap-1">
          <FileText size={11} /> Generar informe
        </button>
      </div>
    </WizardCard>
  );

  return null;
};

// ─── 10. WIZARDWIDGET: despachador de wizards ─────────────────────────────────
//
// Este componente recibe un WizardMessage y decide qué renderizar:
//   - Si ya tiene resolución (completed/cancelled) → muestra el estado final
//   - Si no, delega en el wizard correcto según msg.action
//
// Es el "router" de wizards: el padre no necesita saber qué wizard mostrar,
// solo pasa el mensaje y este componente lo gestiona.

interface WizardWidgetProps {
  msg: WizardMessage;
  workers: Worker[];
  incidencias: Incidencia[];
  onComplete: (msgId: number, result: Record<string, unknown>, updates?: Partial<Worker>, workerId?: string) => void;
  onCancel:   (msgId: number) => void;
}

const WizardWidget = ({ msg, workers, incidencias, onComplete, onCancel }: WizardWidgetProps) => {
  // Estado final: completado → resumen con botón de descarga si es un informe
  if (msg.resolution === 'completed') {
    const d = msg.resolvedData ?? {};
    return (
      <div className="w-full bg-stone-50/60 dark:bg-stone-800/20 border border-stone-200/40 dark:border-stone-700/20 rounded-xl px-3.5 py-2.5 space-y-2">
        <p className="text-[11px] text-slate-500 dark:text-stone-400">{d.summary as string ?? 'Completado'}</p>
        {!!d.detail && <p className="text-[11px] text-slate-400 dark:text-stone-500">{String(d.detail)}</p>}
        {/* Botón de descarga — solo aparece si el informe generó un archivo */}
        {!!d.downloadUrl && (
          <a href={d.downloadUrl as string} download={d.fileName as string}
            className="flex items-center justify-center gap-1.5 w-full py-1.5 rounded-lg text-[11px] text-white bg-orange-500 hover:bg-orange-600 transition-all active:scale-[0.98]">
            <FileText size={11} /> Descargar informe
          </a>
        )}
      </div>
    );
  }

  // Estado final: cancelado → mensaje gris discreto
  if (msg.resolution === 'cancelled') {
    return (
      <div className="w-full bg-stone-50/60 dark:bg-stone-800/20 border border-stone-200/40 dark:border-stone-700/20 rounded-xl px-3.5 py-2.5">
        <p className="text-[11px] text-slate-400 dark:text-stone-500">Acción cancelada</p>
      </div>
    );
  }

  // Sin resolución todavía → renderizamos el wizard activo según la acción
  // Cada caso envuelve el result en el formato { summary, detail } para el estado final
  if (msg.action === 'edit_worker') return (
    <EditWorkerWizard
      workers={workers}
      onComplete={r => onComplete(msg.id, {
        summary: `Datos de ${r.workerName} actualizados`,
        detail: Object.entries(r.savedLabels).map(([k, v]) => `${k}: ${v}`).join(' · '),
      }, r.updates, r.workerId)}
      onCancel={() => onCancel(msg.id)}
    />
  );

  if (msg.action === 'pagos_pendientes') return (
    <PagosPendientesWizard
      onComplete={r => onComplete(msg.id, {
        summary: `${r.count} trabajador${r.count !== 1 ? 'es' : ''} marcado${r.count !== 1 ? 's' : ''} como pagado${r.count !== 1 ? 's' : ''}`,
        detail: `Total: ${r.total.toFixed(2)}€`,
      })}
      onCancel={() => onCancel(msg.id)}
    />
  );

  if (msg.action === 'ver_incidencias') return (
    <VerIncidenciasCard onClose={() => onCancel(msg.id)} incidencias={incidencias} />
  );

  if (msg.action === 'generar_informe') return (
    <GenerarInformeWizard
      workers={workers}
      onComplete={(r: GenerarInformeResult) => onComplete(msg.id, {
        summary: `Informe generado · ${r.tipo}`,
        detail: `${r.periodo} · ${r.trabajadores}`,
        downloadUrl: r.downloadUrl,
        fileName: r.fileName,
      })}
      onCancel={() => onCancel(msg.id)}
    />
  );

  return null;
};

// ─── 10. CHATBOT: componente principal ────────────────────────────────────────
//
// Aquí vive todo el estado global del chat y la lógica de alto nivel:
//   - Estado de apertura/cierre del popup
//   - Array de mensajes (mezcla de texto, widgets y wizards)
//   - Estado local de trabajadores (para reflejar ediciones sin recargar)
//   - Llamadas a la API de Groq
//   - Handlers que conectan los wizards con el estado

const ChatBot = () => {
  const [isOpen,         setIsOpen]         = useState(false);
  const [workers,        setWorkers]        = useState<Worker[]>([]);
  const [accommodations, setAccommodations] = useState<Accommodation[]>([]);
  const [incidencias,    setIncidencias]    = useState<Incidencia[]>([]);
  const [messages,  setMessages]  = useState<ChatMessage[]>([
    { id: 0, role: 'assistant', kind: 'text', content: 'Hola, soy Cristóbal, tu asistente de Rental Holidays. ¿En qué puedo ayudarte?' }
  ]);
  const [input,     setInput]     = useState('');
  const [isLoading,   setIsLoading]   = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [interim,     setInterim]     = useState(''); // texto que se está dictando ahora mismo

  const messagesEndRef  = useRef<HTMLDivElement>(null);
  const idRef           = useRef(1);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef  = useRef<any>(null);
  const confirmedRef    = useRef(''); // texto final acumulado durante la sesión de dictado

  const toggleListening = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
    if (!SR) return;

    if (isListening) {
      recognitionRef.current?.stop();
      recognitionRef.current = null;
      // Al parar: consolida el interim que quedara pendiente y limpia
      setInput(prev => {
        const full = (prev + ' ' + interim).trim();
        return full;
      });
      setInterim('');
      confirmedRef.current = '';
      setIsListening(false);
      return;
    }

    // Guardamos el texto actual del input como base para el dictado
    confirmedRef.current = '';

    const rec = new SR();
    rec.lang = 'es-ES';
    rec.interimResults = true;  // recibir palabras mientras se habla
    rec.continuous = true;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onresult = (e: any) => {
      let finalChunk = '';
      let interimChunk = '';

      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalChunk += t + ' ';
        else interimChunk += t;
      }

      if (finalChunk) {
        confirmedRef.current = (confirmedRef.current + ' ' + finalChunk).trim();
        setInput(prev => {
          // base del input antes de que empezara el dictado + todo lo confirmado
          const base = prev.replace(/ ?…$/, '').trimEnd();
          return base ? base + ' ' + confirmedRef.current : confirmedRef.current;
        });
        setInterim('');
      } else {
        setInterim(interimChunk);
      }
    };

    rec.onerror = () => { recognitionRef.current = null; setIsListening(false); setInterim(''); };
    rec.onend = () => {
      if (recognitionRef.current) {
        try { recognitionRef.current.start(); } catch { /* ya iniciado */ }
      }
    };

    recognitionRef.current = rec;
    rec.start();
    setIsListening(true);
  };

  // Carga datos reales del Excel al abrir el chat por primera vez
  useEffect(() => {
    if (!isOpen || workers.length > 0) return;
    Promise.all([
      appsScriptApi.getWorkers(),
      appsScriptApi.getAccommodations(),
      appsScriptApi.getRecentIncidencias(10),
    ]).then(([w, a, i]) => {
      setWorkers(w);
      setAccommodations(a);
      setIncidencias(i);
    }).catch(() => { /* fallo silencioso: el bot funciona aunque no carguen los datos */ });
  }, [isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // ── Helpers de API ──────────────────────────────────────────────────────────

  // Envía una petición a Groq y devuelve el texto de la respuesta.
  // El sistema prompt se construye dinámicamente con el estado actual de workers.
  const callGroq = async (msgs: { role: string; content: string }[]) => {
    const res = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile', // modelo de Groq (LLaMA 3.3 de Meta, 70B parámetros)
        messages: [{ role: 'system', content: buildSystemPrompt(workers, accommodations, incidencias) }, ...msgs],
        max_tokens: 400,   // máximo de tokens en la respuesta (aprox. 300 palabras)
        temperature: 0.5,  // 0 = determinista, 1 = creativo — 0.5 es equilibrado
      }),
    });
    if (!res.ok) throw new Error();
    const data = await res.json();
    return data.choices?.[0]?.message?.content as string ?? '';
  };

  // Tipo auxiliar: lo que puede devolver parseResponse (texto o widget de edición)
  type ParsedMessage =
    | { role: 'assistant'; kind: 'text'; content: string }
    | { role: 'assistant'; kind: 'edit_worker'; workerId: string; fields: string[]; message: string };

  // Analiza la respuesta raw de la IA buscando la etiqueta especial <CRISTOBAL_ACTION>.
  // Si la encuentra, extrae el JSON y crea un mensaje de tipo 'edit_worker'.
  // Si no, devuelve un mensaje de texto normal.
  const parseResponse = (raw: string): ParsedMessage => {
    const match = raw.match(/<CRISTOBAL_ACTION>([\s\S]*?)<\/CRISTOBAL_ACTION>/);
    if (match) {
      try {
        const p = JSON.parse(match[1].trim());
        if (p.type === 'edit_worker')
          return { role: 'assistant', kind: 'edit_worker', workerId: p.workerId, fields: p.fields, message: p.message };
      } catch { /* JSON malformado: ignoramos y tratamos como texto */ }
    }
    return { role: 'assistant', kind: 'text', content: raw };
  };

  // Filtra el array de mensajes para enviarle a Groq solo los mensajes de texto.
  // Los wizards y widgets son UI pura y la IA no necesita saber que existen.
  const textMessages = (msgs: ChatMessage[]) =>
    msgs.filter((m): m is TextMessage => m.kind === 'text').map(m => ({ role: m.role, content: m.content }));

  // ── Handlers de acciones ────────────────────────────────────────────────────

  // sendMessage: envía el texto del input a la IA y añade la respuesta al chat
  const sendMessage = async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    const userMsg: TextMessage = { id: idRef.current++, role: 'user', kind: 'text', content: text };
    const updated = [...messages, userMsg]; // incluimos el mensaje del usuario en el historial
    setMessages(updated);
    setInput('');
    setIsLoading(true);

    try {
      const raw = await callGroq(textMessages(updated));
      const parsed = parseResponse(raw); // puede ser texto o un widget de edición
      setMessages(prev => [...prev, { ...parsed, id: idRef.current++ } as ChatMessage]);
    } catch {
      setMessages(prev => [...prev, { id: idRef.current++, role: 'assistant', kind: 'text', content: 'Ha ocurrido un error. Inténtalo de nuevo.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  // triggerWizard: botones de "Editar", "Pagos", "Incidencias" — inyecta un
  // WizardMessage en el chat directamente, sin pasar por la IA
  const triggerWizard = (action: WizardMessage['action']) => {
    if (isLoading) return;
    setMessages(prev => [...prev, { id: idRef.current++, role: 'assistant', kind: 'wizard', action }]);
  };

  // handleWizardComplete: se llama cuando el usuario pulsa "Confirmar" en un wizard.
  //   1. Si hay cambios de trabajador, actualiza el estado local y persiste en el Excel
  //   2. Marca el WizardMessage con resolution='completed' y los datos del resumen
  const handleWizardComplete = (msgId: number, result: Record<string, unknown>, updates?: Partial<Worker>, workerId?: string) => {
    if (workerId && updates) {
      setWorkers(prev => {
        const updated = prev.map(w => w.id === workerId ? { ...w, ...updates } : w);
        const worker = updated.find(w => w.id === workerId);
        if (worker) appsScriptApi.updateWorker(worker);
        return updated;
      });
    }
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, resolution: 'completed' as const, resolvedData: result } as ChatMessage : m));
  };

  // handleWizardCancel: se llama cuando el usuario pulsa "Cancelar" o "Cerrar" en un wizard.
  // Marca el mensaje con resolution='cancelled' para mostrar el estado colapsado.
  const handleWizardCancel = (msgId: number) => {
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, resolution: 'cancelled' as const } as ChatMessage : m));
  };

  // handleEditWorkerSave: equivalente a handleWizardComplete pero para el widget
  // activado por IA (EditWorkerWidget), que tiene su propia lógica de savedValues
  const handleEditWorkerSave = (workerId: string, updates: Partial<Worker>, msgId: number, labels: Record<string, string>) => {
    setWorkers(prev => {
      const updated = prev.map(w => w.id === workerId ? { ...w, ...updates } : w);
      const worker = updated.find(w => w.id === workerId);
      if (worker) appsScriptApi.updateWorker(worker);
      return updated;
    });
    const savedValues: Record<string, string> = {};
    Object.entries(updates).forEach(([k, v]) => { savedValues[labels[k] ?? k] = String(v); });
    setMessages(prev => prev.map(m => m.id === msgId && m.kind === 'edit_worker' ? { ...m, resolution: 'saved' as const, savedValues } as ChatMessage : m));
  };

  const handleEditWorkerCancel = (msgId: number) => {
    setMessages(prev => prev.map(m => m.id === msgId && m.kind === 'edit_worker' ? { ...m, resolution: 'cancelled' as const } : m));
  };

  // Enviar con Enter además del botón
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => { if (e.key === 'Enter') sendMessage(); };

  // ── Botones de acción rápida ────────────────────────────────────────────────
  // Array que define los 4 botones pill encima del input.
  // Cada uno tiene icono, etiqueta y la función que ejecuta al pulsarlo.
  const QUICK_ACTIONS = [
    { icon: FileText,      label: 'Generar informe', onClick: () => triggerWizard('generar_informe') },
    { icon: UserCog,       label: 'Editar',          onClick: () => triggerWizard('edit_worker') },
    { icon: CreditCard,    label: 'Pagos',            onClick: () => triggerWizard('pagos_pendientes') },
    { icon: AlertTriangle, label: 'Incidencias',      onClick: () => triggerWizard('ver_incidencias') },
  ] as const;

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Backdrop invisible — al hacer clic fuera del popup lo cierra */}
      <div
        className={`fixed inset-0 z-[195] transition-opacity duration-300 ${isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        onClick={() => setIsOpen(false)}
      />

      {/* Popup del chat — usa scale + opacity + translateY para la animación de entrada */}
      <div className={`fixed bottom-[76px] right-6 z-[200] w-[430px] rounded-2xl overflow-hidden bg-white/90 dark:bg-stone-900/95 backdrop-blur-xl border border-white/60 dark:border-stone-800/50 soft-shadow transition-all duration-300 ease-out origin-bottom-right ${isOpen ? 'opacity-100 scale-100 translate-y-0 pointer-events-auto' : 'opacity-0 scale-95 translate-y-2 pointer-events-none'}`}>

        {/* Cabecera del popup */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100 dark:border-stone-800/50">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-xl overflow-hidden border border-orange-100 dark:border-orange-800/30">
              <img src={chatbotAvatar} alt="Cristóbal" className="w-full h-full object-cover" />
            </div>
            <div>
              <p className="text-[13px] font-normal text-slate-800 dark:text-stone-200 font-display leading-none">Cristóbal</p>
              <p className="text-[10px] text-slate-400 dark:text-stone-500 mt-0.5 leading-none">Rental Holidays</p>
            </div>
          </div>
          <button onClick={() => setIsOpen(false)}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 dark:text-stone-500 hover:text-slate-600 dark:hover:text-stone-300 hover:bg-stone-100/80 dark:hover:bg-stone-800/60 transition-all active:scale-95">
            <X size={13} />
          </button>
        </div>

        {/* Área de mensajes — height fija + overflow-y-auto para el scroll interno */}
        <div className="h-[430px] px-5 py-4 flex flex-col gap-3 overflow-y-auto">
          {messages.map(msg => {

            // Burbuja de usuario (derecha, fondo naranja)
            if (msg.role === 'user') return (
              <div key={msg.id} className="flex justify-end">
                <div className="bg-orange-500 rounded-xl rounded-tr-sm px-3.5 py-2.5 max-w-[300px]">
                  <p className="text-[12px] text-white leading-relaxed whitespace-pre-wrap">{(msg as TextMessage).content}</p>
                </div>
              </div>
            );

            // Wizard — ocupa todo el ancho, sin icono de Sparkles
            // Esto es lo que da el "estilismo distinto" respecto a los mensajes de texto
            if (msg.kind === 'wizard') return (
              <div key={msg.id} className="w-full">
                <WizardWidget msg={msg} workers={workers} incidencias={incidencias} onComplete={handleWizardComplete} onCancel={handleWizardCancel} />
              </div>
            );

            // Mensaje del asistente (texto o widget IA) — con avatar a la izquierda
            return (
              <div key={msg.id} className="flex items-start gap-2.5">
                <div className="w-6 h-6 rounded-lg overflow-hidden shrink-0 mt-0.5">
                  <img src={chatbotAvatar} alt="Cristóbal" className="w-full h-full object-cover" />
                </div>
                {msg.kind === 'text' ? (
                  // Burbuja de texto normal
                  <div className="bg-stone-50/80 dark:bg-stone-800/40 border border-stone-100/80 dark:border-stone-700/30 rounded-xl rounded-tl-sm px-3.5 py-2.5 max-w-[300px]">
                    <p className="text-[12px] text-slate-600 dark:text-stone-300 leading-relaxed whitespace-pre-wrap">{renderHighlighted(msg.content)}</p>
                  </div>
                ) : msg.kind === 'edit_worker' ? (
                  // Widget de edición activado por la IA (cuando el usuario lo pide por texto)
                  <EditWorkerWidget msg={msg} workers={workers} onSave={handleEditWorkerSave} onCancel={handleEditWorkerCancel} />
                ) : null}
              </div>
            );
          })}

          {/* Indicador de carga (spinner) — solo visible mientras la IA procesa */}
          {isLoading && (
            <div className="flex items-start gap-2.5">
              <div className="w-6 h-6 rounded-lg overflow-hidden shrink-0 mt-0.5">
                <img src={chatbotAvatar} alt="Cristóbal" className="w-full h-full object-cover" />
              </div>
              <div className="bg-stone-50/80 dark:bg-stone-800/40 border border-stone-100/80 dark:border-stone-700/30 rounded-xl rounded-tl-sm px-3.5 py-2.5">
                <Loader2 size={13} className="text-orange-400 animate-spin" />
              </div>
            </div>
          )}

          {/* Div invisible al final — scrollIntoView() lo usa para bajar automáticamente */}
          <div ref={messagesEndRef} />
        </div>

        {/* Área de entrada: botones rápidos + campo de texto */}
        <div className="px-4 pt-2.5 pb-3.5 border-t border-stone-100 dark:border-stone-800/50 space-y-2.5">

          {/* Botones de acción rápida — no-scrollbar oculta la barra de scroll horizontal */}
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
            {QUICK_ACTIONS.map(({ icon: Icon, label, onClick }) => (
              <button key={label} onClick={onClick} disabled={isLoading}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-stone-50 dark:bg-stone-800/40 border border-stone-200/60 dark:border-stone-700/30 text-[11px] text-slate-500 dark:text-stone-400 hover:border-orange-200 dark:hover:border-orange-800/40 hover:text-orange-500 dark:hover:text-orange-400 hover:bg-orange-50/50 dark:hover:bg-orange-900/10 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-[0.97] whitespace-nowrap shrink-0">
                <Icon size={11} />{label}
              </button>
            ))}
          </div>

          {/* Campo de texto libre para conversar con la IA */}
          <div className="flex items-center gap-2 bg-stone-50/80 dark:bg-stone-800/40 border border-stone-200/60 dark:border-stone-700/30 rounded-xl px-3.5 py-2.5">
            {/* Mientras se dicta mostramos un div con el texto confirmado + interim en gris */}
            {isListening ? (
              <div className="flex-1 text-[12px] leading-relaxed min-h-[18px]">
                <span className="text-slate-700 dark:text-stone-300">{input}</span>
                {interim && <span className="text-slate-400 dark:text-stone-500"> {interim}</span>}
                {!input && !interim && <span className="text-slate-400 dark:text-stone-500">Escuchando...</span>}
              </div>
            ) : (
              <input type="text" value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKeyDown}
                placeholder="Escribe tu pregunta..." disabled={isLoading}
                className="flex-1 bg-transparent text-[12px] text-slate-700 dark:text-stone-300 placeholder:text-slate-400 dark:placeholder:text-stone-500 outline-none" />
            )}
            {/* Botón de micrófono: icono naranja cuando activo, gris cuando inactivo */}
            <button onClick={toggleListening} disabled={isLoading} title={isListening ? 'Detener dictado' : 'Dictar mensaje'}
              className="flex items-center justify-center transition-all active:scale-95 shrink-0 disabled:opacity-40 disabled:cursor-not-allowed">
              <Mic size={13} className={isListening ? 'text-orange-500' : 'text-slate-400 dark:text-stone-500 hover:text-orange-400'} />
            </button>
            {/* Botón de envío */}
            <button onClick={sendMessage} disabled={!input.trim() || isLoading}
              className="w-6 h-6 flex items-center justify-center rounded-lg bg-orange-500 hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95 shrink-0">
              <Send size={11} className="text-white" />
            </button>
          </div>
        </div>
      </div>

      {/* Botón flotante de apertura/cierre del chat */}
      <button onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 z-[200] w-12 h-12 rounded-2xl flex items-center justify-center bg-white/90 dark:bg-stone-900/95 backdrop-blur-xl border border-orange-200/40 dark:border-orange-900/30 soft-shadow transition-all duration-300 active:scale-95 hover:scale-105">
        {/* Icono de chat — visible cuando el popup está cerrado */}
        <div className={`transition-all duration-300 ${isOpen ? 'scale-0 opacity-0 absolute' : 'scale-100 opacity-100'}`}>
          <MessageCircle size={18} className="text-orange-500" />
        </div>
        {/* Icono de X — visible cuando el popup está abierto */}
        <div className={`transition-all duration-300 ${isOpen ? 'scale-100 opacity-100' : 'scale-0 opacity-0 absolute'}`}>
          <X size={16} className="text-slate-500 dark:text-stone-400" />
        </div>
      </button>
    </>
  );
};

export default ChatBot;
