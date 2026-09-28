/* core.js — datos derivados, estado, persistencia y sincronización.
   Sin dependencias. Expone window.SIM. */
(function () {
  'use strict';
  const D = window.SIMULACRO_DATA;
  if (!D) {
    document.body.innerHTML = '<p style="padding:2rem;font:16px system-ui">No se encontró <code>data/simulacro.data.js</code>. Ejecuta <code>python3 tools/build_data.py</code>.</p>';
    return;
  }
  const CFG = Object.assign({ backend: 'local', appsScriptUrl: '', token: '', refrescoSegundos: 45, entidad: 'Alcaldía de Gachancipá', form: {} }, window.SIM_CONFIG || {});
  const S = (window.SIM = { D, CFG });

  /* ───────── utilidades ───────── */
  S.$ = (s, r) => (r || document).querySelector(s);
  S.$$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  S.esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  S.icon = (n, cls) => `<svg class="i ${cls || ''}" aria-hidden="true"><use href="#${n}"/></svg>`;
  const pad = n => String(n).padStart(2, '0');
  const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const qs = new URLSearchParams(location.search);
  const hp = qs.get('hoy');
  S.hoySimulado = /^\d{4}-\d{2}-\d{2}$/.test(hp || '') ? hp : null; // ?hoy=2026-11-20 para ver el panel en otra fecha
  S.hoy = () => S.hoySimulado || iso(new Date());
  S.d = s => { const p = s.split('-').map(Number); return new Date(p[0], p[1] - 1, p[2]); };
  S.dias = (a, b) => Math.round((S.d(b) - S.d(a)) / 86400000);
  const f1 = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short' });
  const f2 = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });
  S.fecha = s => f1.format(S.d(s)).replace('.', '');
  S.fechaL = s => f2.format(S.d(s));
  S.rango = (a, b) => (a === b ? S.fecha(a) : `${S.fecha(a)} – ${S.fecha(b)}`);
  S.pc = x => Math.round(x * 100);
  S.uid = () => 'E' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  S.plural = (n, a, b) => (n === 1 ? a : b);

  /* ───────── catálogos ───────── */
  S.DIMS = [
    { n: 'Talento Humano', corto: 'Talento Humano', icon: 'd-talento', c: '#E4572E' },
    { n: 'Direccionamiento Estratégico y Planeación', corto: 'Direccionamiento', icon: 'd-direccion', c: '#F08C00' },
    { n: 'Relación Estado-Ciudadanías', corto: 'Estado-Ciudadanías', icon: 'd-ciudadania', c: '#2E7DD1' },
    { n: 'Fortalecimiento Institucional', corto: 'Fortalecimiento', icon: 'd-fortalec', c: '#7C5CE0' },
    { n: 'Gestión del Conocimiento, la Innovación y la Memoria Pública', corto: 'Conocimiento', icon: 'd-conocimiento', c: '#0A8F7A' },
    { n: 'Seguimiento, Evaluación y Control Integral', corto: 'Seguimiento y Control', icon: 'd-seguim', c: '#C2416B' },
    { n: 'Transversal — cruce por validar', corto: 'Transversal', icon: 'd-transversal', c: '#6B7C8C' }
  ];
  S.dim = n => S.DIMS.find(x => x.n === n) || S.DIMS[S.DIMS.length - 1];
  S.DEPS = [
    { n: 'Secretaría de Planeación y Servicios Públicos', corto: 'Planeación', c: '#2E7DD1' },
    { n: 'Secretaría General', corto: 'Secretaría General', c: '#0A8F7A' },
    { n: 'Secretaría de Desarrollo Institucional', corto: 'Desarrollo Institucional', c: '#F08C00' },
    { n: 'Oficina de Control Interno', corto: 'Control Interno', c: '#7C5CE0' }
  ];
  S.COORD = '__coord';
  S.dep = n => S.DEPS.find(x => x.n === n) || { n, corto: n, c: '#6B7C8C' };
  S.PRIO = { 1: 'Crítica', 2: 'Alta', 3: 'Media', 4: 'Baja', 5: 'Condicionada' };
  S.acc = new Map(D.acciones.map(a => [a.id, a]));
  S.pol = new Map(D.politicas.map(p => [p.codigo, p]));
  S.polNombre = c => (c && S.pol.get(c) ? S.pol.get(c).nombre : 'Transversal (cruce por validar)');

  /* ───────── estado persistente ───────── */
  const KEY = 'simulacro-mipg-v1';
  const blank = () => ({ user: { nombre: '', dependencia: '' }, estados: {}, evidencias: [], cola: [], ultimoSync: null, tema: null });
  let st = blank();
  try { const raw = localStorage.getItem(KEY); if (raw) st = Object.assign(blank(), JSON.parse(raw)); } catch (e) { /* almacenamiento bloqueado: se trabaja en memoria */ }
  S.st = st;
  const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) { /* sin persistencia */ } };
  S.persist = persist;

  const listeners = [];
  S.on = fn => listeners.push(fn);
  const emit = (why) => listeners.forEach(fn => { try { fn(why); } catch (e) { console.error(e); } });
  S.emit = emit;

  let evIdx = new Map();
  const reindex = () => {
    evIdx = new Map();
    st.evidencias.forEach(e => { if (e.activa !== false) { if (!evIdx.has(e.codigo)) evIdx.set(e.codigo, []); evIdx.get(e.codigo).push(e); } });
  };
  reindex();
  S.evDe = id => evIdx.get(id) || [];

  S.puedeEditar = a => !!st.user.dependencia && (st.user.dependencia === S.COORD || st.user.dependencia === a.dependencia);

  /* ───────── cálculo por acción ───────── */
  S.info = id => {
    const a = S.acc.get(id);
    const e = st.estados[id] || { ok: [] };
    const pend = [];
    a.opciones.forEach((o, i) => { if (!o[1]) pend.push(i); });
    const ok = new Set(e.ok || []);
    const hechas = pend.filter(i => ok.has(i)).length;
    const evs = S.evDe(id);
    // El enlace de evidencia cuenta como un paso más del checklist: sin él la acción no se completa.
    const pasos = pend.length + 1, hechos = hechas + (evs.length ? 1 : 0);
    const pct = hechos / pasos;
    const lista = hechos === pasos;
    const hoy = S.hoy();
    const dias = S.dias(hoy, a.fin);
    return {
      a, pend, ok, hechas, pasos, hechos, evs, pct, lista,
      estado: lista ? 'lista' : (hechas > 0 || evs.length > 0) ? 'curso' : 'pendiente',
      dias, vencida: !lista && dias < 0, proxima: !lista && dias >= 0 && dias <= 14,
      aunNo: S.dias(hoy, a.inicio) > 0, condicionada: !!a.condicionada_a, actualizado: e.actualizado || null
    };
  };
  S.agg = list => {
    const r = { n: list.length, pct: 0, listas: 0, curso: 0, pendientes: 0, conEv: 0, venc: 0, prox: 0 };
    let sum = 0;
    list.forEach(a => {
      const i = S.info(a.id);
      sum += i.pct;
      if (i.lista) r.listas++; else if (i.estado === 'curso') r.curso++; else r.pendientes++;
      if (i.evs.length) r.conEv++;
      if (i.vencida) r.venc++;
      if (i.proxima) r.prox++;
    });
    r.pct = r.n ? sum / r.n : 0;
    return r;
  };
  S.firmes = () => D.acciones.filter(a => !a.condicionada_a);

  /* ───────── validación de evidencias ───────── */
  S.tipoDeUrl = u => {
    let h = '', p = '';
    try { const x = new URL(u); h = x.hostname.toLowerCase(); p = x.pathname.toLowerCase(); } catch (e) { return 'Otro'; }
    if (/(^|\.)(drive|docs)\.google\.com$/.test(h)) return 'Drive';
    if (/sharepoint\.com$|onedrive\.live\.com$|1drv\.ms$/.test(h)) return 'SharePoint/OneDrive';
    if (/\.pdf$/.test(p)) return 'PDF';
    return 'Sitio web';
  };
  S.TIPOS = ['Drive', 'SharePoint/OneDrive', 'PDF', 'Sitio web', 'Otro'];
  S.validaUrl = raw => {
    const u = String(raw || '').trim();
    if (!u) return { ok: false, error: 'Pega el enlace de la evidencia.' };
    if (u.length > 500) return { ok: false, error: 'El enlace supera 500 caracteres.' };
    let x;
    try { x = new URL(u); } catch (e) { return { ok: false, error: 'No parece un enlace válido. Cópialo completo, con https://' }; }
    if (x.protocol !== 'https:') return { ok: false, error: 'El enlace debe empezar por https://' };
    if (!x.hostname.includes('.')) return { ok: false, error: 'El enlace no tiene un dominio válido.' };
    return { ok: true, url: x.href };
  };

  /* ───────── mutaciones ───────── */
  const nowISO = () => new Date().toISOString();
  const quien = () => ({ dependencia: st.user.dependencia === S.COORD ? 'Coordinación MIPG' : st.user.dependencia, autor: st.user.nombre || '(sin nombre)' });

  S.setOpcion = (id, idx, val) => {
    const a = S.acc.get(id);
    if (!a || !S.puedeEditar(a)) return false;
    const e = st.estados[id] || (st.estados[id] = { ok: [] });
    const set = new Set(e.ok);
    if (val) set.add(idx); else set.delete(idx);
    e.ok = Array.from(set).sort((x, y) => x - y);
    e.actualizado = nowISO();
    const q = quien(); e.autor = q.autor; e.dependencia = q.dependencia;
    encola({ accion: 'estado', codigo: id, ok: e.ok, avance: Math.round(S.info(id).pct * 1000) / 1000, actualizado: e.actualizado, dependencia: q.dependencia, autor: q.autor });
    return true;
  };

  S.addEvidencia = ({ codigo, url, tipo, descripcion }) => {
    const a = S.acc.get(codigo);
    if (!a) return { ok: false, error: 'Acción desconocida.' };
    if (!S.puedeEditar(a)) return { ok: false, error: 'Tu dependencia no puede registrar evidencias en esta acción.' };
    const v = S.validaUrl(url);
    if (!v.ok) return v;
    const d = String(descripcion || '').trim();
    if (d.length < 8) return { ok: false, error: 'Describe brevemente qué demuestra el enlace (mínimo 8 caracteres).' };
    if (d.length > 300) return { ok: false, error: 'La descripción supera 300 caracteres.' };
    if (S.evDe(codigo).some(e => e.url === v.url)) return { ok: false, error: 'Ese enlace ya está registrado en esta acción.' };
    const q = quien();
    const ev = { id: S.uid(), codigo, url: v.url, tipo: S.TIPOS.includes(tipo) ? tipo : S.tipoDeUrl(v.url), descripcion: d, dependencia: q.dependencia, autor: q.autor, fecha: nowISO(), activa: true };
    st.evidencias.push(ev); reindex();
    encola(Object.assign({ accion: 'evidencia' }, ev));
    return { ok: true, ev };
  };

  S.retirarEvidencia = id => {
    const ev = st.evidencias.find(e => e.id === id);
    if (!ev) return false;
    const a = S.acc.get(ev.codigo);
    if (!a || !S.puedeEditar(a)) return false;
    ev.activa = false; reindex();
    encola({ accion: 'retirar', id, codigo: ev.codigo, autor: quien().autor, fecha: nowISO() });
    return true;
  };

  S.setUser = (nombre, dependencia) => { st.user = { nombre: String(nombre || '').trim().slice(0, 60), dependencia }; persist(); emit('user'); };
  S.resetLocal = () => { st = S.st = blank(); reindex(); persist(); emit('reset'); };

  /* ───────── sincronización ───────── */
  const B = {};
  const post = async (body) => {
    const r = await fetch(CFG.appsScriptUrl, { method: 'POST', redirect: 'follow', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(Object.assign({ token: CFG.token }, body)) });
    const j = await r.json();
    if (!j.ok) { const e = new Error(j.error || 'Respuesta no válida del servidor'); e.permanente = !!j.permanente; throw e; }
    return j;
  };
  B.appsscript = {
    push: ev => post(ev),
    load: async () => {
      const u = CFG.appsScriptUrl + (CFG.appsScriptUrl.includes('?') ? '&' : '?') + 'accion=estado&token=' + encodeURIComponent(CFG.token);
      const r = await fetch(u, { redirect: 'follow' });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || 'Respuesta no válida del servidor');
      return j;
    },
    ping: async () => { const j = await B.appsscript.load(); return `Conectado · ${j.evidencias.length} evidencias, ${j.estados.length} acciones con avance en el servidor`; }
  };
  const F = CFG.form || {};
  const csv = t => { // lector CSV mínimo (comillas, saltos de línea dentro de celdas)
    const rows = []; let row = [], c = '', q = false;
    for (let i = 0; i < t.length; i++) {
      const ch = t[i];
      if (q) { if (ch === '"') { if (t[i + 1] === '"') { c += '"'; i++; } else q = false; } else c += ch; }
      else if (ch === '"') q = true;
      else if (ch === ',') { row.push(c); c = ''; }
      else if (ch === '\n') { row.push(c); rows.push(row); row = []; c = ''; }
      else if (ch !== '\r') c += ch;
    }
    if (c.length || row.length) { row.push(c); rows.push(row); }
    return rows;
  };
  B.form = {
    push: async ev => {
      const m = F.campos || {}; const p = new URLSearchParams();
      const put = (k, v) => { if (m[k]) p.set(m[k], v == null ? '' : String(v)); };
      put('tipo', ev.accion); put('codigo', ev.codigo); put('dependencia', ev.dependencia); put('autor', ev.autor);
      put('url', ev.url); put('tipo_enlace', ev.tipo); put('descripcion', ev.descripcion);
      put('opciones_ok', ev.ok ? JSON.stringify(ev.ok) : ''); put('id', ev.id); put('fecha', ev.fecha || ev.actualizado);
      // no-cors: Google Forms no devuelve cabeceras CORS; la respuesta es opaca y se da por enviada.
      await fetch(F.actionUrl, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: p.toString() });
    },
    load: async () => {
      if (!F.csvUrl) return null;
      const r = await fetch(F.csvUrl + (F.csvUrl.includes('?') ? '&' : '?') + 't=' + Date.now());
      const rows = csv(await r.text());
      if (rows.length < 2) return { estados: [], evidencias: [] };
      const h = rows[0].map(x => x.trim().toLowerCase());
      const col = n => h.indexOf(n);
      const g = (r, n) => (col(n) >= 0 ? (r[col(n)] || '').trim() : '');
      const evidencias = [], estados = new Map(), retiradas = new Set();
      rows.slice(1).forEach(r => {
        const tipo = g(r, 'tipo de registro'), cod = g(r, 'código');
        const marca = g(r, 'fecha iso');
        if (tipo === 'evidencia') evidencias.push({ id: g(r, 'id'), codigo: cod, url: g(r, 'enlace'), tipo: g(r, 'tipo de enlace'), descripcion: g(r, 'descripción'), dependencia: g(r, 'dependencia'), autor: g(r, 'autor'), fecha: marca, activa: true });
        else if (tipo === 'retirar') retiradas.add(g(r, 'id'));
        else if (tipo === 'estado') {
          let ok = []; try { ok = JSON.parse(g(r, 'opciones cumplidas') || '[]'); } catch (e) { /* fila mal formada */ }
          const prev = estados.get(cod);
          if (!prev || marca >= prev.actualizado) estados.set(cod, { codigo: cod, ok, dependencia: g(r, 'dependencia'), autor: g(r, 'autor'), actualizado: marca });
        }
      });
      evidencias.forEach(e => { if (retiradas.has(e.id)) e.activa = false; });
      return { estados: Array.from(estados.values()), evidencias };
    },
    ping: async () => {
      if (!F.actionUrl) throw new Error('Falta form.actionUrl en js/config.js');
      const j = await B.form.load();
      return j ? `Lectura correcta · ${j.evidencias.length} evidencias en la hoja publicada` : 'Escritura configurada; sin csvUrl este panel no podrá leer lo de otras dependencias.';
    }
  };
  const be = () => (CFG.backend === 'appsscript' && CFG.appsScriptUrl ? B.appsscript : CFG.backend === 'form' && F.actionUrl ? B.form : null);
  S.modo = () => (be() ? CFG.backend : 'local');
  S.ping = async () => { const b = be(); if (!b) throw new Error('Modo local: no hay servidor configurado (js/config.js).'); return b.ping(); };

  S.sync = { estado: 'local', error: '' };
  const setSync = (e, msg) => { S.sync.estado = e; S.sync.error = msg || ''; emit('sync'); };
  function encola(ev) {
    st.cola.push(ev); persist(); emit('data');
    if (be()) { setSync(navigator.onLine ? 'pend' : 'offline'); S.flush(); }
  }
  let flushing = false;
  S.flush = async () => {
    const b = be();
    if (!b || flushing || !st.cola.length) { if (b && !st.cola.length && S.sync.estado === 'pend') setSync('ok'); return; }
    flushing = true; setSync('sync');
    try {
      while (st.cola.length) {
        try { await b.push(st.cola[0]); }
        catch (e) {
          if (!e.permanente) throw e;
          // El servidor rechazó este registro por su contenido: reintentar no sirve y bloquearía la cola.
          const malo = st.cola.shift(); persist();
          S.rechazados = (S.rechazados || []).concat([{ codigo: malo.codigo, accion: malo.accion, error: e.message }]);
          if (S.ui) S.ui.toast(`El servidor rechazó un registro de ${malo.codigo}: ${e.message}`, 'err');
          continue;
        }
        st.cola.shift(); persist();
      }
      st.ultimoSync = Date.now(); setSync('ok');
    } catch (e) { setSync(navigator.onLine ? 'error' : 'offline', e.message); }
    finally { flushing = false; persist(); }
  };
  S.refresh = async () => {
    const b = be();
    if (!b) return;
    try {
      const r = await b.load();
      if (r) merge(r);
      st.ultimoSync = Date.now(); persist();
      setSync(st.cola.length ? 'pend' : 'ok'); emit('remote');
    } catch (e) { setSync(navigator.onLine ? 'error' : 'offline', e.message); }
  };
  function merge(r) {
    const conCola = new Set(st.cola.filter(x => x.codigo).map(x => x.codigo));
    const porId = new Map(st.evidencias.map(e => [e.id, e]));
    (r.evidencias || []).forEach(e => {
      if (!e.id || !S.acc.has(e.codigo)) return;
      const l = porId.get(e.id);
      if (l) { if (e.activa === false) l.activa = false; else if (!st.cola.some(x => x.accion === 'retirar' && x.id === e.id)) l.activa = true; }
      else st.evidencias.push(Object.assign({}, e));
    });
    (r.estados || []).forEach(e => {
      if (!S.acc.has(e.codigo) || conCola.has(e.codigo)) return;
      const l = st.estados[e.codigo];
      if (!l || String(e.actualizado || '') > String(l.actualizado || '')) st.estados[e.codigo] = { ok: (e.ok || []).filter(Number.isInteger), actualizado: e.actualizado, autor: e.autor, dependencia: e.dependencia };
    });
    reindex();
  }
  S.iniciaSync = () => {
    if (!be()) return;
    setSync(st.cola.length ? 'pend' : 'sync');
    S.refresh().then(() => S.flush());
    setInterval(() => { if (document.visibilityState === 'visible') S.flush().then(S.refresh); }, Math.max(15, CFG.refrescoSegundos) * 1000);
    addEventListener('online', () => S.flush().then(S.refresh));
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') S.flush().then(S.refresh); });
    addEventListener('offline', () => setSync('offline'));
  };

  /* ───────── actividad reciente ───────── */
  S.actividad = (n) => {
    const it = [];
    st.evidencias.filter(e => e.activa !== false).forEach(e => it.push({ t: e.fecha, tipo: 'ev', codigo: e.codigo, autor: e.autor, dep: e.dependencia, txt: e.descripcion }));
    Object.keys(st.estados).forEach(c => { const e = st.estados[c]; if (e.actualizado && e.ok && e.ok.length) it.push({ t: e.actualizado, tipo: 'st', codigo: c, autor: e.autor, dep: e.dependencia, txt: `${e.ok.length} ${S.plural(e.ok.length, 'opción marcada', 'opciones marcadas')}` }); });
    return it.sort((a, b) => String(b.t).localeCompare(String(a.t))).slice(0, n || 8);
  };
})();
