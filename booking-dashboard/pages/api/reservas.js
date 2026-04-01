// pages/api/reservas.js
// Lee el Google Sheet publicado como CSV

export default async function handler(req, res) {
  // URL HTML publicada (fallback para parsear)
  const HTML_URL =
    'https://docs.google.com/spreadsheets/d/e/2PACX-1vQ9XN1hs2aSSFFCI9EOP4zCo_RILZY-SXIok-ourvii_sx64LzJsY3T-AGPcllJBUjFqcuMk0UcAhpQ/pubhtml';

  // Columnas conocidas del sheet
  const COL = {
    alojamiento: 'ALOJAMIENTO',
    origen: 'ORIGEN',
    observaciones: 'observaciones',
    entrada: 'ENTRADA 2026',
    salida: 'SALIDA 2026',
    reportes: 'REPORTES',
    cobradoA: 'COBRADO A',
    cobradoB: 'COBRADO B',
    totalCobrado: 'TOTAL COBRADO',
    datosKiko: 'DATOS KIKO',
    ingresoCanal: 'INGRESO CANAL NETO',
    fechaPago: 'FECHA DE PAGO',
    segundoIngreso: 'SEGUNDO INGRESO NETO',
    fechaPago2: 'FECHA DE PAGO 2',
    observaciones2: 'OBSERVACIONES',
  };

  try {
    const response = await fetch(HTML_URL, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    const html = await response.text();

    // Parse all table rows from the HTML
    const rows = [];
    const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    const tagRegex = /<[^>]+>/g;

    let trMatch;
    let headerRow = null;

    while ((trMatch = trRegex.exec(html)) !== null) {
      const cells = [];
      const cellRegex = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
      let tdMatch;
      while ((tdMatch = cellRegex.exec(trMatch[1])) !== null) {
        const text = tdMatch[1]
          .replace(tagRegex, '')
          .replace(/&amp;/g, '&')
          .replace(/&nbsp;/g, ' ')
          .replace(/&#39;/g, "'")
          .replace(/&quot;/g, '"')
          .trim();
        cells.push(text);
      }
      if (cells.length > 2) {
        if (!headerRow && cells.some(c =>
          /alojamiento|origen|entrada|salida/i.test(c)
        )) {
          headerRow = cells;
        } else if (headerRow) {
          rows.push(cells);
        }
      }
    }

    if (!headerRow) {
      return res.status(200).json({
        error: 'No se encontró la cabecera. Verifica que el Sheet está publicado.',
        headers: [],
        data: [],
      });
    }

    // Normalize header names
    const normalizedHeaders = headerRow.map(h => h.trim());

    // Map rows to objects
    const allData = rows
      .map(row => {
        const obj = {};
        normalizedHeaders.forEach((h, i) => {
          obj[h] = (row[i] || '').trim();
        });
        return obj;
      })
      .filter(obj => Object.values(obj).some(v => v !== ''));

    // Find actual column keys (flexible matching)
    function findKey(pattern) {
      return normalizedHeaders.find(h => pattern.test(h)) || null;
    }

    const keys = {
      alojamiento: findKey(/alojamiento/i),
      origen: findKey(/origen/i),
      entrada: findKey(/entrada/i),
      salida: findKey(/salida/i),
      observaciones: findKey(/observaci/i),
      cobradoA: findKey(/cobrado\s*a/i),
      cobradoB: findKey(/cobrado\s*b/i),
      totalCobrado: findKey(/total\s*cobrado/i),
      datosKiko: findKey(/kiko/i),
      ingresoCanal: findKey(/ingreso\s*canal/i),
      fechaPago: findKey(/fecha\s*de\s*pago/i),
      segundoIngreso: findKey(/segundo\s*ingreso/i),
      reportes: findKey(/reporte/i),
    };

    // Filter Booking and Airbnb only
    const filtered = allData.filter(row => {
      const origen = (row[keys.origen] || '').toLowerCase();
      return origen.includes('booking') || origen.includes('airbnb');
    });

    res.status(200).json({
      headers: normalizedHeaders,
      keys,
      total: filtered.length,
      totalAll: allData.length,
      data: filtered,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
