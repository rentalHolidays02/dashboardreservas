import React, { useState } from 'react';
import { appsScriptApi } from '../services/api';
import { Eye, EyeOff, Loader2, AlertCircle, Users, BarChart3, FileText } from 'lucide-react';
import { User } from '../services/mockData';

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
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const user = await appsScriptApi.login(email, password);
      if (user) {
        onLoginSuccess(user);
      } else {
        setError('Credenciales incorrectas. Prueba con admin@rh.local / 1234');
      }
    } catch {
      setError('Hubo un error al intentar iniciar sesión.');
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
              <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center overflow-hidden">
                <img src="/src/assets/logo/LogoEstandar.png" alt="Logo" className="w-9 h-9 object-contain" />
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
              <div className="w-9 h-9 bg-orange-500 rounded-xl flex items-center justify-center">
                <span className="text-white font-bold text-sm">RH</span>
              </div>
              <span className="text-slate-700 dark:text-stone-200 font-semibold text-sm">Rental Holidays</span>
            </div>

            <div className="mb-8 text-center">
              <h1 className="text-2xl font-bold text-slate-900 dark:text-stone-100">Bienvenido</h1>
              <p className="text-slate-500 dark:text-stone-400 mt-1 text-sm">
                Introduce tus credenciales para acceder
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">

              {/* Email */}
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-slate-600 dark:text-stone-400">
                  Correo electrónico
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-white/80 dark:bg-stone-800/80 border border-slate-200 dark:border-stone-700/60 text-slate-900 dark:text-stone-100 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 transition-all placeholder:text-slate-400 dark:placeholder:text-stone-500"
                  placeholder="admin@rh.local"
                  required
                />
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-slate-600 dark:text-stone-400">
                  Contraseña
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-3 pr-11 rounded-xl bg-white/80 dark:bg-stone-800/80 border border-slate-200 dark:border-stone-700/60 text-slate-900 dark:text-stone-100 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 transition-all placeholder:text-slate-400 dark:placeholder:text-stone-500"
                    placeholder="••••••••"
                    required
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
                    <span>Verificando…</span>
                  </>
                ) : (
                  <span>Iniciar sesión</span>
                )}
              </button>
            </form>

            <p className="mt-8 text-xs text-center text-slate-400 dark:text-stone-600">
              Base de Datos Pagos RH · {new Date().getFullYear()}
            </p>
          </div>
        </div>
      </div>
    </>
  );
};

export default Login;
