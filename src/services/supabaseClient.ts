import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('⚠️ Supabase URL o Anon Key no encontradas en el archivo .env');
}

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    // Guardar la sesión en sessionStorage (no localStorage): sobrevive a
    // recargas (F5) dentro de la misma pestaña, pero se borra al cerrar la
    // pestaña/navegador. Más seguro: al cerrar, hay que volver a iniciar sesión.
    // Nota: sessionStorage es por pestaña → cada pestaña nueva pide login.
    storage: typeof window !== 'undefined' ? window.sessionStorage : undefined,
    // Sustituye el Web Lock global del navegador (navigatorLock) por un lock
    // pass-through. El navigatorLock provoca un deadlock: signInWithPassword
    // recibe el token (HTTP 200) pero su promesa JS nunca resuelve porque el
    // lock queda retenido por getSession()/detectSessionInUrl concurrentes,
    // dejando el botón "Verificando…" girando para siempre.
    lock: async (_name, _acquireTimeout, fn) => fn(),
  },
});
