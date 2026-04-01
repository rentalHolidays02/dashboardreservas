import Papa from 'papaparse';

export default async function handler(req, res) {
  const SHEET_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQ9XN1hs2aSSFFCI9EOP4zCo_RILZY-SXIok-ourvii_sx64LzJsY3T-AGPcllJBUjFqcuMk0UcAhpQ/pub?output=csv";

  try {
    const response = await fetch(SHEET_URL);
    const csvText = await response.text();
    
    const parsed = Papa.parse(csvText, {
      header: true,
      skipEmptyLines: true,
    });

    // 1. Buscamos los nombres reales de tus columnas dinámicamente
    const firstRow = parsed.data[0] || {};
    const colNames = Object.keys(firstRow);
    
    const realColEntrada = colNames.find(c => c.toUpperCase().includes('ENTRADA')) || 'FECHA ENTRADA';
    const realColSalida = colNames.find(c => c.toUpperCase().includes('SALIDA')) || 'FECHA SALIDA';
    const realColOrigen = colNames.find(c => c.toUpperCase().includes('ORIGEN')) || 'ORIGEN';

    // 2. FILTRADO: Solo Booking y Airbnb
    const filteredData = parsed.data.filter(reserva => {
      const origen = (reserva[realColOrigen] || '').toUpperCase().trim();
      return origen.includes('BOOKING') || origen.includes('AIRBNB');
    });

    // 3. MAPEO: Vinculamos lo que el Dashboard espera con lo que tu Excel tiene
    const keys = {
      alojamiento: 'ALOJAMIENTO', 
      origen: realColOrigen,
      entrada: realColEntrada, // <--- Aquí es donde se arreglan las fechas
      salida: realColSalida,   // <--- Aquí es donde se arreglan las fechas
      nombre: 'NOMBRE',
      observaciones: 'OBSERVACIONES',
      datosKiko: 'DATOS KIKO'
    };

    res.status(200).json({ data: filteredData, keys });
  } catch (error) {
    res.status(500).json({ error: "Error al conectar con la hoja de reservas" });
  }
}
