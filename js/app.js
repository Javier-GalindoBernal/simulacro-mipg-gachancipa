/* app.js — arranque, ruteo por hash, chrome (barra, tema, identidad) y diálogos. */
(function () {
  'use strict';
  const S = window.SIM; if (!S) return;
  const { $, $$, esc, icon, D } = S;
  const U = S.ui, V = S.views;
  const app = (S.app = {});

  const RUTAS = [
    ['panel', 'Panel', 'i-home'], ['checklist', 'Checklist', 'i-list'], ['cronograma', 'Cronograma', 'i-cal'],
    ['evidencias', 'Evidencias', 'i-link'], ['ayuda', 'Ayuda', 'i-help']
  ];
  let actual = 'panel';

  /* ───────── chrome ───────── */
  const nav = () => {
    const mk = cls => RUTAS.map(r => `<a href="#/${r[0]}" ${r[0] === actual ? 'aria-current="page"' : ''}>${icon(r[2])}<span>${r[1]}</span></a>`).join('');
    $('#nav').innerHTML = mk(); $('#tabbar').innerHTML = mk();
  };
  const pill = () => {
    const el = $('#syncpill'), tx = $('.tx', el), n = S.st.cola.length, e = S.sync.estado;
    const hh = S.st.ultimoSync ? new Date(S.st.ultimoSync).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }) : '';
    const m = { local: ['', 'Solo este navegador'], sync: ['sync', 'Sincronizando…'], ok: ['ok', `Sincronizado${hh ? ' · ' + hh : ''}`], pend: ['pend', `${n} por enviar`], error: ['err', `Error de conexión${n ? ' · ' + n + ' en cola' : ''}`], offline: ['pend', `Sin conexión${n ? ' · ' + n + ' en cola' : ''}`] }[e] || ['', e];
    el.className = 'pill ' + m[0]; tx.textContent = m[1];
    el.title = e === 'error' || e === 'offline' ? (S.sync.error || 'Sin conexión') : (e === 'local' ? 'Los datos se guardan solo en este navegador. Configura js/config.js para consolidar.' : '');
  };
  const who = () => {
    const u = S.st.user, b = $('#whoami .tx');
    b.textContent = u.dependencia ? `${u.nombre ? u.nombre.split(' ')[0] + ' · ' : ''}${u.dependencia === S.COORD ? 'Coordinación' : S.dep(u.dependencia).corto}` : 'Identificarme';
  };
  const temaEfectivo = () => document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  const setTema = t => {
    if (t) document.documentElement.dataset.theme = t;
    const dark = temaEfectivo() === 'dark';
    $('#theme use').setAttribute('href', dark ? '#i-sun' : '#i-moon');
    const mt = document.querySelector('meta[name="theme-color"]'); if (mt) mt.content = dark ? '#07131C' : '#0A8F7A';
  };
  const foot = () => {
    $('#foot').innerHTML = `${esc(S.CFG.entidad)} · Plan de mejoramiento MIPG V7 · datos con corte al ${S.fechaL(D.meta.corte_datos)}.<br>${esc(D.meta.aviso)}`;
    const b = $('#banner');
    b.innerHTML = S.hoySimulado ? `<div class="banner-sim">Vista con fecha simulada: ${S.fechaL(S.hoySimulado)} · <a href="${location.pathname}" style="color:inherit">volver a hoy</a></div>` : '';
  };

  /* ───────── ruteo ───────── */
  const leeHash = () => {
    const h = location.hash.replace(/^#\/?/, '');
    const i = h.indexOf('?');
    const name = (i < 0 ? h : h.slice(0, i)) || 'panel';
    return { name: V[name] ? name : 'panel', params: new URLSearchParams(i < 0 ? '' : h.slice(i + 1)) };
  };
  const render = (keepScroll) => {
    const r = leeHash(); actual = r.name;
    const v = V[r.name];
    if (v.params && !keepScroll) v.params(r.params);
    const main = $('#view');
    main.innerHTML = v.html();
    v.mount(main);
    nav();
    document.title = `${RUTAS.find(x => x[0] === actual)[1]} · Simulacro MIPG Gachancipá`;
    if (!keepScroll) { const target = r.params.get('open'); if (!target) window.scrollTo(0, 0); }
  };
  addEventListener('hashchange', () => render());

  /* ───────── diálogos ───────── */
  app.avisaPermiso = id => {
    const a = S.acc.get(id);
    if (!S.st.user.dependencia) return app.modalUsuario();
    U.toast(`Esa acción es de ${S.dep(a.dependencia).corto}; tu dependencia solo puede verla.`, 'err');
  };

  app.modalUsuario = () => {
    const u = S.st.user;
    const opts = S.DEPS.map(d => `<label class="radio"><input type="radio" name="dep" value="${esc(d.n)}" ${u.dependencia === d.n ? 'checked' : ''}><span><b>${esc(d.n)}</b><small>${D.acciones.filter(a => a.dependencia === d.n).length} acciones asignadas</small></span></label>`).join('')
      + `<label class="radio"><input type="radio" name="dep" value="${S.COORD}" ${u.dependencia === S.COORD ? 'checked' : ''}><span><b>Coordinación MIPG</b><small>Puede editar todas las acciones (consolida y apoya a las dependencias)</small></span></label>`;
    U.modal(`<h3>¿Quién eres?</h3><p class="sub">Tu dependencia define en qué acciones puedes marcar avances y registrar enlaces. No es un inicio de sesión: es una convención de uso, no un control de seguridad.</p>
      <form id="f-user" novalidate>
        <div class="field"><label for="u-nom">Tu nombre</label><input id="u-nom" maxlength="60" autocomplete="name" value="${esc(u.nombre)}" placeholder="Nombre y apellido"><div class="err" id="u-err"></div></div>
        <div class="field"><label>Tu dependencia</label><div class="radios">${opts}</div></div>
        <div class="mact"><button class="btn" type="button" data-close>Ahora no</button><button class="btn primary" type="submit">Guardar</button></div></form>`, (box, close) => {
      $('#f-user', box).addEventListener('submit', e => {
        e.preventDefault();
        const nom = $('#u-nom', box).value.trim(), dep = ($('input[name="dep"]:checked', box) || {}).value;
        if (nom.length < 3) { $('#u-err', box).textContent = 'Escribe tu nombre (mínimo 3 letras): queda registrado con cada enlace.'; return $('#u-nom', box).focus(); }
        if (!dep) { $('#u-err', box).textContent = 'Elige tu dependencia.'; return; }
        V.checklist.setDep(dep === S.COORD ? '' : dep); S.setUser(nom, dep); close();
        U.toast(`Listo, ${nom.split(' ')[0]}`, 'ok');
      });
    });
  };

  app.modalEvidencia = id => {
    const a = S.acc.get(id);
    if (!S.st.user.dependencia) return app.modalUsuario();
    if (!S.puedeEditar(a)) return app.avisaPermiso(id);
    U.modal(`<h3>Registrar evidencia</h3><p class="sub">${esc(id)} · ${esc(a.entregable)}</p>
      <form id="f-ev" novalidate>
        <div class="field"><label for="e-url">Enlace al soporte</label><input id="e-url" type="url" inputmode="url" placeholder="https://drive.google.com/…" autocomplete="off"><div class="hint">Debe abrirse para quien lo vaya a revisar (Control Interno). En Drive: Compartir → «Cualquier persona con el enlace» o la cuenta institucional.</div><div class="err" id="e-err-url"></div></div>
        <div class="field"><label for="e-tipo">Tipo de enlace</label><select id="e-tipo">${S.TIPOS.map(t => `<option>${esc(t)}</option>`).join('')}</select></div>
        <div class="field"><label for="e-desc">¿Qué demuestra?</label><textarea id="e-desc" rows="3" maxlength="300" placeholder="Ej.: Resolución 045 de 2026 que adopta la política, con firma y fecha."></textarea><div class="hint">Evidencia requerida: ${esc(a.evidencia)}</div><div class="err" id="e-err-desc"></div></div>
        <div class="mact"><button class="btn" type="button" data-close>Cancelar</button><button class="btn primary" type="submit">${icon('i-check')} Guardar enlace</button></div></form>`, (box, close) => {
      const url = $('#e-url', box), tipo = $('#e-tipo', box); let manual = false;
      tipo.addEventListener('change', () => { manual = true; });
      url.addEventListener('input', () => { if (!manual && S.validaUrl(url.value).ok) tipo.value = S.tipoDeUrl(url.value.trim()); });
      $('#f-ev', box).addEventListener('submit', e => {
        e.preventDefault();
        $('#e-err-url', box).textContent = ''; $('#e-err-desc', box).textContent = '';
        const r = S.addEvidencia({ codigo: id, url: url.value, tipo: tipo.value, descripcion: $('#e-desc', box).value });
        if (!r.ok) { const k = /descri/i.test(r.error) ? 'desc' : 'url'; $('#e-err-' + k, box).textContent = r.error; return $(k === 'desc' ? '#e-desc' : '#e-url', box).focus(); }
        close(); V.checklist.refreshOne(id);
        U.toast('Enlace guardado' + (S.modo() === 'local' ? ' (solo en este navegador)' : ''), 'ok');
      });
    });
  };

  app.confirmaRetirar = evId => {
    const ev = S.st.evidencias.find(e => e.id === evId); if (!ev) return;
    U.modal(`<h3>¿Retirar este enlace?</h3><p class="sub">${esc(ev.descripcion)}<br><span class="mono" style="font-size:12px">${esc(ev.url)}</span></p>
      <p>Si era el único de la acción, la acción vuelve a quedar sin evidencia. El registro se conserva marcado como retirado.</p>
      <div class="mact"><button class="btn" data-close>Cancelar</button><button class="btn danger" id="ok-del">Retirar</button></div>`, (b, close) => {
      $('#ok-del', b).addEventListener('click', () => {
        close();
        if (S.retirarEvidencia(evId)) { U.toast('Enlace retirado', 'ok'); if (actual === 'evidencias') V.evidencias.draw(); else V.checklist.refreshOne(ev.codigo); }
        else app.avisaPermiso(ev.codigo);
      });
    });
  };

  /* ───────── arranque ───────── */
  const boot = () => {
    setTema(S.st.tema);
    $('#theme').addEventListener('click', () => { const t = temaEfectivo() === 'dark' ? 'light' : 'dark'; S.st.tema = t; S.persist(); setTema(t); });
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => setTema());
    $('#whoami').addEventListener('click', app.modalUsuario);
    $('#syncpill').addEventListener('click', () => { if (S.modo() !== 'local') S.flush().then(S.refresh); });
    S.on(w => {
      if (w === 'sync' || w === 'data') pill();
      if (w === 'user') { who(); render(true); }
      if (w === 'remote' || w === 'reset') { pill(); if (!$('.overlay')) { const st = window.scrollY; render(true); window.scrollTo(0, st); } }
    });
    S.sync.estado = S.modo() === 'local' ? 'local' : 'sync';
    foot(); who(); pill(); nav();
    render();
    S.iniciaSync();
    if (!S.st.user.dependencia && !sessionStorage.getItem('sim-visto-usuario')) {
      try { sessionStorage.setItem('sim-visto-usuario', '1'); } catch (e) { /* sin sessionStorage */ }
      setTimeout(app.modalUsuario, 700);
    }
  };
  boot();
})();
