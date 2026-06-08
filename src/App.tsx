import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { NavigationGuardProvider } from './context/NavigationGuardContext';
import { UndoToastProvider } from './context/UndoToastContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Cleans from './pages/Cleans';
import Workers from './pages/Workers';
import Incidencias from './pages/Incidencias';
import Sugerencias from './pages/Sugerencias';
import Pagos from './pages/Pagos';
import Alojamientos from './pages/Alojamientos';
import Analisis from './pages/Analisis';
import GenerarInforme from './pages/GenerarInforme';
import GestionUsuarios from './pages/GestionUsuarios';
import EntregaDeLlaves from './pages/EntregaDeLlaves';
import Profile from './pages/Profile';
import MainLayout from './components/layout/MainLayout';
import ChatBot from './components/chatbot/ChatBot';
import EntregaDeLlavesDB from './pages/EntregaDeLlavesDB';
import ServiciosDB from './pages/ServiciosDB';
import IncidenciasDB from './pages/IncidenciasDB';
import WorkerPanel from './pages/WorkerPanel';
import WorkerAnalytics from './pages/WorkerAnalytics';
import WorkerRecords from './pages/WorkerRecords';
import WorkerSwipeShell from './components/workers/WorkerSwipeShell';
import { User } from './services/mockData';
import { Sparkles } from 'lucide-react';

const PlaceholderPage = ({ title }: { title: string }) => (
  <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8 space-y-4 animate-in fade-in duration-500">
    <div className="w-16 h-16 rounded-3xl bg-orange-50 dark:bg-orange-400/10 flex items-center justify-center text-orange-500">
      <Sparkles size={32} className="animate-pulse" />
    </div>
    <h2 className="text-xl font-medium text-slate-800 dark:text-stone-100 font-display">{title}</h2>
    <p className="text-sm text-slate-400 dark:text-stone-500 max-w-sm font-light">
      Esta sección se conectará próximamente a la base de datos de Supabase.
    </p>
  </div>
);


