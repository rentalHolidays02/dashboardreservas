/**
 * Google Apps Script para gestionar las sugerencias desde Gmail.
 * Este script debe publicarse como Aplicación Web.
 */

function doGet(e) {
  try {
    var params = (e && e.parameter) ? e.parameter : {};
    var action = String(params.action || 'listSuggestions');
    var id = params.id;

    if (action === 'listSuggestions') {
      return listSuggestions(params);
    }
    
    if (action === 'markAsRead' && id) {
      GmailApp.getThreadById(id).markRead();
      return jsonResponse({ ok: true });
    }
    
    if (action === 'markAsUnread' && id) {
      GmailApp.getThreadById(id).markUnread();
      return jsonResponse({ ok: true });
    }

    if (action === 'star' && id) {
      var thread = GmailApp.getThreadById(id);
      thread.getMessages()[0].star();
      return jsonResponse({ ok: true });
    }

    if (action === 'unstar' && id) {
      var thread = GmailApp.getThreadById(id);
      thread.getMessages()[0].unstar();
      return jsonResponse({ ok: true });
    }
    
    if (action === 'delete' && id) {
      GmailApp.getThreadById(id).moveToTrash();
      return jsonResponse({ ok: true });
    }

    return jsonResponse({ ok: false, error: 'Acción no soportada: ' + action });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err.message || err) });
  }
}

function doPost(e) {
  try {
    var payload = JSON.parse(e.postData.contents);
    var action = payload.action;
    var id = payload.id;
    
    if (action === 'markAsRead' && id) {
      GmailApp.getThreadById(id).markRead();
      return jsonResponse({ ok: true });
    }
    if (action === 'markAsUnread' && id) {
      GmailApp.getThreadById(id).markUnread();
      return jsonResponse({ ok: true });
    }
    if (action === 'star' && id) {
      GmailApp.getThreadById(id).getMessages()[0].star();
      return jsonResponse({ ok: true });
    }
    if (action === 'unstar' && id) {
      GmailApp.getThreadById(id).getMessages()[0].unstar();
      return jsonResponse({ ok: true });
    }
    if (action === 'delete' && id) {
      GmailApp.getThreadById(id).moveToTrash();
      return jsonResponse({ ok: true });
    }
    
    if (action === 'reply' && id) {
      var body = payload.body;
      if (!body) return jsonResponse({ ok: false, error: 'Falta el cuerpo del mensaje' });
      
      var thread = GmailApp.getThreadById(id);
      var lastMessage = thread.getMessages()[0]; // El primer mensaje suele tener los datos del formulario
      var messageBody = lastMessage.getPlainBody();
      
      // Intentar extraer el correo del cuerpo del mensaje
      var emailMatch = messageBody.match(/Correo:\s*([^\n\r]+)/i);
      var recipient = "";
      if (emailMatch && emailMatch[1]) {
        recipient = emailMatch[1].trim();
      } else {
        // Fallback al remitente del último mensaje
        recipient = thread.getMessages()[thread.getMessageCount() - 1].getFrom();
      }
      
      var subject = "Re: " + thread.getFirstMessageSubject();
      
      // Enviar el correo directamente al destinatario extraído
      GmailApp.sendEmail(recipient, subject, body, {
        name: "Feedback App - Rental Holidays",
        replyTo: "rentalholidays.es@gmail.com"
      });
      
      // También responder en el hilo de Gmail para que quede constancia del envío
      thread.reply("Respuesta enviada a " + recipient + ":\n\n" + body);
      
      return jsonResponse({ ok: true });
    }
    
    return doGet(e);
  } catch (err) {
    return doGet(e);
  }
}

/**
 * Recupera los últimos hilos de correo que coincidan con la búsqueda de sugerencias.
 */
function listSuggestions(params) {
  var query = params.query || 'subject:"FEEDBACK APP"';
  var limit = parseInt(params.limit || '40', 10);
  
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

    // Extraer Categoría (Tipo: fallo/sugerencia/otro)
    var category = "otro";
    var typeMatch = body.match(/Tipo:\s*([^\n\r]+)/i);
    if (typeMatch && typeMatch[1]) {
      category = typeMatch[1].trim().toLowerCase();
    } else if (subject.toLowerCase().includes("fallo")) {
      category = "fallo";
    } else if (subject.toLowerCase().includes("sugerencia")) {
      category = "sugerencia";
    }
    
    results.push({
      id: threads[i].getId(),
      subject: subject,
      from: fromName,
      date: lastMessage.getDate().toISOString(),
      snippet: body.substring(0, 150).replace(/\n/g, ' ') + "...",
      body: body,
      category: category,
      isRead: !threads[i].isUnread(),
      isStarred: threads[i].hasStarredMessages()
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
