import React, { useState } from 'react';
import { appsScriptApi } from '../services/api';
import { LogIn, Loader2, AlertCircle } from 'lucide-react';
import { User } from '../services/mockData';

interface LoginProps {
  onLoginSuccess: (user: User) => void;
}

const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
    } catch (err) {
      setError('Hubo un error al intentar iniciar sesión.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-transparent flex items-center justify-center p-4 sm:p-6 lg:p-8">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-red-400/10 rounded-full blur-3xl opacity-50"></div>
        <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-orange-400/10 rounded-full blur-3xl opacity-50"></div>
      </div>

      <div className="w-full max-w-md bg-white/80 dark:bg-stone-900/80 backdrop-blur-xl border border-white/60 dark:border-stone-700/40 rounded-3xl overflow-hidden z-10 relative animate-in zoom-in duration-500 soft-shadow">
        <div className="p-6 sm:p-10">
          <div className="mb-8 text-center">
            <div className="w-16 h-16 bg-orange-500 rounded-2xl flex items-center justify-center mx-auto mb-4 soft-shadow">
              <LogIn className="text-white" size={32} />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-stone-100">Bienvenido</h1>
            <p className="text-slate-500 dark:text-stone-400 mt-2 text-sm sm:text-base">Base de Datos Pagos RH</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-stone-300 mb-2">
                Correo Electrónico
              </label>
               <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-white/80 dark:bg-stone-800/80 border border-white/60 dark:border-stone-700/60 text-slate-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all placeholder:text-stone-400 dark:placeholder:text-stone-400"
                placeholder="admin@rh.local"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-stone-300 mb-2">
                Contraseña
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-white/80 dark:bg-stone-800/80 border border-white/60 dark:border-stone-700/60 text-slate-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all placeholder:text-stone-400 dark:placeholder:text-stone-400"
                placeholder="••••••••"
                required
              />
            </div>

            {error && (
              <div className="flex items-center space-x-2 text-red-600 bg-red-50 dark:bg-red-950/40 p-3 rounded-xl text-sm border border-red-100 dark:border-red-900/40">
                <AlertCircle size={18} />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-4 rounded-xl transition-all transform hover:-translate-y-1 disabled:opacity-70 disabled:transform-none flex items-center justify-center space-x-2 soft-shadow shadow-orange-200/50"
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin" size={20} />
                  <span>Verificando...</span>
                </>
              ) : (
                <span>Iniciar Sesión</span>
              )}
            </button>
          </form>
        </div>

        <div className="bg-white/40 dark:bg-stone-800/40 p-6 text-center border-t border-white/40 dark:border-stone-700/40">
          <p className="text-xs text-slate-400 dark:text-stone-500">
            Acceso restringido para personal de Rental Holidays
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
