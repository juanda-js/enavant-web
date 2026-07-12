#!/usr/bin/env bash
# ============================================================
#  EN AVANT — Script de LANZAMIENTO ("despertar" el sitio)
#  Ejecutar UNA sola vez, cuando el dominio ya esté conectado
#  y el equipo haya aprobado el sitio.
#
#  Uso:   bash lanzar.sh
#  Luego: git add -A && git commit -m "Lanzamiento" && git push
# ============================================================
set -e
cd "$(dirname "$0")"

DOMINIO="https://www.enavantescuela.com"
GHPAGES="https://juanda-js.github.io/enavant-web"

# Páginas públicas (se indexan). boleteria.html y escaner.html NO: son internas.
PUBLICAS=(index danza musica artes fitness babies temporadas solicitudes)

echo "1) Quitando 'noindex' de las páginas públicas…"
for f in "${PUBLICAS[@]}"; do
  # borra la línea del meta robots noindex (con o sin comentario al lado)
  perl -0pi -e 's{[ \t]*<meta name="robots" content="noindex">(<!--[^>]*-->)?\n}{}g' "$f.html"
  echo "   - $f.html"
done

echo "2) Cambiando github.io por el dominio real en todo el sitio…"
for f in *.html; do
  perl -0pi -e "s{\Q$GHPAGES\E}{$DOMINIO}g" "$f"
done

echo ""
echo "Listo ✅  Verifica y publica con:"
echo "   git add -A && git commit -m \"Lanzamiento: sitio en vivo en el dominio\" && git push"
echo ""
echo "Comprobaciones rápidas:"
echo "   grep -l noindex *.html   # solo deberían salir boleteria.html y escaner.html"
echo "   grep -rc github.io *.html # debería dar 0 en todas"
