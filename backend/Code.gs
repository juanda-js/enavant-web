/*  ============================================================
    EN AVANT — Boletería · Backend (Google Apps Script)
    Base de datos: la misma Google Sheet donde pegues este código.

    PUESTA EN MARCHA:
      1. Pega TODO este archivo en Extensiones → Apps Script.
      2. Ejecuta la función "setup"          (crea Eventos/Ordenes/Boletas)
      3. Ejecuta la función "setupVermont"   (crea el mapa del Teatro Vermont)
      4. Implementar → Gestionar implementaciones → ✏️ → Nueva versión.

    Cada vez que cambies este código: repite el paso 4 (la URL no cambia).
    ============================================================ */

var HOLD_MIN = 20; // minutos que una silla queda "apartada" sin pagar antes de liberarse

/* ============================================================
   1. ESTRUCTURA DE LA HOJA
   ============================================================ */
function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  mkSheet(ss, 'Eventos', ['id','nombre','fecha','hora','lugar','imagen','recinto','activo']);
  mkSheet(ss, 'Ordenes', ['orden_id','fecha','evento_id','cliente','estudiante','telefono','correo','sillas','total','estado','ref_pago']);
  mkSheet(ss, 'Boletas', ['boleta_id','orden_id','evento_id','silla','etiqueta','zona','precio','estudiante','estado','token','fecha_ingreso']);

  var ev = ss.getSheetByName('Eventos');
  if (ev.getLastRow() === 1) {
    ev.appendRow(['reyleon','El Rey León — Gala de fin de año','Sábado 6 de diciembre, 2025','4:00 p.m.','Teatro del Gimnasio Vermont','','vermont', true]);
  }
  return 'Listo. Ahora ejecuta setupVermont().';
}

/* Mapa del Teatro del Gimnasio Vermont.
   OJO: las cantidades son una APROXIMACIÓN a partir de la imagen.
   Ajusta libremente en las pestañas Palcos / Bloques (columna "sillas"). */
function setupVermont() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var R = 'vermont';
  reset(ss, 'Zonas',      ['recinto','zona_id','zona','precio','color']);
  reset(ss, 'Palcos',     ['recinto','palco','zona_id','sillas','x','y']);
  reset(ss, 'Bloques',    ['recinto','bloque_id','zona_id','nombre','filas','sillas','x','y','rot']);
  reset(ss, 'Bloqueadas', ['recinto','silla_id','motivo']);
  reset(ss, 'Areas',      ['recinto','etiqueta','x','y','w','h','rot']);

  ss.getSheetByName('Zonas').getRange(2,1,3,5).setValues([
    [R,'CV','Ciclo de la Vida', 76500, '#E8B923'],
    [R,'HM','Hakuna Matata',    69500, '#F08A24'],
    [R,'AS','Amigos de Simba',  55500, '#7FBF3F']
  ]);

  // ---- Palcos (Ciclo de la Vida): 27 palcos = 8 de 10 sillas + 19 de 5 → 175 ----
  var filasP = [ [1,2,3,4,5], [6,7,8,9], [10,11,12,13,14], [15,16,17,18], [19,20,21,22,23], [24,25,26,27] ];
  var palcos = [];
  filasP.forEach(function (fila, fi) {
    var y = 190 + fi * 60;
    var xs = (fila.length === 5) ? [400,520,640,760,880] : [460,580,700,820];
    fila.forEach(function (n, i) {
      palcos.push([R, n, 'CV', (n <= 8 ? 10 : 5), xs[i], y]);
    });
  });
  ss.getSheetByName('Palcos').getRange(2,1,palcos.length,6).setValues(palcos);

  // ---- Bloques ----
  // Hakuna Matata: frente 5 filas (A-E) 8+10+8=26 → 130 | atrás 8 filas (F-M) 14+17+14=45 → 360  = 490
  // Amigos de Simba: 4 bloques diagonales de 12 filas × 11 sillas = 528 (~526)
  var bloques = [
    [R,'HM1','HM','Hakuna Matata · Izquierda',    'A-E', 8,  395, 555,   0],
    [R,'HM2','HM','Hakuna Matata · Centro',       'A-E',10,  560, 555,   0],
    [R,'HM3','HM','Hakuna Matata · Derecha',      'A-E', 8,  820, 555,   0],
    [R,'HM4','HM','Hakuna Matata · Atrás Izq',    'F-M',14,  290, 690,   0],
    [R,'HM5','HM','Hakuna Matata · Atrás Centro', 'F-M',17,  615, 690,   0],
    [R,'HM6','HM','Hakuna Matata · Atrás Der',    'F-M',14, 1000, 690,   0],
    [R,'AS1','AS','Amigos de Simba · Izq Exterior','A-L',11,   25, 555, -30],
    [R,'AS2','AS','Amigos de Simba · Izq Interior','A-L',11,  170, 495, -30],
    [R,'AS3','AS','Amigos de Simba · Der Interior','A-L',11, 1117, 430,  30],
    [R,'AS4','AS','Amigos de Simba · Der Exterior','A-L',11, 1262, 490,  30]
  ];
  ss.getSheetByName('Bloques').getRange(2,1,bloques.length,9).setValues(bloques);

  // ---- Sillas bloqueadas (fotografía / video) ----
  var bloq = [
    [R,'HM2-A5','Fotografía y video'], [R,'HM2-A6','Fotografía y video'],
    [R,'HM2-A7','Fotografía y video'], [R,'HM2-A8','Fotografía y video']
  ];
  ss.getSheetByName('Bloqueadas').getRange(2,1,bloq.length,3).setValues(bloq);

  // ---- Áreas de referencia (no se venden) ----
  ss.getSheetByName('Areas').getRange(2,1,3,7).setValues([
    [R,'ESCENARIO', 640, 60, 320, 70, 0],
    [R,'Área de consolas', 700, 862, 200, 20, 0],
    [R,'Ascensor', 120, 855, 46, 40, 0]
  ]);
  return 'Mapa del Teatro Vermont creado. Revisa las pestañas Zonas, Palcos, Bloques, Bloqueadas y Areas.';
}

