import Papa from 'papaparse';

export default async function handler(req, res) {
  const SHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQ9XN1hs2aSSFFCI9EOP4zCo_RILZY-SXIok-ourvii_sx64LzJsY3T-AGPcllJBUjFqcuMk0UcAhpQ/pub?output=csv';

  try {
    const response = await fetch(SHEET_URL);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const csvText = await response.text();

    const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true });
    if (!parsed.data?.length) return res.status(200).json({ data: [], keys: {}, _cols: [] });

    const colNames = Object.keys(parsed.data[0] || {});

    // Función para buscar columnas por palabras clave
    const findCol = (...keywords) =>
      colNames.find(c =>
        keywords.some(kw => c.toUpperCase().trim().includes(kw.toUpperCase()))
      ) ?? null;

    // Buscamos las columnas necesarias
    const colAlojamiento = findCol('ALOJAMIENTO', 'APTO', 'PROPIEDAD');
    const colOrigen      = findCol('ORIGEN', 'CANAL', 'PORTAL');
    const colEntrada     = findCol('ENTRADA', 'LLEGADA', 'CHECK-IN', 'CHECKIN');
    const colSalida      = findCol('SALIDA', 'PARTIDA', 'CHECK-OUT', 'CHECKOUT');
    const colNombre      = findCol('NOMBRE', 'CLIENTE', 'HUÉSPED', 'HUESPED');
    const colTelefono    = findCol('TELÉFONO', 'TELEFONO', 'PHONE', 'CELULAR');
    
    // NUEVAS COLUMNAS
    const colObsEntrada  = findCol('OBSERVACION ENTRADA', 'OBS ENTRADA', 'NOTA ENTRADA');
    const colObsSalida   = findCol('OBSERVACION SALIDA', 'OBS SALIDA', 'NOTA SALIDA');

    // Columnas Financieras
    const colCobradoA    = findCol('COBRADO A');
    const colCobradoB    = findCol('COBRADO B');
    const colTotal       = findCol('TOTAL COBRADO');
    const colIngreso     = findCol('INGRESO CANAL');
    const colFechaPago   = findCol('FECHA DE PAGO');
    const colReportes    = findCol('REPORTES');

    const filteredData = parsed.data
      .filter(row => {
        const origen = String(row[colOrigen] || '').toUpperCase();
        const alojamiento = String(row[colAlojamiento] ?? '').trim();
        // Filtramos para quedarnos solo con filas que tengan Booking/Airbnb y un alojamiento válido
        if (!origen.includes('BOOKING') && !origen.includes('AIRBNB')) return false;
        if (!alojamiento || alojamiento.includes('#REF!')) return false;
        return true;
      })
      .map(row => {
        // Limpiar teléfonos (evitar notación científica si viene de Excel)
        const rawTel = row[colTelefono];
        if (rawTel !== undefined && rawTel !== null && rawTel !== '') {
          const telNum = parseFloat(String(rawTel).replace(/,/g, '.'));
          if (!isNaN(telNum)) {
            row[colTelefono] = Math.round(telNum).toString();
          }
        }
        return row;
      });

    // Mapeo de llaves para el Frontend
    const keys = {
      alojamiento:    colAlojamiento,
      origen:         colOrigen,
      entrada:        colEntrada,
      salida:         colSalida,
      nombre:         colNombre,
      telefono:       colTelefono,
      // Se eliminan 'observaciones' y 'datosKiko' y se añaden las nuevas:
      obsEntrada:     colObsEntrada,
      obsSalida:      colObsSalida,
      // Resto de campos
      reportes:       colReportes,
      cobradoA:       colCobradoA,
      cobradoB:       colCobradoB,
      totalCobrado:   colTotal,
      ingresoCanal:   colIngreso,
      fechaPago:      colFechaPago
    };

    return res.status(200).json({ 
      data: filteredData, 
      keys, 
      _cols: colNames 
    });

  } catch (error) {
    console.error("Error en API Reservas:", error);
    return res.status(500).json({ error: error.message });
  }
}
