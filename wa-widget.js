/* ============================================================
   En Avant — Botón flotante de WhatsApp (enlace directo)
   Componente compartido: se incluye en todas las páginas con
   <script src="wa-widget.js"></script>
   Un solo botón que abre WhatsApp directamente al chatbot.
   Para cambiar el número o el mensaje, edita PHONE y MENSAJE.
   ============================================================ */
(function () {
  'use strict';

  var PHONE = '573126356696';   // número único del chatbot (todas las sedes)
  var MENSAJE = '¡Hola En Avant! Quisiera información sobre las clases.';

  var WA_SVG = '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M16 2.7C8.7 2.7 2.7 8.6 2.7 16c0 2.3.6 4.6 1.8 6.6L2.6 29.4l7-1.8c1.9 1 4.1 1.6 6.4 1.6 7.3 0 13.3-6 13.3-13.3S23.3 2.7 16 2.7zm0 24.2c-2 0-4-.5-5.7-1.6l-.4-.2-4.2 1.1 1.1-4.1-.3-.4c-1.1-1.8-1.7-3.9-1.7-6 0-6.1 5-11.1 11.2-11.1 6.1 0 11.1 5 11.1 11.1s-5 11.2-11.1 11.2zm6.1-8.3c-.3-.2-2-1-2.3-1.1-.3-.1-.5-.2-.8.2-.2.3-.9 1.1-1 1.3-.2.2-.4.3-.7.1-.3-.2-1.4-.5-2.7-1.7-1-.9-1.7-2-1.9-2.3-.2-.3 0-.5.1-.7l.5-.6c.2-.2.2-.3.3-.6.1-.2.1-.4 0-.6-.1-.2-.8-1.8-1-2.5-.3-.6-.6-.5-.8-.6h-.7c-.2 0-.6.1-.9.4-.3.3-1.2 1.1-1.2 2.8 0 1.6 1.2 3.2 1.4 3.4.2.2 2.4 3.6 5.7 5.1.8.3 1.4.5 1.9.7.8.3 1.5.2 2.1.1.6-.1 2-.8 2.3-1.6.3-.8.3-1.5.2-1.6-.1-.2-.3-.3-.6-.4z"/></svg>';

  // Etiqueta emergente opcional junto al botón (se oculta en móvil).
  var css = [
    '.eaw{position:fixed;bottom:24px;right:24px;z-index:1200;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;display:flex;align-items:center;gap:12px}',
    '.eaw *{box-sizing:border-box}',
    '.eaw-label{background:#fff;color:#141118;font-size:.9rem;font-weight:600;padding:10px 16px;border-radius:100px;box-shadow:0 10px 26px -10px rgba(20,17,24,.35);white-space:nowrap;opacity:0;transform:translateX(8px);transition:opacity .3s,transform .3s;pointer-events:none}',
    '.eaw:hover .eaw-label{opacity:1;transform:none}',
    '.eaw-fab{width:60px;height:60px;border-radius:50%;background:#25D366;border:none;cursor:pointer;display:grid;place-items:center;box-shadow:0 12px 30px -8px rgba(37,211,102,.55);transition:transform .3s cubic-bezier(.34,1.56,.64,1);position:relative;text-decoration:none;flex-shrink:0}',
    '.eaw-fab:hover{transform:scale(1.08)}',
    '.eaw-fab:focus-visible{outline:3px solid #128C7E;outline-offset:3px}',
    '.eaw-fab svg{width:32px;height:32px;fill:#fff}',
    '.eaw-fab::before{content:"";position:absolute;inset:0;border-radius:50%;border:2px solid #25D366;animation:eawPulse 2.2s ease-out infinite;pointer-events:none}',
    '@keyframes eawPulse{from{transform:scale(1);opacity:.7}to{transform:scale(1.5);opacity:0}}',
    '@media (prefers-reduced-motion:reduce){.eaw *,.eaw *::before{animation:none!important;transition-duration:.01ms!important}}',
    '@media (max-width:480px){.eaw{bottom:18px;right:18px}.eaw-label{display:none}.eaw-fab{width:58px;height:58px}}'
  ].join('');

  var href = 'https://wa.me/' + PHONE + '?text=' + encodeURIComponent(MENSAJE);

  var root = document.createElement('div');
  root.className = 'eaw';
  root.innerHTML =
    '<span class="eaw-label" aria-hidden="true">Escríbenos por WhatsApp</span>' +
    '<a class="eaw-fab eaw-start" href="' + href + '" target="_blank" rel="noopener" ' +
       'aria-label="Escríbenos por WhatsApp">' + WA_SVG + '</a>';

  var style = document.createElement('style');
  style.textContent = css;

  function init() {
    document.head.appendChild(style);
    document.body.appendChild(root);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
