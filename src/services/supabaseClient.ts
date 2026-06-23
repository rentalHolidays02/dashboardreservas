import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('⚠️ Supabase URL o Anon Key no encontradas en el archivo .env');
}

// ponytail: storage en memoria controlado por nosotros.
// - evita el deadlock del navigatorLock (signInWithPassword colgaba porque
//   detectSessionInUrl + getSession concurrentes retenían el lock del SDK)
// - permite escribir el token directamente desde login() sin pasar por setSession()
// - se borra al recargar la página (como sessionStorage), sin persistir entre pestañas
const memStore = new Map<string, string>();
const memStorage = {
  getItem: (key: string) => memStore.get(key) ?? null,
  setItem: (key: string, value: string) => { memStore.set(key, value); },
  removeItem: (key: string) => { memStore.delete(key); },
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
