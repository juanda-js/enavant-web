/*  ============================================================
    EN AVANT — Boletería · Backend (Google Apps Script)
    Base de datos: la misma Google Sheet donde pegues este código.

    PUESTA EN MARCHA (una sola vez):
      1. Crea una Google Sheet nueva en tu Workspace.
      2. Menú: Extensiones → Apps Script.
      3. Borra el contenido y pega TODO este archivo.
      4. Arriba, elige la función "setup" y dale ▶ Ejecutar (autoriza los permisos).
      5. Implementar → Nueva implementación → tipo "Aplicación web":
           - Ejecutar como: Yo
           - Quién tiene acceso: Cualquier usuario
         → Implementar → copia la URL de la app web y pásasela a Claude.
    ============================================================ */

var HOLD_MIN = 20; // minutos que una silla queda "apartada" sin pagar antes de liberarse

/* ---------- 1. Crear la estructura de la hoja + datos de ejemplo ---------- */
function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  mkSheet(ss, 'Eventos',  ['id','nombre','fecha','hora','lugar','imagen','activo']);
  mkSheet(ss, 'Zonas',    ['evento_id','zona','filas','columnas','precio']);
  mkSheet(ss, 'Ordenes',  ['orden_id','fecha','evento_id','cliente','estudiante','telefono','correo','sillas','total','estado','ref_pago']);
  mkSheet(ss, 'Boletas',  ['boleta_id','orden_id','evento_id','silla','zona','precio','estudiante','estado','token','fecha_ingreso']);

  // Sembrar 3 eventos de ejemplo (edítalos o bórralos en la hoja cuando tengas los reales)
  var ev = ss.getSheetByName('Eventos');
  if (ev.getLastRow() === 1) {
    ev.appendRow(['reyleon','El Rey León — Gala de fin de año','Sábado 6 de diciembre, 2025','4:00 p.m.','Teatro Montessori, Bogotá','', true]);
    ev.appendRow(['concierto','Concierto de Música — Fin de año','Domingo 7 de diciembre, 2025','11:00 a.m.','Auditorio En Avant, Mazurén','', true]);
    ev.appendRow(['babies','Muestra Babies & Estimulación','Sábado 13 de diciembre, 2025','10:00 a.m.','Sede Chía','', true]);
  }
  // Sembrar zonas (mapa de sillas) para cada evento: Platea y Balcón
  var zn = ss.getSheetByName('Zonas');
  if (zn.getLastRow() === 1) {
    ['reyleon','concierto','babies'].forEach(function (id) {
      zn.appendRow([id, 'Platea', 'A-J', 14, 40000]);
      zn.appendRow([id, 'Balcón', 'K-N', 16, 30000]);
    });
  }
  return 'Listo: hojas Eventos, Zonas, Ordenes y Boletas creadas.';
}

function mkSheet(ss, name, headers) {
  var sh = ss.getSheetByName(name) || ss.insertSheet(name);
  if (sh.getLastRow() === 0) { sh.appendRow(headers); sh.setFrozenRows(1); }
  return sh;
}

/* ---------- 2. Lecturas (GET) ---------- */
function doGet(e) {
  var a = ((e.parameter.action) || '').toLowerCase();
  if (a === 'eventos')        return json({ ok: true, eventos: getEventos() });
  if (a === 'disponibilidad') return json({ ok: true, ocupadas: getOcupadas(e.parameter.evento) });
  return json({ ok: false, error: 'acción desconocida' });
}

function getEventos() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var tz = ss.getSpreadsheetTimeZone();
  var ev = tabla(ss, 'Eventos');
  var zn = tabla(ss, 'Zonas');
  return ev.filter(esActivo)
    .map(function (r) {
      return {
        id: r.id, nombre: r.nombre,
        fecha: textoFecha(r.fecha, tz),
        hora: textoHora(r.hora, tz),
        lugar: r.lugar, imagen: r.imagen,
        zonas: zn.filter(function (z) { return String(z.evento_id) === String(r.id); })
          .map(function (z) { return { zona: z.zona, filas: z.filas, columnas: Number(z.columnas), precio: Number(z.precio) }; })
      };
    });
}

// "activo" puede llegar como true, "TRUE", "VERDADERO", "sí", 1...
function esActivo(r) {
  var v = String(r.activo).trim().toLowerCase();
  return r.activo === true || v === 'true' || v === 'verdadero' || v === 'si' || v === 'sí' || v === '1';
}
// Sheets convierte "4:00 p.m." en fecha interna; lo devolvemos como texto legible.
function textoHora(v, tz) {
  if (esFecha(v)) return Utilities.formatDate(v, tz, 'h:mm a').replace('AM', 'a. m.').replace('PM', 'p. m.');
  return v;
}
function textoFecha(v, tz) {
  if (esFecha(v)) return Utilities.formatDate(v, tz, 'd/MM/yyyy');
  return v;
}
function esFecha(v) { return Object.prototype.toString.call(v) === '[object Date]'; }

