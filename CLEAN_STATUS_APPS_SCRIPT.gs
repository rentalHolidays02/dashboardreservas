function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return jsonResponse({ ok: false, error: 'Missing post data' });
    }

    var payload = JSON.parse(e.postData.contents);
    var action = String(payload.action || '');
    
    // Auth simple opcional (si fuera necesaria)
    
    if (action === 'updateCleanStatus') return updateCleanStatus(payload);
    if (action === 'createCheckout') return createCheckout(payload);
    if (action === 'updateCheckout') return updateCheckout(payload);
    if (action === 'deleteCheckout') return deleteCheckout(payload);
    
    return jsonResponse({ ok: false, error: 'Unsupported action: ' + action });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err && err.message ? err.message : err) });
  }
}

function getAllowedSheets() {
  return {
    'Checkout_Limpieza_Normal': true,
    'Checkout_Limpieza_Inicial': true,
    'Checkout_Manitas': true,
    'Checkin_Limpieza_Normal': true,
    'Checkin_Limpieza_Inicial': true,
    'Checkin_Manitas': true
  };
}

function getValidSheet(sheetName) {
  var allowedSheets = getAllowedSheets();
  if (!allowedSheets[sheetName]) return { error: 'Invalid sheetName: ' + sheetName };

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return { error: 'Sheet not found: ' + sheetName };
  return { sheet: sheet };
}

function getHeaders(sheet) {
  var lastCol = sheet.getLastColumn();
  if (lastCol < 1) return { error: 'Sheet has no columns: ' + sheet.getName() };
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  return { headers: headers };
}

/**
 * Mapea un objeto record a un array de valores basándose en los encabezados de la hoja.
 */
function mapRecordToRow(headers, record) {
  var row = [];
  for (var i = 0; i < headers.length; i++) {
    var header = String(headers[i] || '');
    var found = getRecordValueByHeader(record, header);
    row.push(found.found ? found.value : '');
  }
  return row;
}

function getRecordValueByHeader(record, header) {
  var target = normalizeText(header);
  for (var key in record) {
    if (!Object.prototype.hasOwnProperty.call(record, key)) continue;
    if (normalizeText(key) === target) {
      return { found: true, value: normalizeCellValue(record[key]) };
    }
  }
  return { found: false, value: '' };
}

function normalizeCellValue(value) {
  if (value === undefined || value === null) return '';
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  return value;
}

/**
 * Acción: Actualizar solo el checkbox 'Checked'
 */
function updateCleanStatus(payload) {
  var sheetName = String(payload.sheetName || '');
  var sheetResult = getValidSheet(sheetName);
  if (sheetResult.error) return jsonResponse({ ok: false, error: sheetResult.error });
  var sheet = sheetResult.sheet;

  var rowIndex = Number(payload.rowIndex);
  if (!rowIndex || rowIndex <= 1) {
    return jsonResponse({ ok: false, error: 'Invalid rowIndex: ' + rowIndex });
  }

  var checked = !!payload.checked;
  var headersResult = getHeaders(sheet);
  if (headersResult.error) return jsonResponse({ ok: false, error: headersResult.error });
  
  var headers = headersResult.headers;
  var checkedColIndex = findHeaderIndex(headers, 'checked');
  
  if (checkedColIndex === -1) {
    return jsonResponse({ ok: false, error: 'Column Checked not found in ' + sheetName });
  }

  if (rowIndex > sheet.getLastRow()) {
    return jsonResponse({ ok: false, error: 'rowIndex out of range: ' + rowIndex });
  }

  sheet.getRange(rowIndex, checkedColIndex + 1).setValue(checked ? 'TRUE' : 'FALSE');

  return jsonResponse({
    ok: true,
    sheetName: sheetName,
    rowIndex: rowIndex,
    checked: checked
  });
}

/**
 * Acción: Crear un nuevo registro al final de la hoja
 */
function createCheckout(payload) {
  var sheetName = String(payload.sheetName || '');
  var sheetResult = getValidSheet(sheetName);
  if (sheetResult.error) return jsonResponse({ ok: false, error: sheetResult.error });
  var sheet = sheetResult.sheet;

  var record = payload.record;
  if (!record || typeof record !== 'object') {
    return jsonResponse({ ok: false, error: 'Missing or invalid record payload' });
  }

  var headersResult = getHeaders(sheet);
  if (headersResult.error) return jsonResponse({ ok: false, error: headersResult.error });
  var headers = headersResult.headers;

  var rowValues = mapRecordToRow(headers, record);
  sheet.appendRow(rowValues);
  var rowIndex = sheet.getLastRow();

  return jsonResponse({ ok: true, sheetName: sheetName, rowIndex: rowIndex });
}

/**
 * Acción: Actualizar un registro existente (Optimizado con setValues)
 */
function updateCheckout(payload) {
  var sheetName = String(payload.sheetName || '');
  var sheetResult = getValidSheet(sheetName);
  if (sheetResult.error) return jsonResponse({ ok: false, error: sheetResult.error });
  var sheet = sheetResult.sheet;

  var rowIndex = Number(payload.rowIndex);
  if (!rowIndex || rowIndex <= 1 || rowIndex > sheet.getLastRow()) {
    return jsonResponse({ ok: false, error: 'Invalid rowIndex: ' + rowIndex });
  }

  var record = payload.record;
  if (!record || typeof record !== 'object') {
    return jsonResponse({ ok: false, error: 'Missing or invalid record payload' });
  }

  var headersResult = getHeaders(sheet);
  if (headersResult.error) return jsonResponse({ ok: false, error: headersResult.error });
  var headers = headersResult.headers;

  // Obtener los valores actuales de la fila para editarlos en memoria
  var range = sheet.getRange(rowIndex, 1, 1, headers.length);
  var rowValues = range.getValues()[0];

  var updatedCount = 0;
  for (var i = 0; i < headers.length; i++) {
    var found = getRecordValueByHeader(record, headers[i]);
    if (found.found) {
      rowValues[i] = found.value;
      updatedCount++;
    }
  }

  if (updatedCount > 0) {
    range.setValues([rowValues]);
  }

  return jsonResponse({ ok: true, sheetName: sheetName, rowIndex: rowIndex, updatedColumns: updatedCount });
}

/**
 * Acción: Eliminar una fila
 */
function deleteCheckout(payload) {
  var sheetName = String(payload.sheetName || '');
  var sheetResult = getValidSheet(sheetName);
  if (sheetResult.error) return jsonResponse({ ok: false, error: sheetResult.error });
  var sheet = sheetResult.sheet;

  var rowIndex = Number(payload.rowIndex);
  if (!rowIndex || rowIndex <= 1 || rowIndex > sheet.getLastRow()) {
    return jsonResponse({ ok: false, error: 'Invalid rowIndex: ' + rowIndex });
  }

  sheet.deleteRow(rowIndex);
  return jsonResponse({ ok: true, sheetName: sheetName, rowIndex: rowIndex });
}

function findHeaderIndex(headers, target) {
  var normalizedTarget = normalizeText(target);
  for (var i = 0; i < headers.length; i++) {
    if (normalizeText(headers[i]) === normalizedTarget) return i;
  }
  return -1;
}

function normalizeText(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD') // Quitar acentos
    .replace(/[\u0300-\u036f]/g, '');
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
