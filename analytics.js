/* ============================================================
   En Avant — Medición + consentimiento de cookies
   Google Analytics 4 y Píxel de Meta. Se cargan SOLO si el
   usuario acepta (no se rastrea antes del consentimiento).
   Incluir en todas las páginas públicas con:
   <script src="analytics.js" defer></script>
   ============================================================ */
(function () {
  'use strict';
  var GA_ID = 'G-L5LHYEVTBW';
  var PIXEL_ID = '1618071858864207';
  var KEY = 'ea_consent';           // 'yes' | 'no'
  var stored = null;
  try { stored = localStorage.getItem(KEY); } catch (e) {}

  // ---- Cargar herramientas de medición (tras consentimiento) ----
  function loadAnalytics() {
    // Google Analytics 4
    var g = document.createElement('script');
    g.async = true;
    g.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_ID;
    document.head.appendChild(g);
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    window.gtag('config', GA_ID);

    // Píxel de Meta
    (function (f, b, e, v, n, t, s) {
      if (f.fbq) return; n = f.fbq = function () {
        n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
      };
      if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = '2.0';
      n.queue = []; t = b.createElement(e); t.async = !0;
      t.src = v; s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
    })(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
    window.fbq('init', PIXEL_ID);
    window.fbq('track', 'PageView');

    trackLeads();
  }

  // ---- Medir la conversión real: clics a WhatsApp / clase de cortesía ----
  function trackLeads() {
    document.addEventListener('click', function (e) {
      var a = e.target.closest('a[href*="wa.me"], a[href="#cortesia"], .eaw-start');
      if (!a) return;
      if (window.gtag) window.gtag('event', 'generate_lead', { method: 'whatsapp' });
      if (window.fbq) window.fbq('track', 'Lead');
    }, true);
  }

  // ---- Banner de consentimiento ----
  function showBanner() {
    var css = [
      '.ea-cc{position:fixed;left:16px;bottom:16px;z-index:1300;max-width:420px;background:#121014;color:#fff;',
      'border-radius:10px;padding:18px 20px;box-shadow:0 24px 60px -20px rgba(0,0,0,.6);',
      'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;font-size:.9rem;line-height:1.5}',
      '.ea-cc p{margin:0 0 14px}',
      '.ea-cc a{color:#68C731;text-decoration:underline}',
      '.ea-cc-row{display:flex;gap:10px;flex-wrap:wrap}',
      '.ea-cc button{font:inherit;font-weight:600;font-size:.82rem;padding:10px 18px;border-radius:100px;cursor:pointer;border:1px solid transparent}',
      '.ea-cc .ea-ok{background:#fff;color:#121014}',
      '.ea-cc .ea-no{background:transparent;color:#fff;border-color:rgba(255,255,255,.45)}',
      '.ea-cc button:focus-visible,.ea-cc a:focus-visible{outline:2px solid #68C731;outline-offset:2px}',
      '@media(max-width:520px){.ea-cc{left:12px;right:12px;bottom:12px;max-width:none}}'
    ].join('');
    var style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);

    var box = document.createElement('div');
    box.className = 'ea-cc';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-label', 'Aviso de cookies');
    box.innerHTML =
      '<p>Usamos cookies para medir el uso del sitio y mejorar tu experiencia. ' +
      '¿Nos permites activarlas? <a href="https://drive.google.com/file/d/1r3E473rLCzm0WyGBS0XYS_4X1ET_WoxN/view?usp=sharing" target="_blank" rel="noopener">Política de datos</a></p>' +
      '<div class="ea-cc-row">' +
        '<button class="ea-ok" type="button">Aceptar</button>' +
        '<button class="ea-no" type="button">Rechazar</button>' +
      '</div>';
    document.body.appendChild(box);

    box.querySelector('.ea-ok').addEventListener('click', function () {
      try { localStorage.setItem(KEY, 'yes'); } catch (e) {}
      box.remove(); loadAnalytics();
    });
    box.querySelector('.ea-no').addEventListener('click', function () {
      try { localStorage.setItem(KEY, 'no'); } catch (e) {}
      box.remove();
    });
  }

  // ---- Arranque ----
  function init() {
    if (stored === 'yes') loadAnalytics();
    else if (stored !== 'no') showBanner();   // sin decisión aún => preguntar
    // stored === 'no' => no cargar nada
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
