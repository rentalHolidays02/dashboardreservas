import React from 'react'
import ReactDOM from 'react-dom/client'

// Interceptar el hash antes de importar App (que importa supabaseClient de forma síncrona en cascada)
if (window.location.hash) {
  const hash = window.location.hash;
  if (hash.includes('type=recovery')) {
    sessionStorage.setItem('is_recovery', 'true');
    // Limpiar el hash de la URL inmediatamente para evitar que se vuelva a procesar al recargar
    window.history.replaceState(null, '', window.location.pathname);
  } else if (hash.includes('type=invite') || hash.includes('type=signup')) {
    sessionStorage.setItem('is_invite', 'true');
    // Limpiar el hash de la URL inmediatamente
    window.history.replaceState(null, '', window.location.pathname);
  }
}

import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
