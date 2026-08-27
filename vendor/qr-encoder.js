/* ============================================================
   Generador de códigos QR — En Avant
   ------------------------------------------------------------
   Escrito para no depender de ningún servicio externo: si el
   servicio de QR se cae el día de la función, las boletas dejan
   de servir. Esto genera el código aquí mismo, sin red.

   Alcance deliberado: modo binario, corrección de errores nivel M
   y versiones 1 a 6 (hasta ~106 caracteres). Los tokens de las
   boletas son UUID de 36, así que sobra de largo. Si algún día no
   cupiera, avisa con un error en vez de producir un QR inválido.

   Uso:  QREncoder.matriz("texto")  → arreglo de arreglos true/false
         QREncoder.svg("texto", {tam:180})  → cadena SVG
   ============================================================ */
(function (global) {
  'use strict';

  /* ---- Aritmética en el campo de Galois GF(256), para Reed-Solomon ---- */
  var EXP = new Uint8Array(512), LOG = new Uint8Array(256);
  (function () {
    var x = 1;
    for (var i = 0; i < 255; i++) {
      EXP[i] = x; LOG[x] = i;
      x <<= 1;
      if (x & 0x100) x ^= 0x11D;          // polinomio primitivo
    }
    for (var j = 255; j < 512; j++) EXP[j] = EXP[j - 255];
  })();
  function mul(a, b) { return (a === 0 || b === 0) ? 0 : EXP[LOG[a] + LOG[b]]; }

  /* Polinomio generador de n codewords de corrección */
  function generador(n) {
    var p = [1];
    for (var i = 0; i < n; i++) {
      var np = new Array(p.length + 1).fill(0);
      for (var j = 0; j < p.length; j++) {
        np[j] ^= p[j];
        np[j + 1] ^= mul(p[j], EXP[i]);
      }
      p = np;
    }
    return p;
  }

  /* Corrección de errores de un bloque */
  function ecDeBloque(datos, nEC) {
    var gen = generador(nEC), resto = datos.slice().concat(new Array(nEC).fill(0));
    for (var i = 0; i < datos.length; i++) {
      var coef = resto[i];
      if (coef === 0) continue;
      for (var j = 0; j < gen.length; j++) resto[i + j] ^= mul(gen[j], coef);
    }
    return resto.slice(datos.length);
  }

  /* ---- Tabla de capacidades, nivel M, versiones 1 a 6 ----
     [ecPorBloque, bloquesG1, datosG1, bloquesG2, datosG2] */
  var VERSIONES = {
    1: [10, 1, 16, 0, 0],
    2: [16, 1, 28, 0, 0],
    3: [26, 1, 44, 0, 0],
    4: [18, 2, 32, 0, 0],
    5: [24, 2, 43, 0, 0],
    6: [16, 4, 27, 0, 0]
  };
  var ALINEACION = { 1: [], 2: [6,18], 3: [6,22], 4: [6,26], 5: [6,30], 6: [6,34] };

  function datosDeVersion(v) { var c = VERSIONES[v]; return c[1] * c[2] + c[3] * c[4]; }

  /* Codifica el texto a bytes UTF-8 */
  function aBytes(txt) {
    var out = [], s = unescape(encodeURIComponent(String(txt)));
    for (var i = 0; i < s.length; i++) out.push(s.charCodeAt(i) & 0xFF);
    return out;
  }

  /* Elige la versión más pequeña donde quepa el contenido */
  function elegirVersion(nBytes) {
    for (var v = 1; v <= 6; v++) {
      var cabecera = 2;                       // 4 bits de modo + 8 de longitud = 12 bits ≈ 2 bytes
      if (nBytes + cabecera <= datosDeVersion(v)) return v;
    }
    throw new Error('El contenido es demasiado largo para un QR de versión 6 (' + nBytes + ' bytes).');
  }

  /* ---- Flujo de bits ---- */
  function Bits() { this.b = []; }
  Bits.prototype.push = function (valor, n) {
    for (var i = n - 1; i >= 0; i--) this.b.push((valor >> i) & 1);
  };
  Bits.prototype.bytes = function () {
    var out = [];
    for (var i = 0; i < this.b.length; i += 8) {
      var byte = 0;
      for (var j = 0; j < 8; j++) byte = (byte << 1) | (this.b[i + j] || 0);
      out.push(byte);
    }
    return out;
  };

  /* Arma la secuencia final de codewords: datos + relleno + corrección, intercalados */
  function codewords(txt) {
    var datos = aBytes(txt), v = elegirVersion(datos.length);
    var cfg = VERSIONES[v], capacidad = datosDeVersion(v);

    var bits = new Bits();
    bits.push(0b0100, 4);                     // modo binario
    bits.push(datos.length, 8);               // longitud (8 bits para versiones 1-9)
    datos.forEach(function (d) { bits.push(d, 8); });
    var faltan = capacidad * 8 - bits.b.length;
    bits.push(0, Math.min(4, faltan));        // terminador
    while (bits.b.length % 8) bits.b.push(0); // completar el byte
    var bs = bits.bytes();
    var relleno = [0xEC, 0x11], k = 0;
    while (bs.length < capacidad) bs.push(relleno[k++ % 2]);

    // Repartir en bloques
    var bloques = [], ec = [], p = 0;
    function agregar(cant, tam) {
      for (var i = 0; i < cant; i++) {
        var blk = bs.slice(p, p + tam); p += tam;
        bloques.push(blk); ec.push(ecDeBloque(blk, cfg[0]));
      }
    }
    agregar(cfg[1], cfg[2]);
    agregar(cfg[3], cfg[4]);

    // Intercalar
    var salida = [], maxD = Math.max(cfg[2], cfg[4] || 0);
    for (var i = 0; i < maxD; i++)
      for (var j = 0; j < bloques.length; j++)
        if (i < bloques[j].length) salida.push(bloques[j][i]);
    for (var i2 = 0; i2 < cfg[0]; i2++)
      for (var j2 = 0; j2 < ec.length; j2++) salida.push(ec[j2][i2]);

    return { bytes: salida, version: v };
  }

  /* ---- Construcción de la matriz ---- */
  function nuevaMatriz(n) {
    var m = [];
    for (var i = 0; i < n; i++) m.push(new Array(n).fill(null));
    return m;
  }
  function ponerBuscador(m, r, c) {
    for (var i = -1; i <= 7; i++) for (var j = -1; j <= 7; j++) {
      var y = r + i, x = c + j;
      if (y < 0 || x < 0 || y >= m.length || x >= m.length) continue;
      var dentro = (i >= 0 && i <= 6 && (j === 0 || j === 6)) ||
                   (j >= 0 && j <= 6 && (i === 0 || i === 6)) ||
                   (i >= 2 && i <= 4 && j >= 2 && j <= 4);
      m[y][x] = dentro;
    }
  }
  function ponerAlineacion(m, v) {
    var c = ALINEACION[v];
    for (var a = 0; a < c.length; a++) for (var b = 0; b < c.length; b++) {
      var r = c[a], k = c[b];
      if (m[r][k] !== null) continue;          // no pisar los buscadores
      for (var i = -2; i <= 2; i++) for (var j = -2; j <= 2; j++)
        m[r + i][k + j] = (Math.max(Math.abs(i), Math.abs(j)) !== 1);
    }
  }
  function reservado(m, n, fila, col) {
    // zonas que no llevan datos: buscadores, tiempo, formato
    if (m[fila][col] !== null) return true;
    return false;
  }

  function construir(txt) {
    var cw = codewords(txt), v = cw.version, n = v * 4 + 17;
    var m = nuevaMatriz(n);

    ponerBuscador(m, 0, 0); ponerBuscador(m, 0, n - 7); ponerBuscador(m, n - 7, 0);
    for (var i = 8; i < n - 8; i++) {          // patrones de tiempo
      m[6][i] = (i % 2 === 0); m[i][6] = (i % 2 === 0);
    }
    ponerAlineacion(m, v);
    m[n - 8][8] = true;                        // módulo oscuro fijo

    // Reservar el área del formato
    var reserva = [];
    for (var k = 0; k < 9; k++) { reserva.push([8, k]); reserva.push([k, 8]); }
    for (var k2 = 0; k2 < 8; k2++) { reserva.push([8, n - 1 - k2]); reserva.push([n - 1 - k2, 8]); }
    reserva.forEach(function (p) { if (m[p[0]][p[1]] === null) m[p[0]][p[1]] = 'R'; });

    // Colocar los datos en zigzag desde abajo a la derecha
    var bitsDatos = [];
    cw.bytes.forEach(function (b) { for (var i = 7; i >= 0; i--) bitsDatos.push((b >> i) & 1); });
    var idx = 0, arriba = true;
    for (var col = n - 1; col > 0; col -= 2) {
      if (col === 6) col--;                    // la columna de tiempo se salta
      for (var f = 0; f < n; f++) {
        var fila = arriba ? (n - 1 - f) : f;
        for (var d = 0; d < 2; d++) {
          var c2 = col - d;
          if (m[fila][c2] !== null) continue;
          m[fila][c2] = idx < bitsDatos.length ? !!bitsDatos[idx] : false;
          idx++;
        }
      }
      arriba = !arriba;
    }
    return { m: m, n: n, v: v };
  }

  /* ---- Máscaras y penalización ---- */
  var MASCARAS = [
    function (i, j) { return (i + j) % 2 === 0; },
    function (i) { return i % 2 === 0; },
    function (i, j) { return j % 3 === 0; },
    function (i, j) { return (i + j) % 3 === 0; },
    function (i, j) { return (Math.floor(i / 2) + Math.floor(j / 3)) % 2 === 0; },
    function (i, j) { return (i * j) % 2 + (i * j) % 3 === 0; },
    function (i, j) { return ((i * j) % 2 + (i * j) % 3) % 2 === 0; },
    function (i, j) { return ((i + j) % 2 + (i * j) % 3) % 2 === 0; }
  ];

  function penalizacion(m) {
    var n = m.length, p = 0;
    // Regla 1: cinco o más módulos iguales seguidos
    for (var i = 0; i < n; i++) {
      var runF = 1, runC = 1;
      for (var j = 1; j < n; j++) {
        runF = (m[i][j] === m[i][j - 1]) ? runF + 1 : 1;
        if (runF === 5) p += 3; else if (runF > 5) p += 1;
        runC = (m[j][i] === m[j - 1][i]) ? runC + 1 : 1;
        if (runC === 5) p += 3; else if (runC > 5) p += 1;
      }
    }
    // Regla 2: bloques de 2×2 del mismo color
    for (var i2 = 0; i2 < n - 1; i2++) for (var j2 = 0; j2 < n - 1; j2++) {
      var a = m[i2][j2];
      if (a === m[i2][j2 + 1] && a === m[i2 + 1][j2] && a === m[i2 + 1][j2 + 1]) p += 3;
    }
    // Regla 3: patrones parecidos al buscador
    var pat1 = [true,false,true,true,true,false,true,false,false,false,false];
    var pat2 = [false,false,false,false,true,false,true,true,true,false,true];
    function coincide(arr, off, pat) {
      for (var k = 0; k < 11; k++) if (arr[off + k] !== pat[k]) return false;
      return true;
    }
    for (var i3 = 0; i3 < n; i3++) {
      var fila = m[i3], colu = [];
      for (var t = 0; t < n; t++) colu.push(m[t][i3]);
      for (var o = 0; o + 11 <= n; o++) {
        if (coincide(fila, o, pat1) || coincide(fila, o, pat2)) p += 40;
        if (coincide(colu, o, pat1) || coincide(colu, o, pat2)) p += 40;
      }
    }
    // Regla 4: desbalance entre claros y oscuros
    var osc = 0;
    for (var i4 = 0; i4 < n; i4++) for (var j4 = 0; j4 < n; j4++) if (m[i4][j4]) osc++;
    var pct = osc * 100 / (n * n);
    p += Math.floor(Math.abs(pct - 50) / 5) * 10;
    return p;
  }

  /* Información de formato: nivel M + máscara, con BCH(15,5) */
  function bitsFormato(mascara) {
    var datos = (0b00 << 3) | mascara;         // nivel M = 00
    var v = datos << 10;
    for (var i = 4; i >= 0; i--) if (v & (1 << (i + 10))) v ^= 0b10100110111 << i;
    return ((datos << 10) | v) ^ 0b101010000010010;
  }

  function matriz(texto) {
    var base = construir(texto), n = base.n;
    var mejor = null, mejorP = Infinity;

    for (var k = 0; k < 8; k++) {
      var m = base.m.map(function (f) { return f.slice(); });
      // aplicar máscara solo a los módulos de datos
      for (var i = 0; i < n; i++) for (var j = 0; j < n; j++) {
        if (base.m[i][j] === 'R') continue;
        if (esFuncional(base, i, j)) continue;
        if (MASCARAS[k](i, j)) m[i][j] = !m[i][j];
      }
      // Escribir la información de formato en sus dos copias.
      // Las posiciones vienen fijadas por la norma; se listan explícitas
      // para no equivocarse con aritmética de índices.
      var f = bitsFormato(k);
      // Ordenadas por número de bit (0 primero). La copia de arriba a la
      // izquierda va al revés que la otra: eso lo fija la norma.
      var copia1 = [[0,8],[1,8],[2,8],[3,8],[4,8],[5,8],[7,8],[8,8],
                    [8,7],[8,5],[8,4],[8,3],[8,2],[8,1],[8,0]];
      var copia2 = [[n-1,8],[n-2,8],[n-3,8],[n-4,8],[n-5,8],[n-6,8],[n-7,8],
                    [8,n-8],[8,n-7],[8,n-6],[8,n-5],[8,n-4],[8,n-3],[8,n-2],[8,n-1]];
      for (var b = 0; b < 15; b++) {
        var bit = ((f >> b) & 1) === 1;
        m[copia1[b][0]][copia1[b][1]] = bit;
        m[copia2[b][0]][copia2[b][1]] = bit;
      }
      m[n - 8][8] = true;                      // el módulo oscuro no se toca
      var p = penalizacion(m);
      if (p < mejorP) { mejorP = p; mejor = m; }
    }
    return mejor.map(function (f) { return f.map(function (x) { return x === true; }); });
  }

  /* ¿La celda pertenece a un patrón funcional (no lleva máscara)? */
  function esFuncional(base, i, j) {
    var n = base.n;
    if (i === 6 || j === 6) return true;                          // tiempo
    if (i < 9 && j < 9) return true;                              // buscador + formato
    if (i < 9 && j >= n - 8) return true;
    if (i >= n - 8 && j < 9) return true;
    var c = ALINEACION[base.v];
    for (var a = 0; a < c.length; a++) for (var b = 0; b < c.length; b++) {
      var r = c[a], k = c[b];
      if (r < 9 && k < 9) continue;
      if (r < 9 && k >= n - 8) continue;
      if (r >= n - 8 && k < 9) continue;
      if (Math.abs(i - r) <= 2 && Math.abs(j - k) <= 2) return true;
    }
    return false;
  }

  /* ---- Salidas ---- */
  function svg(texto, opciones) {
    opciones = opciones || {};
    var m = matriz(texto), n = m.length;
    var margen = opciones.margen == null ? 4 : opciones.margen;   // zona tranquila
    var total = n + margen * 2;
    var d = '';
    for (var i = 0; i < n; i++) for (var j = 0; j < n; j++)
      if (m[i][j]) d += 'M' + (j + margen) + ' ' + (i + margen) + 'h1v1h-1z';
    var tam = opciones.tam || 180;
    return '<svg xmlns="http://www.w3.org/2000/svg" width="' + tam + '" height="' + tam +
      '" viewBox="0 0 ' + total + ' ' + total + '" shape-rendering="crispEdges" role="img" aria-label="Código QR de la boleta">' +
      '<rect width="' + total + '" height="' + total + '" fill="#fff"/>' +
      '<path d="' + d + '" fill="#000"/></svg>';
  }

  global.QREncoder = { matriz: matriz, svg: svg };
})(typeof window !== 'undefined' ? window : this);