/* Reinicia Ordenes y Boletas (borra las compras de PRUEBA).
   Necesario una vez, porque la pestaña Boletas ganó la columna "etiqueta". */
function resetVentas() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  reset(ss, 'Ordenes', ['orden_id','fecha','evento_id','cliente','estudiante','telefono','correo','sillas','total','estado','ref_pago']);
  reset(ss, 'Boletas', ['boleta_id','orden_id','evento_id','silla','etiqueta','zona','precio','estudiante','estado','token','fecha_ingreso']);
  return 'Ordenes y Boletas reiniciadas (se borraron las compras de prueba).';
}

function mkSheet(ss, name, headers) {
  var sh = ss.getSheetByName(name) || ss.insertSheet(name);
  if (sh.getLastRow() === 0) { sh.appendRow(headers); sh.setFrozenRows(1); }
  return sh;
}
function reset(ss, name, headers) {
  var sh = ss.getSheetByName(name) || ss.insertSheet(name);
  sh.clear(); sh.appendRow(headers); sh.setFrozenRows(1); return sh;
}

/* ============================================================
   2. LECTURAS (GET)
   ============================================================ */
function doGet(e) {
  var a = ((e.parameter.action) || '').toLowerCase();
  if (a === 'eventos')        return json({ ok: true, eventos: getEventos() });
  if (a === 'mapa')           return json({ ok: true, mapa: getMapa(e.parameter.recinto) });
  if (a === 'disponibilidad') return json({ ok: true, ocupadas: getOcupadas(e.parameter.evento) });
  return json({ ok: false, error: 'acción desconocida' });
}

function getEventos() {
  var ss = SpreadsheetApp.getActiveSpreadsheet(), tz = ss.getSpreadsheetTimeZone();
  return tabla(ss, 'Eventos').filter(esActivo).map(function (r) {
    return { id: r.id, nombre: r.nombre, fecha: textoFecha(r.fecha, tz), hora: textoHora(r.hora, tz),
             lugar: r.lugar, imagen: r.imagen, recinto: r.recinto || 'vermont' };
  });
}

