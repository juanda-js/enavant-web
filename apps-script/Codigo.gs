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

/**
 * Contraseña general que se le entrega a los maestros.
 * ------------------------------------------------------------
 * Para cambiarla, edita solo esta línea y vuelve a implementar
 * (Implementar → Administrar implementaciones → ✏️ → Versión: Nueva).
 *
 * Vive únicamente en el servidor: nunca se envía al navegador,
 * así que no se puede leer desde el código fuente de la página.
 * Sí la puede ver cualquiera con acceso de edición a este proyecto.
 */
var CLAVE_ACCESO = 'MaestrosEA2026';

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
 * en minúsculas. Evita que "Chía " y "chia" se traten como distintos.
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

/** Busca una hoja tolerando tildes, mayúsculas y espacios sobrantes. */
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
  var m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);   // 18/07/2026
  if (m) {
    return m[3] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2);
  }
  return t;
}

/** true si la asistencia está marcada como presente. */
function esPresente(valor) {
  var v = normalizar(valor);
  return v === 'si' || v === 'virtual' || v === 'asistio';
}

/** true si el maestro ya marcó algo (presente o ausente). */
function estaMarcada(valor) {
  return normalizar(valor) !== '';
}

/**
 * Lee solo las columnas A:H de una hoja de sede, desde la fila 2.
 * Leer el rango completo con getDataRange() traía también las columnas
 * auxiliares que tenga la hoja, y eso pesa en cada consulta.
 * Devuelve [] si la hoja solo tiene encabezado.
 */
function filasDeSede(sheet) {
  var ultima = sheet.getLastRow();
  if (ultima < 2) return [];
  return sheet.getRange(2, 1, ultima - 1, 8).getValues();
}

/**
 * "Base Maestros" cambia muy poco, así que se guarda en caché 10 minutos.
 * Con esto el login deja de releer la hoja en cada intento.
 * OJO: un maestro recién agregado puede tardar hasta 10 minutos en poder
 * entrar. Si necesitas que sea inmediato, ejecuta limpiarCacheMaestros().
 */
function datosMaestros() {
  var cache = CacheService.getScriptCache();
  var guardado = null;
  try { guardado = cache.get('base_maestros'); } catch (e) {}
  if (guardado) {
    try { return JSON.parse(guardado); } catch (e) {}
  }

  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(HOJA_MAESTROS);
  if (!sheet) return null;

  var data = sheet.getDataRange().getValues();
  try {
    var texto = JSON.stringify(data);
    // El límite por clave de CacheService son 100 KB; si se pasa, no se cachea.
    if (texto.length < 90000) cache.put('base_maestros', texto, 600);
  } catch (e) {}

  return data;
}

/** Borra la caché para que un maestro nuevo pueda entrar de inmediato. */
function limpiarCacheMaestros() {
  try { CacheService.getScriptCache().remove('base_maestros'); } catch (e) {}
}

/* ============================================================
   1. LOGIN DE MAESTRO  (cédula + contraseña general)
   ============================================================ */
