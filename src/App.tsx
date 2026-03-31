import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Cleans from './pages/Cleans';
import Workers from './pages/Workers';
import Incidencias from './pages/Incidencias';
import Pagos from './pages/Pagos';
import MainLayout from './components/layout/MainLayout';
import { User } from './services/mockData';

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(true);

  useEffect(() => {
    // Simular persistencia de sesión básica en localStorage para el MVP
    const savedUser = localStorage.getItem('rh_user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
    setIsAuthenticating(false);
  }, []);

  const handleLoginSuccess = (userData: User) => {
    setUser(userData);
    localStorage.setItem('rh_user', JSON.stringify(userData));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('rh_user');
  };

  if (isAuthenticating) {
    return <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
    </div>;
  }

  return (
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

        <Route path="*" element={<Navigate to={user ? "/dashboard" : "/login"} />} />
      </Routes>
    </BrowserRouter>
  );
}


export default App;
