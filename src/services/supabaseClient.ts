import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('⚠️ Supabase URL o Anon Key no encontradas en el archivo .env');
}

// ponytail: storage en memoria + sessionStorage como backup.
// - evita el deadlock del navigatorLock (signInWithPassword colgaba porque
//   detectSessionInUrl + getSession concurrentes retenían el lock del SDK)
// - permite escribir el token directamente desde login() sin pasar por setSession()
// - persiste en sessionStorage para sobrevivir F5 (pero no entre pestañas distintas)
const memStore = new Map<string, string>();
const memStorage = {
  getItem: (key: string) => {
    if (memStore.has(key)) return memStore.get(key)!;
    const val = sessionStorage.getItem(key);
    if (val) memStore.set(key, val); // restaurar tras F5
    return val;
  },
  setItem: (key: string, value: string) => {
    memStore.set(key, value);
    sessionStorage.setItem(key, value);
  },
  removeItem: (key: string) => {
    memStore.delete(key);
    sessionStorage.removeItem(key);
  },
};

export { memStore };

// Lee la sesión directamente de memStore sin pasar por el SDK (evita race con _currentSession).
// Usar en lugar de supabase.auth.getSession() cuando el token puede acabar de escribirse en login().
export const getSessionFromStore = (): { access_token: string; user: { id: string; email: string } } | null => {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
  const projectRef = supabaseUrl?.match(/\/\/([^.]+)/)?.[1] ?? '';
  const key = `sb-${projectRef}-auth-token`;
  const raw = memStore.get(key) ?? sessionStorage.getItem(key);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
};

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: memStorage,
    lock: async (_name, _acquireTimeout, fn) => fn(),
  },
});
