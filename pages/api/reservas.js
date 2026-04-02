// api/reservas.js
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

    // Función para buscar la N-ésima coincidencia (útil para FECHA DE PAGO)
    const findColN = (n, ...keywords) => {
      let count = 0;
      for (const c of colNames) {
        if (keywords.some(kw => c.toUpperCase().trim().includes(kw.toUpperCase()))) {
          if (++count === n) return c;
        }
      }
      return null;
    };

    // --- MAREO DE COLUMNAS ACTUALIZADO ---
    const colAlojamiento = findCol('ALOJAMIENTO')                             ?? 'ALOJAMIENTO';
    const colOrigen      = findCol('ORIGEN')                                  ?? 'ORIGEN';
    const colEntrada     = findCol('ENTRADA')                                 ?? 'ENTRADA 2026';
    const colSalida      = findCol('SALIDA')                                  ?? 'SALIDA 2026';
    const colNombre      = findCol('NOMBRE', 'CLIENTE')                       ?? 'NOMBRE';
    const colTelefono    = findCol('TELÉFONO', 'TELEFONO', 'PHONE', 'MÓVIL') ?? 'TELEFONO ';
    
    // NUEVAS COLUMNAS DE OBSERVACIONES (Reemplazan a 'Observaciones' y 'Kiko')
    const colObsEntrada  = findCol('OBSERVACION ENTRADA', 'OBS ENTRADA', 'NOTA ENTRADA');
    const colObsSalida   = findCol('OBSERVACION SALIDA', 'OBS SALIDA', 'NOTA SALIDA');

    const colReportes    = findCol('REPORTES')                               ?? null;
    const colCobradoA    = findCol('COBRADO A', 'COBRADOA')                  ?? null;
    const colCobradoB    = findCol('COBRADO B', 'COBRADOB')                  ?? null;
    const colTotal       = findCol('TOTAL COBRADO', 'TOTAL')                 ?? null;
    const colIngreso     = findCol('INGRESO CANAL')                           ?? null;
    const colFechaPago   = findColN(1, 'FECHA DE PAGO', 'FECHA PAGO')        ?? null;
    const colSegundo     = findCol('SEGUNDO INGRESO', '2º INGRESO')          ?? null;
    const colFechaPago2  = findColN(2, 'FECHA DE PAGO', 'FECHA PAGO')        ?? null;

    const FORMULA_ERROR = /^#(N\/A|REF!|VALUE!|DIV\/0!|NAME\?|NUM!|NULL!|ERROR!)/i;

    const filteredData = parsed.data
      .filter(row => {
        const origen      = String(row[colOrigen]       ?? '').toUpperCase().trim();
        const alojamiento = String(row[colAlojamiento]  ?? '').trim();
        // Filtramos para quedarnos solo con Booking/Airbnb y evitar errores de fórmula
        if (!origen.includes('BOOKING') && !origen.includes('AIRBNB')) return false;
        if (FORMULA_ERROR.test(alojamiento) || !alojamiento) return false;
        return true;
      })
      .map(row => {
        // Limpiar teléfono (evitar notación científica de Excel)
        const rawTel = row[colTelefono];
        if (rawTel !== undefined && rawTel !== null && rawTel !== '') {
          const telNum = parseFloat(String(rawTel).replace(/,/g, '.'));
          if (!isNaN(telNum)) {
            row[colTelefono] = Math.round(telNum).toString();
          }
        }
        return row;
      });

    const keys = {
      alojamiento:    colAlojamiento,
      origen:         colOrigen,
      entrada:        colEntrada,
      salida:         colSalida,
      nombre:         colNombre,
      telefono:       colTelefono,
      // Mapeo para el frontend editable
      obsEntrada:     colObsEntrada,
      obsSalida:      colObsSalida,
      reportes:       colReportes,
      cobradoA:       colCobradoA,
      cobradoB:       colCobradoB,
      totalCobrado:   colTotal,
      ingresoCanal:   colIngreso,
      fechaPago:      colFechaPago,
      segundoIngreso: colSegundo,
      fechaPago2:     colFechaPago2,
    };

    return res.status(200).json({ data: filteredData, keys, _cols: colNames });

  } catch (error) {
    console.error('[reservas API]', error);
    return res.status(500).json({ error: error.message || 'Error al conectar con el Sheet' });
  }
}
