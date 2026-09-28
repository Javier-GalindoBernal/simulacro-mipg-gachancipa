/* views.js — las cinco vistas. Cada una expone html() y mount(root). */
(function () {
  'use strict';
  const S = window.SIM; if (!S) return;
  const { $, $$, esc, icon, pc, D } = S;
  const U = S.ui;
  const V = (S.views = {});
  const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const trunc = (s, n) => (s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s);
  const FASE_PAL = ['#2E7DD1', '#7C5CE0', '#0A8F7A', '#F08C00', '#E4572E', '#C2416B', '#1E9E62', '#6B7C8C', '#8A6D3B'];

  /* ───────── fases del plan (derivadas de los hitos) ───────── */
  S.fases = () => {
    const m = new Map();
    D.hitos.forEach(h => {
      if (h.fase === 'Condicionadas') return;
      const f = m.get(h.fase) || { n: h.fase, ini: h.inicio, fin: h.fin, hitos: 0 };
      if (h.inicio < f.ini) f.ini = h.inicio; if (h.fin > f.fin) f.fin = h.fin; f.hitos++; m.set(h.fase, f);
    });
    return Array.from(m.values()).sort((a, b) => a.n.localeCompare(b.n, 'es', { numeric: true })).map(f => {
      const p = f.n.split(' · ');
      return Object.assign(f, { num: (p[0].match(/\d+/) || [''])[0], nombre: p[1] || f.n });
    });
  };
  const faseIdx = n => { const m = /Fase (\d+)/.exec(n); return m ? +m[1] - 1 : 8; };

  const badgeDia = i => i.vencida ? `<span class="tag bad">${icon('i-alert')} Vencida hace ${-i.dias} d</span>` : i.lista ? `<span class="tag ok">${icon('i-check')} Completa</span>` : i.proxima ? `<span class="tag warn">${icon('i-clock')} Vence en ${i.dias} d</span>` : i.aunNo ? `<span class="tag">Inicia ${S.fecha(i.a.inicio)}</span>` : '';

  /* ═════════════════════════ PANEL ═════════════════════════ */
  V.panel = {
    html() {
      const firmes = S.firmes(), A = S.agg(firmes), T = S.agg(D.acciones);
      const hoy = S.hoy(), m = D.meta;
      const dPlan = S.dias(m.plan_inicio, hoy), dTot = S.dias(m.plan_inicio, m.plan_fin);
      const kick = dPlan < 0 ? `Faltan ${-dPlan} ${S.plural(-dPlan, 'día', 'días')} para arrancar el plan` : hoy > m.plan_fin ? 'Plan concluido' : `Día ${dPlan + 1} de ${dTot + 1} del plan`;
      const evs = S.st.evidencias.filter(e => e.activa !== false).length;
      const fases = S.fases();
      const nombreHoy = S.st.user.nombre ? `, ${esc(S.st.user.nombre.split(' ')[0])}` : '';

      const kpi = (cls, ic, n, t, h, href) => `<a class="kpi ${cls} rv" href="${href}">
        <div class="ic">${icon(ic)}</div><b data-count="${n}">${n}</b><span>${t}</span><small>${h}</small></a>`;

      const dimRows = S.DIMS.map(d => {
        const l = D.acciones.filter(a => a.dimension === d.n && !a.condicionada_a); if (!l.length) return '';
        const g = S.agg(l);
        return `<a class="barrow" href="#/checklist?dim=${encodeURIComponent(d.n)}&dep=&pol=&f=todas" style="text-decoration:none;color:inherit">
          <span class="di" style="background:${d.c}">${icon(d.icon)}</span>
          <div><div class="nm">${esc(d.corto)}<small>${g.listas} de ${g.n} completas · ${l.length} acciones</small></div><div class="track"><i style="--c:${d.c}" data-w="${pc(g.pct)}%"></i></div></div>
          <span class="pc num">${pc(g.pct)}%</span></a>`;
      }).join('');

      const depBoxes = S.DEPS.map(d => {
        const l = D.acciones.filter(a => a.dependencia === d.n && !a.condicionada_a), g = S.agg(l);
        return `<a class="ringbox" style="--c:${d.c};text-decoration:none;color:inherit" href="#/checklist?dep=${encodeURIComponent(d.n)}&dim=&pol=&f=todas">
          ${U.ring(g.pct, d.c)}<b>${esc(d.corto)}</b><small>${g.listas}/${g.n} completas${g.venc ? ` · <span style="color:var(--bad);font-weight:700">${g.venc} vencidas</span>` : ''}</small></a>`;
      }).join('');

      const mapa = S.DIMS.map(d => {
        const pols = D.politicas.filter(p => p.dimension === d.n); if (!pols.length) return '';
        return `<div class="dimgroup" style="--c:${d.c}"><h4><i></i>${esc(d.corto)}</h4><div class="tiles">${pols.map(p => {
          const l = D.acciones.filter(a => a.politica === p.codigo && !a.condicionada_a), g = S.agg(l);
          const tot = D.acciones.filter(a => a.politica === p.codigo).length;
          const nota = tot === 0 ? (p.tratamiento === 'solo_asignacion' ? 'Política nueva · sin preguntas FURAG' : 'Sin brechas derivables') : `${g.listas}/${g.n} completas${tot > g.n ? ` · +${tot - g.n} cond.` : ''}`;
          return `<a class="tile ${tot ? '' : 'zero'}" style="--c:${d.c};text-decoration:none;color:inherit" data-p="${tot ? pc(g.pct) + '%' : '0%'}" href="${tot ? '#/checklist?pol=' + p.codigo + '&dim=&dep=&f=todas' : '#/ayuda'}" title="${esc(p.nombre)} — líder: ${esc(p.lider)}">
            <div class="cd">${p.codigo}</div><div class="nm">${esc(p.nombre)}</div><div class="ct">${nota}</div></a>`;
        }).join('')}</div></div>`;
      }).join('');

      // Alertas
      const info = D.acciones.map(a => S.info(a.id));
      const venc = info.filter(i => i.vencida).sort((a, b) => a.a.prioridad - b.a.prioridad || a.dias - b.dias);
      const prox = info.filter(i => i.proxima).sort((a, b) => a.dias - b.dias);
      let alertas = venc.slice(0, 5).map(i => ({ i, k: 'bad', when: `hace ${-i.dias} d` })).concat(prox.slice(0, 5).map(i => ({ i, k: 'warn', when: `en ${i.dias} d` }))).slice(0, 6);
      let tituloAl = 'Requiere atención', subAl = 'Vencidas y próximas a vencer (14 días)';
      if (!alertas.length) {
        const arr = info.filter(i => i.aunNo && !i.condicionada).sort((a, b) => a.a.inicio.localeCompare(b.a.inicio)).slice(0, 5);
        alertas = arr.map(i => ({ i, k: 'sky', when: `${S.fecha(i.a.inicio)}` }));
        tituloAl = 'Sin alertas por ahora'; subAl = 'Las primeras acciones que arrancan';
      }
      const li = x => `<a class="li rv" href="#/checklist?open=${x.i.a.id}&q=&dep=&dim=&pol=&prio=&f=todas" style="text-decoration:none;color:inherit">
        <span class="ic ${x.k}">${icon(x.k === 'bad' ? 'i-alert' : x.k === 'warn' ? 'i-clock' : 'i-cal')}</span>
        <span><b>${esc(trunc(x.i.a.pregunta, 92))}</b><small>${x.i.a.id} · ${esc(S.dep(x.i.a.dependencia).corto)} · límite ${S.fecha(x.i.a.fin)}</small></span><span class="when">${x.when}</span></a>`;

      const act = S.actividad(6);
      const actHtml = act.length ? act.map(x => `<a class="li rv" href="#/checklist?open=${x.codigo}&q=&dep=&dim=&pol=&prio=&f=todas" style="text-decoration:none;color:inherit">
          <span class="ic ${x.tipo === 'ev' ? 'sky' : 'ok'}">${icon(x.tipo === 'ev' ? 'i-link' : 'i-check')}</span>
          <span><b>${esc(trunc(x.txt || '', 80))}</b><small>${x.codigo} · ${esc(x.autor || '')} · ${esc(x.dep || '')}</small></span>
          <span class="when">${new Date(x.t).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}</span></a>`).join('')
        : `<div class="empty"><img src="assets/img/empty.svg" alt="" width="220" height="140"><b>Aún no hay actividad</b>Marca un paso del checklist o registra un enlace de evidencia y aparecerá aquí.</div>`;

      const stepHtml = fases.map(f => {
        const cls = f.fin < hoy ? 'done' : (f.ini <= hoy ? 'now' : '');
        return `<div class="step ${cls}"><div class="n">FASE ${f.num}</div><b>${esc(f.nombre)}</b><small>${S.rango(f.ini, f.fin)}</small></div>`;
      }).join('');

      return `<div class="view">
      <section class="hero">
        <div class="copy">
          <span class="kick">${icon('i-flag')} ${kick}</span>
          <h1>Cierra las brechas FURAG con <em>evidencia</em> que se pueda abrir${nombreHoy}.</h1>
          <p class="lead">${m.acciones} acciones en ${m.politicas} políticas de MIPG V7. Marca el checklist, pega el enlace de la evidencia y el avance de cada dependencia se consolida solo.</p>
          <div class="cta"><a class="btn primary" href="#/checklist">${icon('i-list')} Ir al checklist</a><a class="btn" href="#/cronograma">${icon('i-cal')} Ver cronograma</a></div>
        </div>
        <div class="art">${$('#tpl-hero').innerHTML}
          <div class="ringcard">${U.ring(A.pct, 'var(--brand)', { big: 1 })}<div><b>Avance del plan</b><span>${A.listas}/${A.n}</span><small>acciones firmes completas · cierre ${S.fecha(m.plan_fin)}</small></div></div>
        </div>
      </section>

      <div class="kpis">
        ${kpi('k-ok', 'i-check', A.listas, 'Acciones completas', `de ${A.n} firmes (${pc(A.n ? A.listas / A.n : 0)} %)`, '#/checklist?f=lista&dep=&dim=&pol=&prio=&q=')}
        ${kpi('k-sky', 'i-bolt', A.curso, 'En curso', 'con pasos marcados o enlace', '#/checklist?f=curso&dep=&dim=&pol=&prio=&q=')}
        ${kpi('k-bad', 'i-alert', T.venc, 'Vencidas', 'límite pasado, sin completar (incluye condicionadas)', '#/checklist?f=vencidas&dep=&dim=&pol=&prio=&q=')}
        ${kpi('k-warn', 'i-clock', T.prox, 'Vencen en 14 días', 'para priorizar esta quincena', '#/checklist?f=proximas&dep=&dim=&pol=&prio=&q=')}
        ${kpi('k-brand', 'i-link', evs, 'Enlaces de evidencia', `${T.conEv} acciones con al menos uno`, '#/evidencias')}
      </div>

      <div class="section-title rv"><div><h2>Ruta del plan</h2><p>Ocho fases entre el ${S.fecha(m.plan_inicio)} y el ${S.fecha(m.plan_fin)}. Las condicionadas (${m.condicionadas}) se activan según su pregunta habilitante.</p></div></div>
      <div class="steps rv">${stepHtml}</div>

      <div class="grid g2" style="margin-top:18px">
        <section class="card rv"><h3>Avance por dimensión</h3><p class="sub">Solo acciones firmes; toca una fila para filtrar el checklist.</p><div class="bars">${dimRows}</div></section>
        <section class="card rv"><h3>Avance por dependencia</h3><p class="sub">Acciones firmes asignadas a cada líder.</p><div class="rings">${depBoxes}</div></section>
      </div>

      <section class="card rv" style="margin-top:18px"><h3>Mapa de políticas</h3><p class="sub">El relleno sube a medida que se completan las acciones de cada política. Las punteadas no tienen acciones derivadas.</p>${mapa}</section>

      <div class="grid g2" style="margin-top:18px">
        <section class="card"><h3>${tituloAl}</h3><p class="sub">${subAl}</p><div class="list">${alertas.map(li).join('') || '<div class="empty">Nada pendiente.</div>'}</div></section>
        <section class="card"><h3>Actividad reciente</h3><p class="sub">Últimos avances y enlaces registrados</p><div class="list">${actHtml}</div></section>
      </div></div>`;
    },
    mount(root) { U.animar(root); }
  };

  /* ═════════════════════════ CHECKLIST ═════════════════════════ */
  const CL = { q: '', dep: null, dim: '', pol: '', prio: '', f: 'todas', sort: 'fin', lim: 30, open: new Set() };
  V.checklist = {
    params(p) {
      ['q', 'dep', 'dim', 'pol', 'prio', 'f', 'sort'].forEach(k => { if (p.has(k)) { CL[k] = p.get(k); CL.lim = 30; } });
      if (p.get('open')) { CL.open.add(p.get('open')); CL.focus = p.get('open'); if (!p.has('f')) CL.f = 'todas'; }
      if (CL.dep === null) CL.dep = (S.st.user.dependencia && S.st.user.dependencia !== S.COORD) ? S.st.user.dependencia : '';
    },
    filtrar() {
      const q = norm(CL.q).trim();
      const lista = D.acciones.filter(a => {
        if (CL.dep && a.dependencia !== CL.dep) return false;
        if (CL.dim && a.dimension !== CL.dim) return false;
        if (CL.pol && a.politica !== CL.pol) return false;
        if (CL.prio && String(a.prioridad) !== CL.prio) return false;
        if (q) { if (!a._t) a._t = norm([a.id, a.pregunta, a.accion, a.entregable, a.evidencia, S.polNombre(a.politica)].join(' ')); if (!a._t.includes(q)) return false; }
        if (CL.f !== 'todas') {
          const i = S.info(a.id);
          if (CL.f === 'pendiente' && i.estado !== 'pendiente') return false;
          if (CL.f === 'curso' && i.estado !== 'curso') return false;
          if (CL.f === 'lista' && !i.lista) return false;
          if (CL.f === 'vencidas' && !i.vencida) return false;
          if (CL.f === 'proximas' && !i.proxima) return false;
          if (CL.f === 'cond' && !i.condicionada) return false;
        }
        return true;
      });
      const k = CL.sort;
      return lista.sort((a, b) => k === 'prio' ? a.prioridad - b.prioridad || a.fin.localeCompare(b.fin) : k === 'id' ? a.id.localeCompare(b.id) : a.fin.localeCompare(b.fin) || a.prioridad - b.prioridad || a.id.localeCompare(b.id));
    },
    html() {
      const fs = [['todas', 'Todas'], ['pendiente', 'Sin iniciar'], ['curso', 'En curso'], ['lista', 'Completas'], ['vencidas', 'Vencidas'], ['proximas', 'Vencen en 14 d'], ['cond', 'Condicionadas']];
      const opt = (arr, cur, all) => `<option value="">${all}</option>` + arr.map(x => `<option value="${esc(x[0])}" ${x[0] === cur ? 'selected' : ''}>${esc(x[1])}</option>`).join('');
      return `<div class="view">
      <div class="section-title"><div><h2>Checklist por pregunta</h2><p>Cada tarjeta es una pregunta FURAG con brecha. Marca lo que ya cumples y registra el enlace que lo demuestra.</p></div></div>
      <div class="filters stick">
        <div class="frow">
          <label class="search">${icon('i-search')}<span class="sr">Buscar</span><input id="cl-q" type="search" placeholder="Busca por código, pregunta, entregable…" value="${esc(CL.q)}" autocomplete="off"></label>
          <select class="sel" id="cl-dep" aria-label="Dependencia">${opt(S.DEPS.map(d => [d.n, d.corto]), CL.dep, 'Dependencia')}</select>
          <select class="sel" id="cl-dim" aria-label="Dimensión">${opt(S.DIMS.map(d => [d.n, d.corto]), CL.dim, 'Dimensión')}</select>
          <select class="sel" id="cl-pol" aria-label="Política">${opt(D.politicas.filter(p => p.acciones > 0).map(p => [p.codigo, `${p.codigo} · ${trunc(p.nombre, 38)}`]), CL.pol, 'Política')}</select>
          <select class="sel" id="cl-prio" aria-label="Prioridad">${opt(Object.keys(S.PRIO).map(k => [k, `${k}. ${S.PRIO[k]}`]), CL.prio, 'Prioridad')}</select>
        </div>
        <div class="frow chips" id="cl-chips">${fs.map(f => `<button type="button" class="chip ${CL.f === f[0] ? 'on' : ''}" data-f="${f[0]}">${f[1]}</button>`).join('')}</div>
        <div class="frow" style="justify-content:space-between"><span class="count" id="cl-count"></span>
          <select class="sel" id="cl-sort" aria-label="Ordenar"><option value="fin" ${CL.sort === 'fin' ? 'selected' : ''}>Ordenar: fecha límite</option><option value="prio" ${CL.sort === 'prio' ? 'selected' : ''}>Ordenar: prioridad</option><option value="id" ${CL.sort === 'id' ? 'selected' : ''}>Ordenar: código</option></select>
        </div>
      </div>
      <div class="acards" id="cl-list"></div>
      <div style="text-align:center;margin:18px 0"><button class="btn" id="cl-more" type="button" hidden>Mostrar más</button></div></div>`;
    },
    mount(root) {
      const self = this;
      const list = $('#cl-list', root), more = $('#cl-more', root), cnt = $('#cl-count', root);
      const draw = () => {
        const all = self.filtrar();
        cnt.textContent = `${all.length} ${S.plural(all.length, 'acción', 'acciones')}`;
        list.innerHTML = all.slice(0, CL.lim).map(cardHtml).join('') || `<div class="card empty"><img src="assets/img/empty.svg" alt="" width="220" height="140"><b>Ninguna acción coincide</b>Quita algún filtro o cambia la búsqueda.</div>`;
        more.hidden = all.length <= CL.lim;
        more.textContent = `Mostrar ${Math.min(30, all.length - CL.lim)} más (${all.length - CL.lim} restantes)`;
        U.animar(list);
      };
      self.draw = draw;
      const bind = (id, k, ev) => { const el = $(id, root); el.addEventListener(ev || 'change', () => { CL[k] = el.value; CL.lim = 30; draw(); }); };
      bind('#cl-dep', 'dep'); bind('#cl-dim', 'dim'); bind('#cl-pol', 'pol'); bind('#cl-prio', 'prio'); bind('#cl-sort', 'sort');
      let t; $('#cl-q', root).addEventListener('input', e => { clearTimeout(t); t = setTimeout(() => { CL.q = e.target.value; CL.lim = 30; draw(); }, 160); });
      $('#cl-chips', root).addEventListener('click', e => { const b = e.target.closest('[data-f]'); if (!b) return; CL.f = b.dataset.f; CL.lim = 30; $$('#cl-chips .chip', root).forEach(c => c.classList.toggle('on', c === b)); draw(); });
      more.addEventListener('click', () => { CL.lim += 30; draw(); });
      list.addEventListener('click', e => {
        const h = e.target.closest('header[data-act="toggle"]');
        if (h && !e.target.closest('a')) return toggle(h.closest('.ac'));
        const b = e.target.closest('[data-act]'); if (!b) return;
        const id = b.closest('.ac').dataset.id;
        if (b.dataset.act === 'addev') return S.app.modalEvidencia(id);
        if (b.dataset.act === 'delev') return S.app.confirmaRetirar(b.dataset.id);
      });
      list.addEventListener('keydown', e => { const h = e.target.closest('header[data-act="toggle"]'); if (h && (e.key === 'Enter' || e.key === ' ') && e.target === h) { e.preventDefault(); toggle(h.closest('.ac')); } });
      list.addEventListener('change', e => {
        const c = e.target.closest('input[data-opt]'); if (!c) return;
        const card = c.closest('.ac'), id = card.dataset.id;
        if (!S.setOpcion(id, +c.dataset.opt, c.checked)) { c.checked = !c.checked; return S.app.avisaPermiso(id); }
        V.checklist.refreshOne(id);
      });
      draw();
      if (CL.focus) { const el = $('#ac-' + CL.focus, root); CL.focus = null; if (el) setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'center' }), 120); }
    },
    refreshOne(id) {
      const c = $('#ac-' + id); if (!c) return;
      const antes = c.classList.contains('lista'); refreshCard(c);
      if (!antes && c.classList.contains('lista')) celebra(c);
    },
    setDep(d) { CL.dep = d; }
  };

  function celebra(card) {
    const r = card.getBoundingClientRect();
    U.confeti(r.left + r.width / 2, r.top + 30);
    U.toast(`¡Acción ${card.dataset.id} completa!`, 'ok');
  }
  function toggle(card) {
    const id = card.dataset.id;
    if (CL.open.has(id)) CL.open.delete(id); else CL.open.add(id);
    const open = CL.open.has(id);
    card.classList.toggle('open', open);
    $('header', card).setAttribute('aria-expanded', open);
    const old = $('.body', card); if (old) old.remove();
    if (open) card.insertAdjacentHTML('beforeend', bodyHtml(S.acc.get(id), S.info(id)));
  }
  function metaHtml(a, i) {
    const d = S.dep(a.dependencia);
    return `<span class="tag p${a.prioridad}">${S.PRIO[a.prioridad]}</span><span class="tag">${icon('i-user')} ${esc(d.corto)}</span><span class="tag">${icon('i-cal')} ${S.rango(a.inicio, a.fin)}</span>${badgeDia(i)}${a.condicionada_a ? `<span class="tag p5">Condicionada</span>` : ''}${i.evs.length ? `<span class="tag">${icon('i-link')} ${i.evs.length}</span>` : ''}`;
  }
  function cardHtml(a) {
    const i = S.info(a.id), d = S.dim(a.dimension), open = CL.open.has(a.id);
    return `<article class="ac ${open ? 'open' : ''} ${i.lista ? 'lista' : ''}" data-id="${a.id}" id="ac-${a.id}">
      <header data-act="toggle" tabindex="0" role="button" aria-expanded="${open}">
        <div class="bd" style="background:${d.c}">${icon(d.icon)}</div>
        <div><div class="code"><span>${a.id}</span><span>·</span><span>${esc(S.polNombre(a.politica))}</span></div><h4>${esc(a.pregunta)}</h4><div class="meta">${metaHtml(a, i)}</div></div>
        <div class="side"><div class="pc num">${pc(i.pct)}%</div><small>${i.hechos + 0}/${i.pasos} pasos</small></div>
      </header>
      <div class="prog"><i style="width:${pc(i.pct)}%"></i></div>
      ${open ? bodyHtml(a, i) : ''}</article>`;
  }
  function optsHtml(a, i, editable) {
    return a.opciones.map((o, k) => {
      if (o[1]) return `<li class="opt done-of"><label><span class="cb">${icon('i-check')}</span><span class="tx">${esc(o[0])} <span class="tag" style="margin-left:4px">Ya acreditada en el reporte oficial</span></span></label></li>`;
      const on = i.ok.has(k);
      return `<li class="opt ${editable ? '' : 'locked'}"><label><input type="checkbox" data-opt="${k}" ${on ? 'checked' : ''} ${editable ? '' : 'disabled'}><span class="cb"><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></span><span class="tx">${esc(o[0])}</span></label></li>`;
    }).join('');
  }
  function evsHtml(i, editable) {
    if (!i.evs.length) return `<p class="foot-note" style="margin:0 0 10px">Todavía no hay enlaces. Sin al menos uno, la acción no se puede completar.</p>`;
    return i.evs.map(e => `<div class="ev"><span class="ti">${icon(e.tipo === 'Drive' ? 'i-cloud' : e.tipo === 'PDF' ? 'i-file' : 'i-link')}</span>
      <div><a href="${esc(e.url)}" target="_blank" rel="noopener noreferrer">${esc(e.descripcion)} ${icon('i-ext')}</a><small>${esc(e.tipo)} · ${esc(e.autor)} · ${new Date(e.fecha).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}</small></div>
      ${editable ? `<button class="icon-btn" style="width:32px;height:32px" data-act="delev" data-id="${esc(e.id)}" aria-label="Retirar enlace" title="Retirar enlace">${icon('i-trash')}</button>` : '<span></span>'}</div>`).join('');
  }
  function bodyHtml(a, i) {
    const ed = S.puedeEditar(a), u = S.st.user;
    const lock = ed ? '' : `<div class="locknote">${icon('i-lock')} ${u.dependencia ? `Esta acción es de ${esc(S.dep(a.dependencia).corto)}: la ves en solo lectura.` : 'Identifícate (botón de arriba) para marcar avances y registrar evidencias.'}</div>`;
    const ya = a.opciones.filter(o => o[1]).length;
    return `<div class="body">
      <div>
        <div class="box"><h5>Situación detectada</h5><p>${esc(a.situacion)}. Formulario FURAG, página ${a.pagina}.</p></div>
        <div class="box" style="margin-top:12px"><h5>Qué hay que hacer</h5><p>${esc(a.accion)}</p><p style="margin-top:8px"><b>Entregable:</b> ${esc(a.entregable)}</p><p style="margin-top:6px"><b>Evidencia requerida:</b> ${esc(a.evidencia)}</p></div>
        <div class="box" style="margin-top:12px"><h5>Cronograma y responsable</h5><p>${S.rango(a.inicio, a.fin)} · ${esc(a.dependencia)}</p>${a.condicionada_a ? `<p style="margin-top:6px">Solo aplica si lo habilita la pregunta ${S.acc.has(a.condicionada_a) ? `<a href="#/checklist?open=${esc(a.condicionada_a)}&q=&dep=&dim=&pol=&prio=&f=todas">${esc(a.condicionada_a)}</a>` : `<b>${esc(a.condicionada_a)}</b> <span class="tag">sin brecha en el plan: confirma su respuesta con la dependencia</span>`}.</p>` : ''}</div>
      </div>
      <div>
        <div class="box"><h5>Checklist — marca lo que ya cumples</h5>${lock}<ul class="opts">${optsHtml(a, i, ed)}</ul>
          <p class="foot-note">${ya ? `${ya} de ${a.opciones.length} opciones ya estaban acreditadas en el reporte oficial. ` : ''}Las ${i.pend.length} restantes son las que falta demostrar.</p></div>
        <div class="box" style="margin-top:12px"><h5>Evidencia</h5><div class="evs">${evsHtml(i, ed)}</div>
          <button class="btn small" data-act="addev" ${ed ? '' : 'disabled'}>${icon('i-plus')} Registrar enlace de evidencia</button></div>
      </div></div>`;
  }
  function refreshCard(card) {
    const id = card.dataset.id, a = S.acc.get(id), i = S.info(id), ed = S.puedeEditar(a);
    card.classList.toggle('lista', i.lista);
    $('.meta', card).innerHTML = metaHtml(a, i);
    $('.side .pc', card).textContent = pc(i.pct) + '%';
    $('.side small', card).textContent = `${i.hechos}/${i.pasos} pasos`;
    $('.prog i', card).style.width = pc(i.pct) + '%';
    const ev = $('.evs', card); if (ev) ev.innerHTML = evsHtml(i, ed);
  }

  /* ═════════════════════════ CRONOGRAMA ═════════════════════════ */
  V.cronograma = {
    html() {
      const H = D.hitos.slice().sort((a, b) => a.inicio.localeCompare(b.inicio) || a.fin.localeCompare(b.fin));
      const x0 = D.meta.plan_inicio, x1 = D.meta.plan_fin, T = S.dias(x0, x1) + 1;
      const L = 330, W = 1180, R = 24, top = 46, rh = 36, px = (W - L - R) / (T + 4);
      const X = d => L + S.dias(x0, d) * px;
      const Hh = top + H.length * rh + 16;
      let g = '';
      // meses
      const d0 = S.d(x0); let m = new Date(d0.getFullYear(), d0.getMonth() + 1, 1);
      const isoD = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const mesFmt = d => new Intl.DateTimeFormat('es-CO', { month: 'short', year: d.getMonth() === 0 ? 'numeric' : undefined }).format(d);
      g += `<text x="14" y="26" style="font-weight:700">Hito y responsable</text><text x="${L - 6}" y="26" text-anchor="end" style="font-weight:700">${new Intl.DateTimeFormat('es-CO', { month: 'short' }).format(d0)} →</text>`;
      while (isoD(m) <= x1) {
        const xx = X(isoD(m));
        g += `<line class="grid" x1="${xx}" x2="${xx}" y1="34" y2="${Hh}"/><text x="${xx + 6}" y="26" style="font-weight:700">${mesFmt(m)}</text>`;
        m = new Date(m.getFullYear(), m.getMonth() + 1, 1);
      }
      H.forEach((h, k) => {
        const y = top + k * rh, col = FASE_PAL[faseIdx(h.fase)], xa = X(h.inicio), xb = X(h.fin) + px;
        if (k % 2 === 0) g += `<rect x="0" y="${y - 4}" width="${W}" height="${rh}" fill="var(--surface-2)" opacity=".7"/>`;
        g += `<g class="bar" data-h="${h.id}" tabindex="0" role="button" aria-label="${esc(h.actividad)}, ${S.rango(h.inicio, h.fin)}">
          <text class="lbl" x="14" y="${y + 15}">${esc(trunc(h.actividad, 46))}</text>
          <text x="14" y="${y + 29}" style="font-size:11px;fill:var(--ink-3)">${esc(trunc(h.dependencia, 44))}</text>
          ${h.inicio === h.fin ? `<path d="M${xa + px / 2} ${y + 6} l10 10 -10 10 -10 -10z" fill="${col}"/>` : `<rect x="${xa}" y="${y + 7}" width="${Math.max(8, xb - xa)}" height="20" rx="8" fill="${col}"/>${xb + 118 > W ? `<text x="${xa - 6}" y="${y + 22}" text-anchor="end" style="font-size:11px">${S.rango(h.inicio, h.fin)}</text>` : `<text x="${xb + 6}" y="${y + 22}" style="font-size:11px">${S.rango(h.inicio, h.fin)}</text>`}`}
          <title>${esc(h.actividad)} — ${S.rango(h.inicio, h.fin)}</title></g>`;
      });
      const hoy = S.hoy();
      if (hoy >= x0 && hoy <= x1) g += `<line class="today" x1="${X(hoy)}" x2="${X(hoy)}" y1="34" y2="${Hh}"/><text x="${X(hoy) + 5}" y="${Hh - 4}" style="fill:var(--coral);font-weight:700">hoy</text>`;
      // Carga por semana
      const semanas = Math.floor(T / 7) + 1, cont = new Array(semanas).fill(0);
      D.acciones.forEach(a => { const k = Math.floor(S.dias(x0, a.fin) / 7); if (k >= 0 && k < semanas) cont[k]++; });
      const mx = Math.max.apply(null, cont), semHoy = Math.floor(S.dias(x0, hoy) / 7);
      const hist = cont.map((n, k) => { const ini = isoD(new Date(S.d(x0).getTime() + k * 7 * 86400000)); return `<div class="${k === semHoy ? 'now' : ''}" data-h="${mx ? Math.round(n / mx * 100) : 0}px" title="Semana del ${S.fecha(ini)}: ${n} ${S.plural(n, 'vencimiento', 'vencimientos')}">${n ? `<span>${n}</span>` : ''}</div>`; }).join('');

      const filas = H.map(h => `<tr><td class="mono">${esc(h.id)}</td><td>${esc(h.fase)}</td><td>${esc(h.actividad)}</td><td>${esc(h.dependencia)}</td><td style="white-space:nowrap">${S.rango(h.inicio, h.fin)}</td><td>${esc(h.entregable)}</td></tr>`).join('');
      return `<div class="view">
      <div class="section-title"><div><h2>Cronograma del plan</h2><p>${H.length} hitos del ${S.fechaL(x0)} al ${S.fechaL(x1)}. Toca una barra para ver el entregable.</p></div></div>
      <div class="gantt rv"><svg viewBox="0 0 ${W} ${Hh}" role="img" aria-label="Diagrama de Gantt de los hitos del plan">${g}</svg></div>
      <section class="card rv" style="margin-top:18px"><h3>Carga de vencimientos por semana</h3><p class="sub">Cuántas acciones vencen cada semana (barra roja: la semana actual). Sirve para anticipar cuellos de botella.</p><div class="hist">${hist}</div></section>
      <div class="section-title rv"><div><h2>Hitos y entregables</h2></div></div>
      <div class="tablewrap rv"><table><thead><tr><th>ID</th><th>Fase</th><th>Actividad</th><th>Responsable</th><th>Fechas</th><th>Entregable</th></tr></thead><tbody>${filas}</tbody></table></div></div>`;
    },
    mount(root) {
      U.animar(root);
      const open = el => {
        const h = D.hitos.find(x => x.id === el.dataset.h); if (!h) return;
        U.modal(`<h3>${esc(h.actividad)}</h3><p class="sub">${esc(h.fase)} · ${S.rango(h.inicio, h.fin)}</p>
          <div class="box"><h5>Responsable</h5><p>${esc(h.dependencia)}</p></div>
          <div class="box" style="margin-top:10px"><h5>Entregable</h5><p>${esc(h.entregable)}</p></div>
          ${h.nota ? `<div class="box" style="margin-top:10px"><h5>Nota</h5><p>${esc(h.nota)}</p></div>` : ''}
          <div class="mact"><button class="btn primary" data-close>Cerrar</button></div>`);
      };
      $$('.gantt .bar', root).forEach(el => { el.addEventListener('click', () => open(el)); el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(el); } }); });
    }
  };

  /* ═════════════════════════ EVIDENCIAS ═════════════════════════ */
  const EV = { q: '', dep: '', tipo: '' };
  V.evidencias = {
    lista() {
      const q = norm(EV.q);
      return S.st.evidencias.filter(e => e.activa !== false && S.acc.has(e.codigo) && (!EV.dep || e.dependencia === EV.dep || (EV.dep === 'Coordinación MIPG' && e.dependencia === EV.dep)) && (!EV.tipo || e.tipo === EV.tipo) &&
        (!q || norm([e.codigo, e.descripcion, e.url, e.autor].join(' ')).includes(q))).sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
    },
    html() {
      const all = S.st.evidencias.filter(e => e.activa !== false);
      const porTipo = S.TIPOS.map(t => [t, all.filter(e => e.tipo === t).length]).filter(x => x[1]);
      const cubiertas = new Set(all.map(e => e.codigo)).size;
      const deps = S.DEPS.map(d => d.n).concat(['Coordinación MIPG']);
      return `<div class="view">
      <div class="section-title"><div><h2>Enlaces de evidencia</h2><p>Registro consolidado. Cada enlace apunta al soporte real; aquí no se almacenan archivos.</p></div>
        <div class="cta" style="margin:0"><button class="btn" id="ev-csv" type="button">${icon('i-download')} Exportar CSV</button></div></div>
      <div class="kpis" style="margin-top:0">
        <div class="kpi k-brand"><div class="ic">${icon('i-link')}</div><b data-count="${all.length}">${all.length}</b><span>Enlaces activos</span><small>${porTipo.map(x => `${x[0]}: ${x[1]}`).join(' · ') || 'ninguno todavía'}</small></div>
        <div class="kpi k-ok"><div class="ic">${icon('i-check')}</div><b data-count="${cubiertas}">${cubiertas}</b><span>Acciones con evidencia</span><small>de ${D.acciones.length} (${pc(cubiertas / D.acciones.length)} %)</small></div>
      </div>
      <div class="filters" style="position:static;margin-top:18px"><div class="frow">
        <label class="search">${icon('i-search')}<span class="sr">Buscar</span><input id="ev-q" type="search" placeholder="Código, descripción, enlace o autor…" value="${esc(EV.q)}"></label>
        <select class="sel" id="ev-dep" aria-label="Dependencia"><option value="">Todas las dependencias</option>${deps.map(d => `<option ${EV.dep === d ? 'selected' : ''}>${esc(d)}</option>`).join('')}</select>
        <select class="sel" id="ev-tipo" aria-label="Tipo"><option value="">Todos los tipos</option>${S.TIPOS.map(t => `<option ${EV.tipo === t ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select>
      </div></div>
      <div id="ev-tabla"></div></div>`;
    },
    mount(root) {
      const box = $('#ev-tabla', root), self = this;
      const draw = () => {
        const l = self.lista();
        box.innerHTML = l.length ? `<div class="tablewrap"><table><thead><tr><th>Fecha</th><th>Acción</th><th>Evidencia</th><th>Tipo</th><th>Registró</th><th></th></tr></thead><tbody>${l.map(e => {
          const a = S.acc.get(e.codigo), ed = S.puedeEditar(a);
          return `<tr><td style="white-space:nowrap">${new Date(e.fecha).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
            <td><a class="mono" href="#/checklist?open=${e.codigo}&q=&dep=&dim=&pol=&prio=&f=todas">${e.codigo}</a><br><small style="color:var(--ink-3)">${esc(trunc(S.polNombre(a.politica), 40))}</small></td>
            <td><b>${esc(e.descripcion)}</b><br><a href="${esc(e.url)}" target="_blank" rel="noopener noreferrer">${esc(trunc(e.url, 70))}</a></td>
            <td><span class="tag">${esc(e.tipo)}</span></td><td>${esc(e.autor)}<br><small style="color:var(--ink-3)">${esc(e.dependencia)}</small></td>
            <td>${ed ? `<button class="icon-btn" style="width:32px;height:32px" data-del="${esc(e.id)}" aria-label="Retirar">${icon('i-trash')}</button>` : ''}</td></tr>`;
        }).join('')}</tbody></table></div>` : `<div class="card empty"><img src="assets/img/empty.svg" alt="" width="220" height="140"><b>Aún no hay enlaces</b>Abre una acción en el checklist y usa «Registrar enlace de evidencia».<div class="cta" style="justify-content:center"><a class="btn primary" href="#/checklist">${icon('i-list')} Ir al checklist</a></div></div>`;
        U.animar(box);
      };
      self.draw = draw;
      let t; $('#ev-q', root).addEventListener('input', e => { clearTimeout(t); t = setTimeout(() => { EV.q = e.target.value; draw(); }, 160); });
      $('#ev-dep', root).addEventListener('change', e => { EV.dep = e.target.value; draw(); });
      $('#ev-tipo', root).addEventListener('change', e => { EV.tipo = e.target.value; draw(); });
      box.addEventListener('click', e => { const b = e.target.closest('[data-del]'); if (b) S.app.confirmaRetirar(b.dataset.del); });
      $('#ev-csv', root).addEventListener('click', () => {
        const filas = [['fecha', 'codigo', 'politica', 'dependencia_lider', 'enlace', 'tipo', 'descripcion', 'registro_por', 'dependencia_registro']];
        self.lista().forEach(e => { const a = S.acc.get(e.codigo); filas.push([e.fecha, e.codigo, S.polNombre(a.politica), a.dependencia, e.url, e.tipo, e.descripcion, e.autor, e.dependencia]); });
        U.descargar(`evidencias-mipg-${S.hoy()}.csv`, U.csv(filas));
        U.toast('CSV exportado', 'ok');
      });
      U.animar(root); draw();
    }
  };

  /* ═════════════════════════ AYUDA ═════════════════════════ */
  V.ayuda = {
    html() {
      const m = D.meta, modo = S.modo();
      const step = (n, ic, t, p) => `<div class="card rv"><div class="kpi k-brand" style="box-shadow:none;border:0;padding:0;background:none"><div class="ic">${icon(ic)}</div></div><h3>${n}. ${t}</h3><p style="color:var(--ink-2)">${p}</p></div>`;
      const modoTxt = { local: 'Solo este navegador (modo local)', appsscript: 'Google Sheet vía Apps Script', form: 'Google Form + hoja publicada' }[modo];
      return `<div class="view">
      <div class="section-title"><div><h2>Cómo funciona</h2><p>Tres pasos por acción. Todo lo demás se calcula.</p></div></div>
      <div class="grid g3">
        ${step(1, 'i-user', 'Identifícate', 'Elige tu dependencia arriba a la derecha. Solo puedes marcar y registrar en las acciones de tu dependencia; las demás las ves en lectura.')}
        ${step(2, 'i-list', 'Marca el checklist', 'Cada pregunta trae las opciones que aún no están acreditadas. Marca las que ya cumples.')}
        ${step(3, 'i-link', 'Pega el enlace', 'Un enlace https al soporte (Drive, SharePoint, sitio web…) con una frase de qué demuestra. Sin enlace, la acción no se completa.')}
      </div>
      <div class="grid g2" style="margin-top:18px">
        <section class="card rv"><h3>Regla de «acción completa»</h3><p class="sub">Está en el código (core.js, función info)</p>
          <p>Avance = (opciones marcadas + 1 si hay al menos un enlace) ÷ (opciones pendientes + 1).<br>Una acción está <b>completa</b> cuando llega al 100 %. Las acciones condicionadas no cuentan en el indicador general hasta que su pregunta habilitante las active.</p>
          <p class="foot-note">Es una autoevaluación de trabajo: <b>no acredita cumplimiento ni sustituye el reporte FURAG</b>. Las evidencias las valida la Oficina de Control Interno.</p></section>
        <section class="card rv"><h3>Conexión y datos</h3><p class="sub">Dónde se guarda lo que registras</p>
          <p><b>Modo:</b> ${modoTxt}</p>
          <p><b>Pendientes de envío:</b> <span id="ay-cola">${S.st.cola.length}</span> · <b>Última sincronización:</b> ${S.st.ultimoSync ? new Date(S.st.ultimoSync).toLocaleString('es-CO') : '—'}</p>
          <div class="cta"><button class="btn small" id="ay-ping" type="button">${icon('i-refresh')} Probar conexión</button><button class="btn small danger" id="ay-reset" type="button">${icon('i-trash')} Borrar datos de este navegador</button></div>
          <p class="foot-note" id="ay-msg" role="status"></p>
          <p class="foot-note">Este sitio es público: no registres enlaces con datos personales ni reservados. Un enlace de Drive debe estar compartido con quien lo va a revisar.</p></section>
      </div>
      <section class="card rv" style="margin-top:18px"><h3>Origen de los datos</h3><p class="sub">Trazabilidad del simulacro</p>
        <div class="tablewrap" style="box-shadow:none"><table><tbody>
          <tr><th>Corte de datos</th><td>${S.fechaL(m.corte_datos)}</td></tr>
          <tr><th>Plan</th><td>${S.fechaL(m.plan_inicio)} → ${S.fechaL(m.plan_fin)} · ${m.acciones} acciones (${m.condicionadas} condicionadas) · ${m.politicas} políticas</td></tr>
          ${Object.keys(m.fuentes).map(k => `<tr><th>${esc(k.replace(/_/g, ' '))}</th><td>${esc(m.fuentes[k].archivo)}<br><span class="mono" style="color:var(--ink-3);font-size:12px">sha256 ${esc(m.fuentes[k].sha256.slice(0, 16))}…</span></td></tr>`).join('')}
        </tbody></table></div><p class="foot-note">${esc(m.aviso)}</p></section>
      <section class="card rv" style="margin-top:18px"><h3>Preguntas frecuentes</h3>
        ${[['¿Puedo trabajar sin internet?', 'Sí. Lo que marques se guarda en tu navegador y se envía cuando vuelva la conexión (la píldora de arriba muestra cuántos registros esperan).'],
          ['¿Por qué una opción aparece bloqueada?', 'Porque ya estaba acreditada en el reporte oficial FURAG 2025; no hay nada que demostrar de nuevo.'],
          ['¿Qué es una acción condicionada?', 'Una pregunta que solo aplica si otra respuesta la habilita. Se muestran con su pregunta habilitante y no pesan en el indicador general.'],
          ['¿Por qué no veo Hacienda ni Gestión Ambiental?', 'Hacienda no tiene brechas derivables y Gestión Ambiental Institucional es una política nueva sin preguntas en el formulario FURAG 2025: aparecen en el mapa de políticas, punteadas.'],
          ['¿Cómo veo el panel en otra fecha?', 'Agrega <span class="mono">?hoy=2026-11-20</span> a la dirección: las vencidas y próximas se recalculan a esa fecha.']]
          .map(q => `<details style="padding:10px 0;border-top:1px solid var(--line)"><summary style="cursor:pointer;font-weight:700">${q[0]}</summary><p style="color:var(--ink-2);margin-top:6px">${q[1]}</p></details>`).join('')}
      </section></div>`;
    },
    mount(root) {
      U.animar(root);
      const msg = $('#ay-msg', root);
      $('#ay-ping', root).addEventListener('click', async () => { msg.textContent = 'Probando…'; try { msg.textContent = await S.ping(); } catch (e) { msg.textContent = 'No se pudo: ' + e.message; } });
      $('#ay-reset', root).addEventListener('click', () => {
        U.modal(`<h3>¿Borrar los datos de este navegador?</h3><p class="sub">Se elimina lo marcado, los enlaces y la cola de envío guardados aquí. Lo que ya llegó al servidor no se toca.${S.st.cola.length ? ` <b>Hay ${S.st.cola.length} registros sin enviar que se perderían.</b>` : ''}</p>
          <div class="mact"><button class="btn" data-close>Cancelar</button><button class="btn danger" id="ok-reset">Borrar</button></div>`, (b, close) => { $('#ok-reset', b).addEventListener('click', () => { S.resetLocal(); close(); U.toast('Datos locales borrados', 'ok'); }); });
      });
    }
  };
})();