function getMapa(recinto) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var mismo = function (r) { return String(r.recinto) === String(recinto); };
  return {
    zonas:   tabla(ss, 'Zonas').filter(mismo).map(function (z) { return { id: z.zona_id, nombre: z.zona, precio: Number(z.precio), color: z.color }; }),
    palcos:  tabla(ss, 'Palcos').filter(mismo).map(function (p) { return { palco: p.palco, zona: p.zona_id, sillas: Number(p.sillas), x: Number(p.x), y: Number(p.y) }; }),
    bloques: tabla(ss, 'Bloques').filter(mismo).map(function (b) { return { id: b.bloque_id, zona: b.zona_id, nombre: b.nombre, filas: b.filas, sillas: Number(b.sillas), x: Number(b.x), y: Number(b.y), rot: Number(b.rot) }; }),
    bloqueadas: tabla(ss, 'Bloqueadas').filter(mismo).map(function (b) { return { id: b.silla_id, motivo: b.motivo }; }),
    areas:   tabla(ss, 'Areas').filter(mismo).map(function (a) { return { etiqueta: a.etiqueta, x: Number(a.x), y: Number(a.y), w: Number(a.w), h: Number(a.h), rot: Number(a.rot) }; })
  };
}

function getOcupadas(evento) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var ords = {}; tabla(ss, 'Ordenes').forEach(function (o) { ords[o.orden_id] = o.fecha; });
  var now = Date.now(), out = [];
  tabla(ss, 'Boletas').forEach(function (b) {
    if (String(b.evento_id) !== String(evento)) return;
    if (b.estado === 'pagada' || b.estado === 'usada') { out.push(b.silla); return; }
    if (b.estado === 'reservada') {
      var f = ords[b.orden_id];
      if (f && (now - new Date(f).getTime()) < HOLD_MIN * 60000) out.push(b.silla);
    }
  });
  return out;
}

/* ============================================================
   3. ESCRITURAS (POST)
   ============================================================ */
function doPost(e) {
  var body = {};
  try { body = JSON.parse((e.postData && e.postData.contents) || '{}'); } catch (err) {}
  var a = (body.action || '').toLowerCase();
  if (a === 'reservar')  return json(reservar(body));
  if (a === 'confirmar') return json(confirmar(body));
  if (a === 'validar')   return json(validar(body));
  return json({ ok: false, error: 'acción desconocida' });
}

// Aparta las sillas y crea la orden. El PRECIO se calcula aquí (nunca se confía en el navegador).
function reservar(b) {
  var lock = LockService.getScriptLock();
  try { lock.waitLock(20000); } catch (e) { return { ok: false, error: 'El sistema está ocupado, intenta de nuevo.' }; }
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var ev = null; tabla(ss, 'Eventos').forEach(function (x) { if (String(x.id) === String(b.evento)) ev = x; });
    if (!ev) return { ok: false, error: 'Evento no encontrado' };
    var recinto = ev.recinto || 'vermont';

    // precios y nombres de zona reales
    var zonas = {}; tabla(ss, 'Zonas').forEach(function (z) { if (String(z.recinto) === String(recinto)) zonas[z.zona_id] = { nombre: z.zona, precio: Number(z.precio) }; });
    // sillas bloqueadas
    var bloqueadas = {}; tabla(ss, 'Bloqueadas').forEach(function (x) { if (String(x.recinto) === String(recinto)) bloqueadas[x.silla_id] = 1; });

    var sillas = b.sillas || [];
    if (!sillas.length) return { ok: false, error: 'No seleccionaste sillas' };
    var invalidas = sillas.filter(function (s) { return !zonas[s.zona] || bloqueadas[s.id]; });
    if (invalidas.length) return { ok: false, error: 'Sillas no disponibles: ' + invalidas.map(function (s) { return s.id; }).join(', ') };

    var ocup = getOcupadas(b.evento);
    var choque = sillas.filter(function (s) { return ocup.indexOf(s.id) >= 0; });
    if (choque.length) return { ok: false, error: 'Estas sillas ya no están disponibles: ' + choque.map(function (s) { return s.id; }).join(', '), sillas: choque.map(function (s) { return s.id; }) };

    var oid = 'EAV-' + Utilities.formatDate(new Date(), 'GMT-5', 'yyMMdd') + '-' + Math.random().toString(36).toUpperCase().slice(2, 6);
    var total = sillas.reduce(function (a, s) { return a + zonas[s.zona].precio; }, 0);
    ss.getSheetByName('Ordenes').appendRow([oid, new Date(), b.evento, b.cliente, b.estudiante, b.telefono, b.correo,
      sillas.map(function (s) { return s.id; }).join(', '), total, 'pendiente', '']);

    var bsh = ss.getSheetByName('Boletas');
    sillas.forEach(function (s, i) {
      bsh.appendRow([oid + '-' + (i + 1), oid, b.evento, s.id, s.etiqueta || s.id, zonas[s.zona].nombre, zonas[s.zona].precio, b.estudiante, 'reservada', Utilities.getUuid(), '']);
    });
    return { ok: true, orden: oid, total: total };
  } finally { lock.releaseLock(); }
}

