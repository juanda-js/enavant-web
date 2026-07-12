/* ============================================================
   En Avant — Widget flotante de WhatsApp (asesoras por sede)
   Componente compartido: se incluye en todas las páginas con
   <script src="wa-widget.js"></script>
   Para cambiar una asesora, su foto, número o mensaje, edita
   solo el arreglo AGENTS de abajo.
   ============================================================ */
(function () {
  'use strict';

  // -------- Datos de las asesoras (edita aquí) --------
  var AGENTS = [
    {
      name: 'Luz Marina',
      sede: 'En Avant · Mazurén',
      photo: 'img/luz-mendoza.jpg',
      pos: '50% 22%',
      phone: '573134308891',
      intro: '¡Estás contactando a En Avant Mazurén! ✨ Mi nombre es Luz Marina y es un gusto para mí brindarte la información de nuestras clases. Cuéntame, ¿cómo puedo ayudarte?',
      salida: '¡Hola Luz Marina! Quisiera información sobre las clases de En Avant Mazurén.'
    },
    {
      name: 'Sandra López',
      sede: 'En Avant · Chía',
      photo: 'img/sandra-lopez.jpg',
      pos: '50% 20%',
      phone: '573219216471',
      intro: '¡Estás contactando a En Avant Chía! ✨ Mi nombre es Sandra López y con gusto te doy toda la información de nuestras clases. Cuéntame, ¿cómo puedo ayudarte?',
      salida: '¡Hola Sandra! Quisiera información sobre las clases de En Avant Chía.'
    },
    {
      name: 'María Fernanda',
      sede: 'En Avant · Salitre',
      photo: 'img/maria-monterroza.jpeg',
      pos: '50% 28%',
      phone: '573114929959',
      intro: '¡Estás contactando a En Avant Salitre! ✨ Mi nombre es María Fernanda y será un placer brindarte la información de nuestras clases. Cuéntame, ¿cómo puedo ayudarte?',
      salida: '¡Hola María Fernanda! Quisiera información sobre las clases de En Avant Salitre.'
    }
  ];

  var WA_SVG = '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M16 2.7C8.7 2.7 2.7 8.6 2.7 16c0 2.3.6 4.6 1.8 6.6L2.6 29.4l7-1.8c1.9 1 4.1 1.6 6.4 1.6 7.3 0 13.3-6 13.3-13.3S23.3 2.7 16 2.7zm0 24.2c-2 0-4-.5-5.7-1.6l-.4-.2-4.2 1.1 1.1-4.1-.3-.4c-1.1-1.8-1.7-3.9-1.7-6 0-6.1 5-11.1 11.2-11.1 6.1 0 11.1 5 11.1 11.1s-5 11.2-11.1 11.2zm6.1-8.3c-.3-.2-2-1-2.3-1.1-.3-.1-.5-.2-.8.2-.2.3-.9 1.1-1 1.3-.2.2-.4.3-.7.1-.3-.2-1.4-.5-2.7-1.7-1-.9-1.7-2-1.9-2.3-.2-.3 0-.5.1-.7l.5-.6c.2-.2.2-.3.3-.6.1-.2.1-.4 0-.6-.1-.2-.8-1.8-1-2.5-.3-.6-.6-.5-.8-.6h-.7c-.2 0-.6.1-.9.4-.3.3-1.2 1.1-1.2 2.8 0 1.6 1.2 3.2 1.4 3.4.2.2 2.4 3.6 5.7 5.1.8.3 1.4.5 1.9.7.8.3 1.5.2 2.1.1.6-.1 2-.8 2.3-1.6.3-.8.3-1.5.2-1.6-.1-.2-.3-.3-.6-.4z"/></svg>';

  // -------- Estilos --------
  var css = [
    '.eaw{position:fixed;bottom:24px;right:24px;z-index:1200;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}',
    '.eaw *{box-sizing:border-box}',
    '.eaw-fab{width:60px;height:60px;border-radius:50%;background:#25D366;border:none;cursor:pointer;display:grid;place-items:center;box-shadow:0 12px 30px -8px rgba(37,211,102,.55);transition:transform .3s cubic-bezier(.34,1.56,.64,1);position:relative;margin-left:auto}',
    '.eaw-fab:hover{transform:scale(1.08)}',
    '.eaw-fab svg{width:32px;height:32px;fill:#fff}',
    '.eaw-fab::before{content:"";position:absolute;inset:0;border-radius:50%;border:2px solid #25D366;animation:eawPulse 2.2s ease-out infinite}',
    '@keyframes eawPulse{from{transform:scale(1);opacity:.7}to{transform:scale(1.5);opacity:0}}',
    '.eaw-win{position:absolute;bottom:74px;right:0;width:340px;max-width:calc(100vw - 32px);background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 30px 70px -18px rgba(20,17,24,.4);opacity:0;transform:translateY(16px) scale(.98);transform-origin:bottom right;pointer-events:none;transition:opacity .35s cubic-bezier(.22,1,.36,1),transform .35s cubic-bezier(.22,1,.36,1)}',
    '.eaw.open .eaw-win{opacity:1;transform:none;pointer-events:auto}',
    '.eaw-head{position:relative;background:linear-gradient(125deg,#8f0aad 0%,#A40FC4 45%,#C879E6 100%);color:#fff;padding:22px 22px 34px}',
    '.eaw-head .eaw-x{position:absolute;top:16px;right:16px;width:30px;height:30px;border:none;background:transparent;color:#fff;font-size:1.5rem;line-height:1;cursor:pointer;opacity:.9;border-radius:50%;transition:background .25s}',
    '.eaw-head .eaw-x:hover{background:rgba(255,255,255,.18)}',
    '.eaw-hello{font-size:1.5rem;font-weight:700;display:flex;align-items:center;gap:8px}',
    '.eaw-hello .wave{display:inline-block;animation:eawWave 2.4s ease-in-out infinite;transform-origin:70% 70%}',
    '@keyframes eawWave{0%,60%,100%{transform:rotate(0)}10%{transform:rotate(14deg)}20%{transform:rotate(-8deg)}30%{transform:rotate(14deg)}40%{transform:rotate(-4deg)}50%{transform:rotate(10deg)}}',
    '.eaw-t1{font-size:1.02rem;font-weight:500;margin-top:8px;opacity:.97}',
    '.eaw-t2{font-size:.86rem;margin-top:4px;opacity:.8}',
    '.eaw-wave{position:absolute;left:0;right:0;bottom:-1px;width:100%;height:22px;display:block}',
    '.eaw-body{max-height:60vh;overflow-y:auto;background:#fff}',
    '.eaw-agent{display:flex;align-items:center;gap:14px;width:100%;text-align:left;background:none;border:none;cursor:pointer;padding:16px 20px;border-bottom:1px solid rgba(20,17,24,.07);transition:background .25s}',
    '.eaw-agent:last-child{border-bottom:none}',
    '.eaw-agent:hover{background:#faf5fd}',
    '.eaw-av{position:relative;display:block;width:56px;height:56px;flex-shrink:0}',
    '.eaw-av img{width:100%;height:100%;border-radius:50%;object-fit:cover}',
    '.eaw-av .ini{width:100%;height:100%;border-radius:50%;display:grid;place-items:center;background:linear-gradient(135deg,#A40FC4,#7B0B93);color:#fff;font-weight:700;font-size:1.3rem}',
    '.eaw-av .badge{position:absolute;left:-2px;bottom:-2px;width:22px;height:22px;border-radius:50%;background:#25D366;border:2px solid #fff;display:grid;place-items:center}',
    '.eaw-av .badge svg{width:12px;height:12px;fill:#fff}',
    '.eaw-agent .meta b{display:block;font-size:1.02rem;color:#141118;font-weight:600}',
    '.eaw-agent .meta span{display:block;font-size:.9rem;color:rgba(20,17,24,.55);margin-top:1px}',
    '.eaw-agent .chev{margin-left:auto;color:rgba(20,17,24,.3);font-size:1.3rem;transition:transform .25s,color .25s}',
    '.eaw-agent:hover .chev{color:#A40FC4;transform:translateX(3px)}',
    /* Chat view */
    '.eaw-chat{display:none;flex-direction:column}',
    '.eaw.chat .eaw-list{display:none}',
    '.eaw.chat .eaw-chat{display:flex}',
    '.eaw-chead{position:relative;background:linear-gradient(125deg,#8f0aad 0%,#A40FC4 45%,#C879E6 100%);color:#fff;padding:18px 20px 30px;display:flex;align-items:center;gap:12px}',
    '.eaw-back{border:none;background:transparent;color:#fff;cursor:pointer;font-size:1.5rem;line-height:1;padding:0 4px;opacity:.95}',
    '.eaw-chead .eaw-av{width:44px;height:44px}',
    '.eaw-chead .ctitle b{display:block;font-size:1.02rem;font-weight:600}',
    '.eaw-chead .ctitle span{display:block;font-size:.82rem;opacity:.85}',
    '.eaw-chead .eaw-x{position:absolute;top:14px;right:14px;width:28px;height:28px;border:none;background:transparent;color:#fff;font-size:1.4rem;cursor:pointer;opacity:.9;border-radius:50%}',
    '.eaw-chead .eaw-x:hover{background:rgba(255,255,255,.18)}',
    '.eaw-cbody{background:#efe7f4;padding:24px 20px 20px;min-height:190px;background-image:radial-gradient(rgba(164,15,196,.06) 1px,transparent 1px);background-size:16px 16px}',
    '.eaw-bubble{background:#fff;border-radius:4px 16px 16px 16px;padding:16px 18px;font-size:.95rem;line-height:1.5;color:#141118;box-shadow:0 4px 14px -6px rgba(20,17,24,.18);max-width:92%;opacity:0;transform:translateY(8px);animation:eawBubble .5s .1s cubic-bezier(.22,1,.36,1) forwards}',
    '@keyframes eawBubble{to{opacity:1;transform:none}}',
    '.eaw-cfoot{padding:16px 20px 20px;background:#fff}',
    '.eaw-start{display:flex;align-items:center;justify-content:center;gap:10px;width:100%;padding:15px;border-radius:100px;background:linear-gradient(120deg,#A40FC4,#C879E6);color:#fff;font-size:1rem;font-weight:600;text-decoration:none;box-shadow:0 12px 26px -10px rgba(164,15,196,.6);transition:transform .3s cubic-bezier(.34,1.56,.64,1),box-shadow .3s}',
    '.eaw-start:hover{transform:translateY(-2px);box-shadow:0 16px 32px -10px rgba(164,15,196,.7)}',
    '.eaw-start svg{width:20px;height:20px;fill:#fff}',
    '@media (prefers-reduced-motion:reduce){.eaw *,.eaw *::before{animation:none!important;transition-duration:.01ms!important}}',
    /* Móvil: panel como hoja inferior a lo ancho (evita cortes y márgenes desiguales) */
    '@media (max-width:480px){',
    '.eaw{bottom:18px;right:18px}',
    '.eaw-win{position:fixed;left:14px;right:14px;bottom:90px;width:auto;max-width:none;transform-origin:bottom center;border-radius:22px}',
    '.eaw-body{max-height:44vh}',
    '.eaw-cbody{min-height:150px}',
    '.eaw-fab{width:58px;height:58px}',
    '}'
  ].join('');

  // -------- Construcción del DOM --------
  function avatarHTML(a, big) {
    var inner = a.photo
      ? '<img src="' + a.photo + '" alt="' + a.name + '" loading="lazy" style="object-position:' + (a.pos || 'center') + '">'
      : '<span class="ini">' + a.name.charAt(0) + '</span>';
    return '<span class="eaw-av">' + inner +
      '<span class="badge">' + WA_SVG + '</span></span>';
  }

  var wave = '<svg class="eaw-wave" viewBox="0 0 400 22" preserveAspectRatio="none"><path d="M0 22 C 70 4 140 4 200 12 C 260 20 330 20 400 6 L400 22 Z" fill="#fff"/></svg>';

  var agentsHTML = AGENTS.map(function (a, i) {
    return '<button class="eaw-agent" data-i="' + i + '">' +
      avatarHTML(a) +
      '<span class="meta"><b>' + a.name + '</b><span>' + a.sede + '</span></span>' +
      '<span class="chev" aria-hidden="true">›</span>' +
    '</button>';
  }).join('');

  var root = document.createElement('div');
  root.className = 'eaw';
  root.innerHTML =
    '<div class="eaw-win" role="dialog" aria-label="Chatea con En Avant">' +
      '<div class="eaw-list">' +
        '<div class="eaw-head">' +
          '<button class="eaw-x" aria-label="Cerrar">&times;</button>' +
          '<div class="eaw-hello">¡Hola! <span class="wave">👋</span></div>' +
          '<div class="eaw-t1">Bienvenido a En Avant</div>' +
          '<div class="eaw-t2">Horario de atención: 10:00 a.m. – 7:00 p.m.</div>' +
          wave +
        '</div>' +
        '<div class="eaw-body">' + agentsHTML + '</div>' +
      '</div>' +
      '<div class="eaw-chat">' +
        '<div class="eaw-chead">' +
          '<button class="eaw-back" aria-label="Volver">&#8249;</button>' +
          '<span id="eawCav"></span>' +
          '<span class="ctitle"><b id="eawCname"></b><span id="eawCsede"></span></span>' +
          '<button class="eaw-x" aria-label="Cerrar">&times;</button>' +
        '</div>' +
        '<div class="eaw-cbody"><div class="eaw-bubble" id="eawBubble"></div></div>' +
        '<div class="eaw-cfoot"><a class="eaw-start" id="eawStart" target="_blank" rel="noopener">' + WA_SVG + ' Empezar chat</a></div>' +
      '</div>' +
    '</div>' +
    '<button class="eaw-fab" aria-label="Chatea con nosotros por WhatsApp">' + WA_SVG + '</button>';

  var style = document.createElement('style');
  style.textContent = css;

  function init() {
    document.head.appendChild(style);
    document.body.appendChild(root);

    var fab = root.querySelector('.eaw-fab');
    var bubble = root.querySelector('#eawBubble');
    var cname = root.querySelector('#eawCname');
    var csede = root.querySelector('#eawCsede');
    var cav = root.querySelector('#eawCav');
    var start = root.querySelector('#eawStart');

    function open() { root.classList.add('open'); }
    function close() { root.classList.remove('open'); root.classList.remove('chat'); }
    function toList() { root.classList.remove('chat'); }

    function openChat(i) {
      var a = AGENTS[i];
      cav.innerHTML = avatarHTML(a);
      cname.textContent = a.name;
      csede.textContent = a.sede;
      bubble.textContent = a.intro;
      // reinicia la animación de la burbuja
      bubble.style.animation = 'none';
      void bubble.offsetWidth;
      bubble.style.animation = '';
      start.href = 'https://wa.me/' + a.phone + '?text=' + encodeURIComponent(a.salida);
      root.classList.add('chat');
    }

    fab.addEventListener('click', function () {
      root.classList.contains('open') ? close() : open();
    });
    root.querySelectorAll('.eaw-x').forEach(function (b) { b.addEventListener('click', close); });
    root.querySelector('.eaw-back').addEventListener('click', toList);
    root.querySelectorAll('.eaw-agent').forEach(function (b) {
      b.addEventListener('click', function () { openChat(+b.dataset.i); });
    });
    document.addEventListener('click', function (e) {
      if (!e.target.closest('.eaw')) close();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') close();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
