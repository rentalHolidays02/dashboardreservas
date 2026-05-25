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
import WorkerPanel from './pages/WorkerPanel';
import WorkerAnalytics from './pages/WorkerAnalytics';
import WorkerRecords from './pages/WorkerRecords';
import { User } from './services/mockData';


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
                      <GestionUsuarios />
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
                      {user.role === 'trabajador' ? <WorkerPanel user={user} /> : <Dashboard userRole={user.role} />}
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
                      <WorkerRecords user={user} />
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
                      <Workers userRole={user.role} />
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
                      <Pagos userRole={user.role} />
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
                      <GenerarInforme />
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
                path="/perfil"
                element={
                  user ? (
                    <MainLayout user={user} onLogout={handleLogout} onRoleChange={handleRoleChange}>
                      <Profile user={user} onLogout={handleLogout} />
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
