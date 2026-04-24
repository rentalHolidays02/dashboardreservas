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
  // Búsqueda flexible
  var query = params.query || 'subject:"FEEDBACK APP"';
  var limit = parseInt(params.limit || '20', 10);
  
  var threads = GmailApp.search(query, 0, limit);
  var results = [];
  
  for (var i = 0; i < threads.length; i++) {
    var messages = threads[i].getMessages();
    var lastMessage = messages[messages.length - 1];
    var body = lastMessage.getPlainBody();
    var subject = threads[i].getFirstMessageSubject();
    
    // Extraer el nombre real
    var fromName = lastMessage.getFrom();
    var nameMatch = body.match(/De:\s*([^\n\r]+)/i);
    if (nameMatch && nameMatch[1]) {
      fromName = nameMatch[1].trim();
    }

    // Extraer el correo real
    var emailMatch = body.match(/Correo:\s*([^\n\r]+)/i);
    if (emailMatch && emailMatch[1]) {
      fromName += " <" + emailMatch[1].trim() + ">";
    }
    
    results.push({
      id: threads[i].getId(),
      subject: subject,
      from: fromName,
      date: lastMessage.getDate().toISOString(),
      // USAMOS EL CUERPO PARA EL SNIPPET PARA EVITAR EL ERROR
      snippet: body.substring(0, 150).replace(/\n/g, ' ') + "...",
      body: body,
      isRead: !threads[i].isUnread()
    });
  }
  
  return jsonResponse({ 
    ok: true, 
    suggestions: results,
    count: results.length
  });
}


function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
