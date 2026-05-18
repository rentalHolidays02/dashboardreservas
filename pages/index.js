import { useState, useEffect } from 'react';
import Papa from 'papaparse';

export default function DashboardReservas() {
  const [reservas, setReservas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  
  // Filtros del Dashboard
  const [busqueda, setBusqueda] = useState('');
  const [filtroRapido, setFiltroRapido] = useState('TODAS');

  // Enlace de tu Google Sheets publicado como CSV
  const URL_CSV = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQ9XN1hs2aSSFFCI9EOP4zCo_RILZY-SXIok-ourvii_sx64LzJsY3T-AGPcllJBUjFqcuMk0UcAhpQ/pub?output=csv";

  useEffect(() => {
    async function cargarSheet() {
      try {
        const respuesta = await fetch(URL_CSV);
        if (!respuesta.ok) throw new Error("No se pudo conectar con Google Sheets.");
        
        const textoCSV = await respuesta.text();

        Papa.parse(textoCSV, {
          header: false, // Leemos filas puras para encontrar la cabecera real dinámicamente
          skipEmptyLines: true,
          complete: (resultado) => {
            const filas = resultado.data;
            if (filas.length === 0) return;

            // 1. Localizar la fila donde están los títulos (busca la que tenga 'ALOJAMIENTO' o 'PROPIEDAD')
            let idxCabecera = filas.findIndex(f => 
              f.some(celda => {
                const texto = String(celda).toUpperCase();
                return texto.includes("ALOJAMIENTO") || texto.includes("PROPIEDAD");
              })
            );

            if (idxCabecera === -1) idxCabecera = 0; // Fallback por si acaso

            // Limpiamos los títulos pasándolos a mayúsculas
            const cabeceras = filas[idxCabecera].map(c => String(c).trim().toUpperCase());

            // 2. Mapeo tolerante de índices (Busca coincidencias parciales para evitar fallos por años o acentos)
            const idxRef = cabeceras.findIndex(c => c.includes("REF") || c === "`" || c === "");
            const idxPropiedad = cabeceras.findIndex(c => c.includes("ALOJAMIENTO") || c.includes("PROPIEDAD"));
            const idxOrigen = cabeceras.findIndex(c => c.includes("ORIGEN") || c.includes("CANAL"));
            const idxEntrada = cabeceras.findIndex(c => c.includes("ENTRADA") || c.includes("INGRESO"));
            const idxSalida = cabeceras.findIndex(c => c.includes("SALIDA"));
            const idxCliente = cabeceras.findIndex(c => c.includes("NOMBRE") || c.includes("CLIENTE"));
            const idxTelefono = cabeceras.findIndex(c => c.includes("TELEFONO") || c.includes("MÓVIL") || c.includes("MOVIL"));
            const idxTotal = cabeceras.findIndex(c => c.includes("TOTAL COBRADO") || c.includes("MONTO") || c.includes("COBRADO A"));
            const idxObs = cabeceras.findIndex(c => c.includes("OBSERVAC"));

            const listaProcesada = [];
            
            // Obtener fecha de hoy en formato local de España (YYYY-MM-DD)
            const hoyStr = new Date().toLocaleDateString('sv-SE'); 

            // 3. Procesar las filas de datos desde la cabecera en adelante
            for (let i = idxCabecera + 1; i < filas.length; i++) {
              const fila = filas[i];
              
              // Evitar celdas vacías o filas con fórmulas rotas de Excel (#N/A)
              if (!fila[idxPropiedad] || String(fila[idxPropiedad]).startsWith("#")) continue;

              const propiedadNombre = String(fila[idxPropiedad]).trim();
              if (propiedadNombre === "" || propiedadNombre.toUpperCase() === "ALOJAMIENTO") continue;

              // Extraer y limpiar fechas de entrada/salida
              const fechaEntrada = fila[idxEntrada] ? String(fila[idxEntrada]).trim() : '';
              const fechaSalida = fila[idxSalida] ? String(fila[idxSalida]).trim() : '';
              const origenCanal = fila[idxOrigen] ? String(fila[idxOrigen]).trim().toUpperCase() : 'MANUAL';

              listaProcesada.push({
                ref: fila[idxRef] ? String(fila[idxRef]).replace(/['`]/g, '').trim() : '-',
                propiedad: propiedadNombre,
                origen: origenCanal,
                entrada: fechaEntrada || '-',
                salida: fechaSalida || '-',
                cliente: fila[idxCliente] ? String(fila[idxCliente]).trim() : 'Huésped',
                telefono: fila[idxTelefono] ? String(fila[idxTelefono]).trim() : '',
                total: fila[idxTotal] ? String(fila[idxTotal]).trim() : '0',
                observaciones: fila[idxObs] ? String(fila[idxObs]).trim() : '',
                esEntradaHoy: fechaEntrada === hoyStr,
                esSalidaHoy: fechaSalida === hoyStr
              });
            }

            setReservas(listaProcesada);
            setCargando(false);
          },
          error: (err) => {
            throw new Error(err.message);
          }
        });

      } catch (err) {
        setError(err.message);
        setCargando(false);
      }
    }

    cargarSheet();
  }, []);

  // Filtros combinados de la barra de búsqueda y botones rápidos
  const reservasFiltradas = reservas.filter(res => {
    const coincideBusqueda = 
      res.propiedad.toLowerCase().includes(busqueda.toLowerCase()) ||
      res.cliente.toLowerCase().includes(busqueda.toLowerCase()) ||
      res.telefono.includes(busqueda);

    if (filtroRapido === 'HOY_ENTRADA') return coincideBusqueda && res.esEntradaHoy;
    if (filtroRapido === 'HOY_SALIDA') return coincideBusqueda && res.esSalidaHoy;
    if (filtroRapido === 'BOOKING') return coincideBusqueda && res.origen.includes('BOOKING');
    if (filtroRapido === 'AIRBNB') return coincideBusqueda && res.origen.includes('AIRBNB');

    return coincideBusqueda;
  });

  const totalEntradasHoy = reservas.filter(r => r.esEntradaHoy).length;
  const totalSalidasHoy = reservas.filter(r => r.esSalidaHoy).length;

  if (cargando) return <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>⏳ Sincronizando con Google Sheets y organizando alojamientos...</div>;
  if (error) return <div style={{ color: 'red', padding: '20px' }}>❌ Error al leer las columnas: {error}</div>;

  return (
    <div style={{ padding: '24px', fontFamily: 'sans-serif', backgroundColor: '#f8fafc', minHeight: '100vh' }}>
      
      {/* Barra superior */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#0f172a', margin: 0 }}>📅 Dashboard de Reservas</h1>
          <p style={{ fontSize: '14px', color: '#64748b', margin: '4px 0 0 0' }}>Control operativo en tiempo real 2026</p>
        </div>
        <input 
          type="text" 
          placeholder="🔍 Buscar por propiedad, cliente o móvil..." 
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          style={{ padding: '10px 16px', width: '320px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }}
        />
      </div>

      {/* Selectores de visualización rápida */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', alignItems: 'center', flexWrap: 'wrap' }}>
        <button onClick={() => setFiltroRapido('TODAS')} style={{ padding: '10px 16px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: filtroRapido === 'TODAS' ? '#0f172a' : '#fff', color: filtroRapido === 'TODAS' ? '#fff' : '#0f172a', cursor: 'pointer', fontWeight: '500' }}>Todas ({reservas.length})</button>
        <button onClick={() => setFiltroRapido('HOY_ENTRADA')} style={{ padding: '10px 16px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: filtroRapido === 'HOY_ENTRADA' ? '#2563eb' : '#fff', color: filtroRapido === 'HOY_ENTRADA' ? '#fff' : '#2563eb', cursor: 'pointer', fontWeight: '500' }}>📥 Entradas Hoy ({totalEntradasHoy})</button>
        <button onClick={() => setFiltroRapido('HOY_SALIDA')} style={{ padding: '10px 16px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: filtroRapido === 'HOY_SALIDA' ? '#dc2626' : '#fff', color: filtroRapido === 'HOY_SALIDA' ? '#fff' : '#dc2626', cursor: 'pointer', fontWeight: '500' }}>📤 Salidas Hoy ({totalSalidasHoy})</button>
        <button onClick={() => setFiltroRapido('BOOKING')} style={{ padding: '10px 16px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: filtroRapido === 'BOOKING' ? '#003580' : '#fff', color: filtroRapido === 'BOOKING' ? '#fff' : '#003580', cursor: 'pointer', fontWeight: '500' }}>Booking</button>
        <button onClick={() => setFiltroRapido('AIRBNB')} style={{ padding: '10px 16px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: filtroRapido === 'AIRBNB' ? '#ff5a5f' : '#fff', color: filtroRapido === 'AIRBNB' ? '#fff' : '#ff5a5f', cursor: 'pointer', fontWeight: '500' }}>Airbnb</button>
      </div>

      {/* Tabla estilo Excel */}
      <div style={{ background: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <div style={{ overflowX: 'auto', maxHeight: '650px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
            <thead style={{ position: 'sticky', top: 0, backgroundColor: '#f8fafc', zIndex: 1 }}>
              <tr>
                <th style={{ padding: '14px 16px', borderBottom: '2px solid #e2e8f0', color: '#475569' }}>Ref</th>
                <th style={{ padding: '14px 16px', borderBottom: '2px solid #e2e8f0', color: '#475569' }}>Alojamiento</th>
                <th style={{ padding: '14px 16px', borderBottom: '2px solid #e2e8f0', color: '#475569' }}>Origen</th>
                <th style={{ padding: '14px 16px', borderBottom: '2px solid #e2e8f0', color: '#475569' }}>Cliente</th>
                <th style={{ padding: '14px 16px', borderBottom: '2px solid #e2e8f0', color: '#475569' }}>Teléfono</th>
                <th style={{ padding: '14px 16px', borderBottom: '2px solid #e2e8f0', color: '#475569' }}>Entrada</th>
                <th style={{ padding: '14px 16px', borderBottom: '2px solid #e2e8f0', color: '#475569' }}>Salida</th>
                <th style={{ padding: '14px 16px', borderBottom: '2px solid #e2e8f0', color: '#475569' }}>Monto</th>
                <th style={{ padding: '14px 16px', borderBottom: '2px solid #e2e8f0', color: '#475569' }}>Observaciones</th>
              </tr>
            </thead>
            <tbody>
              {reservasFiltradas.length === 0 ? (
                <tr>
                  <td colSpan="9" style={{ padding: '32px', textAlign: 'center', color: '#94a3b8' }}>No hay registros que coincidan con la búsqueda.</td>
                </tr>
              ) : (
                reservasFiltradas.map((res, idx) => (
                  <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? '#fff' : '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '12px 16px', color: '#64748b' }}>{res.ref}</td>
                    <td style={{ padding: '12px 16px', fontWeight: '600', color: '#0f172a' }}>{res.propiedad}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', backgroundColor: res.origen.includes('BOOKING') ? '#e0f2fe' : res.origen.includes('AIRBNB') ? '#fee2e2' : '#f1f5f9', color: res.origen.includes('BOOKING') ? '#0369a1' : res.origen.includes('AIRBNB') ? '#b91c1c' : '#475569' }}>
                        {res.origen}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', color: '#334155' }}>{res.cliente}</td>
                    <td style={{ padding: '12px 16px', color: '#334155' }}>{res.telefono || '-'}</td>
                    <td style={{ padding: '12px 16px', color: '#0f172a', backgroundColor: res.esEntradaHoy ? '#dbeafe' : 'transparent' }}>{res.entrada}</td>
                    <td style={{ padding: '12px 16px', color: '#0f172a', backgroundColor: res.esSalidaHoy ? '#fee2e2' : 'transparent' }}>{res.salida}</td>
                    <td style={{ padding: '12px 16px', fontWeight: 'bold', color: '#16a34a' }}>{res.total} €</td>
                    <td style={{ padding: '12px 16px', fontSize: '12px', color: '#4a5568', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={res.observaciones}>
                      {res.observaciones || '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
