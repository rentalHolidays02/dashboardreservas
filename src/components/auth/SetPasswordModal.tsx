import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Eye, EyeOff } from 'lucide-react';
import { appsScriptApi } from '../../services/api';
import { supabase } from '../../services/supabaseClient';

// Modal forzado que aparece la primera vez que un usuario invitado entra sin contraseña.
// Comprueba `user_metadata.password_set`; si está ausente/false, no se puede cerrar hasta
// que se configure la contraseña. updateUserPassword setea el flag a true.

const ANIM_MS = 320;

const SetPasswordModal: React.FC = () => {
  const [needed, setNeeded] = useState(false);
  const [render, setRender] = useState(false);
  const [visible, setVisible] = useState(false);

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Al montar y en cada cambio de sesión: comprobar si el usuario tiene contraseña configurada.
  useEffect(() => {
    let mounted = true;

    const check = async () => {
      const { data } = await supabase.auth.getUser();
      const u = data?.user;
      if (!u) {
        if (mounted) setNeeded(false);
        return;
      }
      const passwordSet = !!u.user_metadata?.password_set;
      if (mounted) setNeeded(!passwordSet);
    };

    check();

    const { data: sub } = supabase.auth.onAuthStateChange(() => check());
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  // Animación entrada/salida.
  useEffect(() => {
    if (needed) {
      setRender(true);
      const id = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(id);
    } else if (render) {
      setVisible(false);
      const t = window.setTimeout(() => setRender(false), ANIM_MS);
      return () => window.clearTimeout(t);
    }
  }, [needed]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = async () => {
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
      // Limpia local y cierra. El listener volverá a chequear y verá password_set=true.
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
        <div className="px-6 pt-10 pb-8 text-center">
          <h2 className="text-2xl font-medium text-slate-800 dark:text-stone-100 font-dm tracking-tight leading-snug">
            Crea tu contraseña
          </h2>
          <p className="text-sm text-slate-500 dark:text-stone-400 font-light font-dm mt-3 leading-relaxed">
            Antes de empezar necesitas configurar una contraseña. La usarás para entrar la próxima vez sin esperar al enlace por email.
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

        <div className="px-6 pt-4">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={busy}
            className={`w-full py-4 rounded-2xl text-sm font-medium transition-colors disabled:cursor-not-allowed bg-stone-900 hover:bg-stone-800 dark:bg-stone-100 dark:hover:bg-white text-white dark:text-stone-900 ${busy ? 'opacity-60 cursor-wait' : ''}`}
          >
            {busy ? 'Guardando…' : 'Guardar contraseña'}
          </button>
          <p className="mt-2 text-[11px] text-center text-slate-400 dark:text-stone-500">
            Sin contraseña no podrás entrar la próxima vez.
          </p>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default SetPasswordModal;
