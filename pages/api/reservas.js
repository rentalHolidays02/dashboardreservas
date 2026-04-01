import Papa from 'papaparse';

export default async function handler(req, res) {
  // Tu enlace publicado como CSV
  const SHEET_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQ9XN1hs2aSSFFCI9EOP4zCo_RILZY-SXIok-ourvii_sx64LzJsY3T-AGPcllJBUjFqcuMk0UcAhpQ/pub?output=csv";

  try {
    const response = await fetch(SHEET_URL);
    const csvText = await response.text();
    
    const parsed = Papa.parse(csvText, {
      header: true,
      skipEmptyLines: true,
    });

    // Mapeo de columnas: Asegúrate de que los nombres a la derecha (ej: 'ORIGEN') 
    // sean IDÉNTICOS a la primera fila de tu Excel.
    const keys = {
      alojamiento: 'ALOJAMIENTO', 
      origen: 'ORIGEN',
      entrada: 'FECHA ENTRADA',
      salida: 'FECHA SALIDA',
      observaciones: 'OBSERVACIONES',
      datosKiko: 'DATOS KIKO',
      cobradoA: 'COBRADO A',
      cobradoB: 'COBRADO B',
      totalCobrado: 'TOTAL COBRADO',
      ingresoCanal: 'INGRESO CANAL NETO',
      nombre: 'NOMBRE' // Añadido por si tienes una columna de nombre de cliente
    };

    res.status(200).json({ data: parsed.data, keys });
  } catch (error) {
    res.status(500).json({ error: "Error al conectar con Google Sheets" });
  }
}
