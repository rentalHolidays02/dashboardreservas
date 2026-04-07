import { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { NavigationGuardProvider } from './context/NavigationGuardContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Cleans from './pages/Cleans';
import Workers from './pages/Workers';
import Incidencias from './pages/Incidencias';
import Pagos from './pages/Pagos';
import Alojamientos from './pages/Alojamientos';
import Analisis from './pages/Analisis';
import GenerarInforme from './pages/GenerarInforme';
import MainLayout from './components/layout/MainLayout';
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

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('rh_user');
  };

  return (
    <ThemeProvider>
    <NavigationGuardProvider>
    <BrowserRouter>
      <Routes>
        <Route 
          path="/login" 
          element={user ? <Navigate to="/dashboard" /> : <Login onLoginSuccess={handleLoginSuccess} />} 
        />
        
        <Route 
          path="/dashboard" 
          element={
            user ? (
              <MainLayout userRole={user.role} onLogout={handleLogout}>
                <Dashboard />
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
              <MainLayout userRole={user.role} onLogout={handleLogout}>
                <Cleans />
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
              <MainLayout userRole={user.role} onLogout={handleLogout}>
                <Workers />
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
              <MainLayout userRole={user.role} onLogout={handleLogout}>
                <Incidencias />
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
              <MainLayout userRole={user.role} onLogout={handleLogout}>
                <Pagos />
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
              <MainLayout userRole={user.role} onLogout={handleLogout}>
                <Alojamientos />
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
              <MainLayout userRole={user.role} onLogout={handleLogout}>
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
              <MainLayout userRole={user.role} onLogout={handleLogout}>
                <GenerarInforme />
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
    </ThemeProvider>
  );
}


export default App;
