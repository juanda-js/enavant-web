/**
 * ============================================================
 *  APP DOCENTE EN AVANT — Backend
 * ============================================================
 *  Hojas que usa:
 *    "Base Maestros"  A:Estado · B:Sede(s) · D:Nombre · E:Cédula
 *    Una hoja por sede, con:
 *      A:Fecha · B:IdEst · C:Estudiante · D:Horario
 *      E:Programa · F:Maestro · G:Modalidad · H:Asistencia
 *
 *  Al desplegar:  Ejecutar como = Yo   ·   Acceso = Cualquier usuario
 * ============================================================
 */

var HOJA_MAESTROS = 'Base Maestros';
var COL_ASISTENCIA = 8;   // Columna H

/** Sirve la página. */
function doGet() {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('App Docente En Avant')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/* ============================================================
   UTILIDADES
   ============================================================ */

/**
 * Normaliza texto para comparar: sin tildes, sin espacios dobles,
 * en minúsculas. Evita que "Chía " y "chia" se traten como distintos,
 * que era la causa de que a algunos maestros no les apareciera nada.
 */
function normalizar(txt) {
  return String(txt == null ? '' : txt)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/** Deja solo los dígitos de una cédula (quita puntos, comas, espacios). */
function soloDigitos(txt) {
  return String(txt == null ? '' : txt).replace(/\D/g, '');
}

/**
 * Busca una hoja por nombre tolerando diferencias de tildes,
 * mayúsculas y espacios sobrantes.
 */
function buscarHoja(ss, nombre) {
  var exacta = ss.getSheetByName(nombre);
  if (exacta) return exacta;

  var objetivo = normalizar(nombre);
  var hojas = ss.getSheets();
  for (var i = 0; i < hojas.length; i++) {
    if (normalizar(hojas[i].getName()) === objetivo) return hojas[i];
  }
  return null;
}

/** Convierte un valor de celda a "yyyy-MM-dd". */
function aFechaTexto(valor, tz) {
  if (valor instanceof Date) {
    return Utilities.formatDate(valor, tz, 'yyyy-MM-dd');
  }
  var t = String(valor == null ? '' : valor).trim();
  // Acepta "2026-07-18" y también "18/07/2026"
  var m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    return m[3] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2);
  }
  return t;
}

/* ============================================================
   1. LOGIN DE MAESTRO
   ============================================================ */
function loginMaestro(cedula) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(HOJA_MAESTROS);
    if (!sheet) {
      return { success: false, message: 'No se encuentra la hoja "' + HOJA_MAESTROS + '". Avisa a administración.' };
    }

    var buscada = soloDigitos(cedula);
    if (!buscada) {
      return { success: false, message: 'Digita un número de documento válido.' };
    }

    var data = sheet.getDataRange().getValues();

    for (var i = 1; i < data.length; i++) {
      if (soloDigitos(data[i][4]) !== buscada) continue;   // Columna E: Cédula

      var estado = normalizar(data[i][0]);                 // Columna A: Estado
      if (estado !== 'activo') {
        return { success: false, message: 'Usuario inactivo. Contacta a administración.' };
      }

      var nombre = String(data[i][3] == null ? '' : data[i][3]).trim();   // Columna D
      if (!nombre) {
        return { success: false, message: 'Tu usuario no tiene nombre registrado. Avisa a administración.' };
      }

      // Columna B: una o varias sedes separadas por coma. Se descartan vacías.
      var sedes = String(data[i][1] == null ? '' : data[i][1])
        .split(',')
        .map(function (s) { return s.trim(); })
        .filter(function (s) { return s !== ''; });

      if (!sedes.length) {
        return { success: false, message: 'Tu usuario no tiene sede asignada. Avisa a administración.' };
      }

      return { success: true, nombre: nombre, sedes: sedes };
    }

    return { success: false, message: 'Cédula no encontrada.' };

  } catch (err) {
    return { success: false, message: 'Error del servidor: ' + err.message };
  }
}

/* ============================================================
   2. CLASES DEL MAESTRO EN UNA FECHA
   ============================================================ */
function obtenerClases(sede, nombreMaestro, fechaStr) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = buscarHoja(ss, sede);
    if (!sheet) {
      return { success: false, message: 'No existe la hoja de la sede "' + sede + '".' };
    }

    var tz = ss.getSpreadsheetTimeZone();
    var data = sheet.getDataRange().getValues();
    var maestroBuscado = normalizar(nombreMaestro);
    var clases = [];

    for (var i = 1; i < data.length; i++) {
      var row = data[i];

      if (aFechaTexto(row[0], tz) !== fechaStr) continue;          // A: Fecha
      if (normalizar(row[5]) !== maestroBuscado) continue;         // F: Maestro

      clases.push({
        fila: i + 1,                 // número de fila real en la hoja
        idEst: row[1],               // B
        estudiante: row[2],          // C
        horario: row[3],             // D
        programa: row[4],            // E
        modalidad: row[6],           // G
        asistencia: row[7] || ''     // H
      });
    }

    return { success: true, clases: clases };

  } catch (err) {
    return { success: false, message: 'Error del servidor: ' + err.message };
  }
}

/* ============================================================
   3. GUARDAR ASISTENCIA
   ============================================================ */
function guardarAsistencia(sede, numeroFila, valorAsistencia, datosValidacion) {
  var lock = LockService.getScriptLock();
  try {
    // Evita que dos maestros escribiendo a la vez se pisen.
    lock.waitLock(20000);

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = buscarHoja(ss, sede);
    if (!sheet) {
      return { success: false, message: 'No existe la hoja de la sede "' + sede + '".' };
    }

    numeroFila = Number(numeroFila);
    if (!numeroFila || numeroFila < 2 || numeroFila > sheet.getLastRow()) {
      return { success: false, message: 'La fila ya no existe. Recarga la página.' };
    }

    // Verificación: confirmamos que la fila sigue siendo del mismo estudiante,
    // por si alguien insertó o borró filas mientras la app estaba abierta.
    var chequeo = sheet.getRange(numeroFila, 2, 1, 5).getValues()[0];  // B..F
    var idHoja = String(chequeo[0]);        // B: IdEst
    var programaHoja = String(chequeo[3]);  // E: Programa

    if (String(datosValidacion.idEst) !== idHoja ||
        normalizar(datosValidacion.programa) !== normalizar(programaHoja)) {
      return { success: false, message: 'Los datos cambiaron en la hoja. Recarga la página.' };
    }

    sheet.getRange(numeroFila, COL_ASISTENCIA).setValue(valorAsistencia);
    SpreadsheetApp.flush();

    return { success: true };

  } catch (err) {
    if (err && String(err).indexOf('Lock') !== -1) {
      return { success: false, message: 'El sistema está ocupado. Intenta de nuevo en un momento.' };
    }
    return { success: false, message: 'Error al guardar: ' + err.message };

  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}
