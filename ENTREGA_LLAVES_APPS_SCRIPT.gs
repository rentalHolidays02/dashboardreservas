/**
 * Web App — CRUD hoja Informe_Entrega_Llaves
 * URL de despliegue → VITE_ENTREGA_LLAVES_APPS_SCRIPT_URL
 * Mismo ID → VITE_ENTREGA_LLAVES_SPREADSHEET_ID en .env
 */

var SPREADSHEET_ID = '1xSeU9XyvZIWuifWNXgR99l6qftpsRT4hg55tsZn7IE4';
var SHEET_NAME = 'Informe_Entrega_Llaves';

/** Columnas 19-20 firmas, 21 checked (orden real del Excel) */
var NUM_COLS = 21;

function firmaCell_(url) {
  if (!url) return '';
  var s = String(url).trim();
  if (s.indexOf('=IMAGE(') === 0) return s;
  if (s.indexOf('http') === 0) return '=IMAGE("' + s.replace(/"/g, '') + '")';
  return s;
}

function rowFromPayload_(data) {
  return [
    data.telefono || '',
    data.nombre || '',
    data.apellidos || '',
    data.fechaUbicacionEntrega || '',
    data.apartamento || '',
    data.nombreCliente || '',
    data.fechaEntradaReserva || '',
    data.fechaSalidaReserva || '',
    data.entregaLlaves ? 'SÍ' : 'NO',
    data.sabanasToallas || 'No',
    data.km || 0,
    data.observaciones || '',
    data.fianzaMonto || '',
    data.bizumMonto || '',
    data.cantidadPagadaMonto || '0',
    data.fianzaGarantia || '',
    data.bizumGarantia || '',
    data.cantidadPagadaGarantia || '0',
    firmaCell_(data.firmaTrabajador),
    firmaCell_(data.firmaHuesped),
    data.checked ? 'TRUE' : 'FALSE'
  ];
}

function doPost(e) {
  try {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName(SHEET_NAME);
    if (!sheet) {
      return jsonOut({ result: 'error', message: 'Hoja no encontrada: ' + SHEET_NAME });
    }

    var data = JSON.parse(e.postData.contents);
    var action = data.action;

    // ── AÑADIR ──────────────────────────────────────
    if (action === 'add') {
      sheet.appendRow(rowFromPayload_(data));
      return jsonOut({ result: 'success', action: 'add' });
    }

    // ── EDITAR / BORRAR ──────────────────────────────
    if (action === 'update' || action === 'delete') {
      var idStr = String(data.id); // formato: "real_key_N" donde N es el número de fila
      var parts = idStr.split('_');
      var rowNumber = parseInt(parts[parts.length - 1], 10);

      if (isNaN(rowNumber) || rowNumber < 2) {
        return jsonOut({ result: 'error', message: 'ID inválido: ' + idStr });
      }

      if (action === 'delete') {
        sheet.deleteRow(rowNumber);
        return jsonOut({ result: 'success', action: 'delete', row: rowNumber });
      }

      if (action === 'update') {
        sheet.getRange(rowNumber, 1, rowNumber, NUM_COLS).setValues([rowFromPayload_(data)]);
        return jsonOut({ result: 'success', action: 'update', row: rowNumber });
      }
    }

    return jsonOut({ result: 'error', message: 'Acción desconocida' });

  } catch (err) {
    return jsonOut({ result: 'error', message: err.toString() });
  }
}

function jsonOut(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
