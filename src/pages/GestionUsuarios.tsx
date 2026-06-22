import React, { useState, useMemo, useEffect } from 'react';
import {
  Search,
  Plus,
  Trash2,
  Mail,
  Edit2,
  KeyRound,
  UserCheck,
  UserX,
  Eye,
  EyeOff,
  X,
  Check,
  AlertTriangle,
  Users,
  RotateCcw,
} from 'lucide-react';
import { useUndoToast } from '../context/UndoToastContext';
import { appsScriptApi, activityLogApi } from '../services/api';
import { supabase } from '../services/supabaseClient';
import { User, Worker, User as AppUserType } from '../services/mockData';

// ─── Types ───────────────────────────────────────────────────────────────────

type UserRole = 'admin' | 'editor' | 'viewer' | 'trabajador';
type UserStatus = 'active' | 'inactive' | 'pending';
type OnlineStatus = 'online' | 'working' | 'away' | 'offline';

interface AppUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  lastLogin: string | null;
  createdAt: string;
  avatar: string;
  avatarUrl?: string | null;
  onlineStatus: OnlineStatus;
  currentActivity?: string;
  sessionStart?: string;
  telefono?: string;
  // Campos sensibles (opcionales)
  dni?: string;
  home_address?: string;
  bank_account?: string;
  // Transitorio: id del trabajador al que se vincula la cuenta (solo al crear rol trabajador). No se persiste en profiles.
  assignedWorkerId?: string;
}

// ─── Mock data ────────────────────────────────────────────────────────────────
// Los usuarios se cargan en tiempo de ejecución desde Supabase (profiles table).

// ─── Online status config ─────────────────────────────────────────────────────

const onlineConfig: Record<OnlineStatus, { label: string; dot: string; text: string }> = {
  online:  { label: 'En línea',     dot: 'bg-green-500',                        text: 'text-green-600 dark:text-green-400' },
  working: { label: 'Trabajando',   dot: 'bg-orange-500',                       text: 'text-orange-500 dark:text-orange-400' },
  away:    { label: 'En línea',     dot: 'bg-green-500',                        text: 'text-green-600 dark:text-green-400' },
  offline: { label: 'Desconectado', dot: 'bg-slate-300 dark:bg-stone-600',      text: 'text-slate-400' },
};

// ─── WorkingBadge (igual que en AnalyticsCards) ───────────────────────────────

