import React, { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';

export default function Dashboard() {
  const [reservas, setReservas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState('');

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/reservas');
      const json = await res.json();
      
      // Ordenar por fecha de entrada
      const dataOrdenada = (json.data || []).sort((a, b) => {
        const dateA = new Date(a[json.keys.entrada]?.split('/').reverse().join('-'));
        const dateB = new Date(b[json.keys.entrada]?.split('/').reverse().join('-'));
        return dateA - dateB;
      });

      setReservas(dataOrdenada);
      setLastUpdate(new Date().toLocaleTimeString());
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
      audio.play().catch(() => console.log("Clic para activar sonido"));
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 300000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const stats = {
    total: reservas.length,
    booking: reservas.filter(r => r.ORIGEN?.includes('BOOKING')).length,
    airbnb: reservas.filter(r => r.ORIGEN?.includes('AIRBNB')).length,
    hoy: reservas.filter(r => {
        const hoy = new Date().toLocaleDateString('es-ES');
        return r['FECHA ENTRADA'] === hoy || r['FECHA SALIDA'] === hoy;
    }).length
  };

  return (
    <div style={{ backgroundColor: '#060709', color: '#e1e1e1', minHeight: '100vh', padding: '24px', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <Head><title>Reservas Dashboard</title></Head>

      {/* Header Estilo Original */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
        <h1 style={{ margin: 0, fontSize: '24px', fontWeight: '800', letterSpacing: '-0.5px' }}>
          <span style={{ color: '#ff6b00' }}>●</span> Reservas Dashboard
        </h1>
        <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', color: '#666' }}>Actualizado: {lastUpdate}</span>
            <button onClick={() => fetchData()} style={{ backgroundColor: '#1a1d23', color: 'white', border: '1px solid #333', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' }}>
               🔄 Actualizar
            </button>
        </div>
      </div>

      {/* Tarjetas de Estadísticas */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '40px' }}>
        {[
          { label: 'TOTAL RESERVAS', val: stats.total, color: '#ff6b00' },
          { label: 'BOOKING', val: stats.booking, color: '#003580' },
          { label: 'AIRBNB', val: stats.airbnb, color: '#ff5a5f' },
          { label: 'ALERTAS HOY', val: stats.hoy, color: '#ffcc00' }
        ].map((s, i) => (
          <div key={i} style={{ backgroundColor: '#11141a', padding: '20px', borderRadius: '12px', border: '1px solid #222' }}>
            <div style={{ fontSize: '11px', fontWeight: '700', color: '#666', marginBottom: '8px' }}>{s.label}</div>
            <div style={{ fontSize: '32px', fontWeight: '900', color: s.color }}>{s.val}</div>
          </div>
        ))}
      </div>

      {/* Tabla con Estilo Corregido */}
      <div style={{ backgroundColor: '#11141a', borderRadius: '12px', border: '1px solid #222', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #222', color: '#666', fontSize: '12px' }}>
              <th style={{ padding: '20px' }}>ALOJAMIENTO</th>
              <th style={{ padding: '20px' }}>ORIGEN</th>
              <th style={{ padding: '20px' }}>ENTRADA</th>
              <th style={{ padding: '20px' }}>SALIDA</th>
              <th style={{ padding: '20px' }}>NOMBRE</th>
            </tr>
          </thead>
          <tbody>
            {reservas.map((res, i) => {
              const hoy = new Date().toLocaleDateString('es-ES');
              const esHoy = res['FECHA ENTRADA'] === hoy || res['FECHA SALIDA'] === hoy;
              const esBooking = res['ORIGEN']?.includes('BOOKING');

              return (
                <tr key={i} style={{ 
                  borderBottom: '1px solid #1a1d23', 
                  backgroundColor: esHoy ? 'rgba(255, 107, 0, 0.05)' : 'transparent',
                  transition: 'background 0.2s'
                }}>
                  <td style={{ padding: '18px 20px', fontWeight: '600', fontSize: '14px' }}>{res['ALOJAMIENTO']}</td>
                  <td style={{ padding: '18px 20px' }}>
                    <span style={{ 
                      padding: '5px 10px', 
                      borderRadius: '6px', 
                      fontSize: '11px', 
                      fontWeight: '800',
                      backgroundColor: esBooking ? 'rgba(0, 53, 128, 0.2)' : 'rgba(255, 90, 95, 0.2)',
                      color: esBooking ? '#4a90e2' : '#ff5a5f',
                      border: `1px solid ${esBooking ? '#003580' : '#ff5a5f'}`
                    }}>
                      {res['ORIGEN']}
                    </span>
                  </td>
                  <td style={{ padding: '18px 20px', color: esHoy ? '#ffcc00' : '#ccc', fontWeight: esHoy ? 'bold' : 'normal' }}>{res['FECHA ENTRADA']}</td>
                  <td style={{ padding: '18px 20px', color: esHoy ? '#ffcc00' : '#ccc', fontWeight: esHoy ? 'bold' : 'normal' }}>{res['FECHA SALIDA']}</td>
                  <td style={{ padding: '18px 20px', color: '#888' }}>{res['NOMBRE'] || 'Invitado'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
