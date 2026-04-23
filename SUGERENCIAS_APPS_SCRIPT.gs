/**
 * Google Apps Script para gestionar las sugerencias desde Gmail.
 * Este script debe publicarse como Aplicación Web.
 */

function doGet(e) {
  try {
    var params = (e && e.parameter) ? e.parameter : {};
    var action = String(params.action || 'listSuggestions');

    if (action === 'listSuggestions') {
      return listSuggestions(params);
    }

    return jsonResponse({ ok: false, error: 'Acción no soportada: ' + action });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err.message || err) });
  }
}

function doPost(e) {
  // Por ahora solo lectura, pero se podría implementar marcar como leído, etc.
  return doGet(e);
}

/**
 * Recupera los últimos hilos de correo que coincidan con la búsqueda de sugerencias.
 */
function listSuggestions(params) {
  var query = params.query || 'subject:Sugerencia OR label:sugerencias';
  var limit = parseInt(params.limit || '20', 10);
  
  var threads = GmailApp.search(query, 0, limit);
  var results = [];
  
  for (var i = 0; i < threads.length; i++) {
    var messages = threads[i].getMessages();
    var lastMessage = messages[messages.length - 1];
    
    results.push({
      id: threads[i].getId(),
      subject: threads[i].getFirstMessageSubject(),
      from: lastMessage.getFrom(),
      date: lastMessage.getDate().toISOString(),
      snippet: threads[i].getSnippet(),
      body: lastMessage.getPlainBody(),
      isRead: !threads[i].isUnread()
    });
  }
  
  return jsonResponse({ 
    ok: true, 
    suggestions: results,
    count: results.length,
    query: query
  });
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
