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

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: memStorage,
    lock: async (_name, _acquireTimeout, fn) => fn(),
  },
});
