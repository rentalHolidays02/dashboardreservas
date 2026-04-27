/**
 * Google Apps Script para guardar los informes PDF en Google Drive.
 * Este script debe publicarse como Aplicación Web (con permisos de acceso: "Cualquier persona").
 */

function doGet(e) {
  return jsonResponse({ ok: true, message: "Endpoint activo para guardar PDF" });
}

function doPost(e) {
  try {
    var payload = JSON.parse(e.postData.contents);
    var action = payload.action;
    
    if (action === 'uploadPDF') {
      var base64 = payload.base64;
      var filename = payload.filename || 'informe.pdf';
      var folderId = payload.folderId || '1oqpnFs26ig9rlbXM1ud2akXTu_3GA2Wu';
      
      if (!base64) {
        return jsonResponse({ ok: false, error: 'Falta el contenido base64' });
      }
      
      // Decodificar base64 a un Blob
      var decodedData = Utilities.base64Decode(base64);
      var blob = Utilities.newBlob(decodedData, 'application/pdf', filename);
      
      // Obtener la carpeta de Drive y crear el archivo
      var folder = DriveApp.getFolderById(folderId);
      var file = folder.createFile(blob);
      
      return jsonResponse({ ok: true, fileUrl: file.getUrl(), fileId: file.getId() });
    }
    
    return jsonResponse({ ok: false, error: 'Acción no soportada: ' + action });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err.message || err) });
  }
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
