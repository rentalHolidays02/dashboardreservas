/**
 * Web App — Envío de sugerencias / feedback desde la app de trabajadores.
 * Publicar como Aplicación Web (Ejecutar como: yo · Acceso: cualquier persona).
 * URL de despliegue → VITE_FEEDBACK_APPS_SCRIPT_URL en .env
 */

function doGet() {
  return jsonOk({ status: 'ok', message: 'Feedback API activa' });
}

function doPost(e) {
  try {
    var payload = JSON.parse(e.postData.contents);
    var action = String(payload.action || '');

    if (action === 'submitFeedback') {
      return handleAppFeedback(payload);
    }

    return jsonOk({ status: 'error', message: 'Acción no soportada: ' + action });
  } catch (err) {
    return jsonOk({ status: 'error', message: String(err.message || err) });
  }
}

function handleAppFeedback(data) {
  try {
    var miCorreo = 'limpiezarental@gmail.com';
    var tipo = String(data.tipo || 'reporte').trim();
    var asunto = '[FEEDBACK APP] ' + tipo.toUpperCase();

    var cuerpo = 'De: ' + (data.nombre || '') + ' ' + (data.apellidos || '') +
                 '\nCorreo: ' + (data.email || '') +
                 '\nTeléfono: ' + (data.telefono || '') +
                 '\nTipo: ' + tipo +
                 '\n\nDESCRIPCIÓN:\n' + (data.descripcion || '');

    MailApp.sendEmail({
      to: miCorreo,
      subject: asunto,
      body: cuerpo,
      name: 'Rental Holidays (App Feedback)',
      replyTo: data.email || miCorreo
    });

    return jsonOk({ status: 'ok' });
  } catch (e) {
    return jsonOk({ status: 'error', message: 'Error en el servidor al enviar correo: ' + e.toString() });
  }
}

function jsonOk(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
