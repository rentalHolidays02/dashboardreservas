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

    // 1. FILTRADO: Solo Booking y Airbnb (ignorando mayúsculas/minúsculas)
    const filteredData = parsed.data.filter(reserva => {
      const origen = (reserva['ORIGEN'] || '').toUpperCase();
      return origen.includes('BOOKING') || origen.includes('AIRBNB');
    });

    // 2. MAPEO DE COLUMNAS (Asegúrate que coincidan con tu Excel)
    const keys = {
      alojamiento: 'ALOJAMIENTO', 
      origen: 'ORIGEN',
      entrada: 'FECHA ENTRADA',
      salida: 'FECHA SALIDA',
      nombre: 'NOMBRE',
      observaciones: 'OBSERVACIONES'
    };

    // Enviamos los datos ya filtrados al Dashboard
    res.status(200).json({ data: filteredData, keys });
  } catch (error) {
    res.status(500).json({ error: "Error al conectar con la hoja de reservas" });
  }
}