// Marca la orden como pagada, devuelve las boletas y las envía por correo.
function confirmar(b) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  marcar(ss, 'Ordenes', 'orden_id', b.orden, function (sh, row) { sh.getRange(row, 10).setValue('pagada'); if (b.ref) sh.getRange(row, 11).setValue(b.ref); });
  var bsh = ss.getSheetByName('Boletas'), vals = bsh.getDataRange().getValues(), boletas = [];
  for (var i = 1; i < vals.length; i++) {
    if (vals[i][1] === b.orden) {
      if (vals[i][8] === 'reservada') bsh.getRange(i + 1, 9).setValue('pagada');
      boletas.push({ id: vals[i][0], silla: vals[i][3], etiqueta: vals[i][4], zona: vals[i][5], precio: Number(vals[i][6]), estudiante: vals[i][7], token: vals[i][9] });
    }
  }
  if (!boletas.length) return { ok: false, error: 'Orden no encontrada' };
  var aviso = '';
  try { enviarBoletas(b.orden); } catch (err) { aviso = 'La compra quedó registrada, pero no pudimos enviar el correo: ' + err.message; }
  return { ok: true, boletas: boletas, aviso: aviso };
}

// Valida y marca el ingreso de una boleta (app de escaneo).
function validar(b) {
  var ss = SpreadsheetApp.getActiveSpreadsheet(), bsh = ss.getSheetByName('Boletas'), vals = bsh.getDataRange().getValues();
  for (var i = 1; i < vals.length; i++) {
    if (vals[i][9] === b.token) {
      var estado = vals[i][8];
      if (estado === 'usada')  return { ok: false, estado: 'usada', mensaje: 'Boleta YA usada', etiqueta: vals[i][4], estudiante: vals[i][7], ingreso: vals[i][10] };
      if (estado !== 'pagada') return { ok: false, estado: estado, mensaje: 'Boleta no pagada', etiqueta: vals[i][4], estudiante: vals[i][7] };
      bsh.getRange(i + 1, 9).setValue('usada'); bsh.getRange(i + 1, 11).setValue(new Date());
      return { ok: true, estado: 'valida', etiqueta: vals[i][4], zona: vals[i][5], estudiante: vals[i][7] };
    }
  }
  return { ok: false, mensaje: 'Boleta no encontrada' };
}

/* ============================================================
   4. REENVIAR BOLETAS (menú interno de la hoja)
   ============================================================ */
function onOpen() {
  SpreadsheetApp.getUi().createMenu('En Avant')
    .addItem('Reenviar boletas (selecciona una fila en Ordenes)', 'reenviarSeleccion')
    .addItem('Reenviar boletas por número de orden…', 'reenviarPorOrden')
    .addToUi();
}
function reenviarSeleccion() {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  if (sh.getName() !== 'Ordenes') { SpreadsheetApp.getUi().alert('Abre la pestaña "Ordenes" y selecciona la fila de la compra.'); return; }
  var fila = sh.getActiveRange().getRow();
  if (fila < 2) { SpreadsheetApp.getUi().alert('Selecciona la fila de una compra.'); return; }
  SpreadsheetApp.getUi().alert(enviarBoletas(sh.getRange(fila, 1).getValue()));
}
function reenviarPorOrden() {
  var ui = SpreadsheetApp.getUi();
  var r = ui.prompt('Reenviar boletas', 'Escribe el número de orden (ej. EAV-251206-A1B2):', ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK) return;
  ui.alert(enviarBoletas(r.getResponseText().trim()));
}

