/**
 * Simulacro MIPG · Gachancipá — servidor de evidencias
 * @OnlyCurrentDoc
 * Google Apps Script + Google Sheets (la hoja es la base de datos).
 *
 * INSTALACIÓN (resumen; detalle en docs/CONEXION-GOOGLE.md):
 *   1. Crea una hoja de cálculo nueva → Extensiones → Apps Script → pega este archivo.
 *   2. Ejecuta la función «configurar» una vez (autoriza los permisos). Copia el TOKEN que imprime el registro.
 *   3. Implementar → Nueva implementación → Aplicación web
 *        Ejecutar como: Yo   ·   Quién tiene acceso: Cualquier persona
 *   4. Copia la URL (termina en /exec) y el token en js/config.js del sitio.
 *
 * Hojas que crea: «Estado» (una fila por acción), «Evidencias» (una fila por enlace) y «Bitácora».
 *
 * SEGURIDAD — leer:
 *   El sitio es público (GitHub Pages), así que el token viaja en el código del navegador.
 *   Solo sirve para que nadie escriba por accidente; NO es autenticación. No registres datos personales
 *   ni reservados. Si necesitas control real, restringe el acceso a cuentas de la organización
 *   (Quién tiene acceso: «Cualquier usuario de tu organización») y sirve el sitio en una intranet.
 */

var HOJA_ESTADO = 'Estado';
var HOJA_EVID = 'Evidencias';
var HOJA_LOG = 'Bitácora';
var COLS_ESTADO = ['codigo', 'opciones_ok', 'avance', 'dependencia', 'autor', 'actualizado'];
var COLS_EVID = ['id', 'fecha', 'codigo', 'dependencia', 'autor', 'tipo', 'url', 'descripcion', 'activa'];
var COLS_LOG = ['recibido', 'accion', 'codigo', 'autor', 'dependencia', 'detalle'];
var TIPOS = ['Drive', 'SharePoint/OneDrive', 'PDF', 'Sitio web', 'Otro'];
var RE_CODIGO = /^[A-Z]{3}\d{2,3}$/;
var RE_ID = /^[A-Za-z0-9_-]{6,40}$/;
var RE_URL = /^https:\/\/[^\s]+$/;
var RE_ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;

/* ───────── utilidades ───────── */

function libro_() {
  var id = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
  return id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActiveSpreadsheet();
}

function hoja_(nombre, cols) {
  var libro = libro_();
  var sh = libro.getSheetByName(nombre);
  if (!sh) {
    sh = libro.insertSheet(nombre);
    sh.getRange(1, 1, 1, cols.length).setValues([cols]).setFontWeight('bold');
    sh.setFrozenRows(1);
    // Formato «texto plano» en toda la hoja: evita que Sheets convierta fechas ISO o interprete
    // como fórmula un valor que empiece por = + - @ (inyección de fórmulas).
    sh.getRange(1, 1, sh.getMaxRows(), cols.length).setNumberFormat('@');
  }
  return sh;
}

function salida_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function tokenOk_(t) {
  var esperado = PropertiesService.getScriptProperties().getProperty('TOKEN') || '';
  return esperado === '' || String(t || '') === esperado; // sin TOKEN configurado se acepta todo (solo pruebas)
}

function texto_(v, max) { return String(v == null ? '' : v).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max); }

function rechazo_(msg) { return { ok: false, permanente: true, error: msg }; }

/* ───────── configuración inicial (ejecutar una vez a mano) ───────── */

function configurar() {
  hoja_(HOJA_ESTADO, COLS_ESTADO);
  hoja_(HOJA_EVID, COLS_EVID);
  hoja_(HOJA_LOG, COLS_LOG);
  var props = PropertiesService.getScriptProperties();
  if (!props.getProperty('TOKEN')) {
    props.setProperty('TOKEN', Utilities.getUuid().replace(/-/g, '').slice(0, 20));
  }
  Logger.log('Listo. Copia este token en js/config.js → token: "%s"', props.getProperty('TOKEN'));
  Logger.log('Ahora: Implementar → Nueva implementación → Aplicación web (Ejecutar como: Yo · Acceso: Cualquier persona).');
}

/* ───────── lectura ───────── */

function doGet(e) {
  var p = (e && e.parameter) || {};
  if (!tokenOk_(p.token)) return salida_({ ok: false, error: 'Token inválido' });
  if (p.accion === 'ping') return salida_({ ok: true, servidor: new Date().toISOString() });
  if (p.accion !== 'estado') return salida_({ ok: false, error: 'Acción no soportada' });

  var estados = filas_(hoja_(HOJA_ESTADO, COLS_ESTADO), COLS_ESTADO).map(function (f) {
    var ok = [];
    try { ok = JSON.parse(f.opciones_ok || '[]'); } catch (err) { /* fila mal formada: se ignora */ }
    return { codigo: f.codigo, ok: ok, avance: Number(f.avance) || 0, dependencia: f.dependencia, autor: f.autor, actualizado: f.actualizado };
  });
  var evidencias = filas_(hoja_(HOJA_EVID, COLS_EVID), COLS_EVID).map(function (f) {
    f.activa = String(f.activa) !== 'false';
    return f;
  });
  return salida_({ ok: true, servidor: new Date().toISOString(), estados: estados, evidencias: evidencias });
}

