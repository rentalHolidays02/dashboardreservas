import Papa from 'papaparse';

export default async function handler(req, res) {
  const SHEET_URL =
    'https://docs.google.com/spreadsheets/d/e/2PACX-1vQ9XN1hs2aSSFFCI9EOP4zCo_RILZY-SXIok-ourvii_sx64LzJsY3T-AGPcllJBUjFqcuMk0UcAhpQ/pub?output=csv';

  try {
    const response = await fetch(SHEET_URL);
    if (!response.ok) throw new Error(`HTTP ${response.status} al obtener el Sheet`);
    const csvText = await response.text();

    const parsed = Papa.parse(csvText, {
      header: true,
      skipEmptyLines: true,
    });

    if (!parsed.data?.length) {
      return res.status(200).json({ data: [], keys: {} });
    }

    // ── Detección dinámica de columnas ────────────────────────────────────────
    // Busca la primera columna cuyo nombre contenga alguna de las palabras clave.
    // Insensible a mayúsculas y espacios extra.
    const colNames = Object.keys(parsed.data[0] || {});

    const findCol = (...keywords) =>
      colNames.find(c =>
        keywords.some(kw => c.toUpperCase().trim().includes(kw.toUpperCase()))
      ) ?? null;

    // Columnas principales
    const colAlojamiento  = findCol('ALOJAMIENTO')              ?? 'ALOJAMIENTO';
    const colOrigen       = findCol('ORIGEN')                   ?? 'ORIGEN';
    const colEntrada      = findCol('ENTRADA')                  ?? 'FECHA ENTRADA';
    const colSalida       = findCol('SALIDA')                   ?? 'FECHA SALIDA';
    const colNombre       = findCol('NOMBRE', 'CLIENTE')        ?? 'NOMBRE';
    const colObservacion  = findCol('OBSERVACIONES', 'OBS')     ?? 'OBSERVACIONES';
    const colKiko         = findCol('KIKO')                     ?? 'DATOS KIKO';

    // Columnas financieras (pueden no existir → null es válido, el frontend muestra —)
    const colCobradoA     = findCol('COBRADO A',    'COBRADOA');
    const colCobradoB     = findCol('COBRADO B',    'COBRADOB');
    const colTotal        = findCol('TOTAL COBRADO','TOTAL');
    const colIngreso      = findCol('INGRESO CANAL','INGRESO NET');
    const colFechaPago    = findCol('FECHA PAGO')   && !findCol('FECHA PAGO 2')
                              ? findCol('FECHA PAGO') : colNames.find(c =>
                                  c.toUpperCase().includes('FECHA PAGO') &&
                                  !c.toUpperCase().includes('2')
                                ) ?? null;
    const colSegundo      = findCol('2º INGRESO', 'SEGUNDO INGRESO', '2 INGRESO');
    const colFechaPago2   = colNames.find(c =>
                              c.toUpperCase().includes('FECHA PAGO') &&
                              (c.includes('2') || c.toUpperCase().includes('DOS'))
                            ) ?? null;
    const colReportes     = findCol('REPORTES', 'REPORTE');

    // ── Patrones de error de fórmula de Google Sheets ─────────────────────────
    const FORMULA_ERROR = /^#(N\/A|REF!|VALUE!|DIV\/0!|NAME\?|NUM!|NULL!|ERROR!)/i;

    // ── Filtrado ──────────────────────────────────────────────────────────────
    // 1. Solo filas con origen Booking o Airbnb
    // 2. Excluir filas cuyo alojamiento sea un error de fórmula o esté vacío
    const filteredData = parsed.data.filter(row => {
      const origen     = String(row[colOrigen]       ?? '').toUpperCase().trim();
      const alojamiento = String(row[colAlojamiento] ?? '').trim();

      // Descartar si no es Booking ni Airbnb
      if (!origen.includes('BOOKING') && !origen.includes('AIRBNB')) return false;

      // Descartar filas con errores de fórmula en columna alojamiento
      if (FORMULA_ERROR.test(alojamiento)) return false;

      // Descartar filas completamente vacías en alojamiento
      if (!alojamiento) return false;

      return true;
    });

    // ── Mapa de keys para el Dashboard ───────────────────────────────────────
    // El frontend accede como row[keys.alojamiento], row[keys.origen], etc.
    const keys = {
      // Principales
      alojamiento:   colAlojamiento,
      origen:        colOrigen,
      entrada:       colEntrada,
      salida:        colSalida,
      nombre:        colNombre,
      observaciones: colObservacion,
      datosKiko:     colKiko,
      // Financieras
      cobradoA:      colCobradoA,
      cobradoB:      colCobradoB,
      totalCobrado:  colTotal,
      ingresoCanal:  colIngreso,
      fechaPago:     colFechaPago,
      segundoIngreso: colSegundo,
      fechaPago2:    colFechaPago2,
      reportes:      colReportes,
    };

    return res.status(200).json({ data: filteredData, keys });

  } catch (error) {
    console.error('[reservas API]', error);
    return res.status(500).json({ error: error.message || 'Error al conectar con la hoja de reservas' });
  }
}