function enviarBoletas(orden) {
  var ss = SpreadsheetApp.getActiveSpreadsheet(), tz = ss.getSpreadsheetTimeZone();
  var ord = null; tabla(ss, 'Ordenes').forEach(function (o) { if (String(o.orden_id) === String(orden)) ord = o; });
  if (!ord) return 'No encontré la orden ' + orden;
  if (String(ord.estado) !== 'pagada') return 'La orden ' + orden + ' aún no está pagada.';
  var ev = null; tabla(ss, 'Eventos').forEach(function (e) { if (String(e.id) === String(ord.evento_id)) ev = e; });
  var boletas = tabla(ss, 'Boletas').filter(function (b) { return String(b.orden_id) === String(orden); });
  if (!boletas.length) return 'La orden ' + orden + ' no tiene boletas.';

  var html = '<div style="font-family:Arial,sans-serif;max-width:600px">' +
    '<h2 style="color:#A40FC4;margin:0 0 4px">En Avant</h2>' +
    '<p>Hola <b>' + ord.cliente + '</b>, estas son tus boletas para <b>' + (ev ? ev.nombre : ord.evento_id) + '</b>' +
    (ev ? ' · ' + textoFecha(ev.fecha, tz) + ' · ' + textoHora(ev.hora, tz) + ' · ' + ev.lugar : '') + '.</p>' +
    '<p>Presenta el código QR en la entrada (impreso o desde el celular).</p>';
  boletas.forEach(function (b) {
    var qr = 'https://api.qrserver.com/v1/create-qr-code/?size=190x190&margin=0&data=' + encodeURIComponent(b.token);
    html += '<table style="border:1px solid #ddd;border-collapse:collapse;margin:14px 0;width:100%"><tr>' +
      '<td style="background:#121014;padding:14px;text-align:center;width:150px">' +
      '<img src="' + qr + '" width="120" height="120" style="background:#fff;padding:6px;border-radius:6px"><br>' +
      '<span style="color:#fff;font-size:10px;letter-spacing:1px">' + b.boleta_id + '</span></td>' +
      '<td style="padding:14px"><b>' + b.etiqueta + '</b><br>Zona: ' + b.zona + '<br>Estudiante: ' + b.estudiante + '</td></tr></table>';
  });
  html += '<p style="color:#888;font-size:12px">Orden ' + orden + ' · En Avant — Escuela de Danza, Música y Arte</p></div>';
  MailApp.sendEmail({ to: ord.correo, subject: 'Tus boletas — ' + (ev ? ev.nombre : 'En Avant'), htmlBody: html });
  return 'Boletas de ' + orden + ' enviadas a ' + ord.correo;
}

/* ============================================================
   Utilidades
   ============================================================ */
function tabla(ss, name) {
  var sh = ss.getSheetByName(name); if (!sh) return [];
  var v = sh.getDataRange().getValues(); if (v.length < 2) return [];
  var h = v.shift();
  return v.filter(function (r) { return String(r[0]).length; })
          .map(function (row) { var o = {}; h.forEach(function (k, i) { o[k] = row[i]; }); return o; });
}
function marcar(ss, name, keyCol, keyVal, fn) {
  var sh = ss.getSheetByName(name), v = sh.getDataRange().getValues(), c = v[0].indexOf(keyCol);
  for (var i = 1; i < v.length; i++) if (v[i][c] === keyVal) { fn(sh, i + 1); return; }
}
function esActivo(r) {
  var v = String(r.activo).trim().toLowerCase();
  return r.activo === true || v === 'true' || v === 'verdadero' || v === 'si' || v === 'sí' || v === '1';
}
function textoHora(v, tz) { return esFecha(v) ? Utilities.formatDate(v, tz, 'h:mm a').replace('AM','a. m.').replace('PM','p. m.') : v; }
function textoFecha(v, tz) { return esFecha(v) ? Utilities.formatDate(v, tz, 'd/MM/yyyy') : v; }
function esFecha(v) { return Object.prototype.toString.call(v) === '[object Date]'; }
function json(obj) { return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }
