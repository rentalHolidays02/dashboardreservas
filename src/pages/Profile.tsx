import React, { useState, useEffect } from 'react';
import {
  User,
  Mail,
  Shield,
  KeyRound,
  Moon,
  Sun,
  Check,
  Eye,
  EyeOff,
  LogOut,
  Activity,
  Lock,
  ChevronRight,
  Pencil,
  X,
  Save,
  AlertTriangle,
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { activityLogApi, ActivityLog } from '../services/api';

import type { User as AppUser } from '../services/mockData';

interface ProfileProps {
  user: AppUser;
  onLogout: () => void;
}

const ROLE_LABEL: Record<string, string> = {
  admin: 'Administrador',
  viewer: 'Visualizador',
  editor: 'Editor',
  trabajador: 'Trabajador',
};

const ROLE_COLOR: Record<string, string> = {
  admin: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  editor: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  viewer: 'bg-slate-100 text-slate-600 dark:bg-stone-800 dark:text-stone-400',
  trabajador: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
};

function formatActivityTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);

  if (diffMins < 1) return 'Ahora mismo';
  if (diffMins < 60) return `Hace ${diffMins} min`;
  if (diffHours < 24) return `Hace ${diffHours} h`;
  
  return date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

const Profile: React.FC<ProfileProps> = ({ user, onLogout }) => {
  const { theme, toggleTheme } = useTheme();

  // Edit name state
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(user.name);
  const [savedName, setSavedName] = useState(user.name);

  // Password change state
  const [pwSection, setPwSection] = useState(false);
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [pwSaved, setPwSaved] = useState(false);
  const [pwError, setPwError] = useState('');

  // Actividades reales
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [loadingActivities, setLoadingActivities] = useState(true);

  useEffect(() => {
    const fetchActivities = async () => {
      try {
        const data = await activityLogApi.getLatest(10);
        setActivities(data);
      } catch (err) {
        console.error('Error fetching activities:', err);
      } finally {
        setLoadingActivities(false);
      }
    };
    fetchActivities();
  }, []);

  const initials = savedName
    .split(' ')
    .map((w) => w.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ]/g, '')) // Limpiar caracteres especiales
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase() || 'U';

  const handleSaveName = () => {
    if (nameValue.trim()) {
      setSavedName(nameValue.trim());
      setEditingName(false);
    }
  };

  const handleCancelName = () => {
    setNameValue(savedName);
    setEditingName(false);
  };

  const handleSavePassword = () => {
    setPwError('');
    if (!currentPw) { setPwError('Introduce tu contraseña actual.'); return; }
    if (newPw.length < 6) { setPwError('La nueva contraseña debe tener al menos 6 caracteres.'); return; }
    if (newPw !== confirmPw) { setPwError('Las contraseñas no coinciden.'); return; }
    setPwSaved(true);
    setCurrentPw(''); setNewPw(''); setConfirmPw('');
    setTimeout(() => { setPwSaved(false); setPwSection(false); }, 2000);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-10">

      {/* ── Page header ── */}
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 px-1 mb-2">
        <h1 className="text-xl font-normal text-slate-800 dark:text-stone-200 tracking-tight font-display shrink-0">
          Mi perfil
        </h1>
      </header>

      {/* ── Top card: avatar + info ── */}
      <div className="bg-white/80 dark:bg-stone-900 backdrop-blur-md border border-white/60 dark:border-stone-700/50 rounded-2xl overflow-hidden">


        <div className="px-6 py-6">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            {/* Avatar */}
            <div className="flex items-end gap-4">
              <div className="w-20 h-20 rounded-2xl bg-stone-100 dark:bg-orange-900/30 flex items-center justify-center text-orange-600 dark:text-orange-400 text-lg font-normal transition-colors">
                {initials}
              </div>
              <div className="mb-1">
                {editingName ? (
                  <div className="flex items-center gap-2">
                    <input
                      autoFocus
                      value={nameValue}
                      onChange={(e) => setNameValue(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleSaveName(); if (e.key === 'Escape') handleCancelName(); }}
                      className="text-lg font-semibold bg-transparent border-b-2 border-orange-400 outline-none text-slate-800 dark:text-stone-100 w-48"
                    />
                    <button onClick={handleSaveName} className="p-1 text-orange-500 hover:text-orange-600 transition-colors"><Save size={16} /></button>
                    <button onClick={handleCancelName} className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-stone-300 transition-colors"><X size={16} /></button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-semibold text-slate-800 dark:text-stone-100 leading-tight">{savedName}</h2>
                    <button
                      onClick={() => setEditingName(true)}
                      className="p-1 text-slate-300 hover:text-orange-500 dark:text-stone-600 dark:hover:text-orange-400 transition-colors"
                    >
                      <Pencil size={14} />
                    </button>
                  </div>
                )}
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${ROLE_COLOR[user.role]}`}>
                    {ROLE_LABEL[user.role] ?? user.role}
                  </span>
                  <span className="flex items-center gap-1 text-xs text-emerald-500">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-pulse" />
                    En línea
                  </span>
                </div>
              </div>
            </div>

            {/* Quick info + logout */}
            <div className="flex flex-col gap-2">
              <div className="flex flex-col gap-1 text-sm text-slate-500 dark:text-stone-400">
                <span className="flex items-center gap-2">
                  <Mail size={13} className="text-slate-400" />
                  {user.email}
                </span>

              </div>
              <button
                onClick={onLogout}
                className="flex items-center gap-1.5 self-start px-3 py-1.5 rounded-lg border border-red-200 dark:border-red-800/50 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-xs font-medium"
              >
                <LogOut size={13} />
                Cerrar sesión
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Two-column grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* LEFT column (2/3) */}
        <div className="lg:col-span-2 space-y-6">

          {/* Security card */}
          <section className="bg-white/80 dark:bg-stone-900 backdrop-blur-md border border-white/60 dark:border-stone-700/50 rounded-2xl overflow-hidden">
            <div className="module-header">
              <div className="flex items-center gap-2">
                <Lock size={15} className="text-orange-500" />
                <span className="text-sm font-medium text-slate-700 dark:text-stone-200">Seguridad</span>
              </div>
            </div>

            <div className="divide-y divide-stone-100 dark:divide-stone-800">
              {/* Change password row */}
              <div>
                <button
                  onClick={() => { setPwSection((v) => !v); setPwError(''); }}
                  className="flex items-center justify-between w-full px-5 py-4 hover:bg-slate-50/50 dark:hover:bg-stone-800/30 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-lg bg-stone-50 dark:bg-stone-800 flex items-center justify-center">
                      <KeyRound size={15} className="text-orange-500" />
                    </span>
                    <div className="text-left">
                      <p className="text-sm font-medium text-slate-700 dark:text-stone-200">Cambiar contraseña</p>
                      <p className="text-xs text-slate-400 dark:text-stone-500">Última vez hace 30 días</p>
                    </div>
                  </div>
                  <ChevronRight size={16} className={`text-slate-300 dark:text-stone-600 transition-transform duration-200 ${pwSection ? 'rotate-90' : ''}`} />
                </button>

                {pwSection && (
                  <div className="px-5 pb-5 pt-1 space-y-3">
                    {/* Current password */}
                    <div className="relative">
                      <input
                        type={showCurrentPw ? 'text' : 'password'}
                        placeholder="Contraseña actual"
                        value={currentPw}
                        onChange={(e) => setCurrentPw(e.target.value)}
                        className="w-full text-sm bg-stone-50/50 dark:bg-stone-800/50 border border-stone-200/60 dark:border-stone-700/50 rounded-lg px-4 py-2.5 pr-10 outline-none focus:border-orange-400 dark:focus:border-orange-500 text-slate-700 dark:text-stone-200 placeholder-slate-300 dark:placeholder-stone-600 transition-colors"
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrentPw((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-stone-300"
                      >
                        {showCurrentPw ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                    {/* New password */}
                    <div className="relative">
                      <input
                        type={showNewPw ? 'text' : 'password'}
                        placeholder="Nueva contraseña"
                        value={newPw}
                        onChange={(e) => setNewPw(e.target.value)}
                        className="w-full text-sm bg-stone-50/50 dark:bg-stone-800/50 border border-stone-200/60 dark:border-stone-700/50 rounded-lg px-4 py-2.5 pr-10 outline-none focus:border-orange-400 dark:focus:border-orange-500 text-slate-700 dark:text-stone-200 placeholder-slate-300 dark:placeholder-stone-600 transition-colors"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPw((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-stone-300"
                      >
                        {showNewPw ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                    {/* Confirm */}
                    <input
                      type="password"
                      placeholder="Confirmar nueva contraseña"
                      value={confirmPw}
                      onChange={(e) => setConfirmPw(e.target.value)}
                      className="w-full text-sm bg-stone-50/50 dark:bg-stone-800/50 border border-stone-200/60 dark:border-stone-700/50 rounded-lg px-4 py-2.5 outline-none focus:border-orange-400 dark:focus:border-orange-500 text-slate-700 dark:text-stone-200 placeholder-slate-300 dark:placeholder-stone-600 transition-colors"
                    />

                    {pwError && (
                      <p className="text-xs text-red-500 flex items-center gap-1.5">
                        <AlertTriangle size={12} /> {pwError}
                      </p>
                    )}
                    {pwSaved && (
                      <p className="text-xs text-emerald-500 flex items-center gap-1.5">
                        <Check size={12} /> Contraseña actualizada correctamente
                      </p>
                    )}

                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={handleSavePassword}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-xs font-medium transition-colors"
                      >
                        <Save size={13} /> Guardar
                      </button>
                      <button
                        onClick={() => { setPwSection(false); setCurrentPw(''); setNewPw(''); setConfirmPw(''); setPwError(''); }}
                        className="px-4 py-2 rounded-lg text-xs text-slate-500 dark:text-stone-400 hover:bg-slate-100 dark:hover:bg-stone-800 transition-colors"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Role row */}
              <div className="flex items-center justify-between px-5 py-4">
                <div className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-lg bg-stone-50 dark:bg-stone-800 flex items-center justify-center">
                    <Shield size={15} className="text-slate-400 dark:text-stone-500" />
                  </span>
                  <div>
                    <p className="text-sm font-medium text-slate-700 dark:text-stone-200">Rol y permisos</p>
                    <p className="text-xs text-slate-400 dark:text-stone-500">Gestionado por el administrador del sistema</p>
                  </div>
                </div>
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${ROLE_COLOR[user.role]}`}>
                  {ROLE_LABEL[user.role]}
                </span>
              </div>
            </div>
          </section>

          {/* Activity log */}
          <section className="bg-white/80 dark:bg-stone-900 backdrop-blur-md border border-white/60 dark:border-stone-700/50 rounded-2xl overflow-hidden">
            <div className="module-header">
              <div className="flex items-center gap-2">
                <Activity size={15} className="text-orange-500" />
                <span className="text-sm font-medium text-slate-700 dark:text-stone-200">Actividad reciente</span>
              </div>
            </div>
            {loadingActivities ? (
              <div className="p-6 text-center text-xs text-slate-400 dark:text-stone-500">
                Cargando actividad...
              </div>
            ) : activities.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400 dark:text-stone-500">
                No hay actividad reciente registrada.
              </div>
            ) : (
              <ul className="divide-y divide-stone-100 dark:divide-stone-800">
                {activities.map((item) => (
                  <li key={item.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-stone-100/50 dark:hover:bg-stone-700/30 transition-colors">
                    <span className="w-7 h-7 rounded-lg bg-stone-50 dark:bg-stone-800 flex items-center justify-center shrink-0">
                      <Activity size={13} className="text-orange-400" />
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-600 dark:text-stone-300 truncate">
                        {item.action}
                      </p>
                      <p className="text-[10px] text-slate-400 dark:text-stone-500">
                        Por {item.user_name}
                      </p>
                    </div>
                    <span className="text-xs text-slate-400 dark:text-stone-500 whitespace-nowrap">{formatActivityTime(item.created_at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* RIGHT column (1/3) */}
        <div className="space-y-6">

          {/* Preferences */}
          <section className="bg-white/80 dark:bg-stone-900 backdrop-blur-md border border-white/60 dark:border-stone-700/50 rounded-2xl overflow-hidden">
            <div className="module-header">
              <div className="flex items-center gap-2">
                <Sun size={15} className="text-orange-500" />
                <span className="text-sm font-medium text-slate-700 dark:text-stone-200">Apariencia</span>
              </div>
            </div>
            <div className="px-5 py-4">
              <button
                onClick={toggleTheme}
                className="flex items-center justify-between w-full group"
              >
                <div className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-lg bg-stone-50 dark:bg-stone-800 flex items-center justify-center transition-colors group-hover:bg-orange-50 dark:group-hover:bg-orange-800/40">
                    {theme === 'dark' ? <Moon size={15} className="text-orange-400" /> : <Sun size={15} className="text-orange-400" />}
                  </span>
                  <div className="text-left">
                    <p className="text-sm font-medium text-slate-700 dark:text-stone-200">Tema de la interfaz</p>
                    <p className="text-xs text-slate-400 dark:text-stone-500">{theme === 'dark' ? 'Modo oscuro activo' : 'Modo claro activo'}</p>
                  </div>
                </div>
                {/* Toggle pill */}
                <div className={`relative w-10 h-5 rounded-full transition-colors duration-300 ${theme === 'dark' ? 'bg-orange-500' : 'bg-slate-200 dark:bg-stone-700'}`}>
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform duration-300 ${theme === 'dark' ? 'translate-x-5' : 'translate-x-0'}`} />
                </div>
              </button>
            </div>
          </section>

        </div>
      </div>
    </div>
  );
};

export default Profile;