function loginMaestro(cedula, clave) {
  try {
    // La contraseña se revisa primero y con un mensaje genérico,
    // para no confirmar qué cédulas existen ante intentos al azar.
    if (String(clave == null ? '' : clave).trim() !== CLAVE_ACCESO) {
      return { success: false, message: 'Cédula o contraseña incorrecta.' };
    }

    var buscada = soloDigitos(cedula);
    if (!buscada) {
      return { success: false, message: 'Digita un número de documento válido.' };
    }

    var data = datosMaestros();
    if (!data) {
      return { success: false, message: 'No se encuentra la hoja "' + HOJA_MAESTROS + '". Avisa a administración.' };
    }

    for (var i = 1; i < data.length; i++) {
      if (soloDigitos(data[i][4]) !== buscada) continue;   // E: Cédula

      if (normalizar(data[i][0]) !== 'activo') {           // A: Estado
        return { success: false, message: 'Usuario inactivo. Contacta a administración.' };
      }

      var nombre = String(data[i][3] == null ? '' : data[i][3]).trim();   // D: Nombre
      if (!nombre) {
        return { success: false, message: 'Tu usuario no tiene nombre registrado. Avisa a administración.' };
      }

      var sedes = String(data[i][1] == null ? '' : data[i][1])            // B: Sede(s)
        .split(',')
        .map(function (s) { return s.trim(); })
        .filter(function (s) { return s !== ''; });

      if (!sedes.length) {
        return { success: false, message: 'Tu usuario no tiene sede asignada. Avisa a administración.' };
      }

      return { success: true, nombre: nombre, sedes: sedes };
    }

    return { success: false, message: 'Cédula o contraseña incorrecta.' };

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
    var data = filasDeSede(sheet);          // data[0] es la fila 2 de la hoja
    var maestroBuscado = normalizar(nombreMaestro);
    var clases = [];

    for (var i = 0; i < data.length; i++) {
      var row = data[i];
      if (aFechaTexto(row[0], tz) !== fechaStr) continue;      // A: Fecha
      if (normalizar(row[5]) !== maestroBuscado) continue;     // F: Maestro

      clases.push({
        fila: i + 2,
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

    // Confirmamos que la fila siga siendo del mismo estudiante, por si
    // alguien insertó o borró filas mientras la app estaba abierta.
    var chequeo = sheet.getRange(numeroFila, 2, 1, 5).getValues()[0];  // B..F
    if (String(datosValidacion.idEst) !== String(chequeo[0]) ||
        normalizar(datosValidacion.programa) !== normalizar(chequeo[3])) {
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

/* ============================================================
   4. RESUMEN DEL MES DEL MAESTRO
   ------------------------------------------------------------
   Recorre todas las sedes del maestro y agrupa sus filas en
   "sesiones". Una sesión = misma sede + fecha + horario + programa.
   anioMes llega como "2026-07" (del campo <input type="month">).
   ============================================================ */
function obtenerResumenMes(nombreMaestro, sedes, anioMes) {
  try {
    if (!anioMes || !/^\d{4}-\d{2}$/.test(anioMes)) {
      return { success: false, message: 'Mes inválido.' };
    }

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var tz = ss.getSpreadsheetTimeZone();
    var maestroBuscado = normalizar(nombreMaestro);

    var sesiones = {};
    var totalMarcadas = 0, totalPresentes = 0, totalPendientes = 0;

    (sedes || []).forEach(function (sede) {
      var sheet = buscarHoja(ss, sede);
      if (!sheet) return;

      var data = filasDeSede(sheet);

      for (var i = 0; i < data.length; i++) {
        var row = data[i];

        var fecha = aFechaTexto(row[0], tz);
        if (fecha.slice(0, 7) !== anioMes) continue;            // mismo mes
        if (normalizar(row[5]) !== maestroBuscado) continue;    // mismo maestro

        var horario  = String(row[3] == null ? '' : row[3]).trim();
        var programa = String(row[4] == null ? '' : row[4]).trim();
        var firma = sede + '|' + fecha + '|' + horario + '|' + programa;

        if (!sesiones[firma]) {
          sesiones[firma] = {
            sede: sede, fecha: fecha, horario: horario, programa: programa,
            estudiantes: 0, presentes: 0, pendientes: 0
          };
        }

        var s = sesiones[firma];
        s.estudiantes++;

        if (estaMarcada(row[7])) {
          totalMarcadas++;
          if (esPresente(row[7])) { s.presentes++; totalPresentes++; }
        } else {
          s.pendientes++;
          totalPendientes++;
        }
      }
    });

    // Ordenadas de la más reciente a la más antigua.
    var lista = Object.keys(sesiones).map(function (k) { return sesiones[k]; });
    lista.sort(function (a, b) {
      if (a.fecha !== b.fecha) return a.fecha < b.fecha ? 1 : -1;
      return a.horario < b.horario ? -1 : 1;
    });

    var sesionesConPendientes = lista.filter(function (s) { return s.pendientes > 0; }).length;

    return {
      success: true,
      mes: anioMes,
      totales: {
        sesiones: lista.length,
        estudiantes: totalMarcadas + totalPendientes,
        presentes: totalPresentes,
        marcadas: totalMarcadas,
        pendientes: totalPendientes,
        sesionesConPendientes: sesionesConPendientes,
        porcentajeAsistencia: totalMarcadas ? Math.round(totalPresentes * 100 / totalMarcadas) : null
      },
      sesiones: lista
    };

  } catch (err) {
    return { success: false, message: 'Error del servidor: ' + err.message };
  }
}

/* ============================================================
   5. HISTORIAL DE UN ESTUDIANTE
   ------------------------------------------------------------
   Solo devuelve las clases de ESE maestro con ESE estudiante,
   para que un maestro no vea el historial de grupos ajenos.
   ============================================================ */
function obtenerHistorialEstudiante(sede, idEst, nombreMaestro) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = buscarHoja(ss, sede);
    if (!sheet) {
      return { success: false, message: 'No existe la hoja de la sede "' + sede + '".' };
    }

    var tz = ss.getSpreadsheetTimeZone();
    var data = filasDeSede(sheet);
    var maestroBuscado = normalizar(nombreMaestro);
    var idBuscado = String(idEst).trim();

    var registros = [];
    var nombre = '';
    var presentes = 0, ausentes = 0, pendientes = 0;

    for (var i = 0; i < data.length; i++) {
      var row = data[i];
      if (String(row[1]).trim() !== idBuscado) continue;        // B: IdEst
      if (normalizar(row[5]) !== maestroBuscado) continue;      // F: Maestro

      nombre = String(row[2] == null ? '' : row[2]).trim();     // C: Estudiante

      var marcada = estaMarcada(row[7]);
      var presente = marcada && esPresente(row[7]);
      if (!marcada) pendientes++;
      else if (presente) presentes++;
      else ausentes++;

      registros.push({
        fecha: aFechaTexto(row[0], tz),
        horario: String(row[3] == null ? '' : row[3]).trim(),
        programa: String(row[4] == null ? '' : row[4]).trim(),
        asistencia: row[7] || '',
        marcada: marcada,
        presente: presente
      });
    }

    registros.sort(function (a, b) { return a.fecha < b.fecha ? 1 : -1; });

    var conMarca = presentes + ausentes;

    return {
      success: true,
      estudiante: nombre,
      totales: {
        clases: registros.length,
        presentes: presentes,
        ausentes: ausentes,
        pendientes: pendientes,
        porcentaje: conMarca ? Math.round(presentes * 100 / conMarca) : null
      },
      registros: registros
    };

  } catch (err) {
    return { success: false, message: 'Error del servidor: ' + err.message };
  }
}
