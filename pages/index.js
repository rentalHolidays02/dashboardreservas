import React, { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';

export default function Dashboard() {
  const [reservas, setReservas] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/reservas');
      const json = await res.json();
      
      // Ordenar por fecha de entrada (la más cercana arriba)
      const dataOrdenada = (json.data || []).sort((a, b) => {
        const dateA = new Date(a[json.keys.entrada]?.split('/').reverse().join('-'));
        const dateB = new Date(b[json.keys.entrada]?.split('/').reverse().join('-'));
        return dateA - dateB;
      });

      setReservas(dataOrdenada);
      checkAlarms(dataOrdenada, json.keys);
      setLoading(false);
    } catch (error) {
      console.error("Error cargando datos", error);
    }
  }, []);

  const checkAlarms = (data, keys) => {
    const hoy = new Date().toLocaleDateString('es-ES');
    const hayAlerta = data.some(r => r[keys.entrada] === hoy || r[keys.salida] === hoy);
    
    if (hayAlerta) {
      const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
      audio.play().catch(e => console.log("Esperando interacción para sonar"));
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 300000); // Refrescar cada 5 min
    return () => clearInterval(interval);
  }, [fetchData]);

  return (
    <div style={{ backgroundColor: '#0f1115', color: 'white', minHeight: '100vh', padding: '20px', fontFamily: 'sans-serif' }}>
      <Head><title>Dashboard Reservas</title></Head>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
        <h1>📅 Reservas Proximas</h1>
        <button onClick={() => fetchData()} style={{ padding: '10px', cursor: 'pointer' }}>🔄 Actualizar</button>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: '#1a1d23' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #333', textAlign: 'left' }}>
              <th style={{ padding: '15px' }}>ALOJAMIENTO</th>
              <th style={{ padding: '15px' }}>ORIGEN</th>
              <th style={{ padding: '15px' }}>ENTRADA</th>
              <th style={{ padding: '15px' }}>SALIDA</th>
              <th style={{ padding: '15px' }}>NOMBRE</th>
            </tr>
          </thead>
          <tbody>
            {reservas.map((res, i) => {
              const hoy = new Date().toLocaleDateString('es-ES');
              const esHoy = res['FECHA ENTRADA'] === hoy || res['FECHA SALIDA'] === hoy;
              
              return (
                <tr key={i} style={{ 
                  borderBottom: '1px solid #333', 
                  backgroundColor: esHoy ? '#2d1b00' : 'transparent',
                  height: '60px' // Altura fija para evitar que se encimen
                }}>
                  <td style={{ padding: '15px' }}>{res['ALOJAMIENTO'] || '—'}</td>
                  <td style={{ padding: '15px' }}>
                    <span style={{ 
                      padding: '4px 8px', 
                      borderRadius: '4px', 
                      fontSize: '12px',
                      backgroundColor: res['ORIGEN']?.includes('BOOKING') ? '#003580' : '#ff5a5f' 
                    }}>
                      {res['ORIGEN']}
                    </span>
                  </td>
                  <td style={{ padding: '15px', color: esHoy ? '#ff9800' : 'white' }}>{res['FECHA ENTRADA']}</td>
                  <td style={{ padding: '15px', color: esHoy ? '#ff9800' : 'white' }}>{res['FECHA SALIDA']}</td>
                  <td style={{ padding: '15px' }}>{res['NOMBRE'] || 'Sin nombre'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