function App() {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('rh_user');
    return saved ? JSON.parse(saved) : null;
  });

  const handleLoginSuccess = (userData: User) => {
    setUser(userData);
    localStorage.setItem('rh_user', JSON.stringify(userData));
  };

  const handleLogout = async () => {
    setUser(null);
    localStorage.removeItem('rh_user');
    // Importante: Cerrar también la sesión real de Supabase para evitar cruce de cuentas
    const { supabase } = await import('./services/supabaseClient');
    await supabase.auth.signOut();
  };

  const handleRoleChange = (newRole: 'admin' | 'editor' | 'viewer' | 'trabajador') => {
    if (user) {
      const updatedUser = { ...user, role: newRole };
      setUser(updatedUser);
      localStorage.setItem('rh_user', JSON.stringify(updatedUser));
    }
  };

  // Verificación de integridad del perfil al cargar
  useEffect(() => {
    const verifyProfile = async () => {
      // Solo verificamos si ya hay un usuario cargado de localStorage
      if (user && (user.role === 'viewer' || user.name === 'Usuario' || !user.id)) {
        console.log('🔍 Verificando integridad del perfil...');
        try {
          const { supabase } = await import('./services/supabaseClient');
          const { data: { session } } = await supabase.auth.getSession();

          if (session && session.user) {
            const { appsScriptApi } = await import('./services/api');
            // Intentamos un login silencioso (re-obtener perfil)
            const freshUser = await appsScriptApi.getProfileByEmail(session.user.email || '');

            if (freshUser && (freshUser.role !== user.role || freshUser.name !== user.name)) {
              console.log('✅ Perfil actualizado detectado:', freshUser.role);
              handleLoginSuccess(freshUser);
            }
          }
        } catch (e) {
          console.error('Error verificando perfil:', e);
        }
      }
    };
    verifyProfile();
  }, [user]);

  // Backfill avatar_url para sesiones existentes en localStorage que no lo incluyen.
  useEffect(() => {
    if (!user?.id || user.avatar_url !== undefined) return;
    (async () => {
      const { supabase } = await import('./services/supabaseClient');
      const { data } = await supabase
        .from('profiles')
        .select('avatar_url')
        .eq('id', user.id!)
        .single();
      const next = { ...user, avatar_url: data?.avatar_url || null };
      setUser(next);
      localStorage.setItem('rh_user', JSON.stringify(next));
    })();
  }, [user?.id]);

  // Refrescar usuario tras cambios desde Profile (ej. cambio de avatar).
  useEffect(() => {
    const onUserUpdated = () => {
      const saved = localStorage.getItem('rh_user');
      if (saved) setUser(JSON.parse(saved));
    };
    window.addEventListener('rh-user-updated', onUserUpdated);
    return () => window.removeEventListener('rh-user-updated', onUserUpdated);
  }, []);

  // Registro de actividad (Última conexión)
  useEffect(() => {
    if (user && user.id) {
      const updateActivity = async () => {
        const { supabase: sb } = await import('./services/supabaseClient');
        await sb.from('profiles').update({
          last_seen: new Date().toISOString()
        }).eq('id', user.id);
      };
      updateActivity();
      // Actualizar cada 2 minutos mientras la pestaña esté abierta
      const interval = setInterval(updateActivity, 120000);
      return () => clearInterval(interval);
    }
  }, [user?.id]);

  return (
    <ThemeProvider>
      <UndoToastProvider>
        <NavigationGuardProvider>
          <BrowserRouter>
            {user && user.role !== 'trabajador' && <ChatBot />}
            <Routes>
              <Route
                path="/login"
                element={user ? <Navigate to="/dashboard" /> : <Login onLoginSuccess={handleLoginSuccess} />}
              />

              <Route
                path="/usuarios"
                element={
                  user ? (
                    <MainLayout user={user} onLogout={handleLogout} onRoleChange={handleRoleChange}>
                      <GestionUsuarios user={user} />
                    </MainLayout>
                  ) : (
                    <Navigate to="/login" />
                  )
                }
              />

              <Route
                path="/dashboard"
                element={
                  user ? (
                    <MainLayout user={user} onLogout={handleLogout} onRoleChange={handleRoleChange}>
                      {user.role === 'trabajador' ? <WorkerSwipeShell user={user} onLogout={handleLogout} initialIndex={0} /> : <Dashboard userRole={user.role} />}
                    </MainLayout>
                  ) : (
                    <Navigate to="/login" />
                  )
                }
              />

              <Route
                path="/analiticas"
                element={
                  user ? (
                    <MainLayout user={user} onLogout={handleLogout} onRoleChange={handleRoleChange}>
                      <WorkerAnalytics user={user} />
                    </MainLayout>
                  ) : (
                    <Navigate to="/login" />
                  )
                }
              />

              <Route
                path="/registros"
                element={
                  user ? (
                    <MainLayout user={user} onLogout={handleLogout} onRoleChange={handleRoleChange}>
                      {user.role === 'trabajador' ? <WorkerSwipeShell user={user} onLogout={handleLogout} initialIndex={1} /> : <WorkerRecords user={user} />}
                    </MainLayout>
                  ) : (
                    <Navigate to="/login" />
                  )
                }
              />

              <Route
                path="/cleans"
                element={
                  user ? (
                    <MainLayout user={user} onLogout={handleLogout} onRoleChange={handleRoleChange}>
                      <Cleans userRole={user.role} />
                    </MainLayout>
                  ) : (
                    <Navigate to="/login" />
                  )
                }
              />

              <Route
                path="/workers"
                element={
                  user ? (
                    <MainLayout user={user} onLogout={handleLogout} onRoleChange={handleRoleChange}>
                      <Workers user={user} userRole={user.role} />
                    </MainLayout>
                  ) : (
                    <Navigate to="/login" />
                  )
                }
              />

              <Route
                path="/incidencias"
                element={
                  user ? (
                    <MainLayout user={user} onLogout={handleLogout} onRoleChange={handleRoleChange}>
                      <Incidencias userRole={user.role} />
                    </MainLayout>
                  ) : (
                    <Navigate to="/login" />
                  )
                }
              />

              <Route
                path="/sugerencias"
                element={
                  user ? (
                    <MainLayout user={user} onLogout={handleLogout}>
                      <Sugerencias />
                    </MainLayout>
                  ) : (
                    <Navigate to="/login" />
                  )
                }
              />

              <Route
                path="/pagos"
                element={
                  user ? (
                    <MainLayout user={user} onLogout={handleLogout} onRoleChange={handleRoleChange}>
                      <Pagos user={user} userRole={user.role} />
                    </MainLayout>
                  ) : (
                    <Navigate to="/login" />
                  )
                }
              />

              <Route
                path="/alojamientos"
                element={
                  user ? (
                    <MainLayout user={user} onLogout={handleLogout} onRoleChange={handleRoleChange}>
                      <Alojamientos userRole={user.role} />
                    </MainLayout>
                  ) : (
                    <Navigate to="/login" />
                  )
                }
              />

              <Route
                path="/analisis"
                element={
                  user ? (
                    <MainLayout user={user} onLogout={handleLogout} onRoleChange={handleRoleChange}>
                      <Analisis />
                    </MainLayout>
                  ) : (
                    <Navigate to="/login" />
                  )
                }
              />

              <Route
                path="/generar-informe"
                element={
                  user ? (
                    <MainLayout user={user} onLogout={handleLogout} onRoleChange={handleRoleChange}>
                      <GenerarInforme user={user} />
                    </MainLayout>
                  ) : (
                    <Navigate to="/login" />
                  )
                }
              />


              <Route
                path="/entrega-de-llaves"
                element={
                  user ? (
                    <MainLayout user={user} onLogout={handleLogout} onRoleChange={handleRoleChange}>
                      <EntregaDeLlaves userRole={user.role} />
                    </MainLayout>
                  ) : (
                    <Navigate to="/login" />
                  )
                }
              />

              <Route
                path="/servicios-db"
                element={
                  user ? (
                    <MainLayout user={user} onLogout={handleLogout} onRoleChange={handleRoleChange}>
                      <ServiciosDB userRole={user.role} />
                    </MainLayout>
                  ) : (
                    <Navigate to="/login" />
                  )
                }
              />

              <Route
                path="/entrega-llaves-db"
                element={
                  user ? (
                    <MainLayout user={user} onLogout={handleLogout} onRoleChange={handleRoleChange}>
                      <EntregaDeLlavesDB userRole={user.role} />
                    </MainLayout>
                  ) : (
                    <Navigate to="/login" />
                  )
                }
              />

              <Route
                path="/incidencias-db"
                element={
                  user ? (
                    <MainLayout user={user} onLogout={handleLogout} onRoleChange={handleRoleChange}>
                      <IncidenciasDB userRole={user.role} />
                    </MainLayout>
                  ) : (
                    <Navigate to="/login" />
                  )
                }
              />

              <Route
                path="/perfil"
                element={
                  user ? (
                    <MainLayout user={user} onLogout={handleLogout} onRoleChange={handleRoleChange}>
                      {user.role === 'trabajador' ? <WorkerSwipeShell user={user} onLogout={handleLogout} initialIndex={2} /> : <Profile user={user} onLogout={handleLogout} />}
                    </MainLayout>
                  ) : (
                    <Navigate to="/login" />
                  )
                }
              />

              <Route path="/" element={<Navigate to={user ? "/dashboard" : `/login${window.location.hash}`} />} />
              <Route path="*" element={<Navigate to={user ? "/dashboard" : `/login${window.location.hash}`} />} />
            </Routes>
          </BrowserRouter>
        </NavigationGuardProvider>
      </UndoToastProvider>
    </ThemeProvider>
  );
}


export default App;
