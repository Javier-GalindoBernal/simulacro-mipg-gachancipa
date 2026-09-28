/* ui.js — utilidades visuales: toasts, modales, anillos, conteos animados, revelado y confeti. */
(function () {
  'use strict';
  const S = window.SIM; if (!S) return;
  const { $, $$, esc, icon } = S;
  const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const U = (S.ui = {});

  /* Toasts */
  U.toast = (msg, tipo) => {
    const box = $('#toasts'); if (!box) return;
    const t = document.createElement('div');
    t.className = 'toast ' + (tipo || '');
    t.innerHTML = (tipo === 'ok' ? icon('i-check') : tipo === 'err' ? icon('i-alert') : icon('i-bolt')) + `<span>${esc(msg)}</span>`;
    box.appendChild(t);
    setTimeout(() => { t.style.transition = 'opacity .3s, transform .3s'; t.style.opacity = '0'; t.style.transform = 'translateY(10px)'; setTimeout(() => t.remove(), 320); }, tipo === 'err' ? 6000 : 3200);
  };

  /* Modal accesible: Esc cierra, foco atrapado, devuelve el foco */
  let cierraActual = null;
  U.modal = (html, onMount) => {
    if (cierraActual) cierraActual();
    const prev = document.activeElement;
    const ov = document.createElement('div');
    ov.className = 'overlay';
    ov.innerHTML = `<div class="modal" role="dialog" aria-modal="true">${html}</div>`;
    document.body.appendChild(ov);
    const box = $('.modal', ov);
    const close = () => { ov.remove(); document.removeEventListener('keydown', key, true); cierraActual = null; if (prev && prev.focus) prev.focus(); };
    const key = e => {
      if (e.key === 'Escape') { e.stopPropagation(); close(); }
      if (e.key === 'Tab') {
        const f = $$('a[href],button:not([disabled]),input,select,textarea,[tabindex]:not([tabindex="-1"])', box).filter(x => x.offsetParent !== null);
        if (!f.length) return;
        const a = f[0], z = f[f.length - 1];
        if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
        else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
      }
    };
    document.addEventListener('keydown', key, true);
    ov.addEventListener('mousedown', e => { if (e.target === ov) close(); });
    $$('[data-close]', ov).forEach(b => b.addEventListener('click', close));
    cierraActual = close;
    const first = $('[autofocus],input,select,textarea,button', box); if (first) first.focus();
    if (onMount) onMount(box, close);
    return close;
  };

  /* Anillo de progreso (SVG). Se anima al montarse leyendo data-pct. */
  U.ring = (p, color, opts) => {
    opts = opts || {}; const r = 40, c = 2 * Math.PI * r;
    return `<svg class="ring ${opts.big ? 'big' : ''}" viewBox="0 0 100 100" style="--c:${color || 'var(--brand)'}" role="img" aria-label="${S.pc(p)} por ciento">
      <circle class="bg" cx="50" cy="50" r="${r}"/><circle class="fg" cx="50" cy="50" r="${r}" stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${c.toFixed(1)}" data-pct="${p}" data-c="${c.toFixed(1)}"/>
      <text x="50" y="50" data-count="${S.pc(p)}" data-suffix="%">${reduce() ? S.pc(p) + '%' : '0%'}</text></svg>`;
  };

  /* Conteo animado de números */
  const count = el => {
    const to = parseFloat(el.dataset.count); const suf = el.dataset.suffix || '';
    if (reduce() || !isFinite(to)) { el.textContent = to + suf; return; }
    const t0 = performance.now(), dur = 900 + Math.min(600, to * 3);
    const tick = t => { const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3); el.textContent = Math.round(to * e) + suf; if (k < 1) requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  };

  /* Se llama tras pintar una vista: dispara anillos, barras, conteos, revelado */
  U.animar = (root) => {
    root = root || document;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      $$('circle.fg[data-pct]', root).forEach(c => { c.style.strokeDashoffset = (parseFloat(c.dataset.c) * (1 - Math.min(1, parseFloat(c.dataset.pct)))).toFixed(1); });
      $$('[data-w]', root).forEach(el => { el.style.width = el.dataset.w; });
      $$('[data-h]', root).forEach(el => { el.style.height = el.dataset.h; });
      $$('[data-p]', root).forEach(el => { el.style.setProperty('--p', el.dataset.p); });
    }));
    $$('[data-count]', root).forEach(count);
    const els = $$('.rv:not(.in)', root);
    if (!('IntersectionObserver' in window) || reduce()) { els.forEach(e => e.classList.add('in')); return; }
    const io = new IntersectionObserver(es => es.forEach(x => { if (x.isIntersecting) { x.target.classList.add('in'); io.unobserve(x.target); } }), { threshold: .08 });
    els.forEach((e, i) => { e.style.transitionDelay = Math.min(i * 60, 300) + 'ms'; io.observe(e); });
  };

  /* Confeti (canvas propio, sin librerías) */
  U.confeti = (x, y) => {
    if (reduce()) return;
    const cv = $('#confetti'); if (!cv) return;
    const ctx = cv.getContext('2d'); const dpr = window.devicePixelRatio || 1;
    cv.width = innerWidth * dpr; cv.height = innerHeight * dpr; ctx.scale(dpr, dpr);
    const cols = ['#0A8F7A', '#F5B700', '#E4572E', '#2E7DD1', '#7C5CE0', '#1E9E62'];
    const ox = x == null ? innerWidth / 2 : x, oy = y == null ? innerHeight / 3 : y;
    const ps = Array.from({ length: 90 }, () => ({ x: ox, y: oy, vx: (Math.random() - .5) * 13, vy: -Math.random() * 12 - 3, r: Math.random() * 6 + 3, c: cols[(Math.random() * cols.length) | 0], a: Math.random() * 6, va: (Math.random() - .5) * .4, l: 1 }));
    let f = 0;
    const tick = () => {
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      ps.forEach(p => { p.vy += .32; p.x += p.vx; p.y += p.vy; p.a += p.va; p.l -= .011; ctx.save(); ctx.globalAlpha = Math.max(0, p.l); ctx.translate(p.x, p.y); ctx.rotate(p.a); ctx.fillStyle = p.c; ctx.fillRect(-p.r, -p.r / 2, p.r * 2, p.r); ctx.restore(); });
      if (++f < 110) requestAnimationFrame(tick); else ctx.clearRect(0, 0, innerWidth, innerHeight);
    };
    tick();
  };

  /* Descarga de texto (CSV) */
  U.descargar = (nombre, texto, mime) => {
    const b = new Blob(['﻿' + texto], { type: (mime || 'text/csv') + ';charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = nombre; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  };
  // Un valor que empiece por = + - @ lo evaluaría Excel como fórmula: se antepone una comilla.
  U.csv = filas => filas.map(f => f.map(c => { c = String(c == null ? '' : c); if (/^[=+\-@\t\r]/.test(c)) c = "'" + c; return /[",\n;]/.test(c) ? '"' + c.replace(/"/g, '""') + '"' : c; }).join(',')).join('\n');
})();