function getOcupadas(evento) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var bo = tabla(ss, 'Boletas');
  var ords = {}; tabla(ss, 'Ordenes').forEach(function (o) { ords[o.orden_id] = o.fecha; });
  var now = Date.now(), out = [];
  bo.forEach(function (b) {
    if (String(b.evento_id) !== String(evento)) return;
    if (b.estado === 'pagada' || b.estado === 'usada') { out.push(b.silla); return; }
    if (b.estado === 'reservada') {
      var f = ords[b.orden_id];
      if (f && (now - new Date(f).getTime()) < HOLD_MIN * 60000) out.push(b.silla);
    }
  });
  return out;
}

/* ---------- 3. Escrituras (POST) ---------- */
function doPost(e) {
  var body = {};
  try { body = JSON.parse((e.postData && e.postData.contents) || '{}'); } catch (err) {}
  var a = (body.action || '').toLowerCase();
  if (a === 'reservar')  return json(reservar(body));
  if (a === 'confirmar') return json(confirmar(body)); // Fase 2: se llamará al aprobarse el pago
  if (a === 'validar')   return json(validar(body));   // Fase 4: app de escaneo
  return json({ ok: false, error: 'acción desconocida' });
}

// Aparta las sillas y crea la orden (pendiente de pago). Usa candado para evitar doble venta.
function reservar(b) {
  var lock = LockService.getScriptLock();
  try { lock.waitLock(20000); } catch (e) { return { ok: false, error: 'El sistema está ocupado, intenta de nuevo.' }; }
  try {
    var ocup = getOcupadas(b.evento);
    var choque = (b.sillas || []).filter(function (s) { return ocup.indexOf(s.id) >= 0; });
    if (choque.length) return { ok: false, error: 'Estas sillas ya no están disponibles: ' + choque.map(function (s) { return s.id; }).join(', '), sillas: choque.map(function (s) { return s.id; }) };

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var oid = 'EAV-' + Utilities.formatDate(new Date(), 'GMT-5', 'yyMMdd') + '-' + Math.random().toString(36).toUpperCase().slice(2, 6);
    var total = (b.sillas || []).reduce(function (a, s) { return a + Number(s.precio); }, 0);
    ss.getSheetByName('Ordenes').appendRow([oid, new Date(), b.evento, b.cliente, b.estudiante, b.telefono, b.correo, b.sillas.map(function (s) { return s.id; }).join(', '), total, 'pendiente', '']);
    var bsh = ss.getSheetByName('Boletas');
    b.sillas.forEach(function (s, i) {
      bsh.appendRow([oid + '-' + (i + 1), oid, b.evento, s.id, s.zona, s.precio, b.estudiante, 'reservada', Utilities.getUuid(), '']);
    });
    return { ok: true, orden: oid, total: total };
  } finally { lock.releaseLock(); }
}

// Marca la orden como pagada y devuelve las boletas emitidas (con su token para el QR).
// En la Fase 2 esto lo disparará el webhook de Wompi al aprobarse el pago.
function confirmar(b) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  marcar(ss, 'Ordenes', 'orden_id', b.orden, function (sh, row) { sh.getRange(row, 10).setValue('pagada'); if (b.ref) sh.getRange(row, 11).setValue(b.ref); });
  var bsh = ss.getSheetByName('Boletas'), vals = bsh.getDataRange().getValues(), boletas = [];
  for (var i = 1; i < vals.length; i++) {
    if (vals[i][1] === b.orden) {
      if (vals[i][7] === 'reservada') bsh.getRange(i + 1, 8).setValue('pagada');
      boletas.push({ id: vals[i][0], silla: vals[i][3], zona: vals[i][4], precio: Number(vals[i][5]), estudiante: vals[i][6], token: vals[i][8] });
    }
  }
  if (!boletas.length) return { ok: false, error: 'Orden no encontrada' };
  return { ok: true, boletas: boletas };
}

// Valida y marca el ingreso de una boleta (para la app de escaneo, Fase 4).
function validar(b) {
  var ss = SpreadsheetApp.getActiveSpreadsheet(), bsh = ss.getSheetByName('Boletas'), vals = bsh.getDataRange().getValues();
  for (var i = 1; i < vals.length; i++) {
    if (vals[i][8] === b.token) {
      var estado = vals[i][7];
      if (estado === 'usada') return { ok: false, estado: 'usada', mensaje: 'Boleta YA usada', silla: vals[i][3], estudiante: vals[i][6], ingreso: vals[i][9] };
      if (estado !== 'pagada') return { ok: false, estado: estado, mensaje: 'Boleta no pagada', silla: vals[i][3], estudiante: vals[i][6] };
      bsh.getRange(i + 1, 8).setValue('usada'); bsh.getRange(i + 1, 10).setValue(new Date());
      return { ok: true, estado: 'valida', silla: vals[i][3], zona: vals[i][4], estudiante: vals[i][6] };
    }
  }
  return { ok: false, mensaje: 'Boleta no encontrada' };
}

/* ---------- Utilidades ---------- */
function tabla(ss, name) {
  var v = ss.getSheetByName(name).getDataRange().getValues();
  var h = v.shift();
  return v.map(function (row) { var o = {}; h.forEach(function (k, i) { o[k] = row[i]; }); return o; });
}
function marcar(ss, name, keyCol, keyVal, fn) {
  var sh = ss.getSheetByName(name), v = sh.getDataRange().getValues(), c = v[0].indexOf(keyCol);
  for (var i = 1; i < v.length; i++) if (v[i][c] === keyVal) { fn(sh, i + 1); return; }
}
function json(obj) { return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }
