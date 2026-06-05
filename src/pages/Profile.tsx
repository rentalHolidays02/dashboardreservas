import React, { useState, useEffect, useRef } from 'react';
import {
  Moon,
  Sun,
  Check,
  Eye,
  EyeOff,
  LogOut,
  ChevronRight,
  Pencil,
  X,
  Save,
  AlertTriangle,
  Camera,
  Loader2,
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { supabase } from '../services/supabaseClient';

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

const Profile: React.FC<ProfileProps> = ({ user, onLogout }) => {
  const { theme, toggleTheme } = useTheme();

  // Edit name state
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(user.name ?? '');
  const [savedName, setSavedName] = useState(user.name ?? '');

  // Password change state
  const [pwSection, setPwSection] = useState(false);
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [pwSaved, setPwSaved] = useState(false);
  const [pwError, setPwError] = useState('');
  const [pwLoading, setPwLoading] = useState(false);

  // Avatar state
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [avatarError, setAvatarError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Cargar avatar desde Supabase profiles al montar
  useEffect(() => {
    const loadAvatar = async () => {
      if (!user.id) return;
      const { data } = await supabase
        .from('profiles')
        .select('avatar_url')
        .eq('id', user.id)
        .single();
      if (data?.avatar_url) setAvatarUrl(data.avatar_url);
    };
    loadAvatar();
  }, [user.id]);

  const initials = (savedName || '')
    .split(' ')
    .map((w) => w.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ]/g, ''))
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

  const handleSavePassword = async () => {
    setPwError('');
    if (!currentPw) { setPwError('Introduce tu contraseña actual.'); return; }
    if (newPw.length < 6) { setPwError('La nueva contraseña debe tener al menos 6 caracteres.'); return; }
    if (newPw !== confirmPw) { setPwError('Las contraseñas no coinciden.'); return; }

    setPwLoading(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPw,
      });
      if (signInError) {
        setPwError('La contraseña actual es incorrecta.');
        setPwLoading(false);
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({ password: newPw });
      if (updateError) {
        setPwError(updateError.message);
        setPwLoading(false);
        return;
      }

      setPwSaved(true);
      setCurrentPw(''); setNewPw(''); setConfirmPw('');
      setTimeout(() => { setPwSaved(false); setPwSection(false); }, 2500);
    } catch {
      setPwError('Error inesperado. Inténtalo de nuevo.');
    } finally {
      setPwLoading(false);
    }
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user.id) return;

    if (!file.type.startsWith('image/')) {
      setAvatarError('Solo se permiten imágenes.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setAvatarError('La imagen no puede superar 2 MB.');
      return;
    }

    setAvatarError('');
    setAvatarLoading(true);

    try {
      const ext = file.name.split('.').pop() ?? 'jpg';
      const path = `${user.id}/avatar.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, file, { upsert: true, contentType: file.type });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
      const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;

      await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', user.id);

      setAvatarUrl(publicUrl);
    } catch (err: any) {
      setAvatarError('No se pudo subir la imagen. Inténtalo de nuevo.');
      console.error('Avatar upload error:', err);
    } finally {
      setAvatarLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const inputClass =
    'w-full text-sm bg-stone-50 dark:bg-stone-800/40 border border-stone-200/70 dark:border-stone-700/50 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-orange-500/20 text-slate-700 dark:text-stone-200 placeholder:text-slate-400 dark:placeholder:text-stone-500 transition-colors';

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="px-6 pt-4 pb-10 space-y-8 lg:px-0 lg:pt-0 lg:pb-0">

        {/* ── Cabecera: avatar + nombre + rol + email ── */}
        <header className="max-w-xl mx-auto lg:mx-0 pt-2 pr-8 flex items-center gap-4">
          {/* Avatar */}
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={avatarLoading}
              className="w-16 h-16 rounded-2xl bg-stone-50 dark:bg-stone-800/40 border border-stone-200/70 dark:border-stone-700/50 flex items-center justify-center text-slate-700 dark:text-stone-200 text-lg font-medium font-dm overflow-hidden relative group focus:outline-none focus:ring-2 focus:ring-orange-500/30"
              aria-label="Cambiar foto de perfil"
            >
              {avatarUrl ? (
                <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <span>{initials}</span>
              )}
              <span className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                {avatarLoading
                  ? <Loader2 size={18} className="text-white animate-spin" />
                  : <Camera size={18} className="text-white" />
                }
              </span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarChange}
            />
          </div>

          {/* Nombre + meta */}
          <div className="min-w-0 flex-1 font-dm">
            {editingName ? (
              <div className="flex items-center gap-2">
                <input
                  autoFocus
                  value={nameValue}
                  onChange={(e) => setNameValue(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSaveName(); if (e.key === 'Escape') handleCancelName(); }}
                  className="text-2xl font-medium bg-transparent border-b-2 border-orange-400 outline-none text-stone-800 dark:text-stone-200 min-w-0 flex-1"
                />
                <button onClick={handleSaveName} className="p-1 text-orange-500 hover:text-orange-600 transition-colors shrink-0"><Save size={18} /></button>
                <button onClick={handleCancelName} className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-stone-300 transition-colors shrink-0"><X size={18} /></button>
              </div>
            ) : (
              <div className="flex items-center gap-2 min-w-0">
                <h1 className="text-2xl font-medium tracking-tight leading-snug text-stone-800 dark:text-stone-200 truncate">
                  {savedName}
                </h1>
                <button
                  onClick={() => setEditingName(true)}
                  className="p-1 -ml-0.5 text-slate-400 hover:text-orange-500 dark:text-stone-500 dark:hover:text-orange-400 transition-colors shrink-0"
                  aria-label="Editar nombre"
                >
                  <Pencil size={14} />
                </button>
              </div>
            )}
            <p className="text-xs text-slate-500 dark:text-stone-400 mt-1 font-gsf truncate">
              {ROLE_LABEL[user.role] ?? user.role} · {user.email}
            </p>
            {avatarError && (
              <p className="text-[11px] text-red-500 flex items-center gap-1 mt-1 font-gsf">
                <AlertTriangle size={11} />{avatarError}
              </p>
            )}
          </div>
        </header>

        {/* ── Seguridad ── */}
        <section className="max-w-xl mx-auto lg:mx-0 space-y-3 font-gsf">
          <h2 className="px-1 text-xs font-medium text-slate-500 dark:text-stone-400">Seguridad</h2>
          <div className="rounded-xl bg-stone-50/60 dark:bg-stone-800/25 border border-stone-200/70 dark:border-stone-700/50 overflow-hidden">
            <button
              onClick={() => { setPwSection((v) => !v); setPwError(''); }}
              className="w-full px-4 py-4 flex items-center justify-between active:bg-stone-100/40 dark:active:bg-stone-700/20 transition-colors"
            >
              <div className="text-left space-y-0.5">
                <p className="text-sm font-medium text-slate-800 dark:text-stone-100">Cambiar contraseña</p>
                <p className="text-[11px] text-slate-400 dark:text-stone-500">Protege tu cuenta con una contraseña segura</p>
              </div>
              <ChevronRight
                size={16}
                className={`text-slate-400 dark:text-stone-500 transition-transform duration-200 ${pwSection ? 'rotate-90' : ''}`}
              />
            </button>

            {pwSection && (
              <div className="px-4 pb-4 -mt-1 space-y-2.5">
                <div className="relative">
                  <input
                    type={showCurrentPw ? 'text' : 'password'}
                    placeholder="Contraseña actual"
                    value={currentPw}
                    onChange={(e) => setCurrentPw(e.target.value)}
                    className={`${inputClass} pr-10`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPw((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-stone-500 hover:text-slate-600 dark:hover:text-stone-300"
                  >
                    {showCurrentPw ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>

                <div className="relative">
                  <input
                    type={showNewPw ? 'text' : 'password'}
                    placeholder="Nueva contraseña"
                    value={newPw}
                    onChange={(e) => setNewPw(e.target.value)}
                    className={`${inputClass} pr-10`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPw((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-stone-500 hover:text-slate-600 dark:hover:text-stone-300"
                  >
                    {showNewPw ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>

                <input
                  type="password"
                  placeholder="Confirmar nueva contraseña"
                  value={confirmPw}
                  onChange={(e) => setConfirmPw(e.target.value)}
                  className={inputClass}
                />

                {pwError && (
                  <p className="text-[11px] text-red-500 flex items-center gap-1.5">
                    <AlertTriangle size={12} /> {pwError}
                  </p>
                )}
                {pwSaved && (
                  <p className="text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                    <Check size={12} /> Contraseña actualizada correctamente
                  </p>
                )}

                <div className="flex gap-2 pt-1">
                  <button
                    onClick={handleSavePassword}
                    disabled={pwLoading}
                    className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors active:scale-[0.98]"
                  >
                    {pwLoading
                      ? <><Loader2 size={14} className="animate-spin" /> Guardando…</>
                      : <><Save size={14} /> Guardar</>
                    }
                  </button>
                  <button
                    onClick={() => { setPwSection(false); setCurrentPw(''); setNewPw(''); setConfirmPw(''); setPwError(''); }}
                    className="px-4 py-3 rounded-xl text-sm text-slate-500 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800/40 transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* ── Apariencia ── */}
        <section className="max-w-xl mx-auto lg:mx-0 space-y-3 font-gsf">
          <h2 className="px-1 text-xs font-medium text-slate-500 dark:text-stone-400">Apariencia</h2>
          <div className="rounded-xl bg-stone-50/60 dark:bg-stone-800/25 border border-stone-200/70 dark:border-stone-700/50">
            <button
              onClick={toggleTheme}
              className="w-full px-4 py-4 flex items-center justify-between active:bg-stone-100/40 dark:active:bg-stone-700/20 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                {theme === 'dark'
                  ? <Moon size={16} className="text-slate-500 dark:text-stone-400 shrink-0" />
                  : <Sun size={16} className="text-slate-500 dark:text-stone-400 shrink-0" />
                }
                <div className="text-left">
                  <p className="text-sm font-medium text-slate-800 dark:text-stone-100">Tema</p>
                  <p className="text-[11px] text-slate-400 dark:text-stone-500">
                    {theme === 'dark' ? 'Modo oscuro activo' : 'Modo claro activo'}
                  </p>
                </div>
              </div>
              <div className={`relative w-10 h-5 rounded-full transition-colors duration-300 shrink-0 ${theme === 'dark' ? 'bg-orange-500' : 'bg-stone-300 dark:bg-stone-700'}`}>
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-300 ${theme === 'dark' ? 'translate-x-5' : 'translate-x-0'}`} />
              </div>
            </button>
          </div>
        </section>

        {/* ── Cerrar sesión ── */}
        <div className="pt-2 max-w-xl mx-auto lg:mx-0">
          <button
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-2 px-6 py-4 rounded-xl bg-red-50/70 dark:bg-red-900/10 border border-red-200/60 dark:border-red-800/30 text-red-600/90 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 active:scale-[0.98] transition-all font-gsf"
          >
            <LogOut size={15} />
            <span className="text-sm font-medium">Cerrar sesión</span>
          </button>
        </div>

      </div>
    </div>
  );
};

export default Profile;