function filas_(sh, cols) {
  var n = sh.getLastRow();
  if (n < 2) return [];
  return sh.getRange(2, 1, n - 1, cols.length).getValues().filter(function (r) { return r[0] !== ''; }).map(function (r) {
    var o = {};
    cols.forEach(function (c, i) { o[c] = r[i] instanceof Date ? r[i].toISOString() : String(r[i]); });
    return o;
  });
}

/* ───────── escritura ───────── */

function doPost(e) {
  var cuerpo;
  try { cuerpo = JSON.parse(e.postData.contents); } catch (err) { return salida_(rechazo_('Cuerpo no es JSON válido')); }
  if (!tokenOk_(cuerpo.token)) return salida_({ ok: false, error: 'Token inválido' }); // no permanente: se reintenta

  var lock = LockService.getScriptLock();
  try { lock.waitLock(20000); } catch (err) { return salida_({ ok: false, error: 'Servidor ocupado, reintenta' }); }
  try {
    var r;
    if (cuerpo.accion === 'estado') r = guardarEstado_(cuerpo);
    else if (cuerpo.accion === 'evidencia') r = guardarEvidencia_(cuerpo);
    else if (cuerpo.accion === 'retirar') r = retirar_(cuerpo);
    else r = rechazo_('Acción no soportada');
    if (r.ok) bitacora_(cuerpo);
    return salida_(r);
  } catch (err) {
    return salida_({ ok: false, error: 'Error interno: ' + err.message });
  } finally {
    lock.releaseLock();
  }
}

function buscar_(sh, col, valor) { // devuelve el número de fila (2..n) o 0
  var n = sh.getLastRow();
  if (n < 2) return 0;
  var v = sh.getRange(2, col, n - 1, 1).getValues();
  for (var i = 0; i < v.length; i++) { if (String(v[i][0]) === valor) return i + 2; }
  return 0;
}

function guardarEstado_(c) {
  if (!RE_CODIGO.test(String(c.codigo))) return rechazo_('Código de acción inválido');
  if (!Array.isArray(c.ok) || c.ok.length > 60) return rechazo_('Lista de opciones inválida');
  for (var i = 0; i < c.ok.length; i++) { if (!(Number.isInteger(c.ok[i]) && c.ok[i] >= 0 && c.ok[i] < 100)) return rechazo_('Opción fuera de rango'); }
  if (!RE_ISO.test(String(c.actualizado))) return rechazo_('Fecha inválida');
  var avance = Math.max(0, Math.min(1, Number(c.avance) || 0));
  var sh = hoja_(HOJA_ESTADO, COLS_ESTADO);
  var fila = buscar_(sh, 1, c.codigo);
  var nuevo = [c.codigo, JSON.stringify(c.ok), String(avance), texto_(c.dependencia, 80), texto_(c.autor, 60), c.actualizado];
  if (fila) {
    var previo = String(sh.getRange(fila, 6).getValue());
    if (previo > c.actualizado) return { ok: true, ignorado: true }; // ya hay algo más reciente (cola antigua)
    sh.getRange(fila, 1, 1, nuevo.length).setValues([nuevo]);
  } else {
    sh.appendRow(nuevo);
  }
  return { ok: true };
}

function guardarEvidencia_(c) {
  if (!RE_ID.test(String(c.id))) return rechazo_('Identificador inválido');
  if (!RE_CODIGO.test(String(c.codigo))) return rechazo_('Código de acción inválido');
  var url = texto_(c.url, 501);
  if (url.length > 500 || !RE_URL.test(url)) return rechazo_('El enlace debe ser https:// y tener máximo 500 caracteres');
  var desc = texto_(c.descripcion, 301);
  if (desc.length < 8 || desc.length > 300) return rechazo_('La descripción debe tener entre 8 y 300 caracteres');
  if (TIPOS.indexOf(c.tipo) < 0) return rechazo_('Tipo de enlace inválido');
  if (!RE_ISO.test(String(c.fecha))) return rechazo_('Fecha inválida');
  var sh = hoja_(HOJA_EVID, COLS_EVID);
  if (buscar_(sh, 1, c.id)) return { ok: true, ignorado: true }; // reintento de una cola: idempotente
  sh.appendRow([c.id, c.fecha, c.codigo, texto_(c.dependencia, 80), texto_(c.autor, 60), c.tipo, url, desc, 'true']);
  return { ok: true };
}

function retirar_(c) {
  if (!RE_ID.test(String(c.id))) return rechazo_('Identificador inválido');
  var sh = hoja_(HOJA_EVID, COLS_EVID);
  var fila = buscar_(sh, 1, c.id);
  if (!fila) return { ok: true, ignorado: true };
  sh.getRange(fila, 9).setValue('false'); // no se borra: queda trazabilidad
  return { ok: true };
}

function bitacora_(c) {
  var detalle = c.accion === 'evidencia' ? c.url : (c.accion === 'estado' ? JSON.stringify(c.ok) : c.id || '');
  hoja_(HOJA_LOG, COLS_LOG).appendRow([new Date().toISOString(), texto_(c.accion, 20), texto_(c.codigo, 12), texto_(c.autor, 60), texto_(c.dependencia, 80), texto_(detalle, 500)]);
}
