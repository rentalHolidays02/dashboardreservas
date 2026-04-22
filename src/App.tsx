import { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { NavigationGuardProvider } from './context/NavigationGuardContext';
import { UndoToastProvider } from './context/UndoToastContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Cleans from './pages/Cleans';
import Workers from './pages/Workers';
import Incidencias from './pages/Incidencias';
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
import type { User } from './services/mockData';

function App() {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('rh_user');
    return saved ? JSON.parse(saved) : null;
  });

  const handleLoginSuccess = (userData: User) => {
    setUser(userData);
    localStorage.setItem('rh_user', JSON.stringify(userData));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('rh_user');
  };

  const handleRoleChange = (newRole: 'admin' | 'viewer' | 'trabajador') => {
    if (user) {
      const updatedUser = { ...user, role: newRole };
      setUser(updatedUser);
      localStorage.setItem('rh_user', JSON.stringify(updatedUser));
    }
  };

  return (
    <ThemeProvider>
    <UndoToastProvider>
    <NavigationGuardProvider>
    <BrowserRouter>
      {user && <ChatBot />}
      <Routes>
        <Route 
          path="/login" 
          element={user ? <Navigate to="/dashboard" /> : <Login onLoginSuccess={handleLoginSuccess} />} 
        />
        
        <Route
          path="/usuarios"
          element={
            user ? (
              <MainLayout userRole={user.role} onLogout={handleLogout} onRoleChange={handleRoleChange}>
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
              <MainLayout userRole={user.role} onLogout={handleLogout} onRoleChange={handleRoleChange}>
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
              <MainLayout userRole={user.role} onLogout={handleLogout} onRoleChange={handleRoleChange}>
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
              <MainLayout userRole={user.role} onLogout={handleLogout} onRoleChange={handleRoleChange}>
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
              <MainLayout userRole={user.role} onLogout={handleLogout} onRoleChange={handleRoleChange}>
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
              <MainLayout userRole={user.role} onLogout={handleLogout} onRoleChange={handleRoleChange}>
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
              <MainLayout userRole={user.role} onLogout={handleLogout} onRoleChange={handleRoleChange}>
                <Incidencias userRole={user.role} />
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
              <MainLayout userRole={user.role} onLogout={handleLogout} onRoleChange={handleRoleChange}>
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
              <MainLayout userRole={user.role} onLogout={handleLogout} onRoleChange={handleRoleChange}>
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
              <MainLayout userRole={user.role} onLogout={handleLogout} onRoleChange={handleRoleChange}>
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
              <MainLayout userRole={user.role} onLogout={handleLogout} onRoleChange={handleRoleChange}>
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
              <MainLayout userRole={user.role} onLogout={handleLogout} onRoleChange={handleRoleChange}>
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
              <MainLayout userRole={user.role} onLogout={handleLogout} onRoleChange={handleRoleChange}>
                <Profile user={user} onLogout={handleLogout} />
              </MainLayout>
            ) : (
              <Navigate to="/login" />
            )
          }
        />

        <Route path="*" element={<Navigate to={user ? "/dashboard" : "/login"} />} />
      </Routes>
    </BrowserRouter>
    </NavigationGuardProvider>
    </UndoToastProvider>
    </ThemeProvider>
  );
}


export default App;
