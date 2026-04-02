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

    // Busca columna cuyo nombre (sin espacios, mayúsculas) contenga alguna keyword
    const findCol = (...keywords) =>
      colNames.find(c =>
        keywords.some(kw => c.toUpperCase().trim().includes(kw.toUpperCase()))
      ) ?? null;

    // Busca la N-ésima columna que coincide (para duplicados como FECHA DE PAGO)
    const findColN = (n, ...keywords) => {
      let count = 0;
      for (const c of colNames) {
        if (keywords.some(kw => c.toUpperCase().trim().includes(kw.toUpperCase()))) {
          if (++count === n) return c;
        }
      }
      return null;
    };

    // ── Columnas confirmadas del sheet real ───────────────────────────────────
    // Columna exacta en el sheet → lo que buscamos
    // 'ALOJAMIENTO'          → findCol('ALOJAMIENTO')
    // 'ORIGEN'               → findCol('ORIGEN')
    // 'observaciones'        → findCol('OBSERVACIONES','OBS')   [lowercase en sheet]
    // 'ENTRADA 2026'         → findCol('ENTRADA')
    // 'SALIDA 2026'          → findCol('SALIDA')
    // 'REPORTES '            → findCol('REPORTES')              [trailing space]
    // 'NOMBRE'               → findCol('NOMBRE')
    // 'TELEFONO '            → findCol('TELEFONO','TELÉFONO')   [trailing space]
    // 'COBRADO A'            → findCol('COBRADO A')
    // 'COBRADO B'            → findCol('COBRADO B')
    // 'TOTAL COBRADO'        → findCol('TOTAL COBRADO','TOTAL')
    // 'DATOS KIKO '          → findCol('KIKO')                  [trailing space]
    // 'INGRESO CANAL NETO'   → findCol('INGRESO CANAL')
    // 'FECHA DE PAGO'        → findColN(1,'FECHA DE PAGO','FECHA PAGO')
    // 'SEGUNDO INGRESO NETO '→ findCol('SEGUNDO INGRESO','2º INGRESO')
    // 'FECHA DE PAGO '       → findColN(2,'FECHA DE PAGO','FECHA PAGO')
    // 'OBSERVACIONES '       → findColN(2,'OBSERVACIONES','OBS') [segunda columna]

    const colAlojamiento  = findCol('ALOJAMIENTO')                             ?? 'ALOJAMIENTO';
    const colOrigen       = findCol('ORIGEN')                                  ?? 'ORIGEN';
    const colEntrada      = findCol('ENTRADA')                                 ?? 'ENTRADA 2026';
    const colSalida       = findCol('SALIDA')                                  ?? 'SALIDA 2026';
    const colNombre       = findCol('NOMBRE', 'CLIENTE')                       ?? 'NOMBRE';
    const colTelefono     = findCol('TELÉFONO', 'TELEFONO', 'PHONE', 'MÓVIL') ?? 'TELEFONO ';
    const colObservacion  = findCol('OBSERVACIONES', 'OBS')                   ?? 'observaciones';
    const colReportes     = findCol('REPORTES')                               ?? null;
    const colKiko         = findCol('KIKO')                                    ?? null;
    const colCobradoA     = findCol('COBRADO A', 'COBRADOA')                  ?? null;
    const colCobradoB     = findCol('COBRADO B', 'COBRADOB')                  ?? null;
    const colTotal        = findCol('TOTAL COBRADO', 'TOTAL')                 ?? null;
    const colIngreso      = findCol('INGRESO CANAL')                           ?? null;
    const colFechaPago    = findColN(1, 'FECHA DE PAGO', 'FECHA PAGO')        ?? null;
    const colSegundo      = findCol('SEGUNDO INGRESO', '2º INGRESO')          ?? null;
    const colFechaPago2   = findColN(2, 'FECHA DE PAGO', 'FECHA PAGO')        ?? null;

    // ── Filtrado ──────────────────────────────────────────────────────────────
    const FORMULA_ERROR = /^#(N\/A|REF!|VALUE!|DIV\/0!|NAME\?|NUM!|NULL!|ERROR!)/i;

    const filteredData = parsed.data
      .filter(row => {
        const origen      = String(row[colOrigen]       ?? '').toUpperCase().trim();
        const alojamiento = String(row[colAlojamiento]  ?? '').trim();
        if (!origen.includes('BOOKING') && !origen.includes('AIRBNB')) return false;
        if (FORMULA_ERROR.test(alojamiento) || !alojamiento) return false;
        return true;
      })
      .map(row => {
        // Normalizar teléfono: convertir notación científica a string limpio
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
      observaciones:  colObservacion,
      reportes:       colReportes,
      datosKiko:      colKiko,
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
