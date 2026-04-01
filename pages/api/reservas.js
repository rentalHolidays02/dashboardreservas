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

    // 1. FILTRADO ESTRICTO: Solo Booking y Airbnb
    // Usamos .includes para capturar si escribes "BOOKING.COM" o similares
    const filteredData = parsed.data.filter(reserva => {
      const origen = (reserva['ORIGEN'] || '').toUpperCase().trim();
      return origen.includes('BOOKING') || origen.includes('AIRBNB');
    });

    // 2. MAPEO DE COLUMNAS (Ajustado según tu captura de pantalla)
    // Si en tu Excel las columnas se llaman distinto, cámbialas AQUÍ a la derecha:
    const keys = {
      alojamiento: 'ALOJAMIENTO', 
      origen: 'ORIGEN',
      entrada: 'FECHA ENTRADA', // Revisa si en tu Excel tiene espacio o tilde
      salida: 'FECHA SALIDA',   // Revisa si en tu Excel tiene espacio o tilde
      nombre: 'NOMBRE',
      observaciones: 'OBSERVACIONES',
      datosKiko: 'DATOS KIKO'
    };

    res.status(200).json({ data: filteredData, keys });
  } catch (error) {
    res.status(500).json({ error: "Error al conectar con la hoja de reservas" });
  }
}
