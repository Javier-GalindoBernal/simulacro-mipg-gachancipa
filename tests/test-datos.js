/* Invariantes de data/simulacro.data.js. Uso: node tests/test-datos.js */
'use strict';
const fs = require('fs'), path = require('path'), assert = require('assert');
const raiz = path.join(__dirname, '..');
global.window = {}; new Function('window', fs.readFileSync(path.join(raiz, 'data', 'simulacro.data.js'), 'utf8'))(global.window);
const D = global.window.SIMULACRO_DATA;
const json = JSON.parse(fs.readFileSync(path.join(raiz, 'data', 'simulacro.json'), 'utf8'));
let n = 0, fallos = 0;
const t = (nombre, fn) => { try { fn(); n++; console.log('  ✓', nombre); } catch (e) { fallos++; console.log('  ✗', nombre, '\n     ', e.message); } };
const iso = /^\d{4}-\d{2}-\d{2}$/;

console.log('Datos');
t('data.js y data.json son idénticos', () => assert.deepStrictEqual(D, json));
t('meta coincide con el contenido', () => {
  assert.strictEqual(D.meta.acciones, D.acciones.length);
  assert.strictEqual(D.meta.condicionadas, D.acciones.filter(a => a.condicionada_a).length);
  assert.strictEqual(D.meta.politicas, D.politicas.length);
});
t('códigos únicos y con formato válido (3 letras + 2-3 dígitos)', () => {
  const ids = D.acciones.map(a => a.id); assert.strictEqual(new Set(ids).size, ids.length);
  ids.forEach(i => assert.ok(/^[A-Z]{3}\d{2,3}$/.test(i), i));
});
t('fechas válidas, ordenadas y dentro del plan', () => D.acciones.forEach(a => {
  assert.ok(iso.test(a.inicio) && iso.test(a.fin), a.id); assert.ok(a.inicio <= a.fin, a.id);
  assert.ok(a.inicio >= D.meta.plan_inicio && a.fin <= D.meta.plan_fin, a.id + ' fuera del plan');
}));
t('toda acción tiene checklist y al menos una opción pendiente por demostrar', () => D.acciones.forEach(a => {
  assert.ok(a.opciones.length > 0, a.id); assert.ok(a.opciones.some(o => o[1] === 0), a.id + ' sin pendientes');
}));
t('prioridad 1-5 y la 5 es exactamente la condicionada', () => D.acciones.forEach(a => {
  assert.ok([1, 2, 3, 4, 5].includes(a.prioridad), a.id); assert.strictEqual(a.prioridad === 5, !!a.condicionada_a, a.id);
}));
t('las condicionadas citan una pregunta habilitante con código válido', () => {
  D.acciones.filter(a => a.condicionada_a).forEach(a => assert.ok(/^[A-Z]{3}\d{2,3}$/.test(a.condicionada_a), a.id));
  // Informativo: la pregunta habilitante puede no estar en el plan (sin brecha). La interfaz lo indica.
  const ids = new Set(D.acciones.map(a => a.id)); const fuera = D.acciones.filter(a => a.condicionada_a && !ids.has(a.condicionada_a)).length;
  console.log('     (info) condicionadas cuya habilitante no está en el plan: ' + fuera + ' de ' + D.meta.condicionadas);
});
t('cada acción con política referencia una política existente; las sin política son transversales', () => {
  const pols = new Set(D.politicas.map(p => p.codigo));
  D.acciones.forEach(a => { if (a.politica) assert.ok(pols.has(a.politica), a.id); else assert.ok(/Transversal/.test(a.dimension), a.id + ' sin política y no transversal'); });
});
t('el conteo por política coincide con las acciones', () => D.politicas.forEach(p => assert.strictEqual(D.acciones.filter(a => a.politica === p.codigo).length, p.acciones, p.codigo)));
t('cuatro dependencias líderes con acciones', () => assert.strictEqual(new Set(D.acciones.map(a => a.dependencia)).size, 4));
t('hitos con fechas válidas', () => D.hitos.forEach(h => { assert.ok(iso.test(h.inicio) && iso.test(h.fin) && h.inicio <= h.fin, h.id); }));
t('los textos no traen marcado HTML (se escapan al pintar, pero no deben venir sucios)', () => D.acciones.forEach(a => ['pregunta', 'accion', 'entregable', 'evidencia', 'situacion'].forEach(k => assert.ok(!/<[a-z!\/]/i.test(a[k] || ''), a.id + '.' + k))));
console.log(`\n${n} correctas · ${fallos} fallidas`); process.exit(fallos ? 1 : 0);
