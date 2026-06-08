import React, { useState } from 'react';

import { appsScriptApi } from '../services/api';
import { Eye, EyeOff, Loader2, AlertCircle, Users, BarChart3, FileText } from 'lucide-react';
import type { User } from '../services/mockData';
import TermsModal from '../components/auth/TermsModal';

interface LoginProps {
  onLoginSuccess: (user: User) => void;
}

const features = [
  { icon: Users, label: 'Gestión de trabajadores', desc: 'Consulta y administra el personal' },
  { icon: BarChart3, label: 'Análisis y pagos', desc: 'Controla nóminas y métricas' },
  { icon: FileText, label: 'Informes PDF', desc: 'Genera reportes al instante' },
];


const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [sessionEmail, setSessionEmail] = useState(''); // email del usuario en invite/recovery (lo usa Google PM para asociar la pwd)
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [authFlow, setAuthFlow] = useState<'login' | 'invite' | 'recovery'>('login');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [showTerms, setShowTerms] = useState(false);



  // Detectar el tipo de flujo escuchando los eventos de autenticación de Supabase.
  // Usamos onAuthStateChange en lugar de leer window.location.hash directamente porque
  // el SDK de Supabase procesa y limpia el hash de la URL de forma síncrona al importarse,
  // antes de que nuestro useEffect pueda leerlo.
  React.useEffect(() => {
    let isMounted = true;
    let authSubscription: { unsubscribe: () => void } | null = null;

    const setup = async () => {
      const { supabase } = await import('../services/supabaseClient');

      const { data } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (!isMounted) return;

        if (event === 'PASSWORD_RECOVERY') {
          // El usuario viene de un enlace de "Cambiar contraseña" → mostrar formulario de restablecimiento
          setAuthFlow('recovery');
          if (session?.user?.email) setSessionEmail(session.user.email);

        } else if (event === 'SIGNED_IN' && session?.user) {
          // El usuario viene de un magic link o invitación
          // Si ya existe perfil válido en la BD, hacemos auto-login silencioso
          try {
            const { appsScriptApi } = await import('../services/api');
            const appUser = await appsScriptApi.getProfileByEmail(session.user.email || '');
            if (appUser && isMounted) {
              onLoginSuccess(appUser);
            } else if (isMounted) {
              setAuthFlow('invite');
              if (session.user.email) setSessionEmail(session.user.email);
            }
          } catch {
            if (isMounted) {
              setAuthFlow('invite');
              if (session.user.email) setSessionEmail(session.user.email);
            }
          }
        }
      });

      authSubscription = data.subscription;
    };

    setup();

    return () => {
      isMounted = false;
      authSubscription?.unsubscribe();
    };
  }, []);


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.');
      setLoading(false);
      return;
    }

    try {
      if (authFlow !== 'login') {
        // Flujo de invitación o recuperación: establecer contraseña
        if (password !== confirmPassword) {
          setError('Las contraseñas no coinciden.');
          setLoading(false);
          return;
        }

        if (authFlow === 'invite' && !acceptedTerms) {
          setError('Debes aceptar los Términos y Condiciones para crear tu cuenta.');
          setLoading(false);
          return;
        }

        const res = await appsScriptApi.updateUserPassword(password);
        if (res.ok) {
          // Una vez actualizada, intentamos obtener el perfil para entrar
          const { data: { user } } = await (await import('../services/supabaseClient')).supabase.auth.getUser();
          if (user && user.email) {
            const appUser = await appsScriptApi.login(user.email, password);
            if (appUser) {
              // Registrar la aceptación de T&C si es flujo de invitación (no bloqueante)
              if (authFlow === 'invite' && appUser.id) {
                await appsScriptApi.acceptTerms(appUser.id);
              }
              onLoginSuccess(appUser);
            }
          } else {
            // Si algo falla, recargar para login normal
            window.location.hash = '';
            setAuthFlow('login');
            setError('Contraseña establecida. Por favor, inicia sesión normalmente.');
          }
        } else {
          setError(res.error || 'Error al establecer la contraseña.');
        }
      } else {
        // Flujo normal de login
        const user = await appsScriptApi.login(email, password);
        if (user) {
          onLoginSuccess(user);
        } else {
          setError('Credenciales incorrectas.');
        }
      }
    } catch {
      setError('Hubo un error al intentar procesar la solicitud.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style>{`
        .login-panel-bg {
          background: #f97316;
          position: relative;
        }
        .login-noise {
          position: absolute;
          inset: 0;
          border-radius: inherit;
          pointer-events: none;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='80'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='1.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='80' height='80' filter='url(%23n)'/%3E%3C/svg%3E");
          background-repeat: repeat;
          background-size: 80px 80px;
          opacity: 0.22;
          mix-blend-mode: overlay;
        }
      `}</style>

      <div className="min-h-screen flex" style={{ background: '#FDFDFC' }}>

        {/* ── Left panel ── */}
        <div className="hidden lg:flex p-4 w-[46%] shrink-0">
          <div className="login-panel-bg relative flex flex-col justify-between w-full rounded-3xl p-12 overflow-hidden">
            <div className="login-noise" />

            {/* Logo */}
            <div className="relative z-10">
              <div className="w-12 h-12 flex items-center justify-center overflow-hidden">
                <img 
                  src="/faviconRH.png" 
                  alt="Logo" 
                  className="w-12 h-12 object-contain mix-blend-multiply" 
                  style={{ filter: 'contrast(1.2) brightness(1.1)' }}
                />
              </div>
            </div>

            {/* Bottom section: features + footer */}
            <div className="relative z-10 flex flex-col gap-4 mt-auto">
              {/* Feature pills in 3 columns */}
              <div className="grid grid-cols-3 gap-3">
                {features.map(({ icon: Icon, desc }, i) => (
                  <div
                    key={i}
                    className="flex flex-col items-start gap-3 bg-white/15 backdrop-blur-sm border border-white/20 rounded-2xl p-4"
                  >
                    <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
                      <Icon size={20} className="text-white" />
                    </div>
                    <p className="text-white text-base font-medium leading-snug">{desc}</p>
                  </div>
                ))}
              </div>

              {/* Footer */}
              <p className="text-white/40 text-xs">
                Rental Holidays · Acceso restringido
              </p>
            </div>
          </div>
        </div>

        {/* ── Right panel (form) ── */}
        <div className="flex-1 flex flex-col justify-center items-center px-8 py-14 bg-white/80 dark:bg-stone-900/80 backdrop-blur-xl">
          <div className="w-full max-w-sm">

            {/* Mobile logo */}
            <div className="flex lg:hidden items-center gap-2 mb-8">
              <div className="w-9 h-9 flex items-center justify-center overflow-hidden">
                <img 
                  src="/faviconRH.png" 
                  alt="RH Logo" 
                  className="w-9 h-9 object-contain mix-blend-multiply dark:mix-blend-screen" 
                  style={{ filter: 'contrast(1.2) brightness(1.1)' }}
                />
              </div>
              <span className="text-slate-700 dark:text-stone-200 font-semibold text-sm">Rental Holidays</span>
            </div>

            <div className="mb-8 text-center">
              <h1 className="text-2xl font-bold text-slate-900 dark:text-stone-100">
                {authFlow === 'invite' && 'Configura tu cuenta'}
                {authFlow === 'recovery' && 'Restablecer contraseña'}
                {authFlow === 'login' && 'Bienvenido'}
              </h1>
              <p className="text-slate-500 dark:text-stone-400 mt-1 text-sm">
                {authFlow === 'invite' && 'Establece tu contraseña para activar tu acceso'}
                {authFlow === 'recovery' && 'Introduce tu nueva contraseña para acceder'}
                {authFlow === 'login' && 'Introduce tus credenciales para acceder'}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">

              {/* Email read-only en invite/recovery: ayuda al gestor de contraseñas a vincular la pwd
                  a la cuenta correcta + el usuario confirma sobre qué cuenta está actuando. */}
              {authFlow !== 'login' && sessionEmail && (
                <div className="space-y-1.5">
                  <label htmlFor="login-session-email" className="block text-xs font-medium text-slate-600 dark:text-stone-400">
                    Cuenta
                  </label>
                  <input
                    id="login-session-email"
                    name="email"
                    type="email"
                    value={sessionEmail}
                    readOnly
                    autoComplete="username"
                    className="w-full px-4 py-3 rounded-xl bg-stone-50 dark:bg-stone-800/40 border border-slate-200 dark:border-stone-700/60 text-slate-600 dark:text-stone-400 text-sm cursor-not-allowed"
                  />
                </div>
              )}

              {/* Email (solo se muestra en login normal) */}
              {authFlow === 'login' && (
                <div className="space-y-1.5">
                  <label htmlFor="login-email" className="block text-xs font-medium text-slate-600 dark:text-stone-400">
                    Correo electrónico
                  </label>
                  <input
                    id="login-email"
                    name="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="username"
                    inputMode="email"
                    className="w-full px-4 py-3 rounded-xl bg-white/80 dark:bg-stone-800/80 border border-slate-200 dark:border-stone-700/60 text-slate-900 dark:text-stone-100 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 transition-all placeholder:text-slate-400 dark:placeholder:text-stone-500"
                    placeholder="tu@email.com"
                    required
                  />
                </div>
              )}

              {/* Password */}
              <div className="space-y-1.5">
                <label htmlFor="login-password" className="block text-xs font-medium text-slate-600 dark:text-stone-400">
                  {authFlow !== 'login' ? 'Nueva Contraseña' : 'Contraseña'}
                </label>
                <div className="relative">
                  <input
                    id="login-password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete={authFlow === 'login' ? 'current-password' : 'new-password'}
                    className="w-full px-4 py-3 pr-11 rounded-xl bg-white/80 dark:bg-stone-800/80 border border-slate-200 dark:border-stone-700/60 text-slate-900 dark:text-stone-100 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 transition-all placeholder:text-slate-400 dark:placeholder:text-stone-500"
                    placeholder="••••••••"
                    required
                    minLength={8}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-stone-500 hover:text-slate-600 dark:hover:text-stone-300 transition-colors"
                  >
                    {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              </div>

              {/* Confirm Password (en invitación y recuperación) */}
              {authFlow !== 'login' && (
                <div className="space-y-1.5">
                  <label htmlFor="login-confirm-password" className="block text-xs font-medium text-slate-600 dark:text-stone-400">
                    Confirmar Contraseña
                  </label>
                  <input
                    id="login-confirm-password"
                    name="confirm-password"
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    autoComplete="new-password"
                    className="w-full px-4 py-3 rounded-xl bg-white/80 dark:bg-stone-800/80 border border-slate-200 dark:border-stone-700/60 text-slate-900 dark:text-stone-100 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 transition-all placeholder:text-slate-400 dark:placeholder:text-stone-500"
                    placeholder="••••••••"
                    required
                    minLength={8}
                  />
                </div>
              )}

              {/* Aceptación T&C (solo en flujo de invitación) */}
              {authFlow === 'invite' && (
                <label className="flex items-start gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={acceptedTerms}
                    onChange={(e) => setAcceptedTerms(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 dark:border-stone-600 text-orange-500 focus:ring-orange-500/30 cursor-pointer"
                  />
                  <span className="text-xs text-slate-600 dark:text-stone-400 leading-relaxed">
                    He leído y acepto los{' '}
                    <button
                      type="button"
                      onClick={() => setShowTerms(true)}
                      className="text-orange-600 dark:text-orange-400 hover:underline font-medium"
                    >
                      Términos y Condiciones
                    </button>{' '}
                    de uso de la plataforma.
                  </span>
                </label>
              )}

              {/* Error */}
              {error && (
                <div className="flex items-center gap-2 text-red-600 bg-red-50 dark:bg-red-950/40 px-4 py-3 rounded-xl text-sm border border-red-100 dark:border-red-900/40">
                  <AlertCircle size={16} className="shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-white font-normal py-3.5 rounded-xl transition-all hover:-translate-y-0.5 disabled:opacity-70 disabled:translate-y-0 flex items-center justify-center gap-2 soft-shadow shadow-orange-200/60 dark:shadow-orange-900/30 text-sm mt-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="animate-spin" size={17} />
                    <span>
                      {authFlow === 'invite' && 'Creando cuenta…'}
                      {authFlow === 'recovery' && 'Guardando contraseña…'}
                      {authFlow === 'login' && 'Verificando…'}
                    </span>
                  </>
                ) : (
                  <span>
                    {authFlow === 'invite' && 'Crear cuenta'}
                    {authFlow === 'recovery' && 'Restablecer contraseña'}
                    {authFlow === 'login' && 'Iniciar sesión'}
                  </span>
                )}
              </button>
            </form>

            {authFlow === 'login' && (
              <p className="mt-6 text-[11px] text-center text-slate-500 dark:text-stone-500 leading-relaxed">
                Al iniciar sesión confirmas que aceptas los{' '}
                <button
                  type="button"
                  onClick={() => setShowTerms(true)}
                  className="text-orange-600 dark:text-orange-400 hover:underline font-medium"
                >
                  Términos y Condiciones
                </button>{' '}
                de la plataforma.
              </p>
            )}

            <p className="mt-6 text-xs text-center text-slate-400 dark:text-stone-600">
              Base de Datos Pagos RH · {new Date().getFullYear()}
            </p>
          </div>
        </div>
      </div>

      <TermsModal isOpen={showTerms} onClose={() => setShowTerms(false)} />
    </>
  );
};

export default Login;