const WorkingBadge: React.FC = () => {
  const [step, setStep] = useState(1);
  useEffect(() => {
    const id = setInterval(() => setStep(s => (s === 3 ? 1 : s + 1)), 500);
    return () => clearInterval(id);
  }, []);
  return (
    <span className="inline-flex items-center text-[11px]">
      <span className="working-badge font-medium">
        Trabajando
        <span style={{ opacity: step >= 1 ? 1 : 0 }}>.</span>
        <span style={{ opacity: step >= 2 ? 1 : 0 }}>.</span>
        <span style={{ opacity: step >= 3 ? 1 : 0 }}>.</span>
      </span>
    </span>
  );
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const roleConfig: Record<UserRole, { label: string; color: string }> = {
  admin:  { label: 'Admin',  color: 'text-orange-600 dark:text-orange-400' },
  editor: { label: 'Editor', color: 'text-orange-400 dark:text-orange-300' },
  viewer: { label: 'Visor',  color: 'text-slate-400 dark:text-stone-500'   },
  trabajador: { label: 'Trabajador', color: 'text-blue-500 dark:text-blue-400' },
};

const statusConfig: Record<UserStatus, { label: string; color: string; dot: string }> = {
  active: { label: 'Activo', color: 'text-green-700 bg-green-50 dark:bg-green-900/20 dark:text-green-400', dot: 'bg-green-500' },
  inactive: { label: 'Inactivo', color: 'text-slate-500 bg-slate-100 dark:bg-stone-700 dark:text-stone-400', dot: 'bg-slate-400' },
  pending: { label: 'Pendiente', color: 'text-amber-600 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-400', dot: 'bg-amber-400' },
};

function formatDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatSessionDuration(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  const h = Math.floor(diff / 3600);
  const m = Math.floor((diff % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

// ─── UserModal ────────────────────────────────────────────────────────────────

interface UserModalProps {
  user: AppUser | null;
  onClose: () => void;
  onSave: (u: AppUser) => void;
}

// (kept for reference, not used directly)
const _EMPTY_USER: Omit<AppUser, 'id' | 'createdAt' | 'lastLogin' | 'avatar'> = {
  name: '', email: '', role: 'viewer', status: 'active', onlineStatus: 'offline',
};

// ─── Validaciones de DNI, NIE e IBAN ──────────────────────────────────────────

const validateDniNie = (value: string): { isValid: boolean; error?: string } => {
  const clean = value.trim().toUpperCase();
  if (!clean) return { isValid: false, error: 'El DNI / NIE es obligatorio para operarios' };

  const dniRegex = /^[0-9]{8}[TRWAGMYFPDXBNJZSQVHLCKE]$/i;
  const nieRegex = /^[XYZ][0-9]{7}[TRWAGMYFPDXBNJZSQVHLCKE]$/i;

  if (!dniRegex.test(clean) && !nieRegex.test(clean)) {
    return { isValid: false, error: 'Formato de DNI (12345678A) o NIE (X1234567L) no válido' };
  }

  // Verificar la letra de control por Módulo 23
  let tempDni = clean;
  if (nieRegex.test(clean)) {
    const niePrefixMap: Record<string, string> = { X: '0', Y: '1', Z: '2' };
    tempDni = niePrefixMap[clean[0]] + clean.slice(1);
  }

  const number = parseInt(tempDni.slice(0, 8), 10);
  const letter = tempDni.slice(-1);
  const letters = 'TRWAGMYFPDXBNJZSQVHLCKE';
  const expectedLetter = letters[number % 23];

  if (letter !== expectedLetter) {
    return { isValid: false, error: `La letra '${letter}' no corresponde al número (debería ser '${expectedLetter}')` };
  }

  return { isValid: true };
};

const validateIban = (value: string): { isValid: boolean; error?: string } => {
  const clean = value.replace(/\s+/g, '').toUpperCase();
  if (!clean) return { isValid: false, error: 'La cuenta bancaria (IBAN) es obligatoria para operarios' };

  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{12,30}$/.test(clean)) {
    return { isValid: false, error: 'Formato de cuenta bancaria (IBAN) no válido' };
  }

  // Módulo 97
  const rearranged = clean.slice(4) + clean.slice(0, 4);
  const digits = rearranged.split('').map(char => {
    const code = char.charCodeAt(0);
    if (code >= 65 && code <= 90) return String(code - 55); // A-Z a número
    return char;
  }).join('');

  let checksum = 0;
  for (let i = 0; i < digits.length; i++) {
    checksum = (checksum * 10 + parseInt(digits[i], 10)) % 97;
  }

  if (checksum !== 1) {
    return { isValid: false, error: 'El dígito de control del IBAN no es válido' };
  }

  return { isValid: true };
};

const UserModal: React.FC<UserModalProps> = ({ user, onClose, onSave }) => {
  const isNew = !user;
  const [form, setForm] = useState({
    name: user?.name ?? '',
    email: user?.email ?? '',
    role: (user?.role || 'viewer') as UserRole,
    status: (user?.status || 'active') as UserStatus,
    telefono: user?.telefono ?? '',
    dni: '',
    home_address: '',
    bank_account: '',
  });

  const [loadingSensitive, setLoadingSensitive] = useState(false);

  // Trabajadores sin cuenta asignada, para vincular al crear un usuario con rol trabajador.
  const [assignedWorkerId, setAssignedWorkerId] = useState('');
  const [unassignedWorkers, setUnassignedWorkers] = useState<Worker[]>([]);
  const [loadingWorkers, setLoadingWorkers] = useState(false);

  useEffect(() => {
    if (isNew && form.role === 'trabajador' && unassignedWorkers.length === 0) {
      setLoadingWorkers(true);
      // Un worker se considera disponible si su profileId está vacío O
      // si apunta a un perfil que ya no existe (huérfano por borrado manual en Supabase).
      Promise.all([
        appsScriptApi.getWorkers(),
        supabase.from('profiles').select('id'),
      ])
        .then(([ws, { data: profiles }]) => {
          const validIds = new Set((profiles || []).map((p: { id: string }) => p.id));
          setUnassignedWorkers(ws.filter(w => !w.profileId || !validIds.has(w.profileId)));
        })
        .catch(() => setUnassignedWorkers([]))
        .finally(() => setLoadingWorkers(false));
    }
  }, [isNew, form.role, unassignedWorkers.length]);

  const handleSelectWorker = (workerId: string) => {
    setAssignedWorkerId(workerId);
    const w = unassignedWorkers.find(x => x.id === workerId);
    if (w) {
      // Sólo rellena con los datos del worker los campos que el admin tenga vacíos.
      // Si ya hay algo escrito, se respeta para no sobrescribir cambios manuales.
      setForm(f => ({
        ...f,
        name: f.name || w.fullName || '',
        email: f.email || w.email || '',
        telefono: f.telefono || w.telefono || '',
        dni: f.dni || w.dni || '',
        bank_account: f.bank_account || w.iban || '',
      }));
    }
    setErrors(e => ({ ...e, assignedWorkerId: '' }));
  };

  useEffect(() => {
    if (user?.id) {
      setLoadingSensitive(true);
      appsScriptApi.getSensitiveData(user.id).then(data => {
        if (data) {
          // Formatear IBAN en bloques de 4 al cargar
          let rawBank = (data.bank_account || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
          const parts = rawBank.match(/.{1,4}/g) || [];
          const formattedBank = parts.join(' ');

          setForm(f => ({
            ...f,
            dni: (data.dni || '').toUpperCase().replace(/\s/g, ''),
            home_address: data.home_address || '',
            bank_account: formattedBank,
          }));
        }
      }).finally(() => setLoadingSensitive(false));
    }
  }, [user?.id]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = 'El nombre es obligatorio';
    if (!form.email.trim()) e.email = 'El email es obligatorio';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Email no válido';
    if (isNew && form.role === 'trabajador' && !assignedWorkerId) e.assignedWorkerId = 'Debes asignar un trabajador';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;
    const initials = (form.name || 'U').split(' ').filter(Boolean).map(w => w[0]).join('').toUpperCase().slice(0, 2) || 'U';
    onSave({
      id: user?.id ?? '', // Si es vacío, handleSave sabrá que es nuevo
      createdAt: user?.createdAt ?? new Date().toISOString().slice(0, 10),
      lastLogin: user?.lastLogin ?? null,
      avatar: initials,
      onlineStatus: user?.onlineStatus ?? 'offline',
      currentActivity: user?.currentActivity,
      sessionStart: user?.sessionStart,
      ...form,
      assignedWorkerId: assignedWorkerId || undefined,
    } as AppUser);
    onClose();
  };

  const inputClass = 'w-full px-3.5 py-2.5 rounded-xl bg-stone-50 dark:bg-stone-800/50 border border-slate-200 dark:border-stone-700 text-slate-800 dark:text-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400/50 transition';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      
      {/* Añadimos max-h-[90vh] y flex flex-col para scroll interno y evitar recortes de pantalla */}
      <div className="relative bg-white dark:bg-stone-900 rounded-2xl shadow-2xl w-full max-w-md flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95">
        
        {/* Cabecera fija */}
        <div className="flex items-center justify-between p-6 border-b border-stone-100 dark:border-stone-800 shrink-0">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-stone-100">
            {isNew ? 'Nuevo usuario' : 'Editar usuario'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-stone-200 transition">
            <X size={20} />
          </button>
        </div>

        {/* Cuerpo del formulario con scroll independiente */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-stone-400 mb-1.5">Nombre completo</label>
            <input className={`${inputClass} ${errors.name ? 'border-red-400 focus:ring-red-400/50' : ''}`} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ej: María López" />
            {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-stone-400 mb-1.5">Email</label>
            <input className={`${inputClass} ${errors.email ? 'border-red-400' : ''}`} value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="usuario@rh.local" type="email" />
            {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-stone-400 mb-1.5">Teléfono</label>
            <input 
              className={`${inputClass} ${errors.telefono ? 'border-red-400 focus:ring-red-400/50' : ''}`} 
              value={form.telefono} 
              onChange={e => {
                let input = e.target.value;
                let digits = input.replace(/\D/g, '');
                
                if (input === '') {
                  setForm(f => ({ ...f, telefono: '' }));
                  return;
                }

                // Detectar si debe llevar el prefijo +34
                let hasPrefix = input.startsWith('+34') || digits.startsWith('34');
                let mainNumber = digits;
                if (digits.startsWith('34')) mainNumber = digits.slice(2);
                
                // Limitar a 9 dígitos de número
                mainNumber = mainNumber.slice(0, 9);
                
                // Formatear en bloques 3-2-2-2 (ej. 697 60 97 56)
                let formatted = '';
                if (mainNumber.length > 0) {
                  formatted += mainNumber.substring(0, 3);
                  if (mainNumber.length > 3) formatted += ' ' + mainNumber.substring(3, 5);
                  if (mainNumber.length > 5) formatted += ' ' + mainNumber.substring(5, 7);
                  if (mainNumber.length > 7) formatted += ' ' + mainNumber.substring(7, 9);
                }

                const finalValue = (hasPrefix ? '+34 ' : '') + formatted;
                setForm(f => ({ ...f, telefono: finalValue }));
              }} 
              placeholder="+34 600 000 000" 
            />
            {errors.telefono && <p className="text-xs text-red-500 mt-1">{errors.telefono}</p>}
          </div>

          {form.role === 'trabajador' && isNew && (
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-stone-400 mb-1.5">Asignar a trabajador</label>
              <select
                className={`${inputClass} ${errors.assignedWorkerId ? 'border-red-400' : ''}`}
                value={assignedWorkerId}
                onChange={e => handleSelectWorker(e.target.value)}
                disabled={loadingWorkers}
              >
                <option value="">{loadingWorkers ? 'Cargando trabajadores...' : 'Selecciona un trabajador sin cuenta'}</option>
                {unassignedWorkers.map(w => (
                  <option key={w.id} value={w.id}>
                    {w.fullName}{w.telefono ? ` · ${w.telefono}` : ''}
                  </option>
                ))}
              </select>
              {errors.assignedWorkerId && <p className="text-xs text-red-500 mt-1">{errors.assignedWorkerId}</p>}
              {!loadingWorkers && unassignedWorkers.length === 0 && (
                <p className="text-xs text-amber-500 mt-1">Todos los trabajadores ya tienen cuenta asignada.</p>
              )}
            </div>
          )}

          {form.role === 'trabajador' && !isNew && (
            <div className="border-t border-slate-100 dark:border-stone-800 pt-4 mt-2">
              <h3 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-3">Datos Sensibles (Privado)</h3>
              {loadingSensitive ? (
                <div className="py-4 text-center text-xs text-slate-400">Cargando datos seguros...</div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-500 dark:text-stone-400 mb-1.5">DNI / NIE</label>
                    <input 
                      className={`${inputClass} ${errors.dni ? 'border-red-400 focus:ring-red-400/50' : ''} uppercase`} 
                      value={form.dni} 
                      onChange={e => setForm(f => ({ ...f, dni: e.target.value.toUpperCase().replace(/\s/g, '') }))} 
                      placeholder="12345678X" 
                      maxLength={9}
                    />
                    {errors.dni && <p className="text-xs text-red-500 mt-1">{errors.dni}</p>}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 dark:text-stone-400 mb-1.5">Dirección de casa</label>
                    <input className={inputClass} value={form.home_address} onChange={e => setForm(f => ({ ...f, home_address: e.target.value }))} placeholder="Calle Ejemplo, 12, Madrid" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 dark:text-stone-400 mb-1.5">Cuenta Bancaria (IBAN)</label>
                    <input 
                      className={`${inputClass} ${errors.bank_account ? 'border-red-400 focus:ring-red-400/50' : ''} uppercase font-mono`} 
                      value={form.bank_account} 
                      onChange={e => {
                        // Formatear automáticamente en bloques de 4 limitando a un máximo de 24 caracteres (estándar español)
                        let val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
                        if (val.length > 24) val = val.slice(0, 24);
                        const parts = val.match(/.{1,4}/g) || [];
                        const formatted = parts.join(' ');
                        setForm(f => ({ ...f, bank_account: formatted }));
                      }} 
                      placeholder="ES00 0000 0000..." 
                      maxLength={29}
                    />
                    {errors.bank_account && <p className="text-xs text-red-500 mt-1">{errors.bank_account}</p>}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-stone-400 mb-1.5">Rol</label>
              <select className={inputClass} value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value as UserRole }))}>
                <option value="admin">Admin</option>
                <option value="editor">Editor</option>
                <option value="viewer">Visor</option>
                <option value="trabajador">Trabajador</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-stone-400 mb-1.5">Estado</label>
              <select className={inputClass} value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as UserStatus }))}>
                <option value="active">Activo</option>
                <option value="inactive">Inactivo</option>
                <option value="pending">Pendiente</option>
              </select>
            </div>
          </div>
        </div>

        {/* Pie fijo de botones */}
        <div className="p-6 border-t border-slate-100 dark:border-stone-800 flex gap-3 shrink-0">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-stone-700 text-slate-600 dark:text-stone-300 text-sm hover:bg-slate-50 dark:hover:bg-stone-800 transition">Cancelar</button>
          <button onClick={handleSubmit} className="flex-1 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium transition">
            {isNew ? 'Crear usuario' : 'Guardar cambios'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── PasswordModal ────────────────────────────────────────────────────────────

interface PasswordModalProps {
  user: AppUser;
  onClose: () => void;
}

const PasswordModal: React.FC<PasswordModalProps> = ({ user, onClose }) => {
  const [sent, setSent] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [newPwd, setNewPwd] = useState('');
  const [showPwd, setShowPwd] = useState(false);

  const handleSendEmail = () => { setSent(true); };

  const inputClass = 'w-full px-3.5 py-2.5 rounded-xl bg-stone-50 dark:bg-stone-800/50 border border-slate-200 dark:border-stone-700 text-slate-800 dark:text-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400/50 transition';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-stone-900 rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-stone-100">Gestionar contraseña</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition"><X size={20} /></button>
        </div>

        <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-stone-800">
          <div className="w-9 h-9 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center text-orange-600 font-semibold text-sm overflow-hidden">
            {user.avatarUrl ? (
              <img src={user.avatarUrl} alt={user.name} className="w-full h-full object-cover" />
            ) : (
              user.avatar
            )}
          </div>
          <div>
            <p className="text-sm font-medium text-slate-800 dark:text-stone-200">{user.name}</p>
            <p className="text-xs text-slate-400">{user.email}</p>
          </div>
        </div>

        {!sent ? (
          <div className="space-y-3">
            <button
              onClick={handleSendEmail}
              className="w-full flex items-center gap-3 p-3.5 rounded-xl border border-slate-200 dark:border-stone-700 hover:border-orange-300 hover:bg-orange-50 dark:hover:bg-orange-900/10 transition group"
            >
              <Mail size={18} className="text-slate-400 group-hover:text-orange-500 transition" />
              <div className="text-left">
                <p className="text-sm font-medium text-slate-700 dark:text-stone-300">Enviar enlace de recuperación</p>
                <p className="text-xs text-slate-400">Se enviará un email a {user.email}</p>
              </div>
            </button>

            <button
              onClick={() => setShowManual(m => !m)}
              className="w-full flex items-center gap-3 p-3.5 rounded-xl border border-slate-200 dark:border-stone-700 hover:border-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/10 transition group"
            >
              <KeyRound size={18} className="text-slate-400 group-hover:text-blue-500 transition" />
              <div className="text-left">
                <p className="text-sm font-medium text-slate-700 dark:text-stone-300">Establecer contraseña manualmente</p>
                <p className="text-xs text-slate-400">Define una nueva contraseña directamente</p>
              </div>
            </button>

            {showManual && (
              <div className="space-y-2 pt-1">
                <div className="relative">
                  <input
                    type={showPwd ? 'text' : 'password'}
                    className={inputClass}
                    placeholder="Nueva contraseña"
                    value={newPwd}
                    onChange={e => setNewPwd(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <button
                  onClick={() => { setSent(true); }}
                  disabled={newPwd.length < 8}
                  className="w-full py-2.5 rounded-xl bg-blue-500 hover:bg-blue-600 disabled:opacity-40 text-white text-sm font-medium transition"
                >
                  Guardar contraseña
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 py-4">
            <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <Check size={24} className="text-green-600" />
            </div>
            <p className="text-sm text-slate-700 dark:text-stone-300 text-center font-medium">Operación completada</p>
            <p className="text-xs text-slate-400 text-center">La contraseña ha sido actualizada correctamente.</p>
            <button onClick={onClose} className="mt-2 px-6 py-2 rounded-xl bg-slate-100 dark:bg-stone-800 text-slate-700 dark:text-stone-200 text-sm hover:bg-slate-200 transition">Cerrar</button>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── DeleteConfirmModal ───────────────────────────────────────────────────────

interface DeleteConfirmModalProps {
  user: AppUser;
  onClose: () => void;
  onConfirm: () => void;
}

const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({ user, onClose, onConfirm }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
    <div className="relative bg-white dark:bg-stone-900 rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-5">
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center shrink-0">
          <AlertTriangle size={20} className="text-red-500" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-slate-800 dark:text-stone-100">Eliminar usuario</h2>
          <p className="text-sm text-slate-500 dark:text-stone-400 mt-1">
            ¿Estás seguro de que quieres eliminar a <span className="font-medium text-slate-700 dark:text-stone-300">{user.name}</span>? Esta acción no se puede deshacer.
          </p>
        </div>
      </div>
      <div className="flex gap-3">
        <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-stone-700 text-slate-600 dark:text-stone-300 text-sm hover:bg-slate-50 dark:hover:bg-stone-800 transition">Cancelar</button>
        <button onClick={() => { onConfirm(); onClose(); }} className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-medium transition">Eliminar</button>
      </div>
    </div>
  </div>
);

// ─── UserRow ──────────────────────────────────────────────────────────────────

interface UserRowProps {
  user: AppUser;
  onEdit: (u: AppUser) => void;
  onDelete: (u: AppUser) => void;
  onPassword: (u: AppUser) => void;
  onToggleStatus: (u: AppUser) => void;
  onResend: (u: AppUser) => void;
}

const UserRow: React.FC<UserRowProps> = ({ user, onEdit, onDelete, onPassword, onToggleStatus, onResend }) => {
  const { label: roleLabel, color: roleColor } = roleConfig[user.role];
  const { dot: onlineDot } = onlineConfig[user.onlineStatus];
  const isConnected = user.onlineStatus !== 'offline';
  const isWorking = user.onlineStatus === 'working';

  return (
    <li className="group grid grid-cols-[minmax(0,1fr)_100px] sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_100px] md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_120px] gap-4 items-center px-5 sm:px-8 py-4 hover:bg-stone-100/50 dark:hover:bg-stone-700/30 transition-colors">

      {/* Nombre */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="relative shrink-0">
          <div className="w-7 h-7 rounded-full bg-white dark:bg-stone-800 soft-shadow flex items-center justify-center text-xs font-normal text-slate-500 dark:text-stone-400 overflow-hidden">
            {user.avatarUrl ? (
              <img src={user.avatarUrl} alt={user.name} className="w-full h-full object-cover" />
            ) : (
              user.avatar
            )}
          </div>
          <span className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border-2 border-white dark:border-stone-900 ${onlineDot}`} />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <p className="text-sm text-slate-800 dark:text-stone-200 truncate">{user.name}</p>
            <span className={`sm:hidden flex-shrink-0 text-[10px] ${roleColor}`}>{roleLabel}</span>
          </div>
          <p className="text-xs text-slate-400 dark:text-stone-500 truncate">{user.email}</p>
          {/* Mobile presence */}
          <div className="flex items-center gap-1.5 mt-0.5 md:hidden">
            {isWorking && <WorkingBadge />}
            {isConnected && !isWorking && (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-green-600 dark:text-green-400">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />En línea
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Rol */}
      <div className="hidden sm:flex">
        <span className={`text-xs ${roleColor}`}>{roleLabel}</span>
      </div>

      {/* Actividad */}
      <div className="hidden md:flex flex-col gap-0.5">
        {isConnected ? (
          <>
            {isWorking ? (
              <WorkingBadge />
            ) : (
              <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-green-600 dark:text-green-400">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />En línea
              </span>
            )}
            {user.currentActivity && (
              <span className="text-xs text-slate-400 dark:text-stone-500">{user.currentActivity}</span>
            )}
          </>
        ) : (
          <span className="text-xs text-slate-400 dark:text-stone-500">—</span>
        )}
      </div>

      {/* Acciones */}
      <div className="flex items-center justify-end gap-1">
        <button onClick={() => onResend(user)} title="Reenviar correo de recuperación" className="w-7 h-7 flex items-center justify-center rounded-md text-slate-400 dark:text-stone-500 hover:text-amber-500 dark:hover:text-amber-400 transition-colors">
          <RotateCcw size={14} />
        </button>
        <button onClick={() => onEdit(user)} title="Editar" className="w-7 h-7 flex items-center justify-center rounded-md text-slate-400 dark:text-stone-500 hover:text-orange-500 dark:hover:text-orange-400 transition-colors">
          <Edit2 size={14} />
        </button>
        <button onClick={() => onDelete(user)} title="Eliminar" className="w-7 h-7 flex items-center justify-center rounded-md text-slate-400 dark:text-stone-500 hover:text-red-500 transition-colors">
          <Trash2 size={14} />
        </button>
      </div>
    </li>
  );
};

interface GestionUsuariosProps {
  user: User;
}

const GestionUsuarios: React.FC<GestionUsuariosProps> = ({ user }) => {
  const { showUndoToast } = useUndoToast();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const supabaseUsers = await appsScriptApi.getAllUsers();
      const mapped = supabaseUsers.map(u => ({
        ...u,
        // Sin last_seen = nunca entró = invitación no aceptada todavía.
        status: (u.last_seen ? 'active' : 'pending') as UserStatus,
        createdAt: new Date().toISOString(),
        lastLogin: u.last_seen ?? null,
        avatar: u.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2),
        avatarUrl: u.avatar_url || null,
        onlineStatus: 'offline' as OnlineStatus,
      }));
      setUsers(mapped as AppUser[]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState<UserRole | 'all'>('all');

  const [modalUser, setModalUser] = useState<AppUser | null | undefined>(undefined); // undefined = closed, null = new
  const [passwordUser, setPasswordUser] = useState<AppUser | null>(null);
  const [deleteUser, setDeleteUser] = useState<AppUser | null>(null);

  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const filtered = useMemo(() => {
    return users.filter(u => {
      const matchSearch = u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase());
      const matchRole = filterRole === 'all' || u.role === filterRole;
      return matchSearch && matchRole;
    });
  }, [users, search, filterRole]);

  const stats = useMemo(() => ({
    total: users.length,
    active: users.filter(u => u.status === 'active').length,
    admins: users.filter(u => u.role === 'admin').length,
    online: users.filter(u => u.onlineStatus !== 'offline').length,
  }), [users]);

  const onlineUsers = useMemo(() =>
    users.filter(u => u.onlineStatus !== 'offline')
      .sort((a, b) => {
        const order: OnlineStatus[] = ['working', 'online', 'away'];
        return order.indexOf(a.onlineStatus) - order.indexOf(b.onlineStatus);
      }),
  [users]);

  // Tick every minute to refresh session durations
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  const handleSave = async (u: AppUser) => {
    const isNew = !u.id;
    try {
      let targetId = u.id;

      if (isNew) {
        // 1. Invitar al usuario vía Google Apps Script
        const inviteResult = await appsScriptApi.inviteUser(u.email, {
          full_name: u.name,
          role: u.role,
          phone: u.telefono || '',
          dni: u.dni || '',
          home_address: u.home_address || '',
          bank_account: u.bank_account || ''
        } as any);

        if (!inviteResult.ok) {
          throw new Error('No se pudo crear el usuario. ' + (inviteResult.error || ''));
        }

        const newProfileId = inviteResult.id;

        // Log action: Crear usuario
        await activityLogApi.log(
          user.id || null,
          user.name || 'Usuario',
          `Creó el usuario/trabajador "${u.name}" con rol "${u.role}"`,
          'crear_usuario'
        );

        showToast(`Usuario creado. Contraseña por defecto: Rentalholidays0211`);

        // 2. Si es trabajador, vincular su ficha con la cuenta recién creada.
        if (u.role === 'trabajador' && u.assignedWorkerId && newProfileId) {
          try {
            await appsScriptApi.linkWorkerProfile(u.assignedWorkerId, newProfileId);
            await appsScriptApi.updateSensitiveData(newProfileId, {
              dni: u.dni,
              home_address: u.home_address,
              bank_account: u.bank_account,
            });
          } catch (linkErr) {
            console.error('Error al vincular trabajador con la cuenta:', linkErr);
            showToast('Cuenta creada, pero falló el vínculo con el trabajador.');
          }
        }

        // 3. Recargar la lista completa desde Supabase
        setTimeout(() => {
          loadUsers();
          setModalUser(undefined);
        }, 800);

        return;
      }
      
      // MODO EDICIÓN
      // Usar targetId (u.id) para asegurar que no sea undefined
      if (targetId) {
        // 2. Guardar/Actualizar Perfil
        await appsScriptApi.updateProfile(targetId, {
          email: u.email,
          name: u.name,
          role: u.role,
          telefono: u.telefono
        });

        // 3. Guardar Datos Sensibles
        await appsScriptApi.updateSensitiveData(targetId, {
          dni: u.dni,
          home_address: u.home_address,
          bank_account: u.bank_account
        });

        // Log action: Modificar usuario
        await activityLogApi.log(
          user.id || null,
          user.name || 'Usuario',
          `Modificó los datos del usuario "${u.name}"`,
          'editar_usuario'
        );

        setUsers(prev => prev.map(p => p.id === targetId ? { ...p, ...u, avatarUrl: p.avatarUrl } : p));
        showToast('Usuario actualizado correctamente');
      }
    } catch (error: any) {
      console.error('Error al guardar usuario:', error);
      showToast(error.message || 'Error al guardar los cambios');
    }
  };

  const handleDelete = async (u: AppUser) => {
    try {
      // 1. Desvincular trabajador (evita violar FK workers.profile_id -> profiles.id).
      await appsScriptApi.unlinkWorkerByProfile(u.id);
      // 2. Borrar datos sensibles (FK al perfil) y luego el perfil. Detecta RLS si borra 0 filas.
      await appsScriptApi.deleteSensitiveData(u.id);
      await appsScriptApi.deleteProfile(u.id);

      // Log action: Eliminar usuario
      await activityLogApi.log(
        user.id || null,
        user.name || 'Usuario',
        `Eliminó al usuario "${u.name}" del sistema`,
        'eliminar_usuario'
      );

      showToast('Usuario eliminado correctamente');
      // 3. Recargar desde Supabase para reflejar el estado real, no un filter optimista.
      await loadUsers();
    } catch (error: any) {
      console.error('Error al eliminar usuario:', error);
      showToast(error?.message || 'Error al eliminar el usuario');
    }
  };

  const handleResend = async (u: AppUser) => {
    const res = await appsScriptApi.resendInvitation(u.email);
    if (res.ok) {
      showToast(`Enviado a ${u.email}: acceso + recuperación de contraseña`);
    } else {
      showToast(`No se pudo enviar: ${res.error || 'error desconocido'}`);
    }
  };

  const handleToggleStatus = (u: AppUser) => {
    const next: UserStatus = u.status === 'active' ? 'inactive' : 'active';
    setUsers(prev => prev.map(p => p.id === u.id ? { ...p, status: next } : p));
    showToast(`Usuario ${next === 'active' ? 'activado' : 'desactivado'}`);
  };

  const pillClass = (active: boolean) =>
    `px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${active ? 'bg-orange-500 text-white shadow-sm' : 'bg-slate-100 dark:bg-stone-800 text-slate-500 dark:text-stone-400 hover:bg-slate-200 dark:hover:bg-stone-700'}`;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-700">

      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 bg-stone-900 dark:bg-white text-white dark:text-stone-900 rounded-xl shadow-xl text-sm font-medium">
          <Check size={16} className="text-green-400 dark:text-green-600" />
          {toast}
        </div>
      )}

      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 px-1">
        <h1 className="text-xl font-normal text-slate-800 dark:text-stone-200 tracking-tight font-display shrink-0">
          Gestión de usuarios
        </h1>

        <div className="flex flex-col md:flex-row gap-3 justify-end items-center flex-1">
          <div className="relative w-full md:w-72">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-stone-500 pointer-events-none" size={14} />
            <input
              type="text"
              placeholder="Buscar usuario..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-white/40 dark:bg-stone-900/40 backdrop-blur-md border border-white/60 dark:border-stone-700/50 rounded-xl text-slate-700 dark:text-stone-300 text-xs font-normal placeholder:text-slate-400 dark:placeholder:text-stone-500 focus:outline-none transition-all hover:bg-white/80 dark:hover:bg-stone-800/60 focus:bg-white dark:focus:bg-stone-900"
            />
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:flex-none">
              <select
                value={filterRole}
                onChange={e => setFilterRole(e.target.value as UserRole | 'all')}
                className="w-full appearance-none pl-4 pr-8 py-2.5 bg-white dark:bg-stone-900 backdrop-blur-md border border-white/60 dark:border-stone-700/50 rounded-xl text-xs font-normal text-slate-600 dark:text-stone-400 focus:outline-none transition-all hover:bg-white/80 cursor-pointer"
              >
                <option value="all">Todos los roles</option>
                <option value="admin">Admin</option>
                <option value="editor">Editor</option>
                <option value="viewer">Visor</option>
                <option value="trabajador">Trabajador</option>
              </select>
              <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-[10px]">▾</span>
            </div>

            <button
              onClick={() => setModalUser(null)}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-2.5 bg-orange-600 dark:bg-orange-600/90 hover:bg-orange-700 dark:hover:bg-orange-500 text-white rounded-xl text-xs font-medium transition-all shadow-lg shadow-orange-600/10 active:scale-[0.98]"
            >
              <Plus size={14} />
              Nuevo usuario
            </button>
          </div>
        </div>
      </header>

      {/* Online presence panel */}
      {onlineUsers.length > 0 && (
        <div className="bg-white/80 dark:bg-stone-900 backdrop-blur-md border border-white/60 dark:border-stone-700/50 rounded-2xl mb-4 overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100 dark:border-stone-800">
            <h3 className="text-base font-normal font-display tracking-tight text-slate-800 dark:text-stone-200">Conectados ahora</h3>
            <span className="text-xs text-slate-400 dark:text-stone-500">{onlineUsers.length} usuarios</span>
          </div>
          <ul className="divide-y divide-stone-100 dark:divide-stone-800">
            {onlineUsers.map(u => {
              const { dot } = onlineConfig[u.onlineStatus];
              const isWorking = u.onlineStatus === 'working';
              return (
                <li key={u.id} className="flex items-center gap-3 px-6 py-3">
                  <div className="relative shrink-0">
                    <div className="w-7 h-7 rounded-full bg-white dark:bg-stone-800 soft-shadow flex items-center justify-center text-xs font-normal text-slate-500 dark:text-stone-400 overflow-hidden">
                      {u.avatarUrl ? (
                        <img src={u.avatarUrl} alt={u.name} className="w-full h-full object-cover" />
                      ) : (
                        u.avatar
                      )}
                    </div>
                    <span className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border-2 border-white dark:border-stone-900 ${dot}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-slate-800 dark:text-stone-200">{u.name}</p>
                    {u.currentActivity && (
                      <p className="text-xs text-slate-400 dark:text-stone-500 truncate">{u.currentActivity}</p>
                    )}
                  </div>
                  <div className="shrink-0">
                    {isWorking ? (
                      <WorkingBadge />
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-green-600 dark:text-green-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                        En línea{u.sessionStart ? ` · ${formatSessionDuration(u.sessionStart)}` : ''}
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Table card */}
      <div className="bg-white/80 dark:bg-stone-900 backdrop-blur-md border border-white/60 dark:border-stone-700/50 rounded-2xl overflow-hidden mb-4">

        {/* Column headers */}
        <div className="grid grid-cols-[minmax(0,1fr)_100px] sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_100px] md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_120px] gap-4 px-5 sm:px-8 py-3 border-b border-stone-100 dark:border-stone-800">
          <span className="text-xs text-slate-400 dark:text-stone-500">Nombre</span>
          <span className="text-xs text-slate-400 dark:text-stone-500 hidden sm:block">Rol</span>
          <span className="text-xs text-slate-400 dark:text-stone-500 hidden md:block">Actividad</span>
          <span />
        </div>

        {/* Rows */}
        <ul className="divide-y divide-stone-100 dark:divide-stone-800">
          {filtered.length === 0 ? (
            <li className="flex items-center justify-center px-8 py-12">
              <span className="text-xs text-slate-400 dark:text-stone-500">Sin resultados</span>
            </li>
          ) : (
            filtered.map(u => (
              <UserRow
                key={u.id}
                user={u}
                onEdit={u => setModalUser(u)}
                onDelete={u => setDeleteUser(u)}
                onPassword={u => setPasswordUser(u)}
                onToggleStatus={handleToggleStatus}
                onResend={handleResend}
              />
            ))
          )}
        </ul>

        <div className="px-8 py-3 border-t border-stone-100 dark:border-stone-800">
          <span className="text-xs text-slate-400 dark:text-stone-500">{filtered.length} de {users.length} usuarios</span>
        </div>
      </div>

      {/* Modals */}
      {modalUser !== undefined && (
        <UserModal
          user={modalUser}
          onClose={() => setModalUser(undefined)}
          onSave={handleSave}
        />
      )}
      {passwordUser && (
        <PasswordModal user={passwordUser} onClose={() => setPasswordUser(null)} />
      )}
      {deleteUser && (
        <DeleteConfirmModal
          user={deleteUser}
          onClose={() => setDeleteUser(null)}
          onConfirm={() => handleDelete(deleteUser)}
        />
      )}
    </div>
  );
};

export default GestionUsuarios;
