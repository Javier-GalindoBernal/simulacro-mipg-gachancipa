/* Pruebas de la lógica de apps-script/Code.gs con servicios simulados.  Uso: node tests/test-code-gs.js */
'use strict';
const assert = require('assert');
const { crear } = require('./fake-apps-script');
let n = 0, fallos = 0;
const t = (nombre, fn) => { try { fn(); n++; console.log('  ✓', nombre); } catch (e) { fallos++; console.log('  ✗', nombre, '\n     ', e.message); } };

const ISO = '2026-10-05T14:03:22.000Z';
const ev = (o) => Object.assign({ token: 'tok-de-prueba', accion: 'evidencia', id: 'E1abc23xyz', codigo: 'GCI205', url: 'https://drive.google.com/file/d/1/view', tipo: 'Drive', descripcion: 'Resolución 045 de 2026 firmada', dependencia: 'Secretaría General', autor: 'Ana', fecha: ISO }, o || {});
const est = (o) => Object.assign({ token: 'tok-de-prueba', accion: 'estado', codigo: 'GCI205', ok: [0, 2], avance: 0.4, dependencia: 'Secretaría General', autor: 'Ana', actualizado: ISO }, o || {});

console.log('Code.gs');
t('configurar crea las tres hojas y un token si falta', () => {
  const s = crear({ token: null }); s.configurar();
  assert.deepStrictEqual([...s.hojas.keys()].sort(), ['Bitácora', 'Estado', 'Evidencias']);
  assert.ok(s.props.TOKEN && s.props.TOKEN.length === 20);
  assert.strictEqual(s.hojas.get('Evidencias').formato, '@');
});
t('rechaza token inválido en GET y POST (no permanente: se reintenta)', () => {
  const s = crear();
  assert.strictEqual(s.get({ accion: 'estado', token: 'malo' }).ok, false);
  const r = s.post(ev({ token: 'malo' })); assert.strictEqual(r.ok, false); assert.ok(!r.permanente);
});
t('guarda una evidencia válida y la devuelve en GET', () => {
  const s = crear(); assert.strictEqual(s.post(ev()).ok, true);
  const g = s.get({ accion: 'estado', token: 'tok-de-prueba' });
  assert.strictEqual(g.evidencias.length, 1); assert.strictEqual(g.evidencias[0].activa, true);
  assert.strictEqual(g.evidencias[0].url, 'https://drive.google.com/file/d/1/view');
});
t('es idempotente: reenviar el mismo id no duplica', () => {
  const s = crear(); s.post(ev()); const r = s.post(ev()); assert.strictEqual(r.ok, true); assert.strictEqual(r.ignorado, true);
  assert.strictEqual(s.get({ accion: 'estado', token: 'tok-de-prueba' }).evidencias.length, 1);
});
[
  ['http:// (no https)', { url: 'http://x.com/a' }], ['javascript:', { url: 'javascript:alert(1)' }],
  ['url con espacios', { url: 'https://x.com/a b' }], ['url de 501 caracteres', { url: 'https://x.com/' + 'a'.repeat(490) }],
  ['descripción corta', { descripcion: 'corta' }], ['descripción de 301', { descripcion: 'x'.repeat(301) }],
  ['código inválido', { codigo: 'gci205' }], ['tipo inventado', { tipo: 'Dropbox' }], ['id con símbolos', { id: 'a b/c;d' }], ['fecha no ISO', { fecha: '27/09/2026' }]
].forEach(([nombre, o]) => t('rechaza (permanente): ' + nombre, () => {
  const s = crear(); const r = s.post(ev(o)); assert.strictEqual(r.ok, false); assert.strictEqual(r.permanente, true);
  assert.strictEqual(s.get({ accion: 'estado', token: 'tok-de-prueba' }).evidencias.length, 0);
}));
t('una fórmula en la descripción se guarda como texto en hoja de formato «@»', () => {
  const s = crear(); s.post(ev({ descripcion: '=HYPERLINK("http://malo","clic aquí")' }));
  const h = s.hojas.get('Evidencias'); assert.strictEqual(h.formato, '@'); assert.strictEqual(h.filas[1][7], '=HYPERLINK("http://malo","clic aquí")');
});
t('retirar marca activa=false sin borrar; retirar inexistente no bloquea', () => {
  const s = crear(); s.post(ev());
  assert.strictEqual(s.post({ token: 'tok-de-prueba', accion: 'retirar', id: 'E1abc23xyz' }).ok, true);
  const g = s.get({ accion: 'estado', token: 'tok-de-prueba' }); assert.strictEqual(g.evidencias.length, 1); assert.strictEqual(g.evidencias[0].activa, false);
  const r = s.post({ token: 'tok-de-prueba', accion: 'retirar', id: 'noExiste123' }); assert.strictEqual(r.ok, true);
});
t('estado: inserta, actualiza y no pisa con una versión más antigua', () => {
  const s = crear(); s.post(est());
  s.post(est({ ok: [0, 1, 2], avance: 0.6, actualizado: '2026-10-06T10:00:00.000Z' }));
  const r = s.post(est({ ok: [9], avance: 0.1, actualizado: '2026-10-04T10:00:00.000Z' })); assert.strictEqual(r.ignorado, true);
  const g = s.get({ accion: 'estado', token: 'tok-de-prueba' }); assert.strictEqual(g.estados.length, 1);
  assert.deepStrictEqual(g.estados[0].ok, [0, 1, 2]); assert.strictEqual(g.estados[0].avance, 0.6);
});
t('estado: rechaza opciones fuera de rango o no enteras', () => {
  const s = crear();
  assert.strictEqual(s.post(est({ ok: [1.5] })).permanente, true); assert.strictEqual(s.post(est({ ok: [100] })).permanente, true);
  assert.strictEqual(s.post(est({ ok: 'x' })).permanente, true); assert.strictEqual(s.post(est({ ok: new Array(61).fill(1) })).permanente, true);
});
t('cuerpo que no es JSON se rechaza', () => { const s = crear(); assert.strictEqual(s.post('no-json').permanente, true); });
t('acción desconocida se rechaza; GET con acción desconocida también', () => {
  const s = crear(); assert.strictEqual(s.post({ token: 'tok-de-prueba', accion: 'borrar_todo' }).permanente, true);
  assert.strictEqual(s.get({ accion: 'x', token: 'tok-de-prueba' }).ok, false);
});
t('la bitácora registra cada escritura aceptada y ninguna rechazada', () => {
  const s = crear(); s.post(ev()); s.post(est()); s.post(ev({ id: 'otroId12345', url: 'ftp://x' }));
  const b = s.hojas.get('Bitácora').filas; assert.strictEqual(b[0][0], 'recibido'); assert.strictEqual(b.length - 1, 2); // encabezado + 2 aceptadas
});
t('sin TOKEN configurado acepta (modo pruebas)', () => { const s = crear({ token: '' }); assert.strictEqual(s.post(ev({ token: undefined })).ok, true); });

console.log(`\n${n} correctas · ${fallos} fallidas`);
process.exit(fallos ? 1 : 0);
