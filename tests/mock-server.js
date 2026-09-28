/* Servidor de prueba: sirve el sitio y expone /exec con la lógica REAL de Code.gs sobre servicios simulados.
   Uso: node tests/mock-server.js [puerto]   →  abre http://localhost:PUERTO/index.html
   Este servidor entrega su propio js/config.js apuntando a /exec; el sitio publicado no tiene ningún gancho de prueba. */
'use strict';
const http = require('http'), fs = require('fs'), path = require('path');
const { crear } = require('./fake-apps-script');
const raiz = path.join(__dirname, '..');
const puerto = +process.argv[2] || 8766;
const modo = process.argv[3] || 'appsscript'; // 'appsscript' | 'form'
const ENTRY = { tipo: 'entry.101', codigo: 'entry.102', dependencia: 'entry.103', autor: 'entry.104', url: 'entry.105', tipo_enlace: 'entry.106', descripcion: 'entry.107', opciones_ok: 'entry.108', id: 'entry.109', fecha: 'entry.110' };
const filasForm = [];
const csvCel = v => '"' + String(v).replace(/"/g, '""') + '"';
const gas = crear();
const tipos = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.json': 'application/json' };
let peticiones = [];
http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  const cors = { 'Access-Control-Allow-Origin': '*' };
  if (u.pathname === '/exec') {
    if (req.method === 'OPTIONS') { res.writeHead(403, cors); return res.end(); } // Apps Script no atiende preflight: el cliente no debe provocarlo
    const responde = o => { res.writeHead(200, Object.assign({ 'Content-Type': 'application/json' }, cors)); res.end(JSON.stringify(o)); };
    if (req.method === 'GET') { peticiones.push('GET ' + u.searchParams.get('accion')); return responde(gas.get(Object.fromEntries(u.searchParams))); }
    let b = ''; req.on('data', c => (b += c)); req.on('end', () => {
      const ct = req.headers['content-type'] || '';
      if (!/^text\/plain/.test(ct)) { peticiones.push('POST con content-type NO simple: ' + ct); }
      const r = gas.post(b); peticiones.push('POST ' + (JSON.parse(b).accion) + ' → ' + (r.ok ? 'ok' : 'rechazo'));
      responde(r);
    });
    return;
  }
  if (u.pathname === '/_peticiones') { res.writeHead(200, cors); return res.end(JSON.stringify(peticiones)); }
  if (u.pathname === '/_estado') { res.writeHead(200, cors); return res.end(JSON.stringify(gas.get({ accion: 'estado', token: 'tok-de-prueba' }))); }
  if (u.pathname === '/forms/formResponse' && req.method === 'POST') { // imita Google Forms: sin CORS, 200 opaco
    let b = ''; req.on('data', c => (b += c)); req.on('end', () => {
      const p = new URLSearchParams(b); const f = k => p.get(ENTRY[k]) || '';
      filasForm.push(['27/09/2026 20:00:00', f('tipo'), f('codigo'), f('dependencia'), f('autor'), f('url'), f('tipo_enlace'), f('descripcion'), f('opciones_ok'), f('id'), f('fecha')]);
      peticiones.push('FORM ' + f('tipo') + ' ' + f('codigo')); res.writeHead(200); res.end('ok');
    }); return;
  }
  if (u.pathname === '/forms/pub.csv') {
    const cab = ['Marca temporal', 'Tipo de registro', 'Código', 'Dependencia', 'Autor', 'Enlace', 'Tipo de enlace', 'Descripción', 'Opciones cumplidas', 'ID', 'Fecha ISO'];
    res.writeHead(200, Object.assign({ 'Content-Type': 'text/csv; charset=utf-8' }, cors));
    return res.end([cab].concat(filasForm).map(r => r.map(csvCel).join(',')).join('\r\n') + '\r\n');
  }
  if (u.pathname === '/js/config.js' && modo === 'form') {
    res.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'no-store' });
    return res.end(`window.SIM_CONFIG = { backend: 'form', refrescoSegundos: 15, form: { actionUrl: 'http://localhost:${puerto}/forms/formResponse', csvUrl: 'http://localhost:${puerto}/forms/pub.csv', campos: ${JSON.stringify(ENTRY)} } };`);
  }
  if (u.pathname === '/js/config.js') {
    res.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'no-store' });
    return res.end(`window.SIM_CONFIG = { backend: 'appsscript', appsScriptUrl: 'http://localhost:${puerto}/exec', token: 'tok-de-prueba', refrescoSegundos: 15 };`);
  }
  let f = path.join(raiz, u.pathname === '/' ? 'index.html' : decodeURIComponent(u.pathname));
  if (!f.startsWith(raiz) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('no encontrado'); }
  res.writeHead(200, { 'Content-Type': tipos[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); fs.createReadStream(f).pipe(res);
}).listen(puerto, () => console.log(`Mock listo: http://localhost:${puerto}/index.html   (token: tok-de-prueba)`));
