import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Eye, EyeOff, KeyRound, ShieldCheck } from 'lucide-react';
import { appsScriptApi } from '../../services/api';
import { getSessionFromStore } from '../../services/supabaseClient';

const ANIM_MS = 320;
const DEFAULT_PASSWORD = 'Rentalholidays0211';

const SetPasswordModal: React.FC = () => {
  const [needed, setNeeded] = useState(false);
  const [render, setRender] = useState(false);
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState<'choice' | 'change'>('choice');

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // supabase.auth.getUser/onAuthStateChange no disponibles con accessToken option.
    // getSessionFromStore() devuelve el JSON completo de sesión (incluye user_metadata).
    const session = getSessionFromStore() as any;
    const needsSetup = session?.user?.user_metadata?.password_set === false;
    setNeeded(!!needsSetup);
  }, []);

  useEffect(() => {
    if (needed) {
      setStep('choice');
      setRender(true);
      const id = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(id);
    } else if (render) {
      setVisible(false);
      const t = window.setTimeout(() => setRender(false), ANIM_MS);
      return () => window.clearTimeout(t);
    }
  }, [needed]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleKeepDefault = async () => {
    setBusy(true);
    setError(null);
    try {
      // supabase.auth.updateUser no disponible con accessToken option → fetch directo
      const session = getSessionFromStore() as any;
      if (session?.access_token) {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
        await fetch(`${supabaseUrl}/auth/v1/user`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY as string,
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ data: { password_set: true } }),
        }).catch(() => {}); // no-op si falla — modal cierra igual
      }
      setNeeded(false);
    } finally {
      setBusy(false);
    }
  };

  const handleChangePassword = async () => {
    setError(null);
    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (password !== confirm) {
      setError('Las contraseñas no coinciden.');
      return;
    }
    setBusy(true);
    try {
      const res = await appsScriptApi.updateUserPassword(password);
      if (!res.ok) {
        setError(res.error || 'No se pudo guardar la contraseña.');
        return;
      }
      setPassword('');
      setConfirm('');
      setNeeded(false);
    } finally {
      setBusy(false);
    }
  };

  if (!render) return null;

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-end justify-center">
      <div
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity duration-300"
        style={{ opacity: visible ? 1 : 0 }}
      />
      <div
        className="relative w-full sm:max-w-md bg-white dark:bg-stone-900 rounded-t-3xl shadow-2xl border-t border-white/60 dark:border-stone-800/50 pb-[calc(env(safe-area-inset-bottom)+1rem)] font-dm"
        style={{
          transform: visible ? 'translateY(0)' : 'translateY(100%)',
          transition: `transform ${ANIM_MS}ms cubic-bezier(0.4, 0, 0.2, 1)`,
          willChange: 'transform',
        }}
      >
        {step === 'choice' ? (
          <>
            <div className="px-6 pt-10 pb-6 text-center">
              <h2 className="text-2xl font-medium text-slate-800 dark:text-stone-100 tracking-tight leading-snug">
                Configura tu acceso
              </h2>
              <p className="text-sm text-slate-500 dark:text-stone-400 font-light mt-3 leading-relaxed">
                Tu cuenta ya está activa. Elige cómo quieres acceder la próxima vez.
              </p>
            </div>

            <div className="px-6 space-y-3 pb-2">
              {/* Opción: mantener por defecto */}
              <button
                type="button"
                disabled={busy}
                onClick={handleKeepDefault}
                className="w-full flex items-start gap-4 p-4 rounded-2xl border-[1.5px] border-stone-200 dark:border-stone-700/60 hover:border-stone-400 dark:hover:border-stone-500 hover:bg-stone-50 dark:hover:bg-stone-800/40 transition-colors text-left disabled:opacity-60"
              >
                <div className="mt-0.5 flex-shrink-0 w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center">
                  <ShieldCheck size={18} className="text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-800 dark:text-stone-100">Mantener contraseña por defecto</p>
                  <p className="text-xs text-slate-400 dark:text-stone-500 mt-0.5">
                    Usa <span className="font-mono font-semibold text-slate-600 dark:text-stone-300">{DEFAULT_PASSWORD}</span> para entrar
                  </p>
                </div>
              </button>

              {/* Opción: cambiar contraseña */}
              <button
                type="button"
                disabled={busy}
                onClick={() => { setStep('change'); setError(null); }}
                className="w-full flex items-start gap-4 p-4 rounded-2xl border-[1.5px] border-stone-200 dark:border-stone-700/60 hover:border-orange-400 dark:hover:border-orange-500 hover:bg-orange-50/40 dark:hover:bg-orange-900/10 transition-colors text-left disabled:opacity-60"
              >
                <div className="mt-0.5 flex-shrink-0 w-9 h-9 rounded-xl bg-orange-50 dark:bg-orange-900/30 flex items-center justify-center">
                  <KeyRound size={18} className="text-orange-500 dark:text-orange-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-800 dark:text-stone-100">Elegir mi propia contraseña</p>
                  <p className="text-xs text-slate-400 dark:text-stone-500 mt-0.5">Establece una contraseña personalizada ahora</p>
                </div>
              </button>

              {error && (
                <div className="px-3 py-2 rounded-xl text-[11px] font-medium text-center border bg-stone-100 dark:bg-stone-800/60 text-slate-800 dark:text-stone-100 border-stone-300 dark:border-stone-600">
                  {error}
                </div>
              )}
            </div>

            <p className="mt-3 mb-2 text-[11px] text-center text-slate-400 dark:text-stone-500 px-6">
              Podrás cambiar tu contraseña más adelante desde tu perfil.
            </p>
          </>
        ) : (
          <>
            <div className="px-6 pt-10 pb-6 text-center">
              <button
                type="button"
                onClick={() => { setStep('choice'); setError(null); setPassword(''); setConfirm(''); }}
                className="absolute left-5 top-5 text-xs text-slate-400 hover:text-slate-600 dark:text-stone-500 dark:hover:text-stone-300 transition-colors"
              >
                ← Volver
              </button>
              <h2 className="text-2xl font-medium text-slate-800 dark:text-stone-100 tracking-tight leading-snug">
                Nueva contraseña
              </h2>
              <p className="text-sm text-slate-500 dark:text-stone-400 font-light mt-3 leading-relaxed">
                Mínimo 8 caracteres.
              </p>
            </div>

            <div className="px-6 space-y-3">
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Contraseña (mín. 8)"
                  autoComplete="new-password"
                  className="w-full min-w-0 appearance-none rounded-xl bg-transparent border-[1.5px] border-stone-200 dark:border-stone-700/60 px-4 py-4 pr-12 text-base leading-6 text-slate-800 dark:text-stone-100 placeholder:text-stone-300 dark:placeholder:text-stone-600 focus:outline-none focus:border-stone-900 dark:focus:border-stone-100 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-slate-400 dark:text-stone-500"
                  aria-label={showPw ? 'Ocultar' : 'Mostrar'}
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              <input
                type={showPw ? 'text' : 'password'}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Repite la contraseña"
                autoComplete="new-password"
                className="w-full min-w-0 appearance-none rounded-xl bg-transparent border-[1.5px] border-stone-200 dark:border-stone-700/60 px-4 py-4 text-base leading-6 text-slate-800 dark:text-stone-100 placeholder:text-stone-300 dark:placeholder:text-stone-600 focus:outline-none focus:border-stone-900 dark:focus:border-stone-100 transition-colors"
              />

              {error && (
                <div className="px-3 py-2 rounded-xl text-[11px] font-medium text-center border bg-stone-100 dark:bg-stone-800/60 text-slate-800 dark:text-stone-100 border-stone-300 dark:border-stone-600">
                  {error}
                </div>
              )}
            </div>

            <div className="px-6 pt-4 pb-2">
              <button
                type="button"
                onClick={handleChangePassword}
                disabled={busy}
                className={`w-full py-4 rounded-2xl text-sm font-medium transition-colors disabled:cursor-not-allowed bg-stone-900 hover:bg-stone-800 dark:bg-stone-100 dark:hover:bg-white text-white dark:text-stone-900 ${busy ? 'opacity-60 cursor-wait' : ''}`}
              >
                {busy ? 'Guardando…' : 'Guardar contraseña'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  );
};

export default SetPasswordModal;
